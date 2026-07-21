import { supabase } from '../api/supabaseClient';

export interface Milestone {
  id: string;
  project_id: string;
  organization_id: string;
  name: string;
  description: string | null;
  due_date: string | null;
  status: string;
  created_at: string;
}

export const MilestoneService = {
  async getMilestones(projectId: string) {
    const { data, error } = await supabase
      .from('milestones')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data as Milestone[];
  },

  async createMilestone(projectId: string, name: string, description: string, dueDate: string) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('No user logged in');

    const { data: profile } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('id', user.id)
      .single();

    if (!profile) throw new Error('Profile not found');

    const { data, error } = await supabase
      .from('milestones')
      .insert([{
        project_id: projectId,
        name,
        description,
        due_date: dueDate || null,
        organization_id: profile.organization_id,
      }])
      .select()
      .single();

    if (error) throw error;
    return data as Milestone;
  },

  async updateMilestone(id: string, fields: { name?: string; description?: string; due_date?: string; status?: string }) {
    const { data, error } = await supabase
      .from('milestones')
      .update(fields)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data as Milestone;
  },

  async deleteMilestone(id: string) {
    const { error } = await supabase
      .from('milestones')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },
};