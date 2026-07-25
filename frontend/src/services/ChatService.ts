import { supabase } from '../api/supabaseClient';

export interface Message {
  id: string;
  organization_id: string;
  project_id: string | null;
  channel_id: string | null;
  conversation_id: string | null;
  sender_id: string;
  content: string;
  created_at: string;
  profiles?: { email: string | null } | null;
}

interface MessageInsert {
  content: string;
  sender_id: string;
  organization_id: string;
  conversation_id?: string | null;
  channel_id?: string | null;
  project_id?: string | null;
}

export interface UnreadCount {
  project_id: string | null;
  count: number;
}

export const ChatService = {
  /** Get messages for a project, channel, or conversation scope */
  async getMessages(
    projectId?: string | null,
    channelId?: string | null,
    conversationId?: string | null,
  ) {
    let query = supabase
      .from('messages')
      .select('*, profiles:sender_id(email)')
      .order('created_at', { ascending: true });

    if (conversationId) {
      query = query.eq('conversation_id', conversationId);
    } else if (channelId) {
      query = query.eq('channel_id', channelId);
    } else if (projectId === null) {
      query = query.is('project_id', null).is('channel_id', null).is('conversation_id', null);
    } else if (projectId) {
      query = query.eq('project_id', projectId);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data as Message[];
  },

  /** Send a message to a project, channel, or conversation scope */
  async sendMessage(
    projectId: string | null | undefined,
    content: string,
    channelId?: string | null,
    conversationId?: string | null,
  ) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('No user logged in');

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) throw new Error('Profile not found');

    const message: MessageInsert = {
      content,
      sender_id: user.id,
      organization_id: profile.organization_id,
    };

    if (conversationId) {
      message.conversation_id = conversationId;
      message.project_id = null;
    } else if (channelId) {
      message.channel_id = channelId;
      message.project_id = null;
    } else if (projectId === null) {
      message.project_id = null;
    } else if (projectId) {
      message.project_id = projectId;
    }

    const { error } = await supabase
      .from('messages')
      .insert([message]);
    if (error) throw error;
  },

  // --- Read Receipts (Unread Indicators) ---

  /** Mark a chat scope as read */
  async markAsRead(
    projectId: string | null | undefined,
    channelId?: string | null,
    conversationId?: string | null,
  ) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('id', user.id)
      .single();

    if (!profile) return;

    // Use the atomic upsert function to avoid race conditions
    await supabase.rpc('upsert_message_read', {
      p_user_id: user.id,
      p_organization_id: profile.organization_id,
      p_project_id: projectId ?? null,
      p_channel_id: channelId ?? null,
      p_conversation_id: conversationId ?? null,
    });
  },

  /** Get the number of unread messages for a scope */
  async getUnreadCount(
    projectId: string | null | undefined,
    channelId?: string | null,
    conversationId?: string | null,
  ): Promise<number> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return 0;

    // Get user's last_read_at for this scope
    let readQuery = supabase
      .from('message_reads')
      .select('last_read_at')
      .eq('user_id', user.id);

    if (conversationId) {
      readQuery = readQuery.eq('conversation_id', conversationId);
    } else if (channelId) {
      readQuery = readQuery.eq('channel_id', channelId);
    } else if (projectId === null) {
      readQuery = readQuery.is('project_id', null).is('channel_id', null).is('conversation_id', null);
    } else if (projectId) {
      readQuery = readQuery.eq('project_id', projectId);
    }

    const { data: readData } = await readQuery.maybeSingle();

    // Count messages after last_read_at, excluding own messages
    let countQuery = supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .neq('sender_id', user.id);

    if (conversationId) {
      countQuery = countQuery.eq('conversation_id', conversationId);
    } else if (channelId) {
      countQuery = countQuery.eq('channel_id', channelId);
    } else if (projectId === null) {
      countQuery = countQuery.is('project_id', null).is('channel_id', null).is('conversation_id', null);
    } else if (projectId) {
      countQuery = countQuery.eq('project_id', projectId);
    }

    if (readData) {
      countQuery = countQuery.gt('created_at', readData.last_read_at);
    }

    const { count, error } = await countQuery;
    if (error) throw error;
    return count ?? 0;
  },

  /** Legacy: get all unread counts for projects */
  async getAllUnreadCounts(): Promise<UnreadCount[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data: profile } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('id', user.id)
      .single();

    if (!profile) return [];

    const { data: scopes } = await supabase
      .from('messages')
      .select('project_id')
      .eq('organization_id', profile.organization_id);

    if (!scopes) return [];

    const uniqueProjectIds = [...new Set(scopes.map(s => s.project_id ?? '__global__'))];

    const results = await Promise.all(
      uniqueProjectIds.map(async (scope) => {
        const projectId = scope === '__global__' ? null : scope;
        const count = await this.getUnreadCount(projectId);
        return { project_id: projectId, count };
      })
    );

    return results.filter(r => r.count > 0);
  },

  // --- Sender Display Names ---

  async getSenderDisplayName(userId: string): Promise<string> {
    const { data } = await supabase
      .from('profiles')
      .select('email')
      .eq('id', userId)
      .single();

    if (data?.email) {
      return data.email.split('@')[0];
    }
    return userId.substring(0, 5);
  },
};