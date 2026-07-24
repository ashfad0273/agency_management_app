import { useState, useEffect, FormEvent } from 'react';
import { MilestoneService, Milestone } from '../services/MilestoneService';
import { tokens, sharedStyles, radius, fontSize } from '../theme/tokens';

interface Props {
  projectId: string;
}

const MILESTONE_STATUSES = ['pending', 'in_progress', 'completed'] as const;

export default function MilestoneList({ projectId }: Props) {
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [addingMilestone, setAddingMilestone] = useState(false);
  const [updatingMilestoneId, setUpdatingMilestoneId] = useState<string | null>(null);
  const [deletingMilestoneId, setDeletingMilestoneId] = useState<string | null>(null);

  useEffect(() => {
    loadMilestones();
  }, [projectId]);

  const loadMilestones = async () => {
    setLoading(true);
    try {
      const data = await MilestoneService.getMilestones(projectId);
      setMilestones(data);
    } catch (error) {
      console.error('Error loading milestones:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    setAddingMilestone(true);
    try {
      await MilestoneService.createMilestone(projectId, name, description, dueDate);
      setName('');
      setDescription('');
      setDueDate('');
      loadMilestones();
    } catch (error) {
      console.error('Error creating milestone:', error);
    }
    setAddingMilestone(false);
  };

  const handleStatusChange = async (id: string, status: string) => {
    setUpdatingMilestoneId(id);
    try {
      await MilestoneService.updateMilestone(id, { status });
      loadMilestones();
    } catch (error) {
      console.error('Error updating milestone status:', error);
    }
    setUpdatingMilestoneId(null);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this milestone?')) return;
    setDeletingMilestoneId(id);
    try {
      await MilestoneService.deleteMilestone(id);
      loadMilestones();
    } catch (error) {
      console.error('Error deleting milestone:', error);
    }
    setDeletingMilestoneId(null);
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'No due date';
    return new Date(dateStr).toLocaleDateString();
  };

  const statusColors: Record<string, string> = {
    pending: tokens.textDim,
    in_progress: tokens.accentPrimary,
    completed: tokens.success,
  };

  return (
    <div style={{ marginTop: 12, borderLeft: `2px solid ${tokens.accentPrimary}`, paddingLeft: 16 }}>
      <h6 style={{ color: tokens.accentPrimary, fontSize: fontSize.sm, fontWeight: 600, margin: '0 0 8px' }}>Milestones</h6>
      <form onSubmit={handleCreate} style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
        <input placeholder="Milestone Name" value={name} onChange={(e) => setName(e.target.value)} required style={{ ...sharedStyles.input, width: 'auto', flex: '1 1 140px' }} />
        <input placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} style={{ ...sharedStyles.input, width: 'auto', flex: '1 1 140px' }} />
        <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} style={{ ...sharedStyles.input, width: 'auto', flex: '0 0 auto' }} />
        <button type="submit" disabled={addingMilestone} style={{
          background: tokens.accentPrimary,
          color: '#fff',
          border: `1px solid ${tokens.accentPrimary}`,
          borderRadius: radius.sm,
          padding: '6px 12px',
          fontSize: fontSize.sm,
          fontWeight: 600,
          cursor: 'pointer',
          opacity: addingMilestone ? 0.6 : 1,
        }}>
          {addingMilestone ? 'Adding...' : 'Add Milestone'}
        </button>
      </form>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {loading ? (
          <li style={{ ...sharedStyles.textMuted }}>Loading milestones...</li>
        ) : milestones.length === 0 ? (
          <li style={{ ...sharedStyles.textMuted }}>No milestones yet</li>
        ) : (
          milestones.map((m) => (
            <li key={m.id} style={{
              padding: '8px 10px',
              borderRadius: radius.sm,
              marginBottom: 6,
              background: tokens.surfaceInset,
              border: `1px solid ${tokens.borderDefault}`,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: statusColors[m.status] || tokens.textDim,
                  display: 'inline-block',
                  flexShrink: 0,
                }} />
                <div style={{ flex: 1 }}>
                  <strong style={{
                    color: tokens.textPrimary,
                    fontSize: fontSize.base,
                    textDecoration: m.status === 'completed' ? 'line-through' : 'none',
                  }}>
                    {m.name}
                  </strong>
                  {m.description && (
                    <span style={{ color: tokens.textSecondary, fontSize: fontSize.base, marginLeft: 6 }}>— {m.description}</span>
                  )}
                  <div style={{ color: tokens.textDim, fontSize: fontSize.xs, marginTop: 2 }}>
                    Due: {formatDate(m.due_date)}
                  </div>
                </div>
                <select
                  value={m.status}
                  onChange={(e) => handleStatusChange(m.id, e.target.value)}
                  disabled={updatingMilestoneId === m.id}
                  style={{
                    background: tokens.surfaceInset,
                    border: `1px solid ${tokens.borderDefault}`,
                    color: tokens.textPrimary,
                    borderRadius: radius.sm,
                    padding: '2px 6px',
                    fontSize: fontSize.xs,
                  }}
                >
                  {MILESTONE_STATUSES.map((s) => (
                    <option key={s} value={s}>{s.replace('_', ' ')}</option>
                  ))}
                </select>
                <button onClick={() => handleDelete(m.id)} disabled={deletingMilestoneId === m.id} style={{
                  background: 'none',
                  border: 'none',
                  color: tokens.danger,
                  fontSize: fontSize.xs,
                  cursor: 'pointer',
                  padding: '2px 6px',
                  opacity: deletingMilestoneId === m.id ? 0.5 : 1,
                }}>
                  {deletingMilestoneId === m.id ? '...' : '✕'}
                </button>
              </div>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
