// ============================================================
// Supabase Edge Function: send-invite
//
// Called by the frontend when an invitation is created.
// Uses Supabase's built-in auth email system to send the
// invitation email with a magic link.
//
// The invite token is passed as user metadata so the
// handle_new_user trigger can process it on signup.
//
// No third-party API keys required — Supabase handles email
// delivery via its built-in service or your configured SMTP.
//
// Secrets needed (set automatically by Supabase):
//   SUPABASE_URL              — already available
//   SUPABASE_SERVICE_ROLE_KEY — already available
//
// Optional:
//   APP_URL  — your frontend URL (default: http://localhost:5173)
//
// Deploy:
//   supabase functions deploy send-invite --no-verify-jwt
// ============================================================

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';

serve(async (req) => {
  try {
    const { invitation_id } = await req.json();
    if (!invitation_id) {
      return new Response(JSON.stringify({ error: 'invitation_id is required' }), { status: 400 });
    }

    // Create Supabase client with service role to bypass RLS
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false } }
    );

    // Fetch the invitation
    const { data: invitation, error: invError } = await supabaseAdmin
      .from('invitations')
      .select('*')
      .eq('id', invitation_id)
      .single();

    if (invError || !invitation) {
      return new Response(JSON.stringify({ error: 'Invitation not found' }), { status: 404 });
    }

    const appUrl = Deno.env.get('APP_URL') || 'http://localhost:5173';

    // Use Supabase's built-in auth email to send the invitation
    // The invite_token is passed as user metadata so the
    // handle_new_user trigger can process it on signup
    const { error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
      invitation.email,
      {
        data: { invite_token: invitation.token },
        redirectTo: appUrl,
      }
    );

    if (inviteError) {
      console.error('Invite email error:', inviteError);
      return new Response(JSON.stringify({
        emailSent: false,
        link: `${appUrl}/?invite=${invitation.token}`,
        error: inviteError.message,
      }), { status: 200 });
    }

    return new Response(JSON.stringify({ emailSent: true }), { status: 200 });

  } catch (err) {
    console.error('Unexpected error:', err);
    return new Response(JSON.stringify({ error: 'Internal error' }), { status: 500 });
  }
});
