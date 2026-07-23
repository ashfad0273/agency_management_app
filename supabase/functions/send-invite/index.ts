// Supabase Edge Function: Send Invite Email
// Deploy: npx supabase functions deploy send-invite
// Secrets: npx supabase secrets set RESEND_API_KEY=your_key
//          npx supabase secrets set RESEND_FROM_EMAIL=invitations@yourdomain.com

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

interface InviteRequest {
  invitation_id: string;
}

serve(async (req) => {
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Content-Type': 'application/json',
  };

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers });
  }

  try {
    const { invitation_id }: InviteRequest = await req.json();

    if (!invitation_id) {
      return new Response(JSON.stringify({ error: 'invitation_id is required' }), {
        status: 400,
        headers,
      });
    }

    // Initialize Supabase client with service role (admin access)
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch the invitation
    const { data: invitation, error: fetchError } = await supabase
      .from('invitations')
      .select('*, organizations:organization_id(name)')
      .eq('id', invitation_id)
      .single();

    if (fetchError || !invitation) {
      return new Response(JSON.stringify({ error: 'Invitation not found' }), {
        status: 404,
        headers,
      });
    }

    if (invitation.status !== 'pending') {
      return new Response(JSON.stringify({ error: 'Invitation is no longer pending' }), {
        status: 400,
        headers,
      });
    }

    // Build the invite link
    const appUrl = Deno.env.get('APP_URL') || 'http://localhost:5173';
    const inviteLink = `${appUrl}/?invite=${invitation.token}`;

    // Send email via Resend
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    const resendFromEmail = Deno.env.get('RESEND_FROM_EMAIL') || 'invitations@yourdomain.com';

    if (!resendApiKey) {
      // If Resend is not configured, just log the link and return it
      console.log('RESEND_API_KEY not set. Invite link:', inviteLink);
      return new Response(
        JSON.stringify({
          message: 'Email not sent (Resend not configured)',
          invite_link: inviteLink,
          invitation,
        }),
        { status: 200, headers }
      );
    }

    const emailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: resendFromEmail,
        to: invitation.email,
        subject: `You're invited to join ${invitation.organizations?.name || 'an organization'}!`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
            <h2>You're Invited!</h2>
            <p>You have been invited to join <strong>${invitation.organizations?.name || 'an organization'}</strong>.</p>
            <p>Click the button below to create your account and get started:</p>
            <a href="${inviteLink}" 
               style="display: inline-block; padding: 12px 24px; background: #4a90d9; color: white; 
                      text-decoration: none; border-radius: 4px; font-weight: bold; margin: 16px 0;">
              Accept Invitation
            </a>
            <p style="color: #888; font-size: 0.9em;">
              Or copy this link into your browser:<br/>
              <a href="${inviteLink}">${inviteLink}</a>
            </p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
            <p style="color: #aaa; font-size: 0.8em;">
              This invitation expires in 7 days. If you didn't expect this invitation, you can ignore this email.
            </p>
          </div>
        `,
      }),
    });

    const emailResult = await emailResponse.json();

    if (!emailResponse.ok) {
      console.error('Resend error:', emailResult);
      return new Response(JSON.stringify({ error: 'Failed to send email', details: emailResult }), {
        status: 500,
        headers,
      });
    }

    // Update invitation status to 'sent'
    await supabase
      .from('invitations')
      .update({ status: 'sent' })
      .eq('id', invitation_id);

    return new Response(
      JSON.stringify({
        message: 'Invitation email sent successfully',
        id: emailResult.id,
      }),
      { status: 200, headers }
    );
  } catch (err) {
    console.error('Unexpected error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers,
    });
  }
});