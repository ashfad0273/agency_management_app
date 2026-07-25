-- ============================================================
-- COMPLETE SCHEMA — Agency Management App
-- Paste this entire file into the Supabase SQL Editor and run.
-- Idempotent: safe to run multiple times.
-- ============================================================

-- =============================================
-- 1. ORGANIZATIONS
-- =============================================
CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    domain TEXT UNIQUE,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- =============================================
-- 2. PROFILES (linked to Supabase auth.users)
-- =============================================
CREATE TABLE IF NOT EXISTS profiles (
    id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL PRIMARY KEY,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
    email TEXT,
    role TEXT DEFAULT 'employee',
    role_id UUID,        -- FK added below after roles table
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- =============================================
-- 3. PROJECTS
-- =============================================
CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'active' NOT NULL,
    deadline DATE,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Add columns if the table already existed from a previous schema
ALTER TABLE projects ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active' NOT NULL;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS deadline DATE;

-- =============================================
-- 4. TASKS
-- =============================================
CREATE TABLE IF NOT EXISTS tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    status TEXT DEFAULT 'pending' NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- =============================================
-- 5. MILESTONES
-- =============================================
CREATE TABLE IF NOT EXISTS milestones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    due_date DATE,
    status TEXT DEFAULT 'pending' NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- =============================================
-- 6. PROJECT MEMBERS
-- =============================================
CREATE TABLE IF NOT EXISTS project_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
    role TEXT DEFAULT 'member' NOT NULL,
    joined_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(project_id, user_id)
);

-- =============================================
-- 7. INVITATIONS
-- =============================================
CREATE TABLE IF NOT EXISTS invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
    organization_name TEXT NOT NULL,
    email TEXT NOT NULL,
    token TEXT NOT NULL UNIQUE DEFAULT gen_random_uuid()::text,
    invited_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    role TEXT DEFAULT 'employee',
    status TEXT DEFAULT 'pending' NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    expires_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now() + interval '7 days') NOT NULL
);

-- =============================================
-- 8. CHANNELS (chat)
-- =============================================
CREATE TABLE IF NOT EXISTS channels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    is_private BOOLEAN DEFAULT false NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(organization_id, name)
);

CREATE TABLE IF NOT EXISTS channel_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_id UUID REFERENCES channels(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
    role TEXT DEFAULT 'member' NOT NULL,
    joined_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(channel_id, user_id)
);

-- =============================================
-- 9. CONVERSATIONS (direct messages)
-- =============================================
CREATE TABLE IF NOT EXISTS conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS conversation_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
    joined_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(conversation_id, user_id)
);

-- =============================================
-- 10. MESSAGES
-- =============================================
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    channel_id UUID REFERENCES channels(id) ON DELETE CASCADE,
    conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS message_reads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    channel_id UUID REFERENCES channels(id) ON DELETE CASCADE,
    conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
    last_read_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(user_id, project_id, channel_id, conversation_id)
);

-- =============================================
-- 11. RBAC: PERMISSIONS
-- =============================================
CREATE TABLE IF NOT EXISTS permissions (
    key TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    group_name TEXT NOT NULL
);

-- =============================================
-- 12. RBAC: ROLES
-- =============================================
CREATE TABLE IF NOT EXISTS roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    is_system BOOLEAN DEFAULT false NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(organization_id, name)
);

-- =============================================
-- 13. RBAC: ROLE ↔ PERMISSION junction
-- =============================================
CREATE TABLE IF NOT EXISTS role_permissions (
    role_id UUID REFERENCES roles(id) ON DELETE CASCADE NOT NULL,
    permission_key TEXT REFERENCES permissions(key) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    PRIMARY KEY (role_id, permission_key)
);

-- =============================================
-- 14. Add FK for profiles.role_id → roles.id
-- =============================================
DO $$ BEGIN
  ALTER TABLE profiles ADD CONSTRAINT fk_profiles_role_id
    FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- =============================================
