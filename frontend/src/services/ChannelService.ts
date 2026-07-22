import { supabase } from '../api/supabaseClient';

export interface Channel {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  created_by: string | null;
  is_private: boolean;
  created_at: string;
}

export interface ChannelWithMembership extends Channel {
  is_member: boolean;
}

export const ChannelService = {
  /** Get all channels the user can see (public channels + private channels they're a member of) */
  async getChannels(): Promise<Channel[]> {
    const { data, error } = await supabase
      .from('channels')
      .select('*')
      .order('name', { ascending: true });

    if (error) throw error;
    return data as Channel[];
  },

  /** Get channels with membership status for the current user */
  async getChannelsWithMembership(): Promise<ChannelWithMembership[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const channels = await this.getChannels();

    // Get the channels the user is a member of
    const { data: memberships } = await supabase
      .from('channel_members')
      .select('channel_id')
      .eq('user_id', user.id);

    const memberChannelIds = new Set(memberships?.map(m => m.channel_id) ?? []);

    return channels.map(c => ({
      ...c,
      is_member: memberChannelIds.has(c.id),
    }));
  },

  /** Create a new channel and auto-join the creator */
  async createChannel(name: string, description: string, isPrivate: boolean = false): Promise<Channel> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('No user logged in');

    const { data: profile } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('id', user.id)
      .single();

    if (!profile) throw new Error('Profile not found');

    // Create the channel
    const { data: channel, error: channelError } = await supabase
      .from('channels')
      .insert([{
        organization_id: profile.organization_id,
        name,
        description: description || null,
        created_by: user.id,
        is_private: isPrivate,
      }])
      .select()
      .single();

    if (channelError) throw channelError;

    // Auto-join the creator
    await this.addMember(channel.id, user.id, 'admin');

    return channel as Channel;
  },

  /** Add a user as a member of a channel */
  async addMember(channelId: string, userId: string, role: string = 'member') {
    const { data: profile } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('id', userId)
      .single();

    if (!profile) throw new Error('Profile not found');

    const { error } = await supabase
      .from('channel_members')
      .insert([{
        channel_id: channelId,
        user_id: userId,
        organization_id: profile.organization_id,
        role,
      }]);

    if (error) throw error;
  },

  /** Remove a user from a channel */
  async removeMember(channelId: string, userId: string) {
    const { error } = await supabase
      .from('channel_members')
      .delete()
      .eq('channel_id', channelId)
      .eq('user_id', userId);

    if (error) throw error;
  },

  /** Check if the current user is a member of a channel */
  async isMember(channelId: string): Promise<boolean> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    const { data } = await supabase
      .from('channel_members')
      .select('id')
      .eq('channel_id', channelId)
      .eq('user_id', user.id)
      .maybeSingle();

    return !!data;
  },

  /** Get members of a channel */
  async getMembers(channelId: string) {
    const { data, error } = await supabase
      .from('channel_members')
      .select('*, profiles(email)')
      .eq('channel_id', channelId);

    if (error) throw error;
    return data;
  },

  /** Auto-join the current user to a public channel */
  async joinChannel(channelId: string) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('No user logged in');

    const alreadyMember = await this.isMember(channelId);
    if (alreadyMember) return;

    const { data: profile } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('id', user.id)
      .single();

    if (!profile) throw new Error('Profile not found');

    const { error } = await supabase
      .from('channel_members')
      .insert([{
        channel_id: channelId,
        user_id: user.id,
        organization_id: profile.organization_id,
      }]);

    if (error) throw error;
  },
};