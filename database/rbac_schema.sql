-- =============================================
-- Phase 4: Dynamic RBAC (Roles & Permissions)
-- =============================================

-- =============================================
-- 1. PERMISSIONS TABLE (Global permission keys)
-- =============================================
CREATE TABLE IF NOT EXISTS permissions (
    key TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    group_name TEXT NOT NULL
);

-- =============================================
-- 2. ROLES TABLE (Per-organization roles)
-- =============================================
CREATE TABLE IF NOT EXISTS roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    is_system BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(organization_id, name)
);

-- =============================================
-- 3. ROLE_PERMISSIONS Junction Table
-- =============================================
CREATE TABLE IF NOT EXISTS role_permissions (
    role_id UUID REFERENCES roles(id) ON DELETE CASCADE NOT NULL,
    permission_key TEXT REFERENCES permissions(key) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    PRIMARY KEY (role_id, permission_key)
);

-- =============================================
-- 4. Add role_id column to profiles
-- =============================================
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS role_id UUID REFERENCES roles(id) ON DELETE SET NULL;

-- =============================================
-- 5. Seed Default Permissions
-- =============================================
INSERT INTO permissions (key, name, description, group_name) VALUES
    ('project:create', 'Create Projects', 'Create new projects in the organization', 'Projects'),
    ('project:read', 'Read Projects', 'View project details and tasks', 'Projects'),
    ('project:update', 'Update Projects', 'Edit project name and description', 'Projects'),
    ('project:delete', 'Delete Projects', 'Remove projects from the organization', 'Projects'),
    ('project:assign_users', 'Assign Users to Projects', 'Add or remove project members', 'Projects'),
    ('project:manage_milestones', 'Manage Milestones', 'Create, edit, and delete milestones', 'Projects'),
    ('user:view', 'View Users', 'Browse the list of organization members', 'Users'),
    ('user:invite', 'Invite Users', 'Send invitations to new members', 'Users'),
    ('user:edit', 'Edit Users', 'Update user profiles and information', 'Users'),
    ('user:delete', 'Delete Users', 'Remove members from the organization', 'Users'),
    ('user:manage_roles', 'Manage User Roles', 'Change roles assigned to users', 'Users'),
    ('settings:manage', 'Manage Settings', 'Update organization-wide settings', 'Settings'),
    ('chat:send', 'Send Messages', 'Post messages in channels and chats', 'Chat'),
    ('chat:manage_channels', 'Manage Channels', 'Create, edit, and delete chat channels', 'Chat'),
    ('reports:view', 'View Reports', 'Access reports and analytics', 'Reports')
ON CONFLICT (key) DO NOTHING;

-- =============================================
-- 6. Seed Default Roles Function
-- Called when a new organization is created
-- =============================================
CREATE OR REPLACE FUNCTION public.seed_default_roles(p_org_id UUID)
RETURNS UUID[]  -- Returns array of created role IDs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_admin_id UUID;
    v_ceo_id UUID;
    v_coo_id UUID;
    v_hr_id UUID;
    v_pm_id UUID;
    v_hod_id UUID;
    v_employee_id UUID;
    v_role_ids UUID[];
