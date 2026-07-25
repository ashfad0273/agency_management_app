import { supabase } from '../api/supabaseClient';

export interface Invitation {
  id: string;
  organization_id: string;
  organization_name: string;
  email: string;
  token: string;
  invited_by: string | null;
  role: string;
  status: string;
  created_at: string;
  expires_at: string;
}

export const InviteService = {
  /** Create a pending invitation and send a magic link email via Supabase Auth */
  async createInvitation(email: string, role: string = 'employee'): Promise<{ invitation: Invitation; link: string; emailSent: boolean }> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('No user logged in');

    const { data: profile } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('id', user.id)
      .single();

    if (!profile) throw new Error('Profile not found');

    const { data: org } = await supabase
      .from('organizations')
      .select('name')
      .eq('id', profile.organization_id)
      .single();

    if (!org) throw new Error('Organization not found');

    // Create the invitation record
    const { data, error } = await supabase
      .from('invitations')
      .insert([{
        email: email.trim().toLowerCase(),
        organization_id: profile.organization_id,
        organization_name: org.name,
        invited_by: user.id,
        role,
      }])
      .select()
      .single();

    if (error) throw error;

    const invitation = data as Invitation;
    const redirectTo = `${window.location.origin}/?invite=${invitation.token}`;

    // Send a magic link email via Supabase Auth.
    // For new users: shouldCreateUser creates the auth user, handle_new_user fires,
    //   processes the invite_token from metadata, accepts the invitation.
    // For existing users: magic link signs them in, processInviteToken in App.tsx
    //   picks up the pending invitation by email and accepts it.
    let emailSent = false;
    try {
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email: email.trim().toLowerCase(),
        options: {
          shouldCreateUser: true,
          emailRedirectTo: redirectTo,
          data: {
            invite_token: invitation.token,
          },
        },
      });
      if (otpError) throw otpError;
      emailSent = true;
    } catch (err) {
      console.error('Failed to send invitation email:', err);
      // Email send failed, but the invitation record was created.
      // Admin can still share the invite link manually.
    }

    return { invitation, link: redirectTo, emailSent };
  },

  /** Get all invitations for the current user's org */
  async getAllInvitations(): Promise<Invitation[]> {
    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    if (userErr || !user) throw new Error(userErr?.message || 'No user logged in');

    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('id', user.id)
      .single();

    if (profileErr || !profile) {
      throw new Error(profileErr?.message || 'Profile not found');
    }

    const { data, error } = await supabase
      .from('invitations')
      .select('*')
      .eq('organization_id', profile.organization_id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data as Invitation[];
  },

  /** Get all pending invitations for the current user's org */
  async getPendingInvitations(): Promise<Invitation[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('No user logged in');

    const { data: profile } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('id', user.id)
      .single();

    if (!profile) throw new Error('Profile not found');

    const { data, error } = await supabase
      .from('invitations')
      .select('*')
      .eq('organization_id', profile.organization_id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data as Invitation[];
  },

  /** Cancel a pending invitation */
  async cancelInvitation(id: string): Promise<void> {
    const { error } = await supabase
      .from('invitations')
      .update({ status: 'cancelled' })
      .eq('id', id);

    if (error) throw error;
  },
};
