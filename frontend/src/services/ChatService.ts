import { supabase } from '../api/supabaseClient';

export interface Message {
  id: string;
  project_id: string | null;
  sender_id: string;
  content: string;
  created_at: string;
}

export const ChatService = {
  async getMessages(projectId: string | null) {
    let query = supabase
      .from('messages')
      .select('*')
      .order('created_at', { ascending: true });

    if (projectId === null) {
      query = query.is('project_id', null);
    } else {
      query = query.eq('project_id', projectId);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data as Message[];
  },

  async sendMessage(projectId: string | null, content: string) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('No user logged in');

    // Get the organization_id from the profiles table
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) throw new Error('Profile not found');

    const { error } = await supabase
      .from('messages')
      .insert([{ 
        project_id: projectId,
        content, 
        sender_id: user.id,
        organization_id: profile.organization_id 
      }]);
    if (error) throw error;
  }
};