-- 15. PERFORMANCE INDEXES
-- =============================================
CREATE INDEX IF NOT EXISTS idx_profiles_organization_id ON profiles(organization_id);
CREATE INDEX IF NOT EXISTS idx_projects_organization_id ON projects(organization_id);
CREATE INDEX IF NOT EXISTS idx_tasks_organization_id ON tasks(organization_id);
CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_milestones_organization_id ON milestones(organization_id);
CREATE INDEX IF NOT EXISTS idx_milestones_project_id ON milestones(project_id);
CREATE INDEX IF NOT EXISTS idx_project_members_organization_id ON project_members(organization_id);
CREATE INDEX IF NOT EXISTS idx_project_members_project_id ON project_members(project_id);
CREATE INDEX IF NOT EXISTS idx_project_members_user_id ON project_members(user_id);
CREATE INDEX IF NOT EXISTS idx_invitations_organization_id ON invitations(organization_id);
CREATE INDEX IF NOT EXISTS idx_invitations_token ON invitations(token);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_channel_id ON messages(channel_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_channel_members_user_id ON channel_members(user_id);
CREATE INDEX IF NOT EXISTS idx_conversation_participants_user_id ON conversation_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_roles_organization_id ON roles(organization_id);

-- =============================================
-- 16. HELPER: get_user_organization_id
-- SECURITY DEFINER so RLS policies can call it
-- =============================================
CREATE OR REPLACE FUNCTION public.get_user_organization_id()
RETURNS UUID
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT organization_id FROM profiles WHERE id = auth.uid()
$$;

-- =============================================
-- 17. HELPER: get_invite_by_token (used during signup)
-- =============================================
CREATE OR REPLACE FUNCTION public.get_invite_by_token(p_token TEXT)
RETURNS TABLE (organization_name TEXT, email TEXT)
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT inv.organization_name, inv.email
  FROM invitations inv
  WHERE inv.token = p_token
  AND inv.status = 'pending'
  AND inv.expires_at > now()
  LIMIT 1
$$;

-- =============================================
-- 18. HELPER: is_conversation_participant
-- =============================================
CREATE OR REPLACE FUNCTION public.is_conversation_participant(conv_id UUID, uid UUID)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM conversation_participants
    WHERE conversation_id = conv_id AND user_id = uid
  )
$$;

