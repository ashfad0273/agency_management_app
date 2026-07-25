-- 1. Organizations Table
CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    domain TEXT UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Profiles Table (Linked to Supabase Auth.users)
CREATE TABLE IF NOT EXISTS profiles (
    id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL PRIMARY KEY,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
    email TEXT,
    role TEXT DEFAULT 'employee',
    role_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Projects Table
CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'active' NOT NULL,
    deadline DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Tasks Table
CREATE TABLE IF NOT EXISTS tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. Milestones Table
CREATE TABLE IF NOT EXISTS milestones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    due_date DATE,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. Project Members Table
CREATE TABLE IF NOT EXISTS project_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
    role TEXT DEFAULT 'member',
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(project_id, user_id)
);

-- ========================
-- Helper: SECURITY DEFINER function to avoid infinite recursion in RLS policies
-- ========================
CREATE OR REPLACE FUNCTION public.get_user_organization_id()
RETURNS UUID
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT organization_id FROM profiles WHERE id = auth.uid()
$$;

-- ========================
-- Performance Indexes on Foreign Key Columns
-- ========================
CREATE INDEX IF NOT EXISTS idx_profiles_organization_id ON profiles(organization_id);
CREATE INDEX IF NOT EXISTS idx_projects_organization_id ON projects(organization_id);
CREATE INDEX IF NOT EXISTS idx_tasks_organization_id ON tasks(organization_id);
CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_milestones_organization_id ON milestones(organization_id);
CREATE INDEX IF NOT EXISTS idx_milestones_project_id ON milestones(project_id);
CREATE INDEX IF NOT EXISTS idx_project_members_organization_id ON project_members(organization_id);
CREATE INDEX IF NOT EXISTS idx_project_members_project_id ON project_members(project_id);
CREATE INDEX IF NOT EXISTS idx_project_members_user_id ON project_members(user_id);

