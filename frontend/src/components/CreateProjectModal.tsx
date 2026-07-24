import { useState, useEffect, useRef, CSSProperties } from 'react';
import { ProjectMemberService } from '../services/ProjectMemberService';
import { tokens, radius, fontSize } from '../theme/tokens';

interface OrgMember {
  id: string;
  email: string | null;
  selected?: boolean;
}

interface TaskRow {
  id: string;
  title: string;
}

interface MilestoneRow {
  id: string;
  name: string;
  dueDate: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onCreate: (data: {
    name: string;
    description: string;
    deadline: string;
    memberIds: string[];
    initialTasks: string[];
    initialMilestones: { name: string; due_date: string }[];
  }) => Promise<void>;
}

let rowId = 0;
const nextRowId = () => `row_${++rowId}`;

export default function CreateProjectModal({ open, onClose, onCreate }: Props) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [deadline, setDeadline] = useState('');
  const [orgMembers, setOrgMembers] = useState<OrgMember[]>([]);
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [milestones, setMilestones] = useState<MilestoneRow[]>([]);
  const [creating, setCreating] = useState(false);
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [showEmployeeDropdown, setShowEmployeeDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setName('');
      setDescription('');
      setDeadline('');
      setTasks([]);
      setMilestones([]);
      setEmployeeSearch('');
      setShowEmployeeDropdown(false);
      setCreating(false);
      ProjectMemberService.getOrgMembers()
        .then((members) => setOrgMembers(members.map(m => ({ ...m, selected: false }))))
        .catch(console.error);
    }
  }, [open]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowEmployeeDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const toggleMember = (id: string) => {
    setOrgMembers(prev => prev.map(m => m.id === id ? { ...m, selected: !m.selected } : m));
  };

  const selectedMembers = orgMembers.filter(m => m.selected);
  const filteredMembers = orgMembers.filter(m => {
    if (!employeeSearch) return true;
    return (m.email || '').toLowerCase().includes(employeeSearch.toLowerCase());
  });

  const addTask = () => setTasks(prev => [...prev, { id: nextRowId(), title: '' }]);
  const updateTask = (id: string, title: string) => setTasks(prev => prev.map(t => t.id === id ? { ...t, title } : t));
  const removeTask = (id: string) => setTasks(prev => prev.filter(t => t.id !== id));

  const addMilestone = () => setMilestones(prev => [...prev, { id: nextRowId(), name: '', dueDate: '' }]);
  const updateMilestone = (id: string, field: 'name' | 'dueDate', value: string) => setMilestones(prev => prev.map(m => m.id === id ? { ...m, [field]: value } : m));
  const removeMilestone = (id: string) => setMilestones(prev => prev.filter(m => m.id !== id));

  const handleSubmit = async () => {
    if (!name.trim()) return;
    setCreating(true);
    try {
      await onCreate({
        name: name.trim(),
        description: description.trim(),
        deadline,
        memberIds: selectedMembers.map(m => m.id),
        initialTasks: tasks.map(t => t.title).filter(Boolean),
        initialMilestones: milestones.filter(m => m.name.trim()).map(m => ({ name: m.name.trim(), due_date: m.dueDate || '' })),
      });
    } catch {
      setCreating(false);
    }
  };

  if (!open) return null;

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        animation: 'fade-in 0.15s ease',
      }}
    >
      <div style={{
        background: tokens.surfaceFloat,
        border: `1px solid ${tokens.borderDefault}`,
        borderRadius: radius.lg,
        width: 540,
        maxWidth: '90vw',
        maxHeight: '85vh',
        display: 'flex',
        flexDirection: 'column',
        animation: 'slide-down 0.2s ease-out',
      }}>
        {/* Header */}
        <div style={{
          padding: '18px 22px',
          borderBottom: `1px solid ${tokens.borderDefault}`,
        }}>
          <h2 style={{ margin: 0, color: tokens.textPrimary, fontSize: fontSize.lg, fontWeight: 600 }}>
            Create New Project
          </h2>
        </div>

        {/* Scrollable Form */}
        <div style={{ padding: '18px 22px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Project Name */}
          <div>
            <label style={labelStyle}>Project Name</label>
            <input
              placeholder="Enter project name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={inputStyle}
              autoFocus
            />
          </div>

          {/* Description */}
          <div>
            <label style={labelStyle}>Description</label>
            <textarea
              placeholder="Describe the project..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
            />
          </div>

          {/* Deadline */}
          <div>
            <label style={labelStyle}>Deadline</label>
            <input
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              style={{ ...inputStyle, width: 'auto' }}
            />
          </div>

          {/* Assign Employees */}
          <div ref={dropdownRef} style={{ position: 'relative' }}>
            <label style={labelStyle}>Assign Employees</label>
            <div
              onClick={() => setShowEmployeeDropdown(!showEmployeeDropdown)}
              style={{
                ...inputStyle,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 4,
                minHeight: 36,
              }}
            >
              {selectedMembers.length === 0 && (
                <span style={{ color: tokens.textDim }}>Select team members...</span>
              )}
              {selectedMembers.map(m => (
                <span key={m.id} style={{
                  background: tokens.accentMuted,
                  color: tokens.accentPrimary,
                  borderRadius: radius.sm,
                  padding: '2px 8px',
                  fontSize: fontSize.xs,
                  fontWeight: 500,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                }}>
                  {m.email ? m.email.split('@')[0] : '?'}
                  <span
                    onClick={(e) => { e.stopPropagation(); toggleMember(m.id); }}
                    style={{ cursor: 'pointer', opacity: 0.7 }}
                  >
                    ✕
                  </span>
                </span>
              ))}
            </div>

            {showEmployeeDropdown && (
              <div style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                marginTop: 4,
                background: tokens.surfaceFloat,
                border: `1px solid ${tokens.borderDefault}`,
                borderRadius: radius.sm,
                zIndex: 1100,
                maxHeight: 200,
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
              }}>
                <div style={{ padding: '6px 8px', borderBottom: `1px solid ${tokens.borderDefault}` }}>
                  <input
                    placeholder="Search..."
                    value={employeeSearch}
                    onChange={(e) => setEmployeeSearch(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    style={{ ...inputStyle, fontSize: fontSize.sm }}
                  />
                </div>
                <div style={{ overflowY: 'auto', flex: 1 }}>
                  {filteredMembers.length === 0 ? (
                    <div style={{ padding: 12, color: tokens.textDim, fontSize: fontSize.sm, textAlign: 'center' }}>
                      No members found
                    </div>
                  ) : (
                    filteredMembers.map(m => (
                      <div
                        key={m.id}
                        onClick={() => toggleMember(m.id)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          padding: '7px 10px',
                          cursor: 'pointer',
                          background: m.selected ? tokens.accentMuted : 'transparent',
                          transition: 'background 0.1s',
                        }}
                      >
                        <div style={{
                          width: 20,
                          height: 20,
                          borderRadius: 4,
                          border: `1px solid ${m.selected ? tokens.accentPrimary : tokens.borderDefault}`,
                          background: m.selected ? tokens.accentPrimary : 'transparent',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#fff',
                          fontSize: 11,
                          fontWeight: 700,
                          flexShrink: 0,
                        }}>
                          {m.selected ? '✓' : ''}
                        </div>
                        <div style={{
                          width: 24,
                          height: 24,
                          borderRadius: '50%',
                          background: tokens.surfaceHover,
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
                        <span style={{ color: tokens.textPrimary, fontSize: fontSize.base }}>
                          {m.email || 'Unknown'}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Initial Tasks */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <label style={labelStyle}>Initial Tasks</label>
              <button onClick={addTask} style={ghostBtn}>+ Add Task</button>
            </div>
            {tasks.length === 0 && (
              <div style={{ color: tokens.textDim, fontSize: fontSize.sm }}>No tasks added yet</div>
            )}
            {tasks.map(t => (
              <div key={t.id} style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                <input
                  placeholder="Task title"
                  value={t.title}
                  onChange={(e) => updateTask(t.id, e.target.value)}
                  style={{ ...inputStyle, flex: 1 }}
                />
                <button onClick={() => removeTask(t.id)} style={{ ...ghostBtn, color: tokens.danger }}>✕</button>
              </div>
            ))}
          </div>

          {/* Initial Milestones */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <label style={labelStyle}>Initial Milestones</label>
              <button onClick={addMilestone} style={ghostBtn}>+ Add Milestone</button>
            </div>
            {milestones.length === 0 && (
              <div style={{ color: tokens.textDim, fontSize: fontSize.sm }}>No milestones added yet</div>
            )}
            {milestones.map(m => (
              <div key={m.id} style={{ display: 'flex', gap: 6, marginBottom: 6, alignItems: 'center' }}>
                <input
                  placeholder="Milestone name"
                  value={m.name}
                  onChange={(e) => updateMilestone(m.id, 'name', e.target.value)}
                  style={{ ...inputStyle, flex: 1 }}
                />
                <input
                  type="date"
                  value={m.dueDate}
                  onChange={(e) => updateMilestone(m.id, 'dueDate', e.target.value)}
                  style={{ ...inputStyle, width: 150 }}
                />
                <button onClick={() => removeMilestone(m.id)} style={{ ...ghostBtn, color: tokens.danger }}>✕</button>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: '14px 22px',
          borderTop: `1px solid ${tokens.borderDefault}`,
          display: 'flex',
          justifyContent: 'flex-end',
          gap: 8,
        }}>
          <button onClick={onClose} disabled={creating} style={ghostBtn}>Cancel</button>
          <button
            onClick={handleSubmit}
            disabled={creating || !name.trim()}
            style={{
              background: tokens.accentPrimary,
              color: '#fff',
              border: `1px solid ${tokens.accentPrimary}`,
              borderRadius: radius.sm,
              padding: '9px 20px',
              fontSize: fontSize.base,
              fontWeight: 600,
              cursor: creating || !name.trim() ? 'not-allowed' : 'pointer',
              opacity: creating || !name.trim() ? 0.6 : 1,
              transition: 'all 0.15s ease',
            }}
          >
            {creating ? 'Creating...' : 'Create Project'}
          </button>
        </div>
      </div>
    </div>
  );
}

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

const labelStyle: CSSProperties = {
  color: tokens.textSecondary,
  fontSize: fontSize.sm,
  fontWeight: 600,
  marginBottom: 6,
  display: 'block',
};

const ghostBtn: CSSProperties = {
  background: 'transparent',
  color: tokens.textSecondary,
  border: `1px solid ${tokens.borderDefault}`,
  borderRadius: radius.sm,
  padding: '6px 12px',
  fontSize: fontSize.sm,
  fontWeight: 500,
  cursor: 'pointer',
  transition: 'all 0.15s ease',
};
