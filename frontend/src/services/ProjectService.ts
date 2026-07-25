import { supabase } from '../api/supabaseClient';
import { ProjectMemberService } from './ProjectMemberService';

export interface Project {
  id: string;
  name: string;
  description: string | null;
  organization_id: string;
  status: string;
  deadline: string | null;
  created_at?: string;
}

export interface ProjectCardData extends Project {
  memberCount: number;
  members: { id: string; email: string | null }[];
  taskCount: number;
  completedTaskCount: number;
}

export interface CreateProjectInput {
  name: string;
  description?: string;
  deadline?: string | null;
  memberIds?: string[];
  initialTasks?: string[];
  initialMilestones?: { name: string; due_date?: string }[];
}

export const ProjectService = {
  async createProject(input: CreateProjectInput): Promise<Project> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('No user logged in');

    const { data: profile } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('id', user.id)
      .single();

    if (!profile) throw new Error('Profile not found');

    const { data, error } = await supabase
      .from('projects')
      .insert([{
        name: input.name,
        description: input.description || null,
        deadline: input.deadline || null,
        organization_id: profile.organization_id,
      }])
      .select()
      .single();

    if (error) throw error;
    const project = data as Project;

    try {
      await ProjectMemberService.addMember(project.id, user.id, 'owner');
    } catch (memberErr) {
      await supabase.from('projects').delete().eq('id', project.id);
      throw new Error('Failed to add you as project member. Project creation rolled back.');
    }

    if (input.memberIds && input.memberIds.length > 0) {
      for (const uid of input.memberIds) {
        if (uid !== user.id) {
          try {
            await ProjectMemberService.addMember(project.id, uid, 'member');
          } catch {
            // skip individual failures
          }
        }
      }
    }

    if (input.initialTasks && input.initialTasks.length > 0) {
      const taskRows = input.initialTasks
        .filter(t => t.trim())
        .map(title => ({
          project_id: project.id,
          title,
          organization_id: profile.organization_id,
        }));
      if (taskRows.length > 0) {
        await supabase.from('tasks').insert(taskRows);
      }
    }

    if (input.initialMilestones && input.initialMilestones.length > 0) {
      const msRows = input.initialMilestones
        .filter(m => m.name.trim())
        .map(m => ({
          project_id: project.id,
          name: m.name,
          due_date: m.due_date || null,
          organization_id: profile.organization_id,
        }));
      if (msRows.length > 0) {
        await supabase.from('milestones').insert(msRows);
      }
    }

    return project;
  },

  async getProjects() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from('project_members')
      .select('project_id, projects!inner(id, name, description, organization_id, status, deadline, created_at)')
      .eq('user_id', user.id);

    if (error) throw error;

    interface ProjectJoin {
      project_id: string;
      projects: Project | Project[];
    }

    return (data as unknown as ProjectJoin[]).map(item => {
      const p = Array.isArray(item.projects) ? item.projects[0] : item.projects;
      return p as Project;
    }).sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
  },

  async getProjectsWithDetails(): Promise<ProjectCardData[]> {
    const projects = await this.getProjects();
    if (projects.length === 0) return [];

    const ids = projects.map(p => p.id);

    // Fetch members and profiles in separate queries for reliability
    const { data: members } = await supabase
      .from('project_members')
      .select('project_id, user_id')
      .in('project_id', ids);

    const userIds = [...new Set((members ?? []).map(m => m.user_id))];
    let emailMap: Record<string, string | null> = {};
    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, email')
        .in('id', userIds);
      for (const p of profiles ?? []) {
        emailMap[p.id] = p.email;
      }
    }

    const { data: tasks } = await supabase
      .from('tasks')
      .select('project_id, id, status')
      .in('project_id', ids);

    const membersByProject: Record<string, { id: string; email: string | null }[]> = {};
    for (const m of members ?? []) {
      if (!membersByProject[m.project_id]) membersByProject[m.project_id] = [];
      membersByProject[m.project_id].push({
        id: m.user_id,
        email: emailMap[m.user_id] ?? null,
      });
    }

    const taskCounts: Record<string, { total: number; completed: number }> = {};
    for (const t of tasks ?? []) {
      if (!taskCounts[t.project_id]) taskCounts[t.project_id] = { total: 0, completed: 0 };
      taskCounts[t.project_id].total++;
      if (t.status === 'completed') taskCounts[t.project_id].completed++;
    }

    return projects.map(p => ({
      ...p,
      memberCount: membersByProject[p.id]?.length ?? 0,
      members: membersByProject[p.id] ?? [],
      taskCount: taskCounts[p.id]?.total ?? 0,
      completedTaskCount: taskCounts[p.id]?.completed ?? 0,
    }));
  },

  async updateProject(id: string, fields: { name?: string; description?: string | null; status?: string; deadline?: string | null }) {
    const { data, error } = await supabase
      .from('projects')
      .update(fields)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data as Project;
  },

  async deleteProject(id: string) {
    const { error } = await supabase
      .from('projects')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },
};
