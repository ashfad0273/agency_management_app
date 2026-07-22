import { supabase } from '../api/supabaseClient';

export interface Conversation {
  id: string;
  organization_id: string;
  created_at: string;
}

export interface ConversationWithUser {
  conversation_id: string;
  other_user_id: string;
  other_user_email: string;
  other_user_display: string;
}

export const ConversationService = {
  /** Get all DM conversations for the current user, with the other participant's info */
  async getConversations(): Promise<ConversationWithUser[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    // Get conversations the user is in
    const { data: myParticipations, error: myError } = await supabase
      .from('conversation_participants')
      .select('conversation_id')
      .eq('user_id', user.id);

    if (myError || !myParticipations || myParticipations.length === 0) return [];

    const conversationIds = myParticipations.map(p => p.conversation_id);

    // Get the other participants for each conversation (with their profile email)
    const { data: otherParticipants, error: otherError } = await supabase
      .from('conversation_participants')
      .select('conversation_id, user_id, profiles!inner(email)')
      .in('conversation_id', conversationIds)
      .neq('user_id', user.id);

    if (otherError || !otherParticipants) return [];

    return otherParticipants.map((p: any) => ({
      conversation_id: p.conversation_id,
      other_user_id: p.user_id,
      other_user_email: p.profiles.email ?? p.user_id,
      other_user_display: p.profiles.email ? p.profiles.email.split('@')[0] : p.user_id.substring(0, 5),
    }));
  },

  /** Find an existing DM conversation with a user, or create a new one */
  async createOrGetConversation(otherUserId: string): Promise<string> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('No user logged in');

    // Get the current user's org
    const { data: profile } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('id', user.id)
      .single();

    if (!profile) throw new Error('Profile not found');

    // Look for an existing 2-person conversation between these users
    // Find conversations where user is a participant
    const { data: userConvos } = await supabase
      .from('conversation_participants')
      .select('conversation_id')
      .eq('user_id', user.id);

    if (userConvos && userConvos.length > 0) {
      const ids = userConvos.map(c => c.conversation_id);

      // Check if any of these conversations also have the other user
      const { data: match } = await supabase
        .from('conversation_participants')
        .select('conversation_id')
        .in('conversation_id', ids)
        .eq('user_id', otherUserId)
        .maybeSingle();

      if (match) return match.conversation_id;
    }

    // No existing conversation — create a new one
    const { data: conversation, error: convoError } = await supabase
      .from('conversations')
      .insert([{ organization_id: profile.organization_id }])
      .select()
      .single();

    if (convoError) throw convoError;

    // Add both participants
    const participants = [
      { conversation_id: conversation.id, user_id: user.id, organization_id: profile.organization_id },
      { conversation_id: conversation.id, user_id: otherUserId, organization_id: profile.organization_id },
    ];

    const { error: partError } = await supabase
      .from('conversation_participants')
      .insert(participants);

    if (partError) throw partError;

    return conversation.id;
  },

  /** Search for users in the same org by email prefix */
  async searchUsers(query: string): Promise<{ id: string; email: string; display: string }[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data: profile } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('id', user.id)
      .single();

    if (!profile) return [];

    const { data, error } = await supabase
      .from('profiles')
      .select('id, email')
      .eq('organization_id', profile.organization_id)
      .neq('id', user.id)
      .ilike('email', `%${query}%`)
      .limit(10);

    if (error || !data) return [];

    return data.map(p => ({
      id: p.id,
      email: p.email ?? p.id,
      display: p.email ? p.email.split('@')[0] : p.id.substring(0, 5),
    }));
  },
};