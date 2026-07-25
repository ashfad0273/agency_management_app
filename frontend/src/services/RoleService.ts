import { supabase } from '../api/supabaseClient';

export interface Role {
  id: string;
  organization_id: string;
  name: string;
  description: string;
  is_system: boolean;
  created_at: string;
  /** Optional: number of users assigned to this role */
  user_count?: number;
}

export interface Permission {
  key: string;
  name: string;
  description: string;
  group_name: string;
}

export interface RoleWithPermissions extends Role {
  permissions: string[];
}

export const RoleService = {
  /** Get all roles for the current user's organization */
  async getRoles(): Promise<Role[]> {
    const { data, error } = await supabase
      .from('roles')
      .select('*')
      .order('name', { ascending: true });

    if (error) throw error;
    return data as Role[];
  },

  /** Get roles with user counts — 3 queries total regardless of role count */
  async getRolesWithUserCounts(): Promise<RoleWithPermissions[]> {
    const roles = await this.getRoles();

    // Count profiles per role_id in a single query
    const { data: allProfiles } = await supabase
      .from('profiles')
      .select('role_id');
    const userCounts: Record<string, number> = {};
    for (const p of allProfiles ?? []) {
      if (p.role_id) userCounts[p.role_id] = (userCounts[p.role_id] || 0) + 1;
    }

    // Fetch all permissions for all roles at once
    const { data: allPerms } = await supabase
      .from('role_permissions')
      .select('role_id, permission_key');
    const permsByRole: Record<string, string[]> = {};
    for (const p of allPerms ?? []) {
      if (!permsByRole[p.role_id]) permsByRole[p.role_id] = [];
      permsByRole[p.role_id].push(p.permission_key);
    }

    return roles.map((role) => ({
      ...role,
      user_count: userCounts[role.id] ?? 0,
      permissions: permsByRole[role.id] ?? [],
    })) as RoleWithPermissions[];
  },

  /** Get all available permission keys */
  async getPermissions(): Promise<Permission[]> {
    const { data, error } = await supabase
      .from('permissions')
      .select('*')
      .order('group_name', { ascending: true })
      .order('name', { ascending: true });

    if (error) throw error;
    return data as Permission[];
  },

  /** Create a new custom role */
  async createRole(name: string, description: string): Promise<Role> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('No user logged in');

    const { data: profile } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('id', user.id)
      .single();

    if (!profile) throw new Error('Profile not found');

    const { data, error } = await supabase
      .from('roles')
      .insert([{
        organization_id: profile.organization_id,
        name,
        description,
        is_system: false,
      }])
      .select()
      .single();

    if (error) throw error;
    return data as Role;
  },

  /** Update a role's name and description */
  async updateRole(id: string, fields: { name?: string; description?: string }): Promise<void> {
    const { error } = await supabase
      .from('roles')
      .update(fields)
      .eq('id', id);

    if (error) throw error;
  },

  /** Delete a custom role (cannot delete system roles) */
  async deleteRole(id: string): Promise<void> {
    const { error } = await supabase
      .from('roles')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  /** Set permissions for a role (incremental — only adds/removes what changed) */
  async setRolePermissions(roleId: string, permissionKeys: string[]): Promise<void> {
    const { data: existing } = await supabase
      .from('role_permissions')
      .select('permission_key')
      .eq('role_id', roleId);

    const existingSet = new Set(existing?.map(p => p.permission_key) ?? []);
    const newSet = new Set(permissionKeys);

    const toAdd = permissionKeys.filter(k => !existingSet.has(k));
    const toRemove = Array.from(existingSet).filter(k => !newSet.has(k));

    if (toRemove.length > 0) {
      const { error: deleteError } = await supabase
        .from('role_permissions')
        .delete()
        .eq('role_id', roleId)
        .in('permission_key', toRemove);
      if (deleteError) throw deleteError;
    }

    if (toAdd.length > 0) {
      const rows = toAdd.map(key => ({ role_id: roleId, permission_key: key }));
      const { error: insertError } = await supabase
        .from('role_permissions')
        .insert(rows);
      if (insertError) throw insertError;
    }
  },

  /** Assign a role to a user */
  async assignRoleToUser(userId: string, roleId: string): Promise<void> {
    // Also fetch the role name to update the string 'role' column for backward compatibility
    const { data: role } = await supabase
      .from('roles')
      .select('name')
      .eq('id', roleId)
      .single();

    const updateData: { role_id: string; role?: string } = { role_id: roleId };
    if (role?.name) {
      updateData.role = role.name.toLowerCase();
    }

    const { error } = await supabase
      .from('profiles')
      .update(updateData)
      .eq('id', userId);

    if (error) throw error;
  },

  /** Get the current user's role with permissions */
  async getCurrentUserPermissions(): Promise<{ roleId: string | null; roleName: string; permissions: string[] }> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('No user logged in');

    // Get user profile with role_id
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, role_id, role')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) throw new Error('Profile not found');

    if (!profile.role_id) {
      return { roleId: null, roleName: profile.role ?? 'employee', permissions: [] };
    }

    // Get the role name
    const { data: role } = await supabase
      .from('roles')
      .select('name')
      .eq('id', profile.role_id)
      .single();

    // Get all permissions for this role
    const { data: perms } = await supabase
      .from('role_permissions')
      .select('permission_key')
      .eq('role_id', profile.role_id);

    return {
      roleId: profile.role_id,
      roleName: role?.name ?? profile.role ?? 'employee',
      permissions: perms?.map(p => p.permission_key) ?? [],
    };
  },

  /** Get all profiles with their role info (two-step query avoids FK-dependent join) */
  async getProfilesWithRoles(): Promise<Array<{
    id: string;
    email: string | null;
    role: string;
    role_id: string | null;
    role_name: string | null;
  }>> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('No user logged in');

    const { data: myProfile } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('id', user.id)
      .single();

    if (!myProfile) throw new Error('Profile not found');

    // Step 1: fetch all profiles in the org
    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('id, email, role, role_id')
      .eq('organization_id', myProfile.organization_id);

    if (error) throw error;

    // Step 2: fetch all roles for the org to build a role_id → name map
    const { data: roles } = await supabase
      .from('roles')
      .select('id, name')
      .eq('organization_id', myProfile.organization_id);

    const roleNameMap: Record<string, string> = {};
    for (const r of roles ?? []) {
      roleNameMap[r.id] = r.name;
    }

    return (profiles ?? []).map((p) => ({
      id: p.id,
      email: p.email,
      role: p.role,
      role_id: p.role_id,
      role_name: p.role_id ? (roleNameMap[p.role_id] ?? null) : null,
    }));
  },
};