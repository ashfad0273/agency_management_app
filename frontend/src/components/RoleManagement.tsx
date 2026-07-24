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

  const [roles, setRoles] = useState<RoleWithPermissions[]>([]);
  const [allPermissions, setAllPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [creatingRole, setCreatingRole] = useState(false);
  const [updatingRoleId, setUpdatingRoleId] = useState<string | null>(null);
  const [deletingRoleId, setDeletingRoleId] = useState<string | null>(null);
  const [savingPermissions, setSavingPermissions] = useState(false);
  const [assigningRole, setAssigningRole] = useState(false);

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleDesc, setNewRoleDesc] = useState('');

  const [editingRoleId, setEditingRoleId] = useState<string | null>(null);
  const [editRoleName, setEditRoleName] = useState('');
  const [editRoleDesc, setEditRoleDesc] = useState('');

  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [selectedPermissions, setSelectedPermissions] = useState<Set<string>>(new Set());

  const [users, setUsers] = useState<Array<{ id: string; email: string | null; role_name: string | null; role_id: string | null }>>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedNewRoleId, setSelectedNewRoleId] = useState<string | null>(null);

  const canManageRoles = can(Permissions.User.ManageRoles);

  const showFeedback = (type: 'success' | 'error', message: string) => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 3000);
  };

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    const [roleData, permData] = await Promise.all([
      RoleService.getRolesWithUserCounts().catch(() => []),
      RoleService.getPermissions().catch(() => []),
    ]);
    setRoles(roleData);
    setAllPermissions(permData);
    setLoading(false);
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
      setShowCreateForm(false);
      await loadData();
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
    } catch (err) {
      showFeedback('error', 'Error deleting role: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
    setDeletingRoleId(null);
  };

  const openPermissions = (role: RoleWithPermissions) => {
    setSelectedRoleId(role.id);
    setSelectedPermissions(new Set(role.permissions));
    loadUsers();
  };

  const togglePermission = (key: string) => {
    setSelectedPermissions(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const savePermissions = async () => {
    if (!selectedRoleId) return;
    setSavingPermissions(true);
    try {
      await RoleService.setRolePermissions(selectedRoleId, Array.from(selectedPermissions));
      await loadData();
      showFeedback('success', 'Permissions saved successfully!');
    } catch (err) {
      showFeedback('error', 'Error saving permissions: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
    setSavingPermissions(false);
  };

  const handleAssignRole = async () => {
    if (!selectedUserId || !selectedNewRoleId) return;
    setAssigningRole(true);
    try {
      await RoleService.assignRoleToUser(selectedUserId, selectedNewRoleId);
      setSelectedUserId(null);
      setSelectedNewRoleId(null);
      await loadUsers();
      await loadData();
      showFeedback('success', 'Role assigned successfully!');
    } catch (err) {
      showFeedback('error', 'Error assigning role: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
    setAssigningRole(false);
  };

  const groupedPermissions = allPermissions.reduce<Record<string, Permission[]>>((acc, p) => {
    if (!acc[p.group_name]) acc[p.group_name] = [];
    acc[p.group_name].push(p);
    return acc;
  }, {});

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
    return <div style={{ ...sharedStyles.textMuted, padding: 20 }}>Loading roles...</div>;
  }

  if (error) {
    return <div style={{ padding: 20, color: tokens.danger }}>Error: {error}</div>;
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
    <div style={{ maxWidth: 900 }}>
      {feedback && (
        <div style={sharedStyles.feedbackBanner(feedback.type)}>
          {feedback.message}
        </div>
      )}

      {!showCreateForm && (
        <button
          onClick={() => setShowCreateForm(true)}
          style={{ ...btnPrimary, marginBottom: 20 }}
        >
          + Create New Role
        </button>
      )}

      {showCreateForm && (
        <form onSubmit={handleCreateRole} style={{
          marginBottom: 20,
          padding: 16,
          background: tokens.surfaceFloat,
          border: `1px solid ${tokens.borderDefault}`,
          borderRadius: radius.md,
        }}>
          <h4 style={{ color: tokens.textPrimary, fontSize: fontSize.md, fontWeight: 600, margin: '0 0 12px' }}>Create New Role</h4>
          <div style={{ marginBottom: 8 }}>
            <input
              value={newRoleName}
              onChange={(e) => setNewRoleName(e.target.value)}
              placeholder="Role name (e.g., 'Designer')"
              required
              style={sharedStyles.input}
            />
          </div>
          <div style={{ marginBottom: 12 }}>
            <input
              value={newRoleDesc}
              onChange={(e) => setNewRoleDesc(e.target.value)}
              placeholder="Description (optional)"
              style={sharedStyles.input}
            />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="submit" disabled={creatingRole} style={{ ...btnPrimary, opacity: creatingRole ? 0.6 : 1 }}>
              {creatingRole ? 'Creating...' : 'Create Role'}
            </button>
            <button type="button" onClick={() => setShowCreateForm(false)} style={sharedStyles.btnGhost}>
              Cancel
            </button>
          </div>
        </form>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {roles.map((role) => (
          <div key={role.id} style={sharedStyles.card}>
            {editingRoleId === role.id ? (
              <div style={{ padding: 16 }}>
                <div style={{ marginBottom: 8 }}>
                  <input value={editRoleName} onChange={(e) => setEditRoleName(e.target.value)} placeholder="Role name" style={sharedStyles.input} />
                </div>
                <div style={{ marginBottom: 12 }}>
                  <input value={editRoleDesc} onChange={(e) => setEditRoleDesc(e.target.value)} placeholder="Description" style={sharedStyles.input} />
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => handleUpdateRole(role.id)} disabled={updatingRoleId === role.id} style={{ ...btnPrimary, opacity: updatingRoleId === role.id ? 0.6 : 1 }}>
                    {updatingRoleId === role.id ? 'Saving...' : 'Save'}
                  </button>
                  <button onClick={() => setEditingRoleId(null)} style={sharedStyles.btnGhost}>Cancel</button>
                </div>
              </div>
            ) : (
              <div style={{ padding: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <strong style={{ color: tokens.textPrimary, fontSize: fontSize.md }}>{role.name}</strong>
                    {role.is_system && (
                      <span style={sharedStyles.badge('neutral')}>System</span>
                    )}
                  </div>
                  <div style={{ color: tokens.textDim, fontSize: fontSize.sm }}>
                    {role.user_count ?? 0} user{(role.user_count ?? 0) !== 1 ? 's' : ''}
                  </div>
                </div>

                {role.description && (
                  <p style={{ color: tokens.textSecondary, fontSize: fontSize.base, margin: '0 0 8px' }}>{role.description}</p>
                )}

                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <button
                    onClick={() => { setEditingRoleId(role.id); setEditRoleName(role.name); setEditRoleDesc(role.description); }}
                    style={sharedStyles.btnGhost}
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => openPermissions(role)}
                    style={{
                      ...sharedStyles.btnGhost,
                      borderColor: selectedRoleId === role.id ? tokens.accentPrimary : tokens.borderDefault,
                      background: selectedRoleId === role.id ? tokens.accentMuted : 'transparent',
                      color: selectedRoleId === role.id ? tokens.accentPrimary : tokens.textSecondary,
                    }}
                  >
                    Permissions ({role.permissions.length})
                  </button>
                  {!role.is_system && (
                    <button
                      onClick={() => handleDeleteRole(role)}
                      disabled={deletingRoleId === role.id}
                      style={{ ...sharedStyles.btnDanger, opacity: deletingRoleId === role.id ? 0.6 : 1 }}
                    >
                      {deletingRoleId === role.id ? 'Deleting...' : 'Delete'}
                    </button>
                  )}
                </div>
              </div>
            )}

            {selectedRoleId === role.id && (
              <div style={{
                borderTop: `1px solid ${tokens.borderDefault}`,
                padding: 16,
              }}>
                <h4 style={{ color: tokens.textPrimary, fontSize: fontSize.md, fontWeight: 600, margin: '0 0 12px' }}>
                  Permissions for {role.name}
                </h4>

                {Object.entries(groupedPermissions).map(([group, perms]) => (
                  <div key={group} style={{ marginBottom: 12 }}>
                    <h5 style={{
                      ...sharedStyles.label,
                      margin: '0 0 6px',
                    }}>
                      {group}
                    </h5>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {perms.map((perm) => {
                        const selected = selectedPermissions.has(perm.key);
                        return (
                          <label
                            key={perm.key}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 4,
                              fontSize: fontSize.sm,
                              padding: '5px 10px',
                              border: `1px solid ${selected ? tokens.accentPrimary : tokens.borderDefault}`,
                              borderRadius: radius.sm,
                              background: selected ? tokens.accentMuted : tokens.surfaceInset,
                              color: selected ? tokens.accentPrimary : tokens.textSecondary,
                              cursor: 'pointer',
                              transition: 'all 0.15s',
                              userSelect: 'none',
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={selected}
                              onChange={() => togglePermission(perm.key)}
                              style={{ position: 'absolute', opacity: 0, width: 1, height: 1, overflow: 'hidden' }}
                            />
                            {perm.name}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))}

                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                  <button onClick={savePermissions} disabled={savingPermissions} style={{ ...btnPrimary, opacity: savingPermissions ? 0.6 : 1 }}>
                    {savingPermissions ? 'Saving...' : 'Save Permissions'}
                  </button>
                  <button onClick={() => setSelectedRoleId(null)} style={sharedStyles.btnGhost}>Close</button>
                </div>

                {/* User Assignment */}
                <div style={{ marginTop: 16, borderTop: `1px solid ${tokens.borderDefault}`, paddingTop: 16 }}>
                  <h4 style={{ color: tokens.textPrimary, fontSize: fontSize.md, fontWeight: 600, margin: '0 0 12px' }}>
                    Assign "{role.name}" to a User
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
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
