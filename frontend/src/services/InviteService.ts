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
    const link = `${window.location.origin}/?invite=${invitation.token}`;

    // Send a magic link email via Supabase's built-in auth email system.
    // This creates the user (if needed) with the invite_token in their metadata.
    // The handle_new_user trigger will then process the invite and add them to the org.
    let emailSent = false;
    try {
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email: invitation.email,
        options: {
          shouldCreateUser: true,
          data: { invite_token: invitation.token },
          emailRedirectTo: window.location.origin,
        },
      });
      if (!otpError) {
        emailSent = true;
      } else {
        console.warn('Failed to send magic link email:', otpError);
      }
    } catch (otpError) {
      console.warn('Could not send magic link email:', otpError);
    }

    return { invitation, link, emailSent };
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