BEGIN
    -- Create default roles (idempotent — does not overwrite existing roles)
    INSERT INTO public.roles (organization_id, name, description, is_system)
    VALUES (p_org_id, 'Administrator', 'Full access to all features and settings', true)
    ON CONFLICT (organization_id, name) DO NOTHING;
    SELECT id INTO v_admin_id FROM public.roles WHERE organization_id = p_org_id AND name = 'Administrator';

    INSERT INTO public.roles (organization_id, name, description, is_system)
    VALUES (p_org_id, 'CEO', 'Chief Executive Officer - full access', true)
    ON CONFLICT (organization_id, name) DO NOTHING;
    SELECT id INTO v_ceo_id FROM public.roles WHERE organization_id = p_org_id AND name = 'CEO';

    INSERT INTO public.roles (organization_id, name, description, is_system)
    VALUES (p_org_id, 'COO', 'Chief Operating Officer - operational control', true)
    ON CONFLICT (organization_id, name) DO NOTHING;
    SELECT id INTO v_coo_id FROM public.roles WHERE organization_id = p_org_id AND name = 'COO';

    INSERT INTO public.roles (organization_id, name, description, is_system)
    VALUES (p_org_id, 'HR', 'Human Resources - manages people', true)
    ON CONFLICT (organization_id, name) DO NOTHING;
    SELECT id INTO v_hr_id FROM public.roles WHERE organization_id = p_org_id AND name = 'HR';

    INSERT INTO public.roles (organization_id, name, description, is_system)
    VALUES (p_org_id, 'PM', 'Project Manager - manages projects and timelines', true)
    ON CONFLICT (organization_id, name) DO NOTHING;
    SELECT id INTO v_pm_id FROM public.roles WHERE organization_id = p_org_id AND name = 'PM';

    INSERT INTO public.roles (organization_id, name, description, is_system)
    VALUES (p_org_id, 'HOD', 'Head of Department - oversees department work', true)
    ON CONFLICT (organization_id, name) DO NOTHING;
    SELECT id INTO v_hod_id FROM public.roles WHERE organization_id = p_org_id AND name = 'HOD';

    INSERT INTO public.roles (organization_id, name, description, is_system)
    VALUES (p_org_id, 'Employee', 'Standard team member', true)
    ON CONFLICT (organization_id, name) DO NOTHING;
    SELECT id INTO v_employee_id FROM public.roles WHERE organization_id = p_org_id AND name = 'Employee';

    v_role_ids := ARRAY[v_admin_id, v_ceo_id, v_coo_id, v_hr_id, v_pm_id, v_hod_id, v_employee_id];

    -- ======== Assign permissions to roles ========

    -- Administrator: ALL permissions
    INSERT INTO public.role_permissions (role_id, permission_key)
    SELECT v_admin_id, key FROM public.permissions
    ON CONFLICT DO NOTHING;

    -- CEO: ALL permissions
    INSERT INTO public.role_permissions (role_id, permission_key)
    SELECT v_ceo_id, key FROM public.permissions
    ON CONFLICT DO NOTHING;

    -- COO: All except settings:manage and user:manage_roles
    INSERT INTO public.role_permissions (role_id, permission_key)
    SELECT v_coo_id, key FROM public.permissions
    WHERE key NOT IN ('settings:manage', 'user:manage_roles')
    ON CONFLICT DO NOTHING;

    -- HR: User management + chat + reports + project read
    INSERT INTO public.role_permissions (role_id, permission_key)
    SELECT v_hr_id, key FROM public.permissions
    WHERE key IN (
        'user:view', 'user:invite', 'user:edit',
        'chat:send', 'reports:view', 'project:read'
    )
    ON CONFLICT DO NOTHING;

    -- PM: Full project control + chat + reports + user view
    INSERT INTO public.role_permissions (role_id, permission_key)
    SELECT v_pm_id, key FROM public.permissions
    WHERE key IN (
        'project:create', 'project:read', 'project:update', 'project:delete',
        'project:assign_users', 'project:manage_milestones',
        'chat:send', 'reports:view', 'user:view'
    )
    ON CONFLICT DO NOTHING;

    -- HOD: Project read/update + user view + chat + reports
    INSERT INTO public.role_permissions (role_id, permission_key)
    SELECT v_hod_id, key FROM public.permissions
    WHERE key IN (
        'project:read', 'project:update', 'project:assign_users', 'project:manage_milestones',
        'user:view', 'chat:send', 'reports:view'
    )
    ON CONFLICT DO NOTHING;

    -- Employee: View projects + chat + reports
    INSERT INTO public.role_permissions (role_id, permission_key)
    SELECT v_employee_id, key FROM public.permissions
    WHERE key IN (
        'project:read', 'chat:send', 'reports:view'
    )
    ON CONFLICT DO NOTHING;

    RETURN v_role_ids;
END;
$$;

-- =============================================
-- 7. Update handle_new_user trigger to seed roles
-- =============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_org_id UUID;
  v_org_name TEXT;
  v_channel_id UUID;
  v_invite_token TEXT;
  v_invite_record RECORD;
  v_default_role_id UUID;
