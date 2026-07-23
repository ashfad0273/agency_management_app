import { useState, useEffect, useCallback, useRef } from 'react';
import { RoleService } from '../services/RoleService';

interface PermissionState {
  roleId: string | null;
  roleName: string;
  permissions: string[];
  loading: boolean;
  error: string | null;
}

/**
 * Hook to check if the current user has specific permissions.
 *
 * Usage:
 *   const { can, permissions, roleName, loading } = usePermission();
 *   if (can('project:delete')) { ... }
 *   if (can('chat:manage_channels')) { ... }
 */
export function usePermission() {
  const [state, setState] = useState<PermissionState>({
    roleId: null,
    roleName: '',
    permissions: [],
    loading: true,
    error: null,
  });

  const permissionsSet = useRef<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setState(prev => ({ ...prev, loading: true, error: null }));
      try {
        const result = await RoleService.getCurrentUserPermissions();
        if (!cancelled) {
          permissionsSet.current = new Set(result.permissions);
          setState({
            roleId: result.roleId,
            roleName: result.roleName,
            permissions: result.permissions,
            loading: false,
            error: null,
          });
        }
      } catch (err) {
        if (!cancelled) {
          setState(prev => ({
            ...prev,
            loading: false,
            error: err instanceof Error ? err.message : 'Failed to load permissions',
          }));
        }
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  const can = useCallback((permission: string): boolean => {
    return permissionsSet.current.has(permission);
  }, []);

  const canAny = useCallback((permissions: string[]): boolean => {
    return permissions.some(p => permissionsSet.current.has(p));
  }, []);

  const canAll = useCallback((permissions: string[]): boolean => {
    return permissions.every(p => permissionsSet.current.has(p));
  }, []);

  return {
    /** Check if user has a specific permission */
    can,
    /** Check if user has any of the given permissions */
    canAny,
    /** Check if user has all of the given permissions */
    canAll,
    /** List of all permission keys the user has */
    permissions: state.permissions,
    /** The user's role name */
    roleName: state.roleName,
    /** The user's role ID */
    roleId: state.roleId,
    /** Whether permissions are still loading */
    loading: state.loading,
    /** Error message if loading failed */
    error: state.error,
  };
}

/**
 * Check if a user can perform an action on a specific project.
 * This is a utility shorthand for common checks.
 */
export const Permissions = {
  Project: {
    Create: 'project:create',
    Read: 'project:read',
    Update: 'project:update',
    Delete: 'project:delete',
    AssignUsers: 'project:assign_users',
    ManageMilestones: 'project:manage_milestones',
  },
  User: {
    View: 'user:view',
    Invite: 'user:invite',
    Edit: 'user:edit',
    Delete: 'user:delete',
    ManageRoles: 'user:manage_roles',
  },
  Settings: {
    Manage: 'settings:manage',
  },
  Chat: {
    Send: 'chat:send',
    ManageChannels: 'chat:manage_channels',
  },
  Reports: {
    View: 'reports:view',
  },
} as const;