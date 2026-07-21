import { supabase } from '../api/supabaseClient';

export interface Task {
  id: string;
  project_id: string;
  organization_id: string;
  title: string;
  status: string;
}

export const TaskService = {
  async getTasks(projectId: string) {
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('project_id', projectId);
    if (error) throw error;
    return data as Task[];
  },

  async createTask(projectId: string, title: string) {
    // Get user's org_id
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('No user logged in');

    const { data: profile } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('id', user.id)
      .single();

    if (!profile) throw new Error('Profile not found');

    const { data, error } = await supabase
      .from('tasks')
      .insert([{ 
        project_id: projectId, 
        title, 
        organization_id: profile.organization_id 
      }])
      .select()
      .single();

    if (error) throw error;
    return data as Task;
  },

  async updateTask(id: string, fields: { title?: string; status?: string }) {
    const { data, error } = await supabase
      .from('tasks')
      .update(fields)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data as Task;
  },

  async deleteTask(id: string) {
    const { error } = await supabase
      .from('tasks')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }
};