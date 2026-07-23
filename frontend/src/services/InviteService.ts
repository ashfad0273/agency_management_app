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
  /** Create a pending invitation, attempt to send an email, and return the shareable link */
  async createInvitation(email: string): Promise<{ invitation: Invitation; link: string; emailSent: boolean }> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('No user logged in');

    const { data: profile } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('id', user.id)
      .single();

    if (!profile) throw new Error('Profile not found');

    // Get the organization name
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
      }])
      .select()
      .single();

    if (error) throw error;

    const invitation = data as Invitation;
    const link = `${window.location.origin}/?invite=${invitation.token}`;

    // Attempt to send the invite email via Edge Function
    let emailSent = false;
    try {
      const { error: fnError } = await supabase.functions.invoke('send-invite', {
        body: { invitation_id: invitation.id },
      });
      if (!fnError) {
        emailSent = true;
      } else {
        console.warn('Edge function not available, invite link shown instead:', fnError);
      }
    } catch (fnError) {
      console.warn('Could not send invite email (Edge Function not deployed):', fnError);
    }

    return { invitation, link, emailSent };
  },

  /** Get all pending invitations for the current user's org */
  async getPendingInvitations(): Promise<Invitation[]> {
    const { data, error } = await supabase
      .from('invitations')
      .select('*')
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