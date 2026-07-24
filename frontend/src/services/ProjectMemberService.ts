import { supabase } from '../api/supabaseClient';

export interface ProjectMember {
  id: string;
  project_id: string;
  user_id: string;
  organization_id: string;
  role: string;
  joined_at: string;
}

export interface ProjectWithMembership extends ProjectMember {
  project_name: string;
  project_description: string | null;
}

// Re-export the Project type for convenience
export interface Project {
  id: string;
  name: string;
  description: string | null;
  organization_id: string;
}

export const ProjectMemberService = {
  /** Get all projects the current user is a member of (for chat sidebar) */
  async getUserProjects(): Promise<Project[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('No user logged in');

    // Join project_members with projects to get project details
    const { data, error } = await supabase
      .from('project_members')
      .select('project_id, projects!inner(id, name, description, organization_id)')
      .eq('user_id', user.id);

    if (error) throw error;
    if (!data) return [];

    // Extract the nested project data
    return data.map((item: { projects: Project }) => item.projects);
  },

  /** Check if the current user is a member of a specific project */
  async isMember(projectId: string): Promise<boolean> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    const { data, error } = await supabase
      .from('project_members')
      .select('id')
      .eq('project_id', projectId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) return false;
    return !!data;
  },

  /** Add a user as a member of a project */
  async addMember(projectId: string, userId: string, role: string = 'member') {
    // Get the organization_id from the user's profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('id', userId)
      .single();

    if (!profile) throw new Error('Profile not found');

    const { error } = await supabase
      .from('project_members')
      .insert([{
        project_id: projectId,
        user_id: userId,
        organization_id: profile.organization_id,
        role,
      }]);

    if (error) throw error;
  },

  /** Remove a user from a project */
  async removeMember(projectId: string, userId: string) {
    const { error } = await supabase
      .from('project_members')
      .delete()
      .eq('project_id', projectId)
      .eq('user_id', userId);

    if (error) throw error;
  },

  /** Get all members of a project */
  async getMembers(projectId: string): Promise<ProjectMember[]> {
    const { data, error } = await supabase
      .from('project_members')
      .select('*, profiles(email)')
      .eq('project_id', projectId);

    if (error) throw error;
    return data as ProjectMember[];
  },
};