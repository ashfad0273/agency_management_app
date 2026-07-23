import { useState, useEffect, FormEvent } from 'react';
import { ProjectService, Project } from '../services/ProjectService';
import { ChatService } from '../services/ChatService';
import { usePermission, Permissions } from '../hooks/usePermission';

import TaskList from './TaskList';
import MilestoneList from './MilestoneList';

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

  useEffect(() => {
    loadProjects();
  }, []);

  // Fetch project unread counts whenever projects list changes
  useEffect(() => {
    if (projects.length === 0) return;
    const fetchProjectUnreads = async () => {
      const counts: Record<string, number> = {};
      for (const p of projects) {
        try {
          const count = await ChatService.getUnreadCount(p.id);
          if (count > 0) counts[p.id] = count;
        } catch {
          // ignore errors for individual project counts
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
    console.log("Attempting to create project:", name, description);
    try {
      const newProject = await ProjectService.createProject(name, description);
      console.log("Project created:", newProject);
      setName('');
      setDescription('');
      loadProjects(); // Refresh list
    } catch (error) {
      console.error('Error creating project:', error);
      alert('Error creating project: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
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
    try {
      await ProjectService.updateProject(id, { name: editName, description: editDescription });
      setEditingProjectId(null);
      loadProjects();
    } catch (error) {
      console.error('Error updating project:', error);
      alert('Error updating project: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this project? This action cannot be undone.')) return;
    try {
      await ProjectService.deleteProject(id);
      if (selectedProjectId === id) setSelectedProjectId(null);
      if (selectedMilestoneProjectId === id) setSelectedMilestoneProjectId(null);
      loadProjects();
    } catch (error) {
      console.error('Error deleting project:', error);
      alert('Error deleting project: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  const toggleTasks = (projectId: string) => {
    setSelectedProjectId(selectedProjectId === projectId ? null : projectId);
    setSelectedMilestoneProjectId(null);
    // Clear the unread badge for this project when opening its chat/tasks
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

  return (
    <div style={{ padding: '20px' }}>
      <h2>Projects</h2>
      
      {canCreate && (
        <form onSubmit={handleCreate} style={{ marginBottom: '20px' }}>
          <input placeholder="Project Name" value={name} onChange={(e) => setName(e.target.value)} required />
          <input placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
          <button type="submit">Create Project</button>
        </form>
      )}

      <ul>
        {loading ? (
          <li style={{ color: '#888' }}>Loading projects...</li>
        ) : projects.length === 0 ? (
          <li style={{ color: '#888' }}>No projects yet. Create one above!</li>
        ) : (
          projects.map((p) => (
            <li key={p.id} style={{ marginBottom: '10px' }}>
              {editingProjectId === p.id ? (
                <div style={{ marginBottom: '10px', padding: '10px', border: '1px solid #ccc', background: '#f9f9f9' }}>
                  <input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Project Name" style={{ marginRight: '5px' }} />
                  <input value={editDescription} onChange={(e) => setEditDescription(e.target.value)} placeholder="Description" style={{ marginRight: '5px' }} />
                  <button onClick={() => handleUpdate(p.id)} style={{ marginRight: '5px' }}>Save</button>
                  <button onClick={cancelEditing}>Cancel</button>
                </div>
              ) : (
                <div>
                  <strong>{p.name}</strong> - {p.description}
                  {canUpdate && (
                    <button onClick={() => startEditing(p)} style={{ marginLeft: '10px' }}>Edit</button>
                  )}
                  {canDelete && (
                    <button onClick={() => handleDelete(p.id)} style={{ marginLeft: '5px', color: 'red' }}>Delete</button>
                  )}
                  <button
                    onClick={() => toggleTasks(p.id)}
                    style={{ marginLeft: '5px', position: 'relative' }}
                  >
                    {selectedProjectId === p.id ? 'Hide Tasks' : 'View Tasks'}
                    {unreadCounts[p.id] && selectedProjectId !== p.id && (
                      <span style={{
                        position: 'absolute',
                        top: '-8px',
                        right: '-12px',
                        background: 'red',
                        color: 'white',
                        borderRadius: '50%',
                        padding: '2px 6px',
                        fontSize: '0.7em',
                        fontWeight: 'bold',
                        lineHeight: '1',
                      }}>
                        {unreadCounts[p.id] > 99 ? '99+' : unreadCounts[p.id]}
                      </span>
                    )}
                  </button>
                  <button onClick={() => toggleMilestones(p.id)} style={{ marginLeft: '5px' }}>
                    {selectedMilestoneProjectId === p.id ? 'Hide Milestones' : 'View Milestones'}
                  </button>
                  {selectedProjectId === p.id && <TaskList projectId={p.id} />}
                  {selectedMilestoneProjectId === p.id && <MilestoneList projectId={p.id} />}
                </div>
              )}
            </li>
          ))
        )}
      </ul>
    </div>
  );
}