-- ========================
-- Row-Level Security (RLS)
-- ========================

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Users can view their own org" ON organizations FOR SELECT USING (id = public.get_user_organization_id());
  CREATE POLICY "Users can update their own org" ON organizations FOR UPDATE USING (id = public.get_user_organization_id()) WITH CHECK (id = public.get_user_organization_id());
  CREATE POLICY "Users can delete their own org" ON organizations FOR DELETE USING (id = public.get_user_organization_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Users can view profiles in their org" ON profiles FOR SELECT USING (organization_id = public.get_user_organization_id());
  CREATE POLICY "Users can insert their own profile" ON profiles FOR INSERT WITH CHECK (id = auth.uid());
  CREATE POLICY "Users can update profiles in their org" ON profiles FOR UPDATE USING (organization_id = public.get_user_organization_id()) WITH CHECK (organization_id = public.get_user_organization_id());
  CREATE POLICY "Users can delete profiles in their org" ON profiles FOR DELETE USING (organization_id = public.get_user_organization_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Users can view projects in their org" ON projects FOR SELECT USING (organization_id = public.get_user_organization_id());
  CREATE POLICY "Users can insert projects in their org" ON projects FOR INSERT WITH CHECK (organization_id = public.get_user_organization_id());
  CREATE POLICY "Users can update projects in their org" ON projects FOR UPDATE USING (organization_id = public.get_user_organization_id()) WITH CHECK (organization_id = public.get_user_organization_id());
  CREATE POLICY "Users can delete projects in their org" ON projects FOR DELETE USING (organization_id = public.get_user_organization_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Users can view tasks in their org" ON tasks FOR SELECT USING (organization_id = public.get_user_organization_id());
  CREATE POLICY "Users can insert tasks in their org" ON tasks FOR INSERT WITH CHECK (organization_id = public.get_user_organization_id());
  CREATE POLICY "Users can update tasks in their org" ON tasks FOR UPDATE USING (organization_id = public.get_user_organization_id());
  CREATE POLICY "Users can delete tasks in their org" ON tasks FOR DELETE USING (organization_id = public.get_user_organization_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE milestones ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Users can view milestones in their org" ON milestones FOR SELECT USING (organization_id = public.get_user_organization_id());
  CREATE POLICY "Users can insert milestones in their org" ON milestones FOR INSERT WITH CHECK (organization_id = public.get_user_organization_id());
  CREATE POLICY "Users can update milestones in their org" ON milestones FOR UPDATE USING (organization_id = public.get_user_organization_id());
  CREATE POLICY "Users can delete milestones in their org" ON milestones FOR DELETE USING (organization_id = public.get_user_organization_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Users can view project members in their org" ON project_members FOR SELECT USING (organization_id = public.get_user_organization_id());
  CREATE POLICY "Users can insert project members in their org" ON project_members FOR INSERT WITH CHECK (organization_id = public.get_user_organization_id());
  CREATE POLICY "Users can update project members in their org" ON project_members FOR UPDATE USING (organization_id = public.get_user_organization_id()) WITH CHECK (organization_id = public.get_user_organization_id());
  CREATE POLICY "Users can delete project members in their org" ON project_members FOR DELETE USING (organization_id = public.get_user_organization_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =============================================
-- 7. Invitations Table
-- =============================================
CREATE TABLE IF NOT EXISTS invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
    organization_name TEXT NOT NULL,
    email TEXT NOT NULL,
    token TEXT NOT NULL UNIQUE DEFAULT gen_random_uuid()::text,
    invited_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    role TEXT DEFAULT 'employee',
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now() + interval '7 days') NOT NULL
);

-- SECURITY DEFINER helper: look up an invitation by token
DROP FUNCTION IF EXISTS public.get_invite_by_token(TEXT) CASCADE;
CREATE OR REPLACE FUNCTION public.get_invite_by_token(p_token TEXT)
RETURNS TABLE (organization_name TEXT, email TEXT, role TEXT, organization_id UUID)
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT inv.organization_name, inv.email, inv.role, inv.organization_id
  FROM invitations inv
  WHERE inv.token = p_token
  AND inv.status = 'pending'
  AND inv.expires_at > now()
  LIMIT 1
$$;

ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view invites in their org" ON invitations;
CREATE POLICY "Users can view invites in their org" ON invitations
  FOR SELECT USING (organization_id = public.get_user_organization_id());
DROP POLICY IF EXISTS "Users can create invites in their org" ON invitations;
CREATE POLICY "Users can create invites in their org" ON invitations
  FOR INSERT WITH CHECK (organization_id = public.get_user_organization_id());
DROP POLICY IF EXISTS "Users can update invites they created" ON invitations;
CREATE POLICY "Users can update invites they created" ON invitations
  FOR UPDATE USING (invited_by = auth.uid()) WITH CHECK (invited_by = auth.uid());

CREATE INDEX IF NOT EXISTS idx_invitations_email ON invitations(email);

-- =============================================
-- Channel tables (needed by handle_new_user trigger)
-- =============================================
CREATE TABLE IF NOT EXISTS channels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    is_private BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(organization_id, name)
);

CREATE TABLE IF NOT EXISTS channel_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_id UUID REFERENCES channels(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
    role TEXT DEFAULT 'member',
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(channel_id, user_id)
);

ALTER TABLE channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE channel_members ENABLE ROW LEVEL SECURITY;

-- Channels RLS Policies
DROP POLICY IF EXISTS "Users can view channels in their org" ON channels;
CREATE POLICY "Users can view channels in their org" ON channels
    FOR SELECT USING (
        organization_id = public.get_user_organization_id()
        AND (
            is_private = false
            OR EXISTS (
                SELECT 1 FROM channel_members
                WHERE channel_members.channel_id = id
                AND channel_members.user_id = auth.uid()
            )
        )
    );
DROP POLICY IF EXISTS "Users can insert channels in their org" ON channels;
CREATE POLICY "Users can insert channels in their org" ON channels
    FOR INSERT WITH CHECK (organization_id = public.get_user_organization_id());
DROP POLICY IF EXISTS "Users can update channels in their org" ON channels;
CREATE POLICY "Users can update channels in their org" ON channels
    FOR UPDATE USING (organization_id = public.get_user_organization_id());
DROP POLICY IF EXISTS "Users can delete channels in their org" ON channels;
CREATE POLICY "Users can delete channels in their org" ON channels
    FOR DELETE USING (organization_id = public.get_user_organization_id());

-- Channel Members RLS Policies
DROP POLICY IF EXISTS "Users can view channel members in their org" ON channel_members;
CREATE POLICY "Users can view channel members in their org" ON channel_members
    FOR SELECT USING (organization_id = public.get_user_organization_id());
DROP POLICY IF EXISTS "Users can insert channel members in their org" ON channel_members;
CREATE POLICY "Users can insert channel members in their org" ON channel_members
    FOR INSERT WITH CHECK (organization_id = public.get_user_organization_id());
DROP POLICY IF EXISTS "Users can update channel members in their org" ON channel_members;
CREATE POLICY "Users can update channel members in their org" ON channel_members
    FOR UPDATE USING (organization_id = public.get_user_organization_id());
DROP POLICY IF EXISTS "Users can delete channel members in their org" ON channel_members;
CREATE POLICY "Users can delete channel members in their org" ON channel_members
    FOR DELETE USING (organization_id = public.get_user_organization_id());

-- =============================================
-- 8. RBAC Tables
-- =============================================
CREATE TABLE IF NOT EXISTS permissions (
    key TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    group_name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    is_system BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(organization_id, name)
);

CREATE TABLE IF NOT EXISTS role_permissions (
    role_id UUID REFERENCES roles(id) ON DELETE CASCADE NOT NULL,
    permission_key TEXT REFERENCES permissions(key) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    PRIMARY KEY (role_id, permission_key)
);

-- Add FK constraint for role_id on profiles
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_role_id_fkey') THEN
    ALTER TABLE profiles ADD CONSTRAINT profiles_role_id_fkey FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Seed default permissions
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

-- Seed default roles function
CREATE OR REPLACE FUNCTION public.seed_default_roles(p_org_id UUID)
RETURNS UUID[]
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

    -- Administrator: all permissions
    INSERT INTO public.role_permissions (role_id, permission_key)
    SELECT v_admin_id, key FROM public.permissions
    ON CONFLICT DO NOTHING;

    -- CEO: all permissions
    INSERT INTO public.role_permissions (role_id, permission_key)
    SELECT v_ceo_id, key FROM public.permissions
    ON CONFLICT DO NOTHING;

    -- COO: all except settings:manage and user:manage_roles
    INSERT INTO public.role_permissions (role_id, permission_key)
    SELECT v_coo_id, key FROM public.permissions
    WHERE key NOT IN ('settings:manage', 'user:manage_roles')
    ON CONFLICT DO NOTHING;

    -- HR: user management + chat + reports + project read
    INSERT INTO public.role_permissions (role_id, permission_key)
    SELECT v_hr_id, key FROM public.permissions
    WHERE key IN ('user:view', 'user:invite', 'user:edit', 'chat:send', 'reports:view', 'project:read')
    ON CONFLICT DO NOTHING;

    -- PM: full project control + chat + reports + user view
    INSERT INTO public.role_permissions (role_id, permission_key)
    SELECT v_pm_id, key FROM public.permissions
    WHERE key IN ('project:create', 'project:read', 'project:update', 'project:delete',
        'project:assign_users', 'project:manage_milestones', 'chat:send', 'reports:view', 'user:view')
    ON CONFLICT DO NOTHING;

    -- HOD: project read/update + user view + chat + reports
    INSERT INTO public.role_permissions (role_id, permission_key)
    SELECT v_hod_id, key FROM public.permissions
    WHERE key IN ('project:read', 'project:update', 'project:assign_users', 'project:manage_milestones',
        'user:view', 'chat:send', 'reports:view')
    ON CONFLICT DO NOTHING;

    -- Employee: view projects + chat + reports
    INSERT INTO public.role_permissions (role_id, permission_key)
    SELECT v_employee_id, key FROM public.permissions
    WHERE key IN ('project:read', 'chat:send', 'reports:view')
    ON CONFLICT DO NOTHING;

    RETURN v_role_ids;
END;
$$;

ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Users can view roles in their org" ON roles FOR SELECT USING (organization_id = public.get_user_organization_id());
  CREATE POLICY "Users can insert roles in their org" ON roles FOR INSERT WITH CHECK (organization_id = public.get_user_organization_id());
  CREATE POLICY "Users can update roles in their org" ON roles FOR UPDATE USING (organization_id = public.get_user_organization_id()) WITH CHECK (organization_id = public.get_user_organization_id());
  CREATE POLICY "Users can delete roles in their org" ON roles FOR DELETE USING (organization_id = public.get_user_organization_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Users can view role_permissions in their org" ON role_permissions FOR SELECT USING (
    EXISTS (SELECT 1 FROM roles WHERE roles.id = role_permissions.role_id AND roles.organization_id = public.get_user_organization_id()));
  CREATE POLICY "Users can insert role_permissions in their org" ON role_permissions FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM roles WHERE roles.id = role_permissions.role_id AND roles.organization_id = public.get_user_organization_id()));
  CREATE POLICY "Users can update role_permissions in their org" ON role_permissions FOR UPDATE USING (
    EXISTS (SELECT 1 FROM roles WHERE roles.id = role_permissions.role_id AND roles.organization_id = public.get_user_organization_id()));
  CREATE POLICY "Users can delete role_permissions in their org" ON role_permissions FOR DELETE USING (
    EXISTS (SELECT 1 FROM roles WHERE roles.id = role_permissions.role_id AND roles.organization_id = public.get_user_organization_id()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "All authenticated users can view permissions" ON permissions FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Helper: get user permissions
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

-- Helper: check if user has a permission
CREATE OR REPLACE FUNCTION public.user_has_permission(p_user_id UUID, p_permission TEXT)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles p
    JOIN roles r ON r.id = p.role_id
    JOIN role_permissions rp ON rp.role_id = r.id
    WHERE p.id = p_user_id
    AND p.organization_id = public.get_user_organization_id()
    AND rp.permission_key = p_permission
  )
$$;

-- =============================================
-- 9. Auto-Create Organization & Profile on Signup
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
      INSERT INTO public.organizations (name, domain) VALUES (v_org_name, NEW.email)
      ON CONFLICT (domain) DO UPDATE SET name = EXCLUDED.name
      RETURNING id INTO v_org_id;
      PERFORM public.seed_default_roles(v_org_id);
    END IF;
  ELSE
    v_org_name := COALESCE(NEW.raw_user_meta_data ->> 'organization_name', split_part(NEW.email, '@', 2), 'My Organization');
    INSERT INTO public.organizations (name, domain) VALUES (v_org_name, NEW.email)
    ON CONFLICT (domain) DO UPDATE SET name = EXCLUDED.name
    RETURNING id INTO v_org_id;
    PERFORM public.seed_default_roles(v_org_id);
  END IF;

  IF v_invite_token IS NOT NULL THEN
    SELECT id INTO v_default_role_id FROM public.roles WHERE organization_id = v_org_id AND name = 'Employee';
  ELSE
    SELECT id INTO v_default_role_id FROM public.roles WHERE organization_id = v_org_id AND name = 'Administrator';
  END IF;
  IF v_default_role_id IS NULL THEN
    SELECT id INTO v_default_role_id FROM public.roles WHERE organization_id = v_org_id LIMIT 1;
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
    SELECT id INTO v_channel_id FROM public.channels WHERE organization_id = v_org_id AND name = 'general';
  END IF;

  INSERT INTO public.channel_members (channel_id, user_id, organization_id, role)
  VALUES (v_channel_id, NEW.id, v_org_id, 'member')
  ON CONFLICT (channel_id, user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'on_auth_user_created') THEN
    CREATE TRIGGER on_auth_user_created
      AFTER INSERT ON auth.users
      FOR EACH ROW
      EXECUTE FUNCTION public.handle_new_user();
  END IF;
END $$;

-- =============================================
-- 10. accept_invite_existing_user RPC
-- =============================================
CREATE OR REPLACE FUNCTION public.accept_invite_existing_user(p_token TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite RECORD;
  v_user_email TEXT;
  v_default_role_id UUID;
  v_channel_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Must be authenticated to accept an invitation';
  END IF;

  SELECT * INTO v_invite
  FROM public.invitations
  WHERE token = p_token
  AND status = 'pending'
  AND expires_at > now()
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid or expired invitation';
  END IF;

  SELECT email INTO v_user_email FROM auth.users WHERE id = auth.uid();
  IF v_user_email IS NULL OR lower(v_user_email) <> lower(v_invite.email) THEN
    RAISE EXCEPTION 'This invitation was sent to a different email address';
  END IF;

  SELECT id INTO v_default_role_id
  FROM public.roles
  WHERE organization_id = v_invite.organization_id
  AND lower(name) = 'employee'
  LIMIT 1;

  UPDATE public.profiles
  SET
    organization_id = v_invite.organization_id,
    role = COALESCE(v_invite.role, 'employee'),
    role_id = COALESCE(v_default_role_id, role_id)
  WHERE id = auth.uid();

  SELECT id INTO v_channel_id
  FROM public.channels
  WHERE organization_id = v_invite.organization_id AND name = 'general'
  LIMIT 1;

  IF v_channel_id IS NOT NULL THEN
    INSERT INTO public.channel_members (channel_id, user_id, organization_id, role)
    VALUES (v_channel_id, auth.uid(), v_invite.organization_id, 'member')
    ON CONFLICT (channel_id, user_id) DO NOTHING;
  END IF;

  UPDATE public.invitations
  SET status = 'accepted'
  WHERE id = v_invite.id;

  RETURN v_invite.organization_name;
END;
$$;

NOTIFY pgrst, 'reload schema';
