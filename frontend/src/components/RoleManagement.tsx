import { useState, useEffect, FormEvent } from 'react';
import {
  RoleService,
  RoleWithPermissions,
  Permission,
} from '../services/RoleService';
import { usePermission, Permissions } from '../hooks/usePermission';
import { tokens, sharedStyles, radius, fontSize } from '../theme/tokens';

export default function RoleManagement() {
  const { can, loading: permLoading } = usePermission();
  const canManageRoles = can(Permissions.User.ManageRoles);

  const [roles, setRoles] = useState<RoleWithPermissions[]>([]);
  const [allPermissions, setAllPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [selectedPermissions, setSelectedPermissions] = useState<Set<string>>(new Set());
  const [hasUnsaved, setHasUnsaved] = useState(false);

  const [users, setUsers] = useState<Array<{ id: string; email: string | null; role_name: string | null; role_id: string | null }>>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [assigningRole, setAssigningRole] = useState(false);
  const [savingPermissions, setSavingPermissions] = useState(false);
  const [deletingRoleId, setDeletingRoleId] = useState<string | null>(null);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleDesc, setNewRoleDesc] = useState('');
  const [creatingRole, setCreatingRole] = useState(false);

  const [editingRoleId, setEditingRoleId] = useState<string | null>(null);
  const [editRoleName, setEditRoleName] = useState('');
  const [editRoleDesc, setEditRoleDesc] = useState('');
  const [updatingRoleId, setUpdatingRoleId] = useState<string | null>(null);

  const showFeedback = (type: 'success' | 'error', message: string) => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 3000);
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (selectedRoleId) {
      const role = roles.find(r => r.id === selectedRoleId);
      if (role) {
        setSelectedPermissions(new Set(role.permissions));
        setHasUnsaved(false);
        loadUsers();
      }
    }
  }, [selectedRoleId, roles]);

  const loadData = async () => {
    setLoading(true);
    const [roleData, permData] = await Promise.all([
      RoleService.getRolesWithUserCounts().catch(() => []),
      RoleService.getPermissions().catch(() => []),
    ]);
    setRoles(roleData);
    setAllPermissions(permData);
    setLoading(false);
    if (roleData.length > 0 && !selectedRoleId) {
      setSelectedRoleId(roleData[0].id);
    }
  };

  const loadUsers = async () => {
    try {
      const userData = await RoleService.getProfilesWithRoles();
      setUsers(userData);
    } catch (err) {
      console.error('Failed to load users:', err);
    }
  };

  const handleCreateRole = async (e: FormEvent) => {
    e.preventDefault();
    if (!newRoleName.trim()) return;
    setCreatingRole(true);
    try {
      await RoleService.createRole(newRoleName.trim(), newRoleDesc.trim());
      setNewRoleName('');
      setNewRoleDesc('');
      setShowCreateModal(false);
      await loadData();
      showFeedback('success', 'Role created successfully!');
    } catch (err) {
      showFeedback('error', 'Error creating role: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
    setCreatingRole(false);
  };

  const handleUpdateRole = async (roleId: string) => {
    setUpdatingRoleId(roleId);
    try {
      await RoleService.updateRole(roleId, { name: editRoleName.trim(), description: editRoleDesc.trim() });
      setEditingRoleId(null);
      await loadData();
      showFeedback('success', 'Role updated successfully!');
    } catch (err) {
      showFeedback('error', 'Error updating role: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
    setUpdatingRoleId(null);
  };

  const handleDeleteRole = async (role: RoleWithPermissions) => {
    if (role.user_count && role.user_count > 0) {
      if (!window.confirm(`This role has ${role.user_count} user(s) assigned. Deleting it will unset their roles. Continue?`)) return;
    } else {
      if (!window.confirm(`Delete the role "${role.name}"? This cannot be undone.`)) return;
    }
    setDeletingRoleId(role.id);
    try {
      await RoleService.deleteRole(role.id);
      if (selectedRoleId === role.id) setSelectedRoleId(null);
      await loadData();
      showFeedback('success', 'Role deleted successfully!');
    } catch (err) {
      showFeedback('error', 'Error deleting role: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
    setDeletingRoleId(null);
  };

  const togglePermission = (key: string) => {
    setSelectedPermissions(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
    setHasUnsaved(true);
  };

  const savePermissions = async () => {
    if (!selectedRoleId) return;
    setSavingPermissions(true);
    try {
      await RoleService.setRolePermissions(selectedRoleId, Array.from(selectedPermissions));
      await loadData();
      setHasUnsaved(false);
      showFeedback('success', 'Permissions saved successfully!');
    } catch (err) {
      showFeedback('error', 'Error saving permissions: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
    setSavingPermissions(false);
  };

  const discardChanges = () => {
    const role = roles.find(r => r.id === selectedRoleId);
    if (role) {
      setSelectedPermissions(new Set(role.permissions));
      setHasUnsaved(false);
    }
  };

  const handleAssignRole = async () => {
    if (!selectedUserId || !selectedRoleId) return;
    setAssigningRole(true);
    try {
      await RoleService.assignRoleToUser(selectedUserId, selectedRoleId);
      setSelectedUserId(null);
      await loadUsers();
      await loadData();
      showFeedback('success', 'Role assigned successfully!');
    } catch (err) {
      showFeedback('error', 'Error assigning role: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
    setAssigningRole(false);
  };

  const selectedRole = roles.find(r => r.id === selectedRoleId);

  const groupedPermissions = allPermissions.reduce<Record<string, Permission[]>>((acc, p) => {
    if (!acc[p.group_name]) acc[p.group_name] = [];
    acc[p.group_name].push(p);
    return acc;
  }, {});

  const groupIcons: Record<string, string> = {
    chat: '💬',
    project: '📁',
    report: '📊',
    settings: '⚙',
    user_management: '👥',
  };

  if (permLoading) {
    return <div style={{ ...sharedStyles.textMuted, padding: 20 }}>Checking permissions...</div>;
  }

  if (!canManageRoles) {
    return (
      <div style={{ ...sharedStyles.textMuted, padding: 20 }}>
        You do not have permission to manage roles. Contact your organization administrator.
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', gap: 16 }}>
        <div style={{ width: 350, minWidth: 350 }}>
          <div style={{ ...sharedStyles.shimmer, height: 48, marginBottom: 8 }} />
          {[1, 2, 3, 4].map(i => <div key={i} style={{ ...sharedStyles.shimmer, height: 72, marginBottom: 6 }} />)}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ ...sharedStyles.shimmer, height: '100%', minHeight: 400 }} />
        </div>
      </div>
    );
  }

  const btnPrimary = {
    background: tokens.accentPrimary,
    color: '#fff',
    border: `1px solid ${tokens.accentPrimary}`,
    borderRadius: radius.sm,
    padding: '8px 16px',
    fontSize: fontSize.base,
    fontWeight: 600,
    cursor: 'pointer' as const,
    transition: 'all 0.15s ease',
  };

  return (
    <div>
      {feedback && (
        <div style={{ ...sharedStyles.feedbackBanner(feedback.type), marginBottom: 16 }}>
          {feedback.message}
        </div>
      )}

      {/* Create Role Modal */}
      {showCreateModal && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
            animation: 'fade-in 0.15s ease-out',
          }}
          onClick={() => setShowCreateModal(false)}
        >
          <div
            style={{
              background: tokens.surfaceFloat, border: `1px solid ${tokens.borderDefault}`,
              borderRadius: radius.lg, padding: 24, width: 420, maxWidth: '90vw',
              animation: 'slide-down 0.2s ease-out',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ color: tokens.textPrimary, fontSize: fontSize.md, fontWeight: 600, margin: '0 0 16px' }}>
              Create New Role
            </h3>
            <form onSubmit={handleCreateRole}>
              <div style={{ marginBottom: 12 }}>
                <label style={{ color: tokens.textSecondary, fontSize: fontSize.sm, fontWeight: 500, display: 'block', marginBottom: 4 }}>
                  Role Name
                </label>
                <input
                  value={newRoleName}
                  onChange={(e) => setNewRoleName(e.target.value)}
                  placeholder="e.g., Designer"
                  required
                  autoFocus
                  style={sharedStyles.input}
                />
              </div>
              <div style={{ marginBottom: 20 }}>
                <label style={{ color: tokens.textSecondary, fontSize: fontSize.sm, fontWeight: 500, display: 'block', marginBottom: 4 }}>
                  Description
                </label>
                <input
                  value={newRoleDesc}
                  onChange={(e) => setNewRoleDesc(e.target.value)}
                  placeholder="Brief description of this role"
                  style={sharedStyles.input}
                />
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setShowCreateModal(false)} style={sharedStyles.btnGhost}>Cancel</button>
                <button type="submit" disabled={creatingRole} style={{ ...btnPrimary, opacity: creatingRole ? 0.6 : 1 }}>
                  {creatingRole ? 'Creating...' : 'Create Role'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Master-Detail Layout */}
      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
        {/* Left Column — Role Selector */}
        <div style={{
          width: 350,
          minWidth: 350,
          background: tokens.surfaceFloat,
          border: `1px solid ${tokens.borderDefault}`,
          borderRadius: radius.lg,
          display: 'flex',
          flexDirection: 'column',
          maxHeight: 'calc(100vh - 240px)',
        }}>
          {/* Left Header */}
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '14px 16px',
            borderBottom: `1px solid ${tokens.borderDefault}`,
          }}>
            <span style={{ color: tokens.textPrimary, fontSize: fontSize.md, fontWeight: 600 }}>Roles</span>
            <button onClick={() => setShowCreateModal(true)} style={{
              ...sharedStyles.btnGhost,
              display: 'flex', alignItems: 'center', gap: 4,
              color: tokens.accentPrimary, borderColor: tokens.accentPrimary,
              padding: '4px 10px', fontSize: fontSize.sm,
            }}>
              + Create
            </button>
          </div>

          {/* Role List */}
          <div style={{ flex: 1, overflowY: 'auto', padding: 8 }}>
            {roles.map((role) => {
              const isSelected = selectedRoleId === role.id;
              return (
                <div
                  key={role.id}
                  onClick={() => {
                    if (hasUnsaved && !window.confirm('You have unsaved changes. Discard them?')) return;
                    setSelectedRoleId(role.id);
                  }}
                  style={{
                    padding: '12px 14px',
                    borderRadius: radius.md,
                    cursor: 'pointer',
                    background: isSelected ? tokens.surfaceHover : 'transparent',
                    borderLeft: isSelected ? `2px solid ${tokens.accentPrimary}` : '2px solid transparent',
                    marginBottom: 4,
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                    <span style={{ color: tokens.textPrimary, fontSize: fontSize.base, fontWeight: isSelected ? 600 : 500 }}>
                      {role.name}
                    </span>
                    <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                      {role.is_system && (
                        <span style={{
                          ...sharedStyles.badge('info'),
                          fontSize: 10,
                          padding: '1px 6px',
                        }}>
                          System
                        </span>
                      )}
                      <span style={{
                        color: tokens.textDim,
                        fontSize: fontSize.xs,
                        background: tokens.surfaceInset,
                        padding: '2px 7px',
                        borderRadius: radius.sm,
                        fontWeight: 600,
                      }}>
                        {role.user_count ?? 0}
                      </span>
                    </div>
                  </div>
                  {role.description && (
                    <div style={{ color: tokens.textDim, fontSize: fontSize.xs, marginTop: 2, lineHeight: 1.4 }}>
                      {role.description}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column — Role Detail Panel */}
        <div style={{
          flex: 1,
          background: tokens.surfaceFloat,
          border: `1px solid ${tokens.borderDefault}`,
          borderRadius: radius.lg,
          display: 'flex',
          flexDirection: 'column',
          minHeight: 400,
          maxHeight: 'calc(100vh - 240px)',
        }}>
          {!selectedRole ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: tokens.textDim, fontSize: fontSize.base }}>
              Select a role to configure
            </div>
          ) : editingRoleId === selectedRole.id ? (
            /* Inline Edit Mode */
            <div style={{ padding: 20 }}>
              <div style={{ marginBottom: 12 }}>
                <label style={{ color: tokens.textSecondary, fontSize: fontSize.sm, fontWeight: 500, display: 'block', marginBottom: 4 }}>Role Name</label>
                <input value={editRoleName} onChange={(e) => setEditRoleName(e.target.value)} placeholder="Role name" style={sharedStyles.input} />
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={{ color: tokens.textSecondary, fontSize: fontSize.sm, fontWeight: 500, display: 'block', marginBottom: 4 }}>Description</label>
                <input value={editRoleDesc} onChange={(e) => setEditRoleDesc(e.target.value)} placeholder="Description" style={sharedStyles.input} />
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => handleUpdateRole(selectedRole.id)} disabled={updatingRoleId === selectedRole.id} style={{ ...btnPrimary, opacity: updatingRoleId === selectedRole.id ? 0.6 : 1 }}>
                  {updatingRoleId === selectedRole.id ? 'Saving...' : 'Save'}
                </button>
                <button onClick={() => setEditingRoleId(null)} style={sharedStyles.btnGhost}>Cancel</button>
              </div>
            </div>
          ) : (
            <>
              {/* Detail Header */}
              <div style={{
                padding: '16px 20px',
                borderBottom: `1px solid ${tokens.borderDefault}`,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
              }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <h3 style={{ color: tokens.textPrimary, fontSize: fontSize.md, fontWeight: 600, margin: 0 }}>
                      {selectedRole.name}
                    </h3>
                    {selectedRole.is_system && (
                      <span style={sharedStyles.badge('info')}>System</span>
                    )}
                  </div>
                  {selectedRole.description && (
                    <p style={{ color: tokens.textSecondary, fontSize: fontSize.base, margin: 0 }}>
                      {selectedRole.description}
                    </p>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => { setEditingRoleId(selectedRole.id); setEditRoleName(selectedRole.name); setEditRoleDesc(selectedRole.description); }}
                    style={sharedStyles.btnGhost}
                  >
                    Edit Details
                  </button>
                  {!selectedRole.is_system && (
                    <button
                      onClick={() => handleDeleteRole(selectedRole)}
                      disabled={deletingRoleId === selectedRole.id}
                      style={{ ...sharedStyles.btnDanger, opacity: deletingRoleId === selectedRole.id ? 0.6 : 1 }}
                    >
                      {deletingRoleId === selectedRole.id ? 'Deleting...' : 'Delete Role'}
                    </button>
                  )}
                </div>
              </div>

              {/* Content area (scrollable) */}
              <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
                {/* User Assignment */}
                <div style={{
                  background: tokens.surfaceInset,
                  border: `1px solid ${tokens.borderDefault}`,
                  borderRadius: radius.md,
                  padding: 16,
                  marginBottom: 20,
                }}>
                  <h4 style={{ color: tokens.textPrimary, fontSize: fontSize.sm, fontWeight: 600, margin: '0 0 12px' }}>
                    👥 Assigned Users
                  </h4>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <select
                      value={selectedUserId ?? ''}
                      onChange={(e) => setSelectedUserId(e.target.value || null)}
                      style={{
                        ...sharedStyles.input,
                        width: 'auto',
                        flex: '1 1 200px',
                      }}
                    >
                      <option value="">Select a user...</option>
                      {users.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.email ?? u.id.substring(0, 8)} {u.role_name ? `(${u.role_name})` : ''}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={handleAssignRole}
                      disabled={!selectedUserId || assigningRole}
                      style={{
                        ...btnPrimary,
                        opacity: !selectedUserId || assigningRole ? 0.6 : 1,
                        cursor: !selectedUserId || assigningRole ? 'not-allowed' : 'pointer',
                      }}
                    >
                      {assigningRole ? 'Assigning...' : 'Assign Role'}
                    </button>
                  </div>
                  <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {users.filter(u => u.role_id === selectedRole.id).map(u => (
                      <span key={u.id} style={{
                        ...sharedStyles.badge('info'),
                        fontSize: fontSize.xs,
                      }}>
                        {u.email ?? u.id.substring(0, 8)}
                      </span>
                    ))}
                    {users.filter(u => u.role_id === selectedRole.id).length === 0 && (
                      <span style={{ color: tokens.textDim, fontSize: fontSize.xs }}>No users assigned</span>
                    )}
                  </div>
                </div>

                {/* Permission Groups */}
                {Object.entries(groupedPermissions).map(([group, perms]) => (
                  <div key={group} style={{
                    background: tokens.surfaceInset,
                    border: `1px solid ${tokens.borderDefault}`,
                    borderRadius: radius.md,
                    padding: 16,
                    marginBottom: 12,
                  }}>
                    <h4 style={{
                      color: tokens.textPrimary,
                      fontSize: fontSize.sm,
                      fontWeight: 600,
                      margin: '0 0 12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                    }}>
                      <span>{groupIcons[group] || '📋'}</span>
                      {group.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())} Permissions
                    </h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {perms.map((perm) => {
                        const isChecked = selectedPermissions.has(perm.key);
                        return (
                          <label
                            key={perm.key}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 10,
                              cursor: 'pointer',
                              padding: '6px 0',
                              userSelect: 'none',
                            }}
                          >
                            {/* Toggle Switch */}
                            <span style={{
                              position: 'relative',
                              width: 36,
                              height: 20,
                              flexShrink: 0,
                              borderRadius: 10,
                              background: isChecked ? tokens.accentPrimary : tokens.surfaceHover,
                              border: `1px solid ${isChecked ? tokens.accentPrimary : tokens.borderDefault}`,
                              transition: 'all 0.2s ease',
                              boxShadow: isChecked ? `0 0 6px rgba(58, 149, 154, 0.4)` : 'none',
                            }}>
                              <span style={{
                                position: 'absolute',
                                top: 2,
                                left: isChecked ? 18 : 2,
                                width: 14,
                                height: 14,
                                borderRadius: '50%',
                                background: '#fff',
                                transition: 'left 0.2s ease',
                                boxShadow: '0 1px 2px rgba(0,0,0,0.3)',
                              }} />
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => togglePermission(perm.key)}
                                style={{ position: 'absolute', opacity: 0, width: '100%', height: '100%', cursor: 'pointer', margin: 0 }}
                              />
                            </span>
                            <div>
                              <div style={{ color: tokens.textPrimary, fontSize: fontSize.base, fontWeight: 500 }}>{perm.name}</div>
                              {perm.description && (
                                <div style={{ color: tokens.textDim, fontSize: fontSize.xs, marginTop: 1 }}>{perm.description}</div>
                              )}
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              {/* Sticky Footer */}
              <div style={{
                padding: '12px 20px',
                borderTop: `1px solid ${tokens.borderDefault}`,
                background: tokens.surfaceFloat,
                display: 'flex',
                justifyContent: 'flex-end',
                gap: 8,
                position: 'sticky',
                bottom: 0,
              }}>
                <button
                  onClick={discardChanges}
                  disabled={!hasUnsaved || savingPermissions}
                  style={{ ...sharedStyles.btnGhost, opacity: !hasUnsaved || savingPermissions ? 0.5 : 1, cursor: !hasUnsaved || savingPermissions ? 'not-allowed' : 'pointer' }}
                >
                  Discard
                </button>
                <button
                  onClick={savePermissions}
                  disabled={!hasUnsaved || savingPermissions}
                  style={{
                    ...btnPrimary,
                    opacity: !hasUnsaved || savingPermissions ? 0.6 : 1,
                    cursor: !hasUnsaved || savingPermissions ? 'not-allowed' : 'pointer',
                    display: 'flex', alignItems: 'center', gap: 6,
                  }}
                >
                  {savingPermissions ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
