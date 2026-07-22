import { supabase } from '../api/supabaseClient';
import { ProjectMemberService } from './ProjectMemberService';

export interface Project {
  id: string;
  name: string;
  description: string | null;
  organization_id: string;
}

export const ProjectService = {
  // Create a new project
  async createProject(name: string, description: string) {
    // Get current user's profile to know their organization_id
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('No user logged in');

    const { data: profile } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('id', user.id)
      .single();

    if (!profile) throw new Error('Profile not found');

    // Insert with the organization_id explicitly included
    const { data, error } = await supabase
      .from('projects')
      .insert([{
        name,
        description,
        organization_id: profile.organization_id
      }])
      .select()
      .single();

    if (error) throw error;

    // Auto-add the creator as a project member
    await ProjectMemberService.addMember(data.id, user.id, 'owner');

    return data as Project;
  },

  // Get projects (RLS handles the filtering automatically)
  async getProjects() {
    const { data, error } = await supabase
      .from('projects')
      .select('*');

    if (error) throw error;
    return data as Project[];
  },

  // Update a project
  async updateProject(id: string, fields: { name?: string; description?: string }) {
    const { data, error } = await supabase
      .from('projects')
      .update(fields)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data as Project;
  },

  // Delete a project
  async deleteProject(id: string) {
    const { error } = await supabase
      .from('projects')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }
};