-- =============================================
-- 19. HELPER: upsert_message_read (avoids 409)
-- =============================================
CREATE OR REPLACE FUNCTION public.upsert_message_read(
  p_user_id UUID,
  p_organization_id UUID,
  p_project_id UUID DEFAULT NULL,
  p_channel_id UUID DEFAULT NULL,
  p_conversation_id UUID DEFAULT NULL
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_user_id != auth.uid() THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;
  LOOP
    UPDATE message_reads
    SET last_read_at = now()
    WHERE user_id = p_user_id
    AND (
      (p_project_id IS NOT NULL AND project_id = p_project_id AND channel_id IS NULL AND conversation_id IS NULL)
      OR (p_channel_id IS NOT NULL AND channel_id = p_channel_id)
      OR (p_conversation_id IS NOT NULL AND conversation_id = p_conversation_id)
      OR (p_project_id IS NULL AND p_channel_id IS NULL AND p_conversation_id IS NULL
          AND project_id IS NULL AND channel_id IS NULL AND conversation_id IS NULL)
    );
    IF FOUND THEN RETURN; END IF;
    BEGIN
      INSERT INTO message_reads (user_id, organization_id, project_id, channel_id, conversation_id, last_read_at)
      VALUES (p_user_id, p_organization_id, p_project_id, p_channel_id, p_conversation_id, now());
      RETURN;
    EXCEPTION WHEN unique_violation THEN
      -- concurrent insert; retry UPDATE
    END;
  END LOOP;
END;
$$;

-- =============================================
-- 20. HELPER: get_user_permissions
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
-- 21. HELPER: user_has_permission
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

-- =============================================
-- 22. SEED DEFAULT PERMISSIONS
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
-- 23. SEED DEFAULT ROLES (function)
-- =============================================
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
    VALUES (p_org_id, 'CEO', 'Chief Executive Officer — full access', true)
    ON CONFLICT (organization_id, name) DO NOTHING;
    SELECT id INTO v_ceo_id FROM public.roles WHERE organization_id = p_org_id AND name = 'CEO';

    INSERT INTO public.roles (organization_id, name, description, is_system)
    VALUES (p_org_id, 'COO', 'Chief Operating Officer — operational control', true)
    ON CONFLICT (organization_id, name) DO NOTHING;
    SELECT id INTO v_coo_id FROM public.roles WHERE organization_id = p_org_id AND name = 'COO';

    INSERT INTO public.roles (organization_id, name, description, is_system)
    VALUES (p_org_id, 'HR', 'Human Resources — manages people', true)
    ON CONFLICT (organization_id, name) DO NOTHING;
    SELECT id INTO v_hr_id FROM public.roles WHERE organization_id = p_org_id AND name = 'HR';

    INSERT INTO public.roles (organization_id, name, description, is_system)
    VALUES (p_org_id, 'PM', 'Project Manager — manages projects and timelines', true)
    ON CONFLICT (organization_id, name) DO NOTHING;
    SELECT id INTO v_pm_id FROM public.roles WHERE organization_id = p_org_id AND name = 'PM';

    INSERT INTO public.roles (organization_id, name, description, is_system)
    VALUES (p_org_id, 'HOD', 'Head of Department — oversees department work', true)
    ON CONFLICT (organization_id, name) DO NOTHING;
    SELECT id INTO v_hod_id FROM public.roles WHERE organization_id = p_org_id AND name = 'HOD';

    INSERT INTO public.roles (organization_id, name, description, is_system)
    VALUES (p_org_id, 'Employee', 'Standard team member', true)
    ON CONFLICT (organization_id, name) DO NOTHING;
    SELECT id INTO v_employee_id FROM public.roles WHERE organization_id = p_org_id AND name = 'Employee';

    v_role_ids := ARRAY[v_admin_id, v_ceo_id, v_coo_id, v_hr_id, v_pm_id, v_hod_id, v_employee_id];

    -- Administrator: ALL permissions
    INSERT INTO public.role_permissions (role_id, permission_key)
    SELECT v_admin_id, key FROM public.permissions ON CONFLICT DO NOTHING;
    -- CEO: ALL permissions
    INSERT INTO public.role_permissions (role_id, permission_key)
    SELECT v_ceo_id, key FROM public.permissions ON CONFLICT DO NOTHING;
    -- COO: All except settings:manage and user:manage_roles
    INSERT INTO public.role_permissions (role_id, permission_key)
    SELECT v_coo_id, key FROM public.permissions
    WHERE key NOT IN ('settings:manage', 'user:manage_roles') ON CONFLICT DO NOTHING;
    -- HR: User management + chat + reports + project read
    INSERT INTO public.role_permissions (role_id, permission_key)
    SELECT v_hr_id, key FROM public.permissions
    WHERE key IN ('user:view','user:invite','user:edit','chat:send','reports:view','project:read')
    ON CONFLICT DO NOTHING;
    -- PM: Full project control + chat + reports + user view
    INSERT INTO public.role_permissions (role_id, permission_key)
    SELECT v_pm_id, key FROM public.permissions
    WHERE key IN ('project:create','project:read','project:update','project:delete','project:assign_users','project:manage_milestones','chat:send','reports:view','user:view')
    ON CONFLICT DO NOTHING;
    -- HOD: Project read/update + user view + chat + reports
    INSERT INTO public.role_permissions (role_id, permission_key)
    SELECT v_hod_id, key FROM public.permissions
    WHERE key IN ('project:read','project:update','project:assign_users','project:manage_milestones','user:view','chat:send','reports:view')
    ON CONFLICT DO NOTHING;
    -- Employee: View projects + chat + reports
    INSERT INTO public.role_permissions (role_id, permission_key)
    SELECT v_employee_id, key FROM public.permissions
    WHERE key IN ('project:read','chat:send','reports:view')
    ON CONFLICT DO NOTHING;

    RETURN v_role_ids;
END;
$$;

-- =============================================
-- 24. TRIGGER: handle_new_user (on signup)
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
      INSERT INTO public.organizations (name, domain) VALUES (v_org_name, NEW.email) RETURNING id INTO v_org_id;
      PERFORM public.seed_default_roles(v_org_id);
    END IF;
  ELSE
    v_org_name := COALESCE(NEW.raw_user_meta_data ->> 'organization_name', split_part(NEW.email, '@', 2), 'My Organization');
    INSERT INTO public.organizations (name, domain) VALUES (v_org_name, NEW.email) RETURNING id INTO v_org_id;
    PERFORM public.seed_default_roles(v_org_id);
  END IF;

  IF v_invite_token IS NOT NULL THEN
    SELECT id INTO v_default_role_id FROM public.roles WHERE organization_id = v_org_id AND name = 'Employee';
  ELSE
    SELECT id INTO v_default_role_id FROM public.roles WHERE organization_id = v_org_id AND name = 'Administrator';
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

-- Attach trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- =============================================
-- 25. ROW-LEVEL SECURITY POLICIES
-- =============================================

-- Organizations
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "org_select" ON organizations;
DROP POLICY IF EXISTS "org_update" ON organizations;
DROP POLICY IF EXISTS "org_delete" ON organizations;
CREATE POLICY "org_select" ON organizations FOR SELECT USING (id = public.get_user_organization_id());
CREATE POLICY "org_update" ON organizations FOR UPDATE USING (id = public.get_user_organization_id());
CREATE POLICY "org_delete" ON organizations FOR DELETE USING (id = public.get_user_organization_id());

-- Profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "profiles_select" ON profiles;
DROP POLICY IF EXISTS "profiles_insert" ON profiles;
DROP POLICY IF EXISTS "profiles_update" ON profiles;
DROP POLICY IF EXISTS "profiles_delete" ON profiles;
CREATE POLICY "profiles_select" ON profiles FOR SELECT USING (organization_id = public.get_user_organization_id());
CREATE POLICY "profiles_insert" ON profiles FOR INSERT WITH CHECK (id = auth.uid());
CREATE POLICY "profiles_update" ON profiles FOR UPDATE USING (organization_id = public.get_user_organization_id());
CREATE POLICY "profiles_delete" ON profiles FOR DELETE USING (organization_id = public.get_user_organization_id());

-- Projects
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "projects_select" ON projects;
DROP POLICY IF EXISTS "projects_insert" ON projects;
DROP POLICY IF EXISTS "projects_update" ON projects;
DROP POLICY IF EXISTS "projects_delete" ON projects;
CREATE POLICY "projects_select" ON projects FOR SELECT USING (organization_id = public.get_user_organization_id());
CREATE POLICY "projects_insert" ON projects FOR INSERT WITH CHECK (organization_id = public.get_user_organization_id());
CREATE POLICY "projects_update" ON projects FOR UPDATE USING (organization_id = public.get_user_organization_id());
CREATE POLICY "projects_delete" ON projects FOR DELETE USING (organization_id = public.get_user_organization_id());

-- Tasks
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tasks_select" ON tasks;
DROP POLICY IF EXISTS "tasks_insert" ON tasks;
DROP POLICY IF EXISTS "tasks_update" ON tasks;
DROP POLICY IF EXISTS "tasks_delete" ON tasks;
CREATE POLICY "tasks_select" ON tasks FOR SELECT USING (organization_id = public.get_user_organization_id());
CREATE POLICY "tasks_insert" ON tasks FOR INSERT WITH CHECK (organization_id = public.get_user_organization_id());
CREATE POLICY "tasks_update" ON tasks FOR UPDATE USING (organization_id = public.get_user_organization_id());
CREATE POLICY "tasks_delete" ON tasks FOR DELETE USING (organization_id = public.get_user_organization_id());

-- Milestones
ALTER TABLE milestones ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "milestones_select" ON milestones;
DROP POLICY IF EXISTS "milestones_insert" ON milestones;
DROP POLICY IF EXISTS "milestones_update" ON milestones;
DROP POLICY IF EXISTS "milestones_delete" ON milestones;
CREATE POLICY "milestones_select" ON milestones FOR SELECT USING (organization_id = public.get_user_organization_id());
CREATE POLICY "milestones_insert" ON milestones FOR INSERT WITH CHECK (organization_id = public.get_user_organization_id());
CREATE POLICY "milestones_update" ON milestones FOR UPDATE USING (organization_id = public.get_user_organization_id());
CREATE POLICY "milestones_delete" ON milestones FOR DELETE USING (organization_id = public.get_user_organization_id());

-- Project Members
ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "pm_select" ON project_members;
DROP POLICY IF EXISTS "pm_insert" ON project_members;
DROP POLICY IF EXISTS "pm_update" ON project_members;
DROP POLICY IF EXISTS "pm_delete" ON project_members;
CREATE POLICY "pm_select" ON project_members FOR SELECT USING (organization_id = public.get_user_organization_id());
CREATE POLICY "pm_insert" ON project_members FOR INSERT WITH CHECK (organization_id = public.get_user_organization_id());
CREATE POLICY "pm_update" ON project_members FOR UPDATE USING (organization_id = public.get_user_organization_id());
CREATE POLICY "pm_delete" ON project_members FOR DELETE USING (organization_id = public.get_user_organization_id());

-- Invitations
ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "inv_select" ON invitations;
DROP POLICY IF EXISTS "inv_insert" ON invitations;
DROP POLICY IF EXISTS "inv_update" ON invitations;
CREATE POLICY "inv_select" ON invitations FOR SELECT USING (organization_id = public.get_user_organization_id());
CREATE POLICY "inv_insert" ON invitations FOR INSERT WITH CHECK (organization_id = public.get_user_organization_id());
CREATE POLICY "inv_update" ON invitations FOR UPDATE USING (invited_by = auth.uid());

-- Channels
ALTER TABLE channels ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ch_select" ON channels;
DROP POLICY IF EXISTS "ch_insert" ON channels;
DROP POLICY IF EXISTS "ch_update" ON channels;
DROP POLICY IF EXISTS "ch_delete" ON channels;
CREATE POLICY "ch_select" ON channels FOR SELECT USING (
    organization_id = public.get_user_organization_id()
    AND (is_private = false OR EXISTS (SELECT 1 FROM channel_members WHERE channel_members.channel_id = id AND channel_members.user_id = auth.uid()))
);
CREATE POLICY "ch_insert" ON channels FOR INSERT WITH CHECK (organization_id = public.get_user_organization_id());
CREATE POLICY "ch_update" ON channels FOR UPDATE USING (organization_id = public.get_user_organization_id());
CREATE POLICY "ch_delete" ON channels FOR DELETE USING (organization_id = public.get_user_organization_id());

-- Channel Members
ALTER TABLE channel_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "cm_select" ON channel_members;
DROP POLICY IF EXISTS "cm_insert" ON channel_members;
DROP POLICY IF EXISTS "cm_delete" ON channel_members;
CREATE POLICY "cm_select" ON channel_members FOR SELECT USING (
    EXISTS (SELECT 1 FROM channel_members cm2 WHERE cm2.channel_id = channel_members.channel_id AND cm2.user_id = auth.uid())
);
CREATE POLICY "cm_insert" ON channel_members FOR INSERT WITH CHECK (organization_id = public.get_user_organization_id());
CREATE POLICY "cm_delete" ON channel_members FOR DELETE USING (
    EXISTS (SELECT 1 FROM channel_members cm2 WHERE cm2.channel_id = channel_members.channel_id AND cm2.user_id = auth.uid())
);

-- Conversations
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "conv_select" ON conversations;
DROP POLICY IF EXISTS "conv_insert" ON conversations;
CREATE POLICY "conv_select" ON conversations FOR SELECT USING (
    organization_id = public.get_user_organization_id()
    AND public.is_conversation_participant(id, auth.uid())
);
CREATE POLICY "conv_insert" ON conversations FOR INSERT WITH CHECK (organization_id = public.get_user_organization_id());

-- Conversation Participants
ALTER TABLE conversation_participants ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "cp_select" ON conversation_participants;
DROP POLICY IF EXISTS "cp_insert" ON conversation_participants;
CREATE POLICY "cp_select" ON conversation_participants FOR SELECT USING (
    organization_id = public.get_user_organization_id()
    AND public.is_conversation_participant(conversation_id, auth.uid())
);
CREATE POLICY "cp_insert" ON conversation_participants FOR INSERT WITH CHECK (organization_id = public.get_user_organization_id());

-- Messages
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "msg_select" ON messages;
DROP POLICY IF EXISTS "msg_insert" ON messages;
CREATE POLICY "msg_select" ON messages FOR SELECT USING (organization_id = public.get_user_organization_id());
CREATE POLICY "msg_insert" ON messages FOR INSERT WITH CHECK (
    organization_id = public.get_user_organization_id()
    AND sender_id = auth.uid()
);

-- Message Reads
ALTER TABLE message_reads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "mr_select" ON message_reads;
DROP POLICY IF EXISTS "mr_insert" ON message_reads;
DROP POLICY IF EXISTS "mr_update" ON message_reads;
CREATE POLICY "mr_select" ON message_reads FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "mr_insert" ON message_reads FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "mr_update" ON message_reads FOR UPDATE USING (user_id = auth.uid());

-- Roles
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "roles_select" ON roles;
DROP POLICY IF EXISTS "roles_insert" ON roles;
DROP POLICY IF EXISTS "roles_update" ON roles;
DROP POLICY IF EXISTS "roles_delete" ON roles;
CREATE POLICY "roles_select" ON roles FOR SELECT USING (organization_id = public.get_user_organization_id());
CREATE POLICY "roles_insert" ON roles FOR INSERT WITH CHECK (organization_id = public.get_user_organization_id());
CREATE POLICY "roles_update" ON roles FOR UPDATE USING (organization_id = public.get_user_organization_id());
CREATE POLICY "roles_delete" ON roles FOR DELETE USING (organization_id = public.get_user_organization_id());

-- Role Permissions
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rp_select" ON role_permissions;
DROP POLICY IF EXISTS "rp_insert" ON role_permissions;
DROP POLICY IF EXISTS "rp_update" ON role_permissions;
DROP POLICY IF EXISTS "rp_delete" ON role_permissions;
CREATE POLICY "rp_select" ON role_permissions FOR SELECT USING (
    EXISTS (SELECT 1 FROM roles WHERE roles.id = role_permissions.role_id AND roles.organization_id = public.get_user_organization_id())
);
CREATE POLICY "rp_insert" ON role_permissions FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM roles WHERE roles.id = role_permissions.role_id AND roles.organization_id = public.get_user_organization_id())
);
CREATE POLICY "rp_update" ON role_permissions FOR UPDATE USING (
    EXISTS (SELECT 1 FROM roles WHERE roles.id = role_permissions.role_id AND roles.organization_id = public.get_user_organization_id())
);
CREATE POLICY "rp_delete" ON role_permissions FOR DELETE USING (
    EXISTS (SELECT 1 FROM roles WHERE roles.id = role_permissions.role_id AND roles.organization_id = public.get_user_organization_id())
);

-- Permissions (readable by all authenticated users)
ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "perm_select" ON permissions;
CREATE POLICY "perm_select" ON permissions FOR SELECT USING (true);

-- ============================================
-- 26. Refresh PostgREST schema cache
-- ============================================
NOTIFY pgrst, 'reload schema';

-- ============================================
-- DONE! Your schema is ready.
-- ============================================
