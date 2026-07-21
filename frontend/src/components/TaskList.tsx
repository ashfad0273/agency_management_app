import React, { useState, useEffect } from 'react';
import { TaskService, Task } from '../services/TaskService';
import ChatBox from './ChatBox';

interface Props {
  projectId: string;
}

const TASK_STATUSES = ['pending', 'in_progress', 'completed'] as const;

export default function TaskList({ projectId }: Props) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [title, setTitle] = useState('');

  useEffect(() => {
    loadTasks();
  }, [projectId]);

  const loadTasks = async () => {
    try {
      const data = await TaskService.getTasks(projectId);
      setTasks(data);
    } catch (error) {
      console.error('Error loading tasks:', error);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await TaskService.createTask(projectId, title);
      setTitle('');
      loadTasks();
    } catch (error) {
      console.error('Error creating task:', error);
    }
  };

  const handleStatusChange = async (taskId: string, newStatus: string) => {
    try {
      await TaskService.updateTask(taskId, { status: newStatus });
      loadTasks();
    } catch (error) {
      console.error('Error updating task status:', error);
    }
  };

  const handleDelete = async (taskId: string) => {
    if (!window.confirm('Delete this task?')) return;
    try {
      await TaskService.deleteTask(taskId);
      loadTasks();
    } catch (error) {
      console.error('Error deleting task:', error);
    }
  };

  return (
    <div style={{ marginLeft: '20px', marginTop: '10px', borderLeft: '1px solid #ccc', paddingLeft: '10px' }}>
      <h6>Tasks</h6>
      <form onSubmit={handleCreate}>
        <input placeholder="New Task Title" value={title} onChange={(e) => setTitle(e.target.value)} required />
        <button type="submit">Add</button>
      </form>
      <ul>
        {tasks.map((t) => (
          <li key={t.id} style={{ marginBottom: '5px' }}>
            <span style={{ textDecoration: t.status === 'completed' ? 'line-through' : 'none' }}>
              {t.title}
            </span>
            <select
              value={t.status}
              onChange={(e) => handleStatusChange(t.id, e.target.value)}
              style={{ marginLeft: '8px', fontSize: '0.8em' }}
            >
              {TASK_STATUSES.map((s) => (
                <option key={s} value={s}>{s.replace('_', ' ')}</option>
              ))}
            </select>
            <button onClick={() => handleDelete(t.id)} style={{ marginLeft: '5px', color: 'red', fontSize: '0.8em' }}>Delete</button>
          </li>
        ))}
      </ul>
      <ChatBox projectId={projectId} />
    </div>
  );
}