import React, { useState, useEffect } from 'react';
import { MilestoneService, Milestone } from '../services/MilestoneService';

interface Props {
  projectId: string;
}

const MILESTONE_STATUSES = ['pending', 'in_progress', 'completed'] as const;

export default function MilestoneList({ projectId }: Props) {
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');

  useEffect(() => {
    loadMilestones();
  }, [projectId]);

  const loadMilestones = async () => {
    try {
      const data = await MilestoneService.getMilestones(projectId);
      setMilestones(data);
    } catch (error) {
      console.error('Error loading milestones:', error);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await MilestoneService.createMilestone(projectId, name, description, dueDate);
      setName('');
      setDescription('');
      setDueDate('');
      loadMilestones();
    } catch (error) {
      console.error('Error creating milestone:', error);
    }
  };

  const handleStatusChange = async (id: string, status: string) => {
    try {
      await MilestoneService.updateMilestone(id, { status });
      loadMilestones();
    } catch (error) {
      console.error('Error updating milestone status:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this milestone?')) return;
    try {
      await MilestoneService.deleteMilestone(id);
      loadMilestones();
    } catch (error) {
      console.error('Error deleting milestone:', error);
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'No due date';
    return new Date(dateStr).toLocaleDateString();
  };

  return (
    <div style={{ marginLeft: '20px', marginTop: '10px', borderLeft: '2px solid #4a90d9', paddingLeft: '10px' }}>
      <h6 style={{ color: '#4a90d9' }}>Milestones</h6>
      <form onSubmit={handleCreate} style={{ marginBottom: '10px' }}>
        <input placeholder="Milestone Name" value={name} onChange={(e) => setName(e.target.value)} required style={{ marginRight: '5px' }} />
        <input placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} style={{ marginRight: '5px' }} />
        <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} style={{ marginRight: '5px' }} />
        <button type="submit">Add Milestone</button>
      </form>
      <ul>
        {milestones.map((m) => (
          <li key={m.id} style={{ marginBottom: '8px' }}>
            <div>
              <strong style={{ textDecoration: m.status === 'completed' ? 'line-through' : 'none' }}>{m.name}</strong>
              {m.description && <span> — {m.description}</span>}
              <br />
              <small>Due: {formatDate(m.due_date)}</small>
              <select
                value={m.status}
                onChange={(e) => handleStatusChange(m.id, e.target.value)}
                style={{ marginLeft: '8px', fontSize: '0.8em' }}
              >
                {MILESTONE_STATUSES.map((s) => (
                  <option key={s} value={s}>{s.replace('_', ' ')}</option>
                ))}
              </select>
              <button onClick={() => handleDelete(m.id)} style={{ marginLeft: '5px', color: 'red', fontSize: '0.8em' }}>Delete</button>
            </div>
          </li>
        ))}
        {milestones.length === 0 && <li style={{ color: '#888' }}>No milestones yet</li>}
      </ul>
    </div>
  );
}