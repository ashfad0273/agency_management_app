import { useState, useEffect, FormEvent } from 'react';
import { ProjectService, Project } from '../services/ProjectService';
import { ChatService } from '../services/ChatService';
import { usePermission, Permissions } from '../hooks/usePermission';

import TaskList from './TaskList';
import MilestoneList from './MilestoneList';
import { tokens, sharedStyles, radius, fontSize, spacing } from '../theme/tokens';

export default function ProjectDashboard() {
  const { can } = usePermission();
  const canCreate = can(Permissions.Project.Create);
  const canUpdate = can(Permissions.Project.Update);
  const canDelete = can(Permissions.Project.Delete);

  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedMilestoneProjectId, setSelectedMilestoneProjectId] = useState<string | null>(null);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [creating, setCreating] = useState(false);
  const [savingProjectId, setSavingProjectId] = useState<string | null>(null);
  const [deletingProjectId, setDeletingProjectId] = useState<string | null>(null);

  const showFeedback = (type: 'success' | 'error', message: string) => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 3000);
  };

  useEffect(() => {
    loadProjects();
  }, []);

  useEffect(() => {
    if (projects.length === 0) return;
    const fetchProjectUnreads = async () => {
      const counts: Record<string, number> = {};
      for (const p of projects) {
        try {
          const count = await ChatService.getUnreadCount(p.id);
          if (count > 0) counts[p.id] = count;
        } catch {
        }
      }
      setUnreadCounts(counts);
    };

    fetchProjectUnreads();
    const interval = setInterval(fetchProjectUnreads, 15000);

    return () => clearInterval(interval);
  }, [projects]);

  const loadProjects = async () => {
    setLoading(true);
    try {
      const data = await ProjectService.getProjects();
      setProjects(data);
    } catch (error) {
      console.error('Error loading projects:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      await ProjectService.createProject(name, description);
      setName('');
      setDescription('');
      loadProjects();
    } catch (error) {
      console.error('Error creating project:', error);
      showFeedback('error', 'Error creating project: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
    setCreating(false);
  };

  const startEditing = (project: Project) => {
    setEditingProjectId(project.id);
    setEditName(project.name);
    setEditDescription(project.description ?? '');
  };

  const cancelEditing = () => {
    setEditingProjectId(null);
    setEditName('');
    setEditDescription('');
  };

  const handleUpdate = async (id: string) => {
    setSavingProjectId(id);
    try {
      await ProjectService.updateProject(id, { name: editName, description: editDescription });
      setEditingProjectId(null);
      loadProjects();
    } catch (error) {
      console.error('Error updating project:', error);
      showFeedback('error', 'Error updating project: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
    setSavingProjectId(null);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this project? This action cannot be undone.')) return;
    setDeletingProjectId(id);
    try {
      await ProjectService.deleteProject(id);
      if (selectedProjectId === id) setSelectedProjectId(null);
      if (selectedMilestoneProjectId === id) setSelectedMilestoneProjectId(null);
      loadProjects();
    } catch (error) {
      console.error('Error deleting project:', error);
      showFeedback('error', 'Error deleting project: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
    setDeletingProjectId(null);
  };

  const toggleTasks = (projectId: string) => {
    setSelectedProjectId(selectedProjectId === projectId ? null : projectId);
    setSelectedMilestoneProjectId(null);
    if (selectedProjectId !== projectId) {
      ChatService.markAsRead(projectId);
      setUnreadCounts((prev) => {
        const next = { ...prev };
        delete next[projectId];
        return next;
      });
    }
  };

  const toggleMilestones = (projectId: string) => {
    setSelectedMilestoneProjectId(selectedMilestoneProjectId === projectId ? null : projectId);
    setSelectedProjectId(null);
  };

  const btnPrimary = {
    background: tokens.accentPrimary,
    color: '#fff',
    border: `1px solid ${tokens.accentPrimary}`,
    borderRadius: radius.sm,
    padding: '6px 14px',
    fontSize: fontSize.sm,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  };

  const btnGhost = {
    background: 'transparent',
    color: tokens.textSecondary,
    border: `1px solid ${tokens.borderDefault}`,
    borderRadius: radius.sm,
    padding: '4px 10px',
    fontSize: fontSize.sm,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  };

  return (
    <div>
      <h2 style={{ color: tokens.textPrimary, fontSize: fontSize.lg, fontWeight: 600, margin: '0 0 20px' }}>Projects</h2>

      {feedback && (
        <div style={sharedStyles.feedbackBanner(feedback.type)}>
          {feedback.message}
        </div>
      )}

      {canCreate && (
        <form onSubmit={handleCreate} style={{ marginBottom: 20, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            placeholder="Project Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            style={{ ...sharedStyles.input, width: 'auto', flex: '1 1 200px' }}
          />
          <input
            placeholder="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            style={{ ...sharedStyles.input, width: 'auto', flex: '1 1 200px' }}
          />
          <button type="submit" disabled={creating} style={{ ...btnPrimary, opacity: creating ? 0.6 : 1 }}>
            {creating ? 'Creating...' : 'Create Project'}
          </button>
        </form>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {loading ? (
          <div style={{ ...sharedStyles.textMuted, padding: 20, textAlign: 'center' }}>
            <div style={{ ...sharedStyles.shimmer, height: 20, width: '60%', margin: '0 auto 8px' }} />
            <div style={{ ...sharedStyles.shimmer, height: 20, width: '40%', margin: '0 auto' }} />
          </div>
        ) : projects.length === 0 ? (
          <div style={{ ...sharedStyles.textMuted, padding: 40, textAlign: 'center' }}>
            No projects yet. Create one above!
          </div>
        ) : (
          projects.map((p) => (
            <div key={p.id} style={sharedStyles.card}>
              {editingProjectId === p.id ? (
                <div style={{ padding: spacing.lg }}>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                    <input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Project Name" style={{ ...sharedStyles.input, width: 'auto', flex: 1 }} />
                    <input value={editDescription} onChange={(e) => setEditDescription(e.target.value)} placeholder="Description" style={{ ...sharedStyles.input, width: 'auto', flex: 1 }} />
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => handleUpdate(p.id)} disabled={savingProjectId === p.id} style={{ ...btnPrimary, opacity: savingProjectId === p.id ? 0.6 : 1 }}>
                      {savingProjectId === p.id ? 'Saving...' : 'Save'}
                    </button>
                    <button onClick={cancelEditing} style={btnGhost}>Cancel</button>
                  </div>
                </div>
              ) : (
                <div style={{ padding: spacing.lg }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <div>
                      <strong style={{ color: tokens.textPrimary, fontSize: fontSize.md }}>{p.name}</strong>
                      {p.description && <span style={{ color: tokens.textSecondary, fontSize: fontSize.base, marginLeft: 8 }}>— {p.description}</span>}
                    </div>
                    <div style={{ fontSize: fontSize.sm, color: tokens.textDim }}>
                      {p.organization_id.substring(0, 8)}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <button
                      onClick={() => toggleTasks(p.id)}
                      style={{
                        ...btnGhost,
                        background: selectedProjectId === p.id ? tokens.accentMuted : 'transparent',
                        borderColor: selectedProjectId === p.id ? tokens.accentPrimary : tokens.borderDefault,
                        color: selectedProjectId === p.id ? tokens.accentPrimary : tokens.textSecondary,
                        position: 'relative',
                      }}
                    >
                      {selectedProjectId === p.id ? 'Hide Tasks' : 'Tasks'}
                      {unreadCounts[p.id] && selectedProjectId !== p.id && (
                        <span style={sharedStyles.unreadBadge}>
                          {unreadCounts[p.id] > 99 ? '99+' : unreadCounts[p.id]}
                        </span>
                      )}
                    </button>
                    <button
                      onClick={() => toggleMilestones(p.id)}
                      style={{
                        ...btnGhost,
                        background: selectedMilestoneProjectId === p.id ? tokens.accentMuted : 'transparent',
                        borderColor: selectedMilestoneProjectId === p.id ? tokens.accentPrimary : tokens.borderDefault,
                        color: selectedMilestoneProjectId === p.id ? tokens.accentPrimary : tokens.textSecondary,
                      }}
                    >
                      {selectedMilestoneProjectId === p.id ? 'Hide Milestones' : 'Milestones'}
                    </button>
                    {canUpdate && (
                      <button onClick={() => startEditing(p)} style={btnGhost}>Edit</button>
                    )}
                    {canDelete && (
                      <button onClick={() => handleDelete(p.id)} disabled={deletingProjectId === p.id} style={{ ...sharedStyles.btnDanger, opacity: deletingProjectId === p.id ? 0.6 : 1 }}>
                        {deletingProjectId === p.id ? 'Deleting...' : 'Delete'}
                      </button>
                    )}
                  </div>
                  {selectedProjectId === p.id && <TaskList projectId={p.id} />}
                  {selectedMilestoneProjectId === p.id && <MilestoneList projectId={p.id} />}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