BEGIN
  v_invite_token := NEW.raw_user_meta_data ->> 'invite_token';

  IF v_invite_token IS NOT NULL THEN
    SELECT * INTO v_invite_record FROM public.invitations
    WHERE token = v_invite_token
    AND email = NEW.email
    AND status = 'pending'
    AND expires_at > now();

    IF FOUND THEN
      v_org_id := v_invite_record.organization_id;
      UPDATE public.invitations SET status = 'accepted' WHERE id = v_invite_record.id;
    ELSE
      v_org_name := split_part(NEW.email, '@', 2);
      INSERT INTO public.organizations (name, domain)
      VALUES (v_org_name, NEW.email)
      RETURNING id INTO v_org_id;
      PERFORM public.seed_default_roles(v_org_id);
    END IF;
  ELSE
    v_org_name := COALESCE(NEW.raw_user_meta_data ->> 'organization_name', split_part(NEW.email, '@', 2), 'My Organization');
    INSERT INTO public.organizations (name, domain)
    VALUES (v_org_name, NEW.email)
    RETURNING id INTO v_org_id;
    PERFORM public.seed_default_roles(v_org_id);
  END IF;

  IF v_invite_token IS NOT NULL THEN
    SELECT id INTO v_default_role_id FROM public.roles
    WHERE organization_id = v_org_id AND name = 'Employee';
  ELSE
    SELECT id INTO v_default_role_id FROM public.roles
    WHERE organization_id = v_org_id AND name = 'Administrator';
  END IF;

  INSERT INTO public.profiles (id, organization_id, email, role, role_id)
  VALUES (NEW.id, v_org_id, NEW.email,
    CASE WHEN v_invite_token IS NOT NULL THEN 'employee' ELSE 'admin' END,
    v_default_role_id);

  INSERT INTO public.channels (organization_id, name, description, created_by)
  VALUES (v_org_id, 'general', 'General discussion', NEW.id)
  ON CONFLICT (organization_id, name) DO NOTHING
  RETURNING id INTO v_channel_id;

  IF v_channel_id IS NULL THEN
    SELECT id INTO v_channel_id FROM public.channels
    WHERE organization_id = v_org_id AND name = 'general';
  END IF;

  INSERT INTO public.channel_members (channel_id, user_id, organization_id, role)
  VALUES (v_channel_id, NEW.id, v_org_id, 'member')
  ON CONFLICT (channel_id, user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- =============================================
-- 8. RLS Policies for RBAC Tables
-- =============================================

-- Roles RLS
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Users can view roles in their org" ON roles
    FOR SELECT USING (organization_id = public.get_user_organization_id());
  CREATE POLICY "Users can insert roles in their org" ON roles
    FOR INSERT WITH CHECK (organization_id = public.get_user_organization_id());
  CREATE POLICY "Users can update roles in their org" ON roles
    FOR UPDATE USING (organization_id = public.get_user_organization_id())
    WITH CHECK (organization_id = public.get_user_organization_id());
  CREATE POLICY "Users can delete roles in their org" ON roles
    FOR DELETE USING (organization_id = public.get_user_organization_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Role Permissions RLS
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Users can view role_permissions in their org" ON role_permissions
    FOR SELECT USING (
      EXISTS (
        SELECT 1 FROM roles
        WHERE roles.id = role_permissions.role_id
        AND roles.organization_id = public.get_user_organization_id()
      )
    );
  CREATE POLICY "Users can insert role_permissions in their org" ON role_permissions
    FOR INSERT WITH CHECK (
      EXISTS (
        SELECT 1 FROM roles
        WHERE roles.id = role_permissions.role_id
        AND roles.organization_id = public.get_user_organization_id()
      )
    );
  CREATE POLICY "Users can update role_permissions in their org" ON role_permissions
    FOR UPDATE USING (
      EXISTS (
        SELECT 1 FROM roles
        WHERE roles.id = role_permissions.role_id
        AND roles.organization_id = public.get_user_organization_id()
      )
    );
  CREATE POLICY "Users can delete role_permissions in their org" ON role_permissions
    FOR DELETE USING (
      EXISTS (
        SELECT 1 FROM roles
        WHERE roles.id = role_permissions.role_id
        AND roles.organization_id = public.get_user_organization_id()
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Permissions RLS (readable by all authenticated users)
ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "All authenticated users can view permissions" ON permissions
    FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =============================================
-- 9. Helper Function: Get user's permissions
-- =============================================
CREATE OR REPLACE FUNCTION public.get_user_permissions(p_user_id UUID)
RETURNS TABLE (permission_key TEXT)
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT DISTINCT rp.permission_key
  FROM profiles p
  JOIN roles r ON r.id = p.role_id
  JOIN role_permissions rp ON rp.role_id = r.id
  WHERE p.id = p_user_id
  AND p.organization_id = public.get_user_organization_id()
$$;

-- =============================================
-- 10. Helper Function: Check if user has a permission
-- =============================================
CREATE OR REPLACE FUNCTION public.user_has_permission(p_user_id UUID, p_permission TEXT)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM profiles p
    JOIN roles r ON r.id = p.role_id
    JOIN role_permissions rp ON rp.role_id = r.id
    WHERE p.id = p_user_id
    AND p.organization_id = public.get_user_organization_id()
    AND rp.permission_key = p_permission
  )
$$;