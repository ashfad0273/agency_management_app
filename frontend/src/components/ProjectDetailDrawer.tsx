import { useState, useEffect, FormEvent, CSSProperties } from 'react';
import { ProjectService, Project } from '../services/ProjectService';
import { ProjectMemberService } from '../services/ProjectMemberService';
import { TaskService, Task } from '../services/TaskService';
import { MilestoneService, Milestone } from '../services/MilestoneService';
import { tokens, radius, fontSize } from '../theme/tokens';

type Tab = 'overview' | 'tasks' | 'milestones';

interface Props {
  project: Project | null;
  open: boolean;
  onClose: () => void;
  onUpdate: () => void;
  onDelete: (id: string) => void;
}

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'on_hold', label: 'On Hold' },
  { value: 'completed', label: 'Completed' },
];

export default function ProjectDetailDrawer({ project, open, onClose, onUpdate, onDelete }: Props) {
  const [tab, setTab] = useState<Tab>('overview');
  const [members, setMembers] = useState<{ id: string; user_id: string; role: string; email: string | null }[]>([]);
  const [orgMembers, setOrgMembers] = useState<{ id: string; email: string | null }[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [loading, setLoading] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newMsName, setNewMsName] = useState('');
  const [newMsDate, setNewMsDate] = useState('');
  const [showActions, setShowActions] = useState(false);
  const [showMemberDropdown, setShowMemberDropdown] = useState(false);
  const [statusMenuOpen, setStatusMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editDeadline, setEditDeadline] = useState('');
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    if (!open || !project) return;
    setTab('overview');
    setShowActions(false);
    setShowMemberDropdown(false);
    setStatusMenuOpen(false);
    setEditing(false);
    setFeedback(null);
    loadData();
  }, [project?.id, open]);

  const loadData = async () => {
    if (!project) return;
    setLoading(true);
    try {
      const [mems, orgMems, ts, mss] = await Promise.all([
        ProjectMemberService.getMembersWithProfiles(project.id),
        ProjectMemberService.getOrgMembers(),
        TaskService.getTasks(project.id),
        MilestoneService.getMilestones(project.id),
      ]);
      setMembers(mems);
      setOrgMembers(orgMems);
      setTasks(ts);
      setMilestones(mss);
    } catch (err) {
      console.error('Error loading project details:', err);
    }
    setLoading(false);
  };

  const isMember = (userId: string) => members.some(m => m.user_id === userId);

  const toggleMember = async (userId: string) => {
    if (!project) return;
    try {
      if (isMember(userId)) {
        await ProjectMemberService.removeMember(project.id, userId);
      } else {
        await ProjectMemberService.addMember(project.id, userId, 'member');
      }
      await loadData();
      onUpdate();
    } catch (err) {
      console.error('Error toggling member:', err);
    }
  };

  const handleStatusChange = async (status: string) => {
    if (!project) return;
    setStatusMenuOpen(false);
    try {
      await ProjectService.updateProject(project.id, { status });
      onUpdate();
    } catch (err) {
      console.error('Error updating status:', err);
      setFeedback({ type: 'error', message: 'Failed to update status' });
    }
  };

  const startEditing = () => {
    if (!project) return;
    setShowActions(false);
    setEditName(project.name);
    setEditDescription(project.description || '');
    setEditDeadline(project.deadline || '');
    setEditing(true);
  };

  const cancelEditing = () => {
    setEditing(false);
    setFeedback(null);
  };

  const handleSaveEdit = async () => {
    if (!project || !editName.trim()) return;
    setSaving(true);
    try {
      await ProjectService.updateProject(project.id, {
        name: editName.trim(),
        description: editDescription.trim() || null,
        deadline: editDeadline || null,
      });
      setEditing(false);
      setFeedback({ type: 'success', message: 'Project updated' });
      setTimeout(() => setFeedback(null), 2500);
      onUpdate();
    } catch (err) {
      setFeedback({ type: 'error', message: 'Failed to update project' });
    }
    setSaving(false);
  };

  const handleAddTask = async (e: FormEvent) => {
    e.preventDefault();
    if (!project || !newTaskTitle.trim()) return;
    try {
      await TaskService.createTask(project.id, newTaskTitle.trim());
      setNewTaskTitle('');
      const ts = await TaskService.getTasks(project.id);
      setTasks(ts);
      onUpdate();
    } catch (err) {
      console.error('Error adding task:', err);
    }
  };

  const handleToggleTask = async (taskId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'completed' ? 'pending' : 'completed';
    try {
      await TaskService.updateTask(taskId, { status: newStatus });
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t));
      onUpdate();
    } catch (err) {
      console.error('Error toggling task:', err);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    try {
      await TaskService.deleteTask(taskId);
      setTasks(prev => prev.filter(t => t.id !== taskId));
      onUpdate();
    } catch (err) {
      console.error('Error deleting task:', err);
    }
  };

  const handleAddMilestone = async (e: FormEvent) => {
    e.preventDefault();
    if (!project || !newMsName.trim()) return;
    try {
      await MilestoneService.createMilestone(project.id, newMsName.trim(), '', newMsDate);
      setNewMsName('');
      setNewMsDate('');
      const mss = await MilestoneService.getMilestones(project.id);
      setMilestones(mss);
      onUpdate();
    } catch (err) {
      console.error('Error adding milestone:', err);
    }
  };

  const handleToggleMilestone = async (msId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'completed' ? 'pending' : 'completed';
    try {
      await MilestoneService.updateMilestone(msId, { status: newStatus });
      setMilestones(prev => prev.map(m => m.id === msId ? { ...m, status: newStatus } : m));
      onUpdate();
    } catch (err) {
      console.error('Error toggling milestone:', err);
    }
  };

  const handleDeleteMilestone = async (msId: string) => {
    try {
      await MilestoneService.deleteMilestone(msId);
      setMilestones(prev => prev.filter(m => m.id !== msId));
      onUpdate();
    } catch (err) {
      console.error('Error deleting milestone:', err);
    }
  };

  if (!open || !project) return null;

  const tabLabel = (key: Tab, label: string, count?: number) => (
    <button
      onClick={() => setTab(key)}
      style={{
        background: tab === key ? tokens.accentMuted : 'transparent',
        color: tab === key ? tokens.accentPrimary : tokens.textSecondary,
        border: 'none',
        borderRadius: radius.sm,
        padding: '7px 14px',
        fontSize: fontSize.base,
        fontWeight: tab === key ? 600 : 400,
        cursor: 'pointer',
        transition: 'all 0.15s',
      }}
    >
      {label}{count !== undefined ? ` (${count})` : ''}
    </button>
  );

  const completedTasks = tasks.filter(t => t.status === 'completed').length;
  const progress = tasks.length > 0 ? Math.round((completedTasks / tasks.length) * 100) : 0;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.4)',
          zIndex: 900,
          animation: 'fade-in 0.15s ease',
        }}
      />

      {/* Drawer */}
      <div style={{
        position: 'fixed',
        top: 0,
        right: 0,
        width: 520,
        maxWidth: '100vw',
        height: '100vh',
        background: tokens.surfaceInset,
        borderLeft: `1px solid ${tokens.borderDefault}`,
        zIndex: 950,
        display: 'flex',
        flexDirection: 'column',
        animation: 'slide-in-right 0.25s ease-out',
        boxShadow: '-8px 0 24px rgba(0,0,0,0.3)',
      }}>
        {/* Header */}
        <div style={{
          padding: '18px 20px',
          borderBottom: `1px solid ${tokens.borderDefault}`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 12,
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              {editing ? (
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  style={{ ...inputStyle, fontSize: fontSize.lg, fontWeight: 600, padding: '4px 10px', width: 'auto', minWidth: 120 }}
                />
              ) : (
                <h2 style={{ margin: 0, color: tokens.textPrimary, fontSize: fontSize.lg, fontWeight: 600 }}>
                  {project.name}
                </h2>
              )}
              {/* Status dropdown instead of just a badge */}
              <div style={{ position: 'relative' }}>
                <button
                  onClick={(e) => { e.stopPropagation(); setStatusMenuOpen(!statusMenuOpen); }}
                  style={{
                    ...statusPillStyle(project.status),
                    cursor: 'pointer',
                    border: `1px solid ${tokens.borderDefault}`,
                  }}
                >
                  {STATUS_OPTIONS.find(s => s.value === project.status)?.label || 'Active'}
                </button>
                {statusMenuOpen && (
                  <div style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    marginTop: 4,
                    background: tokens.surfaceFloat,
                    border: `1px solid ${tokens.borderDefault}`,
                    borderRadius: radius.sm,
                    zIndex: 1000,
                    minWidth: 120,
                    overflow: 'hidden',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                  }}>
                    {STATUS_OPTIONS.map(opt => (
                      <div
                        key={opt.value}
                        onClick={() => handleStatusChange(opt.value)}
                        style={{
                          padding: '7px 12px',
                          cursor: 'pointer',
                          color: opt.value === project.status ? tokens.accentPrimary : tokens.textPrimary,
                          background: opt.value === project.status ? tokens.accentMuted : 'transparent',
                          fontSize: fontSize.base,
                          transition: 'background 0.1s',
                        }}
                      >
                        {opt.label}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Actions dropdown + Close */}
          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setShowActions(!showActions)}
                style={{
                  background: 'transparent',
                  border: `1px solid ${tokens.borderDefault}`,
                  borderRadius: radius.sm,
                  color: tokens.textSecondary,
                  padding: '6px 10px',
                  cursor: 'pointer',
                  fontSize: fontSize.md,
                }}
              >
                ⋯
              </button>
              {showActions && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  right: 0,
                  marginTop: 4,
                  background: tokens.surfaceFloat,
                  border: `1px solid ${tokens.borderDefault}`,
                  borderRadius: radius.sm,
                  zIndex: 1000,
                  minWidth: 140,
                  overflow: 'hidden',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                }}>
                  <div
                    onClick={startEditing}
                    style={{
                      padding: '7px 12px',
                      cursor: 'pointer',
                      color: tokens.textPrimary,
                      fontSize: fontSize.base,
                    }}
                  >Edit details</div>
                  <div
                    onClick={() => { setShowActions(false); onDelete(project.id); }}
                    style={{
                      padding: '7px 12px',
                      cursor: 'pointer',
                      color: tokens.danger,
                      fontSize: fontSize.base,
                    }}
                  >
                    Delete project
                  </div>
                </div>
              )}
            </div>
            <button
              onClick={onClose}
              style={{
                background: 'transparent',
                border: 'none',
                color: tokens.textDim,
                fontSize: 20,
                cursor: 'pointer',
                padding: '4px 8px',
                lineHeight: 1,
              }}
            >
              ✕
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div style={{
          padding: '10px 20px',
          borderBottom: `1px solid ${tokens.borderDefault}`,
          display: 'flex',
          gap: 4,
        }}>
          {tabLabel('overview', 'Overview')}
          {tabLabel('tasks', 'Tasks', tasks.length)}
          {tabLabel('milestones', 'Milestones', milestones.length)}
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '18px 20px' }}>
          {/* Feedback */}
          {feedback && (
            <div style={{
              padding: '8px 14px',
              marginBottom: 14,
              borderRadius: radius.sm,
              fontSize: fontSize.base,
              background: feedback.type === 'success' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
              color: feedback.type === 'success' ? tokens.success : tokens.danger,
              border: `1px solid ${feedback.type === 'success' ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
            }}>
              {feedback.message}
            </div>
          )}

          {tab === 'overview' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              {/* Edit actions */}
              {editing && (
                <div style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
                  <button
                    onClick={handleSaveEdit}
                    disabled={saving || !editName.trim()}
                    style={{
                      background: tokens.accentPrimary,
                      color: '#fff',
                      border: `1px solid ${tokens.accentPrimary}`,
                      borderRadius: radius.sm,
                      padding: '8px 18px',
                      fontSize: fontSize.base,
                      fontWeight: 600,
                      cursor: saving || !editName.trim() ? 'not-allowed' : 'pointer',
                      opacity: saving || !editName.trim() ? 0.6 : 1,
                    }}
                  >
                    {saving ? 'Saving...' : 'Save'}
                  </button>
                  <button
                    onClick={cancelEditing}
                    style={{
                      background: 'transparent',
                      color: tokens.textSecondary,
                      border: `1px solid ${tokens.borderDefault}`,
                      borderRadius: radius.sm,
                      padding: '8px 18px',
                      fontSize: fontSize.base,
                      fontWeight: 500,
                      cursor: 'pointer',
                    }}
                  >
                    Cancel
                  </button>
                </div>
              )}
              {/* Description */}
              <div>
                <h4 style={{ ...sectionTitle, marginBottom: 6 }}>Description</h4>
                {editing ? (
                  <textarea
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    rows={3}
                    style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
                  />
                ) : (
                  <p style={{ margin: 0, color: tokens.textSecondary, fontSize: fontSize.base, lineHeight: 1.6 }}>
                    {project.description || 'No description provided.'}
                  </p>
                )}
              </div>

              {/* Deadline */}
              <div>
                <h4 style={{ ...sectionTitle, marginBottom: 6 }}>Deadline</h4>
                {editing ? (
                  <input
                    type="date"
                    value={editDeadline}
                    onChange={(e) => setEditDeadline(e.target.value)}
                    style={{ ...inputStyle, width: 'auto' }}
                  />
                ) : (
                  <span style={{ color: tokens.textPrimary, fontSize: fontSize.base }}>
                    {project.deadline ? new Date(project.deadline).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : 'No deadline set'}
                  </span>
                )}
              </div>

              {/* Progress */}
              <div>
                <h4 style={{ ...sectionTitle, marginBottom: 6 }}>Progress</h4>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ flex: 1, height: 8, background: tokens.surfaceHover, borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ width: `${progress}%`, height: '100%', background: progress === 100 ? tokens.success : tokens.accentPrimary, borderRadius: 4, transition: 'width 0.4s' }} />
                  </div>
                  <span style={{ color: tokens.textPrimary, fontSize: fontSize.sm, fontWeight: 600 }}>{progress}%</span>
                </div>
                <div style={{ color: tokens.textDim, fontSize: fontSize.xs, marginTop: 4 }}>
                  {completedTasks} of {tasks.length} tasks completed
                </div>
              </div>

              {/* Team Members */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <h4 style={{ ...sectionTitle, margin: 0 }}>Team Members ({members.length})</h4>
                  <div style={{ position: 'relative' }}>
                    <button
                      onClick={() => setShowMemberDropdown(!showMemberDropdown)}
                      style={{
                        background: 'transparent',
                        color: tokens.accentPrimary,
                        border: `1px solid ${tokens.accentPrimary}`,
                        borderRadius: radius.sm,
                        padding: '4px 10px',
                        fontSize: fontSize.sm,
                        fontWeight: 500,
                        cursor: 'pointer',
                      }}
                    >
                      + Add / Remove
                    </button>
                    {showMemberDropdown && (
                      <div style={{
                        position: 'absolute',
                        top: '100%',
                        right: 0,
                        marginTop: 4,
                        background: tokens.surfaceFloat,
                        border: `1px solid ${tokens.borderDefault}`,
                        borderRadius: radius.sm,
                        zIndex: 1000,
                        minWidth: 220,
                        maxHeight: 260,
                        overflow: 'auto',
                        boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                      }}>
                        {orgMembers.length === 0 && (
                          <div style={{ padding: 12, color: tokens.textDim, fontSize: fontSize.sm }}>Loading...</div>
                        )}
                        {orgMembers.map(m => {
                          const member = isMember(m.id);
                          return (
                            <div
                              key={m.id}
                              onClick={() => toggleMember(m.id)}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8,
                                padding: '7px 12px',
                                cursor: 'pointer',
                                color: tokens.textPrimary,
                                fontSize: fontSize.base,
                                background: member ? tokens.accentMuted : 'transparent',
                              }}
                            >
                              <div style={{
                                width: 18,
                                height: 18,
                                borderRadius: 4,
                                border: `1px solid ${member ? tokens.accentPrimary : tokens.borderDefault}`,
                                background: member ? tokens.accentPrimary : 'transparent',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: '#fff',
                                fontSize: 10,
                                fontWeight: 700,
                                flexShrink: 0,
                              }}>
                                {member ? '✓' : ''}
                              </div>
                              <span>{m.email || 'Unknown'}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {members.length === 0 && (
                    <span style={{ color: tokens.textDim, fontSize: fontSize.sm }}>No members assigned</span>
                  )}
                  {members.map(m => (
                    <div key={m.id} style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '7px 10px',
                      background: tokens.surfaceHover,
                      borderRadius: radius.sm,
                    }}>
                      <div style={{
                        width: 28,
                        height: 28,
                        borderRadius: '50%',
                        background: tokens.surfaceFloat,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: tokens.textPrimary,
                        fontSize: fontSize.xs,
                        fontWeight: 600,
                        flexShrink: 0,
                      }}>
                        {(m.email || '?').charAt(0).toUpperCase()}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ color: tokens.textPrimary, fontSize: fontSize.base, fontWeight: 500 }}>
                          {m.email ? m.email.split('@')[0] : 'Unknown'}
                        </div>
                        <div style={{ color: tokens.textDim, fontSize: fontSize.xs }}>{m.role}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {tab === 'tasks' && (
            <div>
              {/* Add task form */}
              <form onSubmit={handleAddTask} style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
                <input
                  placeholder="New task title..."
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  style={inputStyle}
                />
                <button type="submit" style={{
                  background: tokens.accentPrimary,
                  color: '#fff',
                  border: `1px solid ${tokens.accentPrimary}`,
                  borderRadius: radius.sm,
                  padding: '8px 14px',
                  fontSize: fontSize.base,
                  fontWeight: 600,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}>
                  Add
                </button>
              </form>

              {/* Task list */}
              {loading ? (
                <div style={{ color: tokens.textDim, fontSize: fontSize.sm }}>Loading tasks...</div>
              ) : tasks.length === 0 ? (
                <div style={{ color: tokens.textDim, fontSize: fontSize.sm, textAlign: 'center', padding: 20 }}>
                  No tasks yet
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {tasks.map(t => (
                    <div key={t.id} style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '8px 10px',
                      borderRadius: radius.sm,
                      background: tokens.surfaceHover,
                    }}>
                      <div
                        onClick={() => handleToggleTask(t.id, t.status)}
                        style={{
                          width: 18,
                          height: 18,
                          borderRadius: 4,
                          border: `1px solid ${t.status === 'completed' ? tokens.success : tokens.borderDefault}`,
                          background: t.status === 'completed' ? tokens.success : 'transparent',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#fff',
                          fontSize: 11,
                          fontWeight: 700,
                          cursor: 'pointer',
                          flexShrink: 0,
                        }}
                      >
                        {t.status === 'completed' ? '✓' : ''}
                      </div>
                      <span style={{
                        flex: 1,
                        color: tokens.textPrimary,
                        fontSize: fontSize.base,
                        textDecoration: t.status === 'completed' ? 'line-through' : 'none',
                        opacity: t.status === 'completed' ? 0.6 : 1,
                      }}>
                        {t.title}
                      </span>
                      <button
                        onClick={() => handleDeleteTask(t.id)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: tokens.danger,
                          cursor: 'pointer',
                          fontSize: fontSize.sm,
                          padding: '2px 6px',
                          opacity: 0.6,
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === 'milestones' && (
            <div>
              {/* Add milestone form */}
              <form onSubmit={handleAddMilestone} style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
                <input
                  placeholder="Milestone name..."
                  value={newMsName}
                  onChange={(e) => setNewMsName(e.target.value)}
                  style={{ ...inputStyle, flex: 1, minWidth: 160 }}
                />
                <input
                  type="date"
                  value={newMsDate}
                  onChange={(e) => setNewMsDate(e.target.value)}
                  style={{ ...inputStyle, width: 150 }}
                />
                <button type="submit" style={{
                  background: tokens.accentPrimary,
                  color: '#fff',
                  border: `1px solid ${tokens.accentPrimary}`,
                  borderRadius: radius.sm,
                  padding: '8px 14px',
                  fontSize: fontSize.base,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}>
                  Add
                </button>
              </form>

              {/* Milestone list */}
              {loading ? (
                <div style={{ color: tokens.textDim, fontSize: fontSize.sm }}>Loading milestones...</div>
              ) : milestones.length === 0 ? (
                <div style={{ color: tokens.textDim, fontSize: fontSize.sm, textAlign: 'center', padding: 20 }}>
                  No milestones yet
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {milestones.map(m => (
                    <div key={m.id} style={{
                      padding: '10px 12px',
                      borderRadius: radius.sm,
                      background: tokens.surfaceHover,
                      borderLeft: `3px solid ${m.status === 'completed' ? tokens.success : m.status === 'in_progress' ? tokens.accentPrimary : tokens.textDim}`,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div
                          onClick={() => handleToggleMilestone(m.id, m.status)}
                          style={{
                            width: 18,
                            height: 18,
                            borderRadius: 4,
                            border: `1px solid ${m.status === 'completed' ? tokens.success : tokens.borderDefault}`,
                            background: m.status === 'completed' ? tokens.success : 'transparent',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#fff',
                            fontSize: 11,
                            fontWeight: 700,
                            cursor: 'pointer',
                            flexShrink: 0,
                          }}
                        >
                          {m.status === 'completed' ? '✓' : ''}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{
                            color: tokens.textPrimary,
                            fontSize: fontSize.base,
                            fontWeight: 500,
                            textDecoration: m.status === 'completed' ? 'line-through' : 'none',
                          }}>
                            {m.name}
                          </div>
                          {m.due_date && (
                            <div style={{ color: tokens.textDim, fontSize: fontSize.xs, marginTop: 2 }}>
                              Due: {new Date(m.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                            </div>
                          )}
                        </div>
                        <button
                          onClick={() => handleDeleteMilestone(m.id)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: tokens.danger,
                            cursor: 'pointer',
                            fontSize: fontSize.sm,
                            padding: '2px 6px',
                            opacity: 0.6,
                          }}
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function statusPillStyle(status: string | undefined) {
  const s = status || 'active';
  const colors: Record<string, { bg: string; text: string }> = {
    active: { bg: 'rgba(58, 149, 154, 0.15)', text: tokens.accentPrimary },
    on_hold: { bg: 'rgba(234, 179, 8, 0.15)', text: tokens.warning },
    completed: { bg: 'rgba(34, 197, 94, 0.15)', text: tokens.success },
  };
  const c = colors[s] || { bg: 'rgba(100, 116, 139, 0.15)', text: tokens.textSecondary };
  return {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '3px 10px',
    borderRadius: radius.sm,
    fontSize: fontSize.xs,
    fontWeight: 600,
    lineHeight: 1.4,
    background: c.bg,
    color: c.text,
  } as CSSProperties;
}

const sectionTitle: CSSProperties = {
  color: tokens.textSecondary,
  fontSize: fontSize.sm,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
};

const inputStyle: CSSProperties = {
  background: tokens.surfaceInset,
  border: `1px solid ${tokens.borderDefault}`,
  color: tokens.textPrimary,
  borderRadius: radius.sm,
  padding: '8px 12px',
  fontSize: fontSize.base,
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box',
};
