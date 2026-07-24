import { useState, useEffect, FormEvent } from 'react';
import { TaskService, Task } from '../services/TaskService';
import { tokens, sharedStyles, radius, fontSize } from '../theme/tokens';

interface Props {
  projectId: string;
}

const TASK_STATUSES = ['pending', 'in_progress', 'completed'] as const;

export default function TaskList({ projectId }: Props) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [addingTask, setAddingTask] = useState(false);
  const [updatingTaskId, setUpdatingTaskId] = useState<string | null>(null);
  const [deletingTaskId, setDeletingTaskId] = useState<string | null>(null);

  useEffect(() => {
    loadTasks();
  }, [projectId]);

  const loadTasks = async () => {
    setLoading(true);
    try {
      const data = await TaskService.getTasks(projectId);
      setTasks(data);
    } catch (error) {
      console.error('Error loading tasks:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    setAddingTask(true);
    try {
      await TaskService.createTask(projectId, title);
      setTitle('');
      loadTasks();
    } catch (error) {
      console.error('Error creating task:', error);
    }
    setAddingTask(false);
  };

  const handleStatusChange = async (taskId: string, newStatus: string) => {
    setUpdatingTaskId(taskId);
    try {
      await TaskService.updateTask(taskId, { status: newStatus });
      loadTasks();
    } catch (error) {
      console.error('Error updating task status:', error);
    }
    setUpdatingTaskId(null);
  };

  const handleDelete = async (taskId: string) => {
    if (!window.confirm('Delete this task?')) return;
    setDeletingTaskId(taskId);
    try {
      await TaskService.deleteTask(taskId);
      loadTasks();
    } catch (error) {
      console.error('Error deleting task:', error);
    }
    setDeletingTaskId(null);
  };

  const statusColors: Record<string, string> = {
    pending: tokens.textDim,
    in_progress: tokens.accentPrimary,
    completed: tokens.success,
  };

  return (
    <div style={{ marginTop: 12, borderLeft: `2px solid ${tokens.accentPrimary}`, paddingLeft: 16 }}>
      <h6 style={{ color: tokens.accentPrimary, fontSize: fontSize.sm, fontWeight: 600, margin: '0 0 8px' }}>Tasks</h6>
      <form onSubmit={handleCreate} style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
        <input
          placeholder="New Task Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          style={{ ...sharedStyles.input, width: 'auto', flex: 1 }}
        />
        <button type="submit" disabled={addingTask} style={{
          background: tokens.accentPrimary,
          color: '#fff',
          border: `1px solid ${tokens.accentPrimary}`,
          borderRadius: radius.sm,
          padding: '6px 12px',
          fontSize: fontSize.sm,
          fontWeight: 600,
          cursor: 'pointer',
          opacity: addingTask ? 0.6 : 1,
        }}>
          {addingTask ? 'Adding...' : 'Add'}
        </button>
      </form>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {loading ? (
          <li style={{ ...sharedStyles.textMuted }}>Loading tasks...</li>
        ) : tasks.length === 0 ? (
          <li style={{ ...sharedStyles.textMuted }}>No tasks yet</li>
        ) : (
          tasks.map((t) => (
            <li key={t.id} style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '6px 8px',
              borderRadius: radius.sm,
              marginBottom: 4,
              background: 'transparent',
              transition: 'background 0.15s',
            }}>
              <span style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: statusColors[t.status] || tokens.textDim,
                display: 'inline-block',
                flexShrink: 0,
              }} />
              <span style={{
                color: tokens.textPrimary,
                fontSize: fontSize.base,
                textDecoration: t.status === 'completed' ? 'line-through' : 'none',
                flex: 1,
              }}>
                {t.title}
              </span>
              <select
                value={t.status}
                onChange={(e) => handleStatusChange(t.id, e.target.value)}
                disabled={updatingTaskId === t.id}
                style={{
                  background: tokens.surfaceInset,
                  border: `1px solid ${tokens.borderDefault}`,
                  color: tokens.textPrimary,
                  borderRadius: radius.sm,
                  padding: '2px 6px',
                  fontSize: fontSize.xs,
                }}
              >
                {TASK_STATUSES.map((s) => (
                  <option key={s} value={s}>{s.replace('_', ' ')}</option>
                ))}
              </select>
              <button onClick={() => handleDelete(t.id)} disabled={deletingTaskId === t.id} style={{
                background: 'none',
                border: 'none',
                color: tokens.danger,
                fontSize: fontSize.xs,
                cursor: 'pointer',
                padding: '2px 6px',
                opacity: deletingTaskId === t.id ? 0.5 : 1,
              }}>
                {deletingTaskId === t.id ? '...' : '✕'}
              </button>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
