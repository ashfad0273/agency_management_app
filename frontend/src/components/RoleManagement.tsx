import { useState, useEffect, FormEvent } from 'react';
import {
  RoleService,
  RoleWithPermissions,
  Permission,
} from '../services/RoleService';
import { usePermission, Permissions } from '../hooks/usePermission';

export default function RoleManagement() {
  const { can, loading: permLoading } = usePermission();

  const [roles, setRoles] = useState<RoleWithPermissions[]>([]);
  const [allPermissions, setAllPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Role creation
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleDesc, setNewRoleDesc] = useState('');

  // Role editing
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null);
  const [editRoleName, setEditRoleName] = useState('');
  const [editRoleDesc, setEditRoleDesc] = useState('');

  // Permission editing
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [selectedPermissions, setSelectedPermissions] = useState<Set<string>>(new Set());

  // User assignment
  const [users, setUsers] = useState<Array<{ id: string; email: string | null; role_name: string | null; role_id: string | null }>>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedNewRoleId, setSelectedNewRoleId] = useState<string | null>(null);

  const canManageRoles = can(Permissions.User.ManageRoles);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [roleData, permData] = await Promise.all([
        RoleService.getRolesWithUserCounts(),
        RoleService.getPermissions(),
      ]);
      setRoles(roleData);
      setAllPermissions(permData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load roles');
    } finally {
      setLoading(false);
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
    try {
      await RoleService.createRole(newRoleName.trim(), newRoleDesc.trim());
      setNewRoleName('');
      setNewRoleDesc('');
      setShowCreateForm(false);
      await loadData();
    } catch (err) {
      alert('Error creating role: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  };

  const handleUpdateRole = async (roleId: string) => {
    try {
      await RoleService.updateRole(roleId, {
        name: editRoleName.trim(),
        description: editRoleDesc.trim(),
      });
      setEditingRoleId(null);
      await loadData();
    } catch (err) {
      alert('Error updating role: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  };

  const handleDeleteRole = async (role: RoleWithPermissions) => {
    if (role.user_count && role.user_count > 0) {
      if (!window.confirm(`This role has ${role.user_count} user(s) assigned. Deleting it will unset their roles. Continue?`)) return;
    } else {
      if (!window.confirm(`Delete the role "${role.name}"? This cannot be undone.`)) return;
    }
    try {
      await RoleService.deleteRole(role.id);
      if (selectedRoleId === role.id) {
        setSelectedRoleId(null);
      }
      await loadData();
    } catch (err) {
      alert('Error deleting role: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  };

  const openPermissions = (role: RoleWithPermissions) => {
    setSelectedRoleId(role.id);
    setSelectedPermissions(new Set(role.permissions));
    loadUsers();
  };

  const togglePermission = (key: string) => {
    setSelectedPermissions(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const savePermissions = async () => {
    if (!selectedRoleId) return;
    try {
      await RoleService.setRolePermissions(selectedRoleId, Array.from(selectedPermissions));
      await loadData();
      alert('Permissions saved successfully!');
    } catch (err) {
      alert('Error saving permissions: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  };

  const handleAssignRole = async () => {
    if (!selectedUserId || !selectedNewRoleId) return;
    try {
      await RoleService.assignRoleToUser(selectedUserId, selectedNewRoleId);
      setSelectedUserId(null);
      setSelectedNewRoleId(null);
      await loadUsers();
      await loadData();
      alert('Role assigned successfully!');
    } catch (err) {
      alert('Error assigning role: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  };

  // Group permissions by group_name
  const groupedPermissions = allPermissions.reduce<Record<string, Permission[]>>((acc, p) => {
    if (!acc[p.group_name]) acc[p.group_name] = [];
    acc[p.group_name].push(p);
    return acc;
  }, {});

  if (permLoading) {
    return <div style={{ padding: '20px', color: '#888' }}>Checking permissions...</div>;
  }

  if (!canManageRoles) {
    return (
      <div style={{ padding: '20px', color: '#888' }}>
        You do not have permission to manage roles. Contact your organization administrator.
      </div>
    );
  }

  if (loading) {
    return <div style={{ padding: '20px', color: '#888' }}>Loading roles...</div>;
  }

  if (error) {
    return <div style={{ padding: '20px', color: 'red' }}>Error: {error}</div>;
  }

  return (
    <div style={{ padding: '20px', maxWidth: '900px' }}>
      <h2 style={{ marginBottom: '20px' }}>Roles & Permissions</h2>

      {/* ======== Create Role Button ======== */}
      {!showCreateForm && (
        <button
          onClick={() => setShowCreateForm(true)}
          style={{
            padding: '8px 16px',
            background: '#4a90d9',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontWeight: 'bold',
            marginBottom: '20px',
          }}
        >
          + Create New Role
        </button>
      )}

      {/* ======== Create Role Form ======== */}
      {showCreateForm && (
        <form onSubmit={handleCreateRole} style={{
          marginBottom: '20px',
          padding: '16px',
          border: '1px solid #ddd',
          borderRadius: '6px',
          background: '#f9f9f9',
        }}>
          <h4 style={{ margin: '0 0 12px' }}>Create New Role</h4>
          <div style={{ marginBottom: '8px' }}>
            <input
              value={newRoleName}
              onChange={(e) => setNewRoleName(e.target.value)}
              placeholder="Role name (e.g., 'Designer')"
              required
              style={{ width: '100%', boxSizing: 'border-box', padding: '8px', fontSize: '0.9em' }}
            />
          </div>
          <div style={{ marginBottom: '12px' }}>
            <input
              value={newRoleDesc}
              onChange={(e) => setNewRoleDesc(e.target.value)}
              placeholder="Description (optional)"
              style={{ width: '100%', boxSizing: 'border-box', padding: '8px', fontSize: '0.9em' }}
            />
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button type="submit" style={{ padding: '8px 16px', background: '#4a90d9', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
              Create Role
            </button>
            <button type="button" onClick={() => setShowCreateForm(false)} style={{ padding: '8px 16px', background: '#ccc', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* ======== Roles List ======== */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {roles.map((role) => (
          <div key={role.id} style={{
            border: '1px solid #e0e0e0',
            borderRadius: '6px',
            padding: '16px',
            background: 'white',
          }}>
            {editingRoleId === role.id ? (
              /* ======== Inline Edit Form ======== */
              <div>
                <div style={{ marginBottom: '8px' }}>
                  <input
                    value={editRoleName}
                    onChange={(e) => setEditRoleName(e.target.value)}
                    placeholder="Role name"
                    style={{ width: '100%', boxSizing: 'border-box', padding: '8px', fontSize: '0.9em' }}
                  />
                </div>
                <div style={{ marginBottom: '12px' }}>
                  <input
                    value={editRoleDesc}
                    onChange={(e) => setEditRoleDesc(e.target.value)}
                    placeholder="Description"
                    style={{ width: '100%', boxSizing: 'border-box', padding: '8px', fontSize: '0.9em' }}
                  />
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={() => handleUpdateRole(role.id)} style={{ padding: '6px 12px', background: '#4a90d9', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                    Save
                  </button>
                  <button onClick={() => setEditingRoleId(null)} style={{ padding: '6px 12px', background: '#ccc', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              /* ======== Role Display ======== */
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <div>
                    <strong style={{ fontSize: '1.05em' }}>{role.name}</strong>
                    {role.is_system && (
                      <span style={{
                        marginLeft: '8px',
                        fontSize: '0.75em',
                        padding: '2px 6px',
                        background: '#e8e8e8',
                        borderRadius: '3px',
                        color: '#666',
                      }}>
                        System
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '0.85em', color: '#888' }}>
                    {role.user_count ?? 0} user{(role.user_count ?? 0) !== 1 ? 's' : ''}
                  </div>
                </div>

                {role.description && (
                  <p style={{ margin: '0 0 8px', fontSize: '0.9em', color: '#555' }}>{role.description}</p>
                )}

                <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                  <button
                    onClick={() => {
                      setEditingRoleId(role.id);
                      setEditRoleName(role.name);
                      setEditRoleDesc(role.description);
                    }}
                    style={{ padding: '4px 10px', fontSize: '0.85em', border: '1px solid #ccc', borderRadius: '4px', cursor: 'pointer', background: 'white' }}
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => openPermissions(role)}
                    style={{
                      padding: '4px 10px',
                      fontSize: '0.85em',
                      border: '1px solid #4a90d9',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      background: selectedRoleId === role.id ? '#4a90d9' : 'white',
                      color: selectedRoleId === role.id ? 'white' : '#4a90d9',
                    }}
                  >
                    Permissions ({role.permissions.length})
                  </button>
                  {!role.is_system && (
                    <button
                      onClick={() => handleDeleteRole(role)}
                      style={{ padding: '4px 10px', fontSize: '0.85em', border: '1px solid #e74c3c', borderRadius: '4px', cursor: 'pointer', background: 'white', color: '#e74c3c' }}
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* ======== Permissions Editor (shown when selected) ======== */}
            {selectedRoleId === role.id && (
              <div style={{
                marginTop: '16px',
                padding: '16px',
                border: '1px solid #4a90d9',
                borderRadius: '6px',
                background: '#f0f5ff',
              }}>
                <h4 style={{ margin: '0 0 12px', fontSize: '1em' }}>Permissions for {role.name}</h4>

                {Object.entries(groupedPermissions).map(([group, perms]) => (
                  <div key={group} style={{ marginBottom: '12px' }}>
                    <h5 style={{
                      margin: '0 0 6px',
                      fontSize: '0.85em',
                      color: '#555',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                    }}>
                      {group}
                    </h5>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {perms.map((perm) => (
                        <label
                          key={perm.key}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            fontSize: '0.85em',
                            padding: '4px 8px',
                            border: '1px solid #ddd',
                            borderRadius: '4px',
                            background: selectedPermissions.has(perm.key) ? '#4a90d9' : 'white',
                            color: selectedPermissions.has(perm.key) ? 'white' : '#333',
                            cursor: 'pointer',
                            transition: 'all 0.15s',
                            userSelect: 'none',
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={selectedPermissions.has(perm.key)}
                            onChange={() => togglePermission(perm.key)}
                            style={{ display: 'none' }}
                          />
                          {perm.name}
                        </label>
                      ))}
                    </div>
                  </div>
                ))}

                <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                  <button onClick={savePermissions} style={{ padding: '8px 16px', background: '#4a90d9', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
                    Save Permissions
                  </button>
                  <button onClick={() => setSelectedRoleId(null)} style={{ padding: '8px 16px', background: '#ccc', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                    Close
                  </button>
                </div>
              </div>
            )}

            {/* ======== User Assignment Section (shown when permissions editor is open) ======== */}
            {selectedRoleId === role.id && (
              <div style={{ marginTop: '16px', borderTop: '1px solid #ddd', paddingTop: '16px' }}>
                <h4 style={{ margin: '0 0 12px', fontSize: '1em' }}>Assign "{role.name}" to a User</h4>

                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <select
                    value={selectedUserId ?? ''}
                    onChange={(e) => setSelectedUserId(e.target.value || null)}
                    style={{ padding: '8px', fontSize: '0.9em', flex: '1', minWidth: '200px' }}
                  >
                    <option value="">Select a user...</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.email ?? u.id.substring(0, 8)} {u.role_name ? `(${u.role_name})` : ''}
                      </option>
                    ))}
                  </select>

                  <input type="hidden" value={role.id} />

                  <button
                    onClick={handleAssignRole}
                    disabled={!selectedUserId}
                    style={{
                      padding: '8px 16px',
                      background: selectedUserId ? '#4a90d9' : '#ccc',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: selectedUserId ? 'pointer' : 'not-allowed',
                      fontWeight: 'bold',
                    }}
                  >
                    Assign Role
                  </button>
                </div>

                {selectedUserId && selectedNewRoleId === role.id && (
                  <p style={{ fontSize: '0.85em', color: '#888', marginTop: '4px' }}>
                    Assigning {role.name} to the selected user.
                  </p>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}