import { useState, useEffect, FormEvent, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../api/supabaseClient';
import { ProjectService, ProjectCardData } from '../services/ProjectService';
import { TaskService } from '../services/TaskService';
import { usePermission, Permissions } from '../hooks/usePermission';
import { useRealtimeTasks } from '../hooks/useRealtimeTasks';
import { useRealtimeProjects } from '../hooks/useRealtimeProjects';
import CreateProjectModal from '../components/CreateProjectModal';
import ProjectDetailDrawer from '../components/ProjectDetailDrawer';
import { tokens, sharedStyles, radius, fontSize } from '../theme/tokens';

interface DashboardStats {
  activeProjects: number;
  teamMembers: number;
  pendingTasks: number;
  completionRate: number;
}

interface ActivityEvent {
  type: 'project_created' | 'member_joined';
  text: string;
  time: string;
  timestamp: number;
  projectId?: string;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

function groupActivities(events: ActivityEvent[]): { label: string; items: ActivityEvent[] }[] {
  const groups: { label: string; items: ActivityEvent[] }[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const thisWeek = new Date(today);
  thisWeek.setDate(thisWeek.getDate() - today.getDay());

  const todayItems: ActivityEvent[] = [];
  const yesterdayItems: ActivityEvent[] = [];
  const weekItems: ActivityEvent[] = [];
  const olderItems: ActivityEvent[] = [];

  for (const e of events) {
    const d = new Date(e.timestamp);
    if (d >= today) todayItems.push(e);
    else if (d >= yesterday) yesterdayItems.push(e);
    else if (d >= thisWeek) weekItems.push(e);
    else olderItems.push(e);
  }

  if (todayItems.length) groups.push({ label: 'Today', items: todayItems });
  if (yesterdayItems.length) groups.push({ label: 'Yesterday', items: yesterdayItems });
  if (weekItems.length) groups.push({ label: 'This Week', items: weekItems });
  if (olderItems.length) groups.push({ label: 'Earlier', items: olderItems });

  return groups;
}

const activityIcons: Record<string, string> = {
  project_created: '🚀',
  member_joined: '👋',
};

export default function DashboardPage() {
  const navigate = useNavigate();
  const { can, roleName } = usePermission();

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [projects, setProjects] = useState<ProjectCardData[]>([]);
  const [recentActivity, setRecentActivity] = useState<ActivityEvent[]>([]);
  const [recentTasks, setRecentTasks] = useState<{ id: string; title: string; status: string; project_id: string; project_name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [selectedProject, setSelectedProject] = useState<ProjectCardData | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const orgIdRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    loadDashboardData();
  }, []);

  // Realtime task updates: sync KPI stats + pending tasks list
  useRealtimeTasks(orgIdRef.current, (payload) => {
    const taskId = payload.new.id as string;
    const newStatus = payload.new.status as string;
    const oldStatus = payload.old.status as string;

    // Update KPI stats
    setStats(prev => {
      if (!prev) return prev;
      let delta = 0;
      if (newStatus === 'completed' && oldStatus !== 'completed') delta = -1;
      else if (newStatus !== 'completed' && oldStatus === 'completed') delta = 1;
      return {
        ...prev,
        pendingTasks: prev.pendingTasks + delta,
      };
    });

    // Update pending tasks list
    setRecentTasks(prev => {
      const existing = prev.find(t => t.id === taskId);
      if (existing) {
        if (newStatus === 'completed') {
          return prev.filter(t => t.id !== taskId);
        }
        return prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t);
      }
      if (newStatus !== 'completed') {
        // Could add it back, but we don't have the title here without a re-fetch
        return prev;
      }
      return prev;
    });

    // Update project progress bars
    setProjects(prev => prev.map(p => {
      if (p.id !== payload.new.project_id) return p;
      const taskDelta = newStatus === 'completed' && oldStatus !== 'completed' ? 1
        : newStatus !== 'completed' && oldStatus === 'completed' ? -1 : 0;
      return {
        ...p,
        completedTaskCount: p.completedTaskCount + taskDelta,
      };
    }));
  });

  // Realtime project updates: sync project cards
  useRealtimeProjects(orgIdRef.current, (project) => {
    const updated = project as any;
    setProjects(prev => prev.map(p =>
      p.id === updated.id
        ? { ...p, name: updated.name, description: updated.description, status: updated.status, deadline: updated.deadline }
        : p
    ));
  }, (project) => {
    // Load full details for newly created projects
    const newId = (project as any).id;
    ProjectService.getProjectsWithDetails().then(all => {
      const newP = all.find(p => p.id === newId);
      if (newP) {
        setProjects(prev => [newP, ...prev]);
        setStats(prev => prev ? { ...prev, activeProjects: prev.activeProjects + 1 } : prev);
      }
    }).catch(() => {});
  });

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('id', user.id)
        .single();

      if (!profile) return;
      const orgId = profile.organization_id;
      orgIdRef.current = orgId;

      const projectDetails = await ProjectService.getProjectsWithDetails();
      setProjects(projectDetails);

      const { count: memberCount } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', orgId);

      const projectIds = projectDetails.map(p => p.id);
      let pendingCount = 0;
      let completedCount = 0;
      let totalCount = 0;

      if (projectIds.length > 0) {
        const { data: tasks } = await supabase
          .from('tasks')
          .select('status')
          .in('project_id', projectIds);

        if (tasks) {
          for (const t of tasks) {
            totalCount++;
            if (t.status === 'completed') completedCount++;
            else pendingCount++;
          }
        }
      }

      setStats({
        activeProjects: projectDetails.length,
        teamMembers: memberCount ?? 0,
        pendingTasks: pendingCount,
        completionRate: totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0,
      });

      // Activity feed
      const activities: ActivityEvent[] = [];
      const recentProjectIds = projectDetails.slice(0, 5).map(p => p.id);

      if (recentProjectIds.length > 0) {
        // Recent project members joined
        const { data: recentMembers } = await supabase
          .from('project_members')
          .select('user_id, project_id, joined_at, profiles!inner(email)')
          .in('project_id', recentProjectIds)
          .order('joined_at', { ascending: false })
          .limit(20);

        if (recentMembers) {
          for (const rm of recentMembers) {
            const project = projectDetails.find(p => p.id === rm.project_id);
            const email = (rm as any).profiles?.email ?? 'Someone';
            activities.push({
              type: 'member_joined',
              text: `${email} joined ${project?.name ?? 'a project'}`,
              time: (rm as any).joined_at,
              timestamp: new Date((rm as any).joined_at).getTime(),
              projectId: rm.project_id,
            });
          }
        }
      }

      // Project created events
      for (const p of projectDetails) {
        if (p.created_at) {
          activities.push({
            type: 'project_created',
            text: `Project created: ${p.name}`,
            time: p.created_at,
            timestamp: new Date(p.created_at).getTime(),
            projectId: p.id,
          });
        }
      }

      activities.sort((a, b) => b.timestamp - a.timestamp);
      setRecentActivity(activities.slice(0, 15));

      // Recent pending tasks across user's projects
      if (projectIds.length > 0) {
        const { data: pendingTasks } = await supabase
          .from('tasks')
          .select('id, title, status, project_id')
          .in('project_id', projectIds)
          .neq('status', 'completed')
          .order('created_at', { ascending: false })
          .limit(10);

        if (pendingTasks) {
          const projectMap = new Map(projectDetails.map(p => [p.id, p.name]));
          setRecentTasks(pendingTasks.map(t => ({
            ...t,
            project_name: projectMap.get(t.project_id) ?? 'Unknown',
          })));
        }
      }
    } catch (err) {
      console.error('Dashboard load error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProject = async (data: {
    name: string;
    description: string;
    deadline: string;
    memberIds: string[];
    initialTasks: string[];
    initialMilestones: { name: string; due_date: string }[];
  }) => {
    await ProjectService.createProject(data);
    setShowCreateModal(false);
    loadDashboardData();
  };

  const handleToggleTask = async (taskId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'completed' ? 'pending' : 'completed';
    try {
      await TaskService.updateTask(taskId, { status: newStatus });
      setRecentTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t));
      if (newStatus === 'pending') {
        setStats(prev => prev ? { ...prev, pendingTasks: prev.pendingTasks + 1 } : prev);
      } else {
        setStats(prev => prev ? { ...prev, pendingTasks: prev.pendingTasks - 1 } : prev);
      }
    } catch (err) {
      console.error('Error toggling task:', err);
    }
  };

  const handleProjectClick = (project: ProjectCardData) => {
    setSelectedProject(project);
    setDrawerOpen(true);
  };

  const handleDrawerClose = () => {
    setDrawerOpen(false);
    setSelectedProject(null);
  };

  const handleDrawerDelete = async (id: string) => {
    try {
      await ProjectService.deleteProject(id);
      setProjects(prev => prev.filter(p => p.id !== id));
      setDrawerOpen(false);
      setSelectedProject(null);
      loadDashboardData();
    } catch (err) {
      console.error('Error deleting project:', err);
    }
  };

  const openProjectFromActivity = (projectId?: string) => {
    if (!projectId) return;
    const p = projects.find(proj => proj.id === projectId);
    if (p) handleProjectClick(p);
  };

  const canCreateProject = can(Permissions.Project.Create);
  const canInvite = can(Permissions.User.Invite);
  const canViewReports = can(Permissions.Reports.View);
  const canManageSettings = can(Permissions.Settings.Manage);

  if (loading && !stats) {
    return (
      <div>
        <h2 style={{ color: tokens.textPrimary, fontSize: fontSize.lg, fontWeight: 600, margin: '0 0 24px' }}>
          Dashboard
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
          {[1, 2, 3, 4].map(i => (
            <div key={i} style={{ ...sharedStyles.shimmer, height: 88 }} />
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div style={{ ...sharedStyles.shimmer, height: 300 }} />
          <div style={{ ...sharedStyles.shimmer, height: 300 }} />
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <h2 style={{ color: tokens.textPrimary, fontSize: fontSize.lg, fontWeight: 600, margin: 0 }}>
            Dashboard
          </h2>
          <p style={{ color: tokens.textDim, fontSize: fontSize.sm, margin: '4px 0 0' }}>
            Welcome back{roleName ? `, ${roleName}` : ''}
          </p>
        </div>
      </div>

      {/* Quick Actions */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {canCreateProject && (
          <button
            onClick={() => setShowCreateModal(true)}
            style={{
              ...sharedStyles.btnPrimary,
              display: 'flex', alignItems: 'center', gap: 6, fontSize: fontSize.sm, padding: '7px 14px',
            }}
          >
            + New Project
          </button>
        )}
        {canInvite && (
          <button
            onClick={() => setShowInviteModal(true)}
            style={{
              ...sharedStyles.btnGhost,
              display: 'flex', alignItems: 'center', gap: 6, fontSize: fontSize.sm, padding: '7px 14px',
            }}
          >
            + Invite Member
          </button>
        )}
        {canViewReports && (
          <button
            onClick={() => {}}
            style={{
              ...sharedStyles.btnGhost,
              display: 'flex', alignItems: 'center', gap: 6, fontSize: fontSize.sm, padding: '7px 14px',
            }}
          >
            Reports
          </button>
        )}
        {canManageSettings && (
          <button
            onClick={() => navigate('/settings')}
            style={{
              ...sharedStyles.btnGhost,
              display: 'flex', alignItems: 'center', gap: 6, fontSize: fontSize.sm, padding: '7px 14px',
            }}
          >
            Settings
          </button>
        )}
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Active Projects', value: stats?.activeProjects ?? 0, icon: '📋', color: tokens.accentPrimary },
          { label: 'Team Members', value: stats?.teamMembers ?? 0, icon: '👥', color: tokens.accentGlow },
          { label: 'Pending Tasks', value: stats?.pendingTasks ?? 0, icon: '📌', color: tokens.warning },
          { label: 'Completion Rate', value: stats ? `${stats.completionRate}%` : '0%', icon: '📈', color: tokens.success },
        ].map(m => (
          <div key={m.label} style={{
            background: tokens.surfaceFloat,
            border: `1px solid ${tokens.borderDefault}`,
            borderRadius: radius.lg,
            padding: '16px 18px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <span style={{ fontSize: 20 }}>{m.icon}</span>
              <span style={{
                width: 6, height: 6, borderRadius: '50%', background: m.color,
              }} />
            </div>
            <div style={{ color: tokens.textPrimary, fontSize: fontSize.xl, fontWeight: 700, lineHeight: 1.2 }}>
              {loading ? '...' : m.value}
            </div>
            <div style={{ color: tokens.textDim, fontSize: fontSize.sm, marginTop: 2 }}>{m.label}</div>
          </div>
        ))}
      </div>

      {/* Bottom Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Recent Activity */}
        <div style={{
          background: tokens.surfaceFloat,
          border: `1px solid ${tokens.borderDefault}`,
          borderRadius: radius.lg,
          padding: 20,
          display: 'flex',
          flexDirection: 'column',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <h3 style={{ color: tokens.textPrimary, fontSize: fontSize.md, fontWeight: 600, margin: 0 }}>
              Recent Activity
            </h3>
            <span style={{ fontSize: fontSize.xs, color: tokens.textDim }}>
              {recentActivity.length} events
            </span>
          </div>
          <div style={{ flex: 1, overflow: 'auto', maxHeight: 360 }}>
            {recentActivity.length === 0 ? (
              <div style={{ color: tokens.textDim, fontSize: fontSize.sm, textAlign: 'center', padding: 24 }}>
                No activity yet. Create a project to get started!
              </div>
            ) : (
              groupActivities(recentActivity).map(group => (
                <div key={group.label} style={{ marginBottom: 14 }}>
                  <div style={{
                    color: tokens.textDim, fontSize: fontSize.xs, fontWeight: 600, marginBottom: 6,
                    textTransform: 'uppercase', letterSpacing: '0.5px',
                  }}>
                    {group.label}
                  </div>
                  {group.items.map((item, i) => (
                    <div
                      key={`${item.type}-${item.timestamp}-${i}`}
                      onClick={() => openProjectFromActivity(item.projectId)}
                      style={{
                        display: 'flex', alignItems: 'flex-start', gap: 10,
                        padding: '8px 10px',
                        background: tokens.surfaceInset,
                        borderRadius: radius.sm,
                        marginBottom: 4,
                        cursor: item.projectId ? 'pointer' : 'default',
                        transition: 'background 0.1s',
                      }}
                      onMouseEnter={e => { if (item.projectId) (e.currentTarget as HTMLElement).style.background = tokens.surfaceHover; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = tokens.surfaceInset; }}
                    >
                      <span style={{ fontSize: 14, lineHeight: '18px' }}>{activityIcons[item.type] ?? '•'}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ color: tokens.textSecondary, fontSize: fontSize.base, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {item.text}
                        </div>
                        <div style={{ color: tokens.textDim, fontSize: fontSize.xs, marginTop: 1 }}>
                          {timeAgo(item.time)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Active Projects Widget */}
          <div style={{
            background: tokens.surfaceFloat,
            border: `1px solid ${tokens.borderDefault}`,
            borderRadius: radius.lg,
            padding: 20,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3 style={{ color: tokens.textPrimary, fontSize: fontSize.md, fontWeight: 600, margin: 0 }}>
                Active Projects
              </h3>
              {projects.length > 3 && (
                <span
                  onClick={() => navigate('/projects')}
                  style={{ color: tokens.accentPrimary, fontSize: fontSize.xs, cursor: 'pointer' }}
                >
                  View all &rarr;
                </span>
              )}
            </div>
            {projects.length === 0 ? (
              <div style={{ color: tokens.textDim, fontSize: fontSize.sm, textAlign: 'center', padding: 20 }}>
                No projects yet
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {projects.slice(0, 4).map(p => {
                  const progress = p.taskCount > 0 ? Math.round((p.completedTaskCount / p.taskCount) * 100) : 0;
                  return (
                    <div
                      key={p.id}
                      onClick={() => handleProjectClick(p)}
                      style={{
                        background: tokens.surfaceInset,
                        border: `1px solid ${tokens.borderDefault}`,
                        borderRadius: radius.sm,
                        padding: '10px 14px',
                        cursor: 'pointer',
                        transition: 'border-color 0.1s',
                      }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = tokens.accentPrimary; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = tokens.borderDefault; }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <div style={{ color: tokens.textPrimary, fontSize: fontSize.base, fontWeight: 500 }}>{p.name}</div>
                        <span style={{
                          ...sharedStyles.badge(p.status === 'completed' ? 'success' : 'info'),
                          fontSize: fontSize.xs,
                        }}>
                          {p.status}
                        </span>
                      </div>
                      {p.taskCount > 0 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{
                            flex: 1, height: 4, borderRadius: 2,
                            background: tokens.canvasBg,
                            overflow: 'hidden',
                          }}>
                            <div style={{
                              width: `${progress}%`, height: '100%',
                              borderRadius: 2,
                              background: progress === 100 ? tokens.success : tokens.accentPrimary,
                              transition: 'width 0.3s ease',
                            }} />
                          </div>
                          <span style={{ color: tokens.textDim, fontSize: fontSize.xs, whiteSpace: 'nowrap' }}>
                            {p.completedTaskCount}/{p.taskCount}
                          </span>
                        </div>
                      )}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 6 }}>
                        {p.members.slice(0, 3).map(m => (
                          <div key={m.id} style={{
                            width: 20, height: 20, borderRadius: '50%',
                            background: tokens.surfaceHover,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: tokens.textSecondary, fontSize: 10, fontWeight: 600,
                          }}>
                            {(m.email ?? '?').charAt(0).toUpperCase()}
                          </div>
                        ))}
                        {p.memberCount > 3 && (
                          <span style={{ color: tokens.textDim, fontSize: 10, marginLeft: 2 }}>
                            +{p.memberCount - 3}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Recent Tasks Widget */}
          <div style={{
            background: tokens.surfaceFloat,
            border: `1px solid ${tokens.borderDefault}`,
            borderRadius: radius.lg,
            padding: 20,
          }}>
            <h3 style={{ color: tokens.textPrimary, fontSize: fontSize.md, fontWeight: 600, margin: '0 0 12px' }}>
              Pending Tasks
            </h3>
            {recentTasks.length === 0 ? (
              <div style={{ color: tokens.textDim, fontSize: fontSize.sm, textAlign: 'center', padding: 16 }}>
                No pending tasks
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {recentTasks.map(t => (
                  <div key={t.id} style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '8px 10px',
                    background: tokens.surfaceInset,
                    borderRadius: radius.sm,
                  }}>
                    <div
                      onClick={() => handleToggleTask(t.id, t.status)}
                      style={{
                        width: 18, height: 18, borderRadius: 4, flexShrink: 0, cursor: 'pointer',
                        border: `1px solid ${t.status === 'completed' ? tokens.success : tokens.borderDefault}`,
                        background: t.status === 'completed' ? tokens.success : 'transparent',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff',
                        fontSize: 11, fontWeight: 700, transition: 'all 0.1s',
                      }}
                    >
                      {t.status === 'completed' ? '✓' : ''}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        color: tokens.textPrimary, fontSize: fontSize.base,
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                        textDecoration: t.status === 'completed' ? 'line-through' : 'none',
                        opacity: t.status === 'completed' ? 0.6 : 1,
                      }}>
                        {t.title}
                      </div>
                      <div style={{ color: tokens.textDim, fontSize: fontSize.xs, marginTop: 1 }}>
                        {t.project_name}
                      </div>
                    </div>
                    <span style={{
                      ...sharedStyles.badge(t.status === 'completed' ? 'success' : t.status === 'in_progress' ? 'warning' : 'neutral'),
                      fontSize: fontSize.xs,
                    }}>
                      {t.status === 'completed' ? 'done' : t.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Project Detail Drawer */}
      <ProjectDetailDrawer
        project={selectedProject}
        open={drawerOpen}
        onClose={handleDrawerClose}
        onUpdate={loadDashboardData}
        onDelete={handleDrawerDelete}
      />

      {/* Modals */}
      <CreateProjectModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreate={handleCreateProject}
      />

      {showInviteModal && (
        <div
          onClick={(e) => { if (e.target === e.currentTarget) setShowInviteModal(false); }}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
          }}
        >
          <div style={{
            background: tokens.surfaceFloat,
            border: `1px solid ${tokens.borderDefault}`,
            borderRadius: radius.lg, width: 500, maxWidth: '90vw',
            maxHeight: '85vh', overflow: 'auto',
          }}>
            <div style={{
              padding: '14px 20px', borderBottom: `1px solid ${tokens.borderDefault}`,
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <h2 style={{ margin: 0, color: tokens.textPrimary, fontSize: fontSize.lg, fontWeight: 600 }}>
                Invite Member
              </h2>
              <button
                onClick={() => setShowInviteModal(false)}
                style={{ background: 'none', border: 'none', color: tokens.textDim, cursor: 'pointer', fontSize: 18 }}
              >
                ✕
              </button>
            </div>
            <div style={{ padding: 16 }}>
              <InvitationManagementInline onClose={() => { setShowInviteModal(false); loadDashboardData(); }} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function InvitationManagementInline({ onClose }: { onClose: () => void }) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('employee');
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setSending(true);
    setMsg(null);
    try {
      const { InviteService } = await import('../services/InviteService');
      await InviteService.createInvitation(email.trim(), role);
      setMsg({ type: 'success', text: 'Invitation sent!' });
      setEmail('');
      setTimeout(onClose, 1500);
    } catch (err: any) {
      setMsg({ type: 'error', text: err.message || 'Failed to send invitation' });
    } finally {
      setSending(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {msg && (
        <div style={sharedStyles.feedbackBanner(msg.type)}>{msg.text}</div>
      )}
      <div>
        <label style={sharedStyles.label}>Email</label>
        <input
          type="email"
          placeholder="colleague@company.com"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
          style={sharedStyles.input}
        />
      </div>
      <div>
        <label style={sharedStyles.label}>Role</label>
        <select
          value={role}
          onChange={e => setRole(e.target.value)}
          style={sharedStyles.input}
        >
          <option value="employee">Employee</option>
          <option value="manager">Manager</option>
          <option value="admin">Admin</option>
        </select>
      </div>
      <button
        type="submit"
        disabled={sending || !email.trim()}
        style={{
          ...sharedStyles.btnPrimary,
          opacity: sending || !email.trim() ? 0.6 : 1,
          cursor: sending || !email.trim() ? 'not-allowed' : 'pointer',
          alignSelf: 'flex-end',
        }}
      >
        {sending ? 'Sending...' : 'Send Invitation'}
      </button>
    </form>
  );
}
