import { useState, useEffect } from 'react';
import { ProjectService, ProjectCardData } from '../services/ProjectService';
import { tokens, radius, fontSize, sharedStyles } from '../theme/tokens';
import { usePermission, Permissions } from '../hooks/usePermission';
import ProjectCard from '../components/ProjectCard';
import CreateProjectModal from '../components/CreateProjectModal';
import ProjectDetailDrawer from '../components/ProjectDetailDrawer';

const STATUS_FILTERS = [
  { value: 'all', label: 'All Status' },
  { value: 'active', label: 'Active' },
  { value: 'on_hold', label: 'On Hold' },
  { value: 'completed', label: 'Completed' },
];

export default function ProjectsPage() {
  const { can } = usePermission();
  const canCreate = can(Permissions.Project.Create);
  const canDelete = can(Permissions.Project.Delete);

  const [projects, setProjects] = useState<ProjectCardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<ProjectCardData | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const showFeedback = (type: 'success' | 'error', message: string) => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 3000);
  };

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    setLoading(true);
    try {
      const data = await ProjectService.getProjectsWithDetails();
      setProjects(data);
    } catch (error) {
      console.error('Error loading projects:', error);
      showFeedback('error', 'Failed to load projects');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (data: {
    name: string;
    description: string;
    deadline: string;
    memberIds: string[];
    initialTasks: string[];
    initialMilestones: { name: string; due_date: string }[];
  }) => {
    try {
      await ProjectService.createProject({
        name: data.name,
        description: data.description || undefined,
        deadline: data.deadline || null,
        memberIds: data.memberIds,
        initialTasks: data.initialTasks,
        initialMilestones: data.initialMilestones,
      });
      setModalOpen(false);
      showFeedback('success', 'Project created successfully');
      loadProjects();
    } catch (error) {
      showFeedback('error', 'Error creating project: ' + (error instanceof Error ? error.message : 'Unknown error'));
      throw error;
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this project? This action cannot be undone.')) return;
    try {
      await ProjectService.deleteProject(id);
      setSelectedProject(null);
      showFeedback('success', 'Project deleted');
      loadProjects();
    } catch (error) {
      showFeedback('error', 'Error deleting project: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  const filteredProjects = projects.filter(p => {
    const q = search.toLowerCase();
    if (search && !p.name.toLowerCase().includes(q) && !(p.description || '').toLowerCase().includes(q)) return false;
    if (statusFilter !== 'all' && p.status !== statusFilter) return false;
    return true;
  });

  return (
    <div>
      {/* Feedback banner */}
      {feedback && (
        <div style={{ ...sharedStyles.feedbackBanner(feedback.type), marginBottom: 16 }}>
          {feedback.message}
        </div>
      )}

      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ color: tokens.textPrimary, fontSize: fontSize.lg, fontWeight: 600, margin: 0 }}>
            Projects
          </h2>
          <p style={{ color: tokens.textDim, fontSize: fontSize.sm, margin: '4px 0 0' }}>
            {loading ? 'Loading...' : `${projects.length} project${projects.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        {canCreate && (
          <button
            onClick={() => setModalOpen(true)}
            style={{
              background: tokens.accentPrimary,
              color: '#fff',
              border: `1px solid ${tokens.accentPrimary}`,
              borderRadius: radius.sm,
              padding: '9px 20px',
              fontSize: fontSize.base,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              whiteSpace: 'nowrap',
            }}
          >
            + Create Project
          </button>
        )}
      </div>

      {/* Search & Filter Bar */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 280px' }}>
          <input
            placeholder="Search projects by name or description..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={sharedStyles.input}
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{ ...sharedStyles.input, width: 'auto', minWidth: 130 }}
        >
          {STATUS_FILTERS.map(f => (
            <option key={f.value} value={f.value}>{f.label}</option>
          ))}
        </select>
      </div>

      {/* Project Grid */}
      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} style={{ ...sharedStyles.shimmer, height: 200 }} />
          ))}
        </div>
      ) : filteredProjects.length === 0 ? (
        <div style={{
          ...sharedStyles.cardFloating,
          padding: 40,
          textAlign: 'center',
          color: tokens.textDim,
          fontSize: fontSize.base,
        }}>
          {search || statusFilter !== 'all'
            ? 'No projects match your search criteria.'
            : 'No projects yet. Create your first project to get started!'}
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
          gap: 16,
        }}>
          {filteredProjects.map(p => (
            <ProjectCard
              key={p.id}
              project={p}
              onClick={() => setSelectedProject(p)}
            />
          ))}
        </div>
      )}

      {/* Create Project Modal */}
      <CreateProjectModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreate={handleCreate}
      />

      {/* Project Detail Drawer */}
      <ProjectDetailDrawer
        project={selectedProject}
        open={!!selectedProject}
        onClose={() => setSelectedProject(null)}
        onUpdate={loadProjects}
        onDelete={canDelete ? handleDelete : () => {}}
      />
    </div>
  );
}
