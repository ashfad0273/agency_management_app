-- 1. Organizations Table
CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    domain TEXT UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Profiles Table (Linked to Supabase Auth.users)
-- Note: 'auth.users' is a built-in table managed by Supabase
CREATE TABLE IF NOT EXISTS profiles (
    id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL PRIMARY KEY,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
    email TEXT,
    role TEXT DEFAULT 'employee',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Projects Table
CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
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

-- 6. Project Members Table (for per-project access control)
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

-- Organizations RLS
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Users can view their own org" ON organizations FOR SELECT USING (id = public.get_user_organization_id());
  CREATE POLICY "Users can update their own org" ON organizations FOR UPDATE USING (id = public.get_user_organization_id()) WITH CHECK (id = public.get_user_organization_id());
  CREATE POLICY "Users can delete their own org" ON organizations FOR DELETE USING (id = public.get_user_organization_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Profiles RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Users can view profiles in their org" ON profiles FOR SELECT USING (organization_id = public.get_user_organization_id());
  CREATE POLICY "Users can insert their own profile" ON profiles FOR INSERT WITH CHECK (id = auth.uid());
  CREATE POLICY "Users can update profiles in their org" ON profiles FOR UPDATE USING (organization_id = public.get_user_organization_id()) WITH CHECK (organization_id = public.get_user_organization_id());
  CREATE POLICY "Users can delete profiles in their org" ON profiles FOR DELETE USING (organization_id = public.get_user_organization_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Projects RLS
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Users can view projects in their org" ON projects FOR SELECT USING (organization_id = public.get_user_organization_id());
  CREATE POLICY "Users can insert projects in their org" ON projects FOR INSERT WITH CHECK (organization_id = public.get_user_organization_id());
  CREATE POLICY "Users can update projects in their org" ON projects FOR UPDATE USING (organization_id = public.get_user_organization_id()) WITH CHECK (organization_id = public.get_user_organization_id());
  CREATE POLICY "Users can delete projects in their org" ON projects FOR DELETE USING (organization_id = public.get_user_organization_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Tasks RLS
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Users can view tasks in their org" ON tasks FOR SELECT USING (organization_id = public.get_user_organization_id());
  CREATE POLICY "Users can insert tasks in their org" ON tasks FOR INSERT WITH CHECK (organization_id = public.get_user_organization_id());
  CREATE POLICY "Users can update tasks in their org" ON tasks FOR UPDATE USING (organization_id = public.get_user_organization_id());
  CREATE POLICY "Users can delete tasks in their org" ON tasks FOR DELETE USING (organization_id = public.get_user_organization_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Milestones RLS
ALTER TABLE milestones ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Users can view milestones in their org" ON milestones FOR SELECT USING (organization_id = public.get_user_organization_id());
  CREATE POLICY "Users can insert milestones in their org" ON milestones FOR INSERT WITH CHECK (organization_id = public.get_user_organization_id());
  CREATE POLICY "Users can update milestones in their org" ON milestones FOR UPDATE USING (organization_id = public.get_user_organization_id());
  CREATE POLICY "Users can delete milestones in their org" ON milestones FOR DELETE USING (organization_id = public.get_user_organization_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Project Members RLS
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

-- SECURITY DEFINER helper: look up an invitation by token (used during signup, before login)
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

ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;

-- Authenticated users: view invites in their org
DROP POLICY IF EXISTS "Users can view invites in their org" ON invitations;
CREATE POLICY "Users can view invites in their org" ON invitations
  FOR SELECT USING (organization_id = public.get_user_organization_id());

-- Authenticated users: create invites in their org
DROP POLICY IF EXISTS "Users can create invites in their org" ON invitations;
CREATE POLICY "Users can create invites in their org" ON invitations
  FOR INSERT WITH CHECK (organization_id = public.get_user_organization_id());

-- Authenticated users: update (cancel) invites they created
DROP POLICY IF EXISTS "Users can update invites they created" ON invitations;
CREATE POLICY "Users can update invites they created" ON invitations
  FOR UPDATE USING (invited_by = auth.uid()) WITH CHECK (invited_by = auth.uid());

-- =============================================
-- Channel tables (needed by handle_new_user trigger below).
-- If chat_schema.sql has already run, these are no-ops.
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

-- =============================================
-- Auto-Create Organization & Profile on Signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  org_id UUID;
  org_name TEXT;
  channel_id UUID;
  invite_token TEXT;
  invite_record RECORD;
BEGIN
  -- Check if user came through an invite
  invite_token := NEW.raw_user_meta_data ->> 'invite_token';

  IF invite_token IS NOT NULL THEN
    -- Look up the pending invitation
    SELECT * INTO invite_record FROM public.invitations
    WHERE token = invite_token
    AND email = NEW.email
    AND status = 'pending'
    AND expires_at > now();

    IF FOUND THEN
      org_id := invite_record.organization_id;
      -- Mark invitation as accepted
      UPDATE public.invitations SET status = 'accepted' WHERE id = invite_record.id;
    ELSE
      -- Invalid or expired token — fall back to creating a new org
      org_name := split_part(NEW.email, '@', 2);
      INSERT INTO public.organizations (name, domain)
      VALUES (org_name, NEW.email)
      RETURNING id INTO org_id;
    END IF;
  ELSE
    -- No invite, create a new org (existing behavior)
    org_name := COALESCE(
      NEW.raw_user_meta_data ->> 'organization_name',
      split_part(NEW.email, '@', 2),
      'My Organization'
    );

    INSERT INTO public.organizations (name, domain)
    VALUES (org_name, NEW.email)
    RETURNING id INTO org_id;
  END IF;

  -- Create profile with the resolved organization
  INSERT INTO public.profiles (id, organization_id, email, role)
  VALUES (NEW.id, org_id, NEW.email, CASE WHEN invite_token IS NOT NULL THEN 'employee' ELSE 'admin' END);

  -- Create #general channel for the org (if it doesn't exist yet)
  INSERT INTO public.channels (organization_id, name, description, created_by)
  VALUES (org_id, 'general', 'General discussion', NEW.id)
  ON CONFLICT (organization_id, name) DO NOTHING
  RETURNING id INTO channel_id;

  -- Add the creator as a member of #general
  -- If the channel already existed, fetch its id
  IF channel_id IS NULL THEN
    SELECT id INTO channel_id FROM public.channels
    WHERE organization_id = org_id AND name = 'general';
  END IF;

  -- Add user as member of #general (safe if already a member)
  INSERT INTO public.channel_members (channel_id, user_id, organization_id, role)
  VALUES (channel_id, NEW.id, org_id, 'member')
  ON CONFLICT (channel_id, user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- Trigger the function on every new user creation
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'on_auth_user_created') THEN
    CREATE TRIGGER on_auth_user_created
      AFTER INSERT ON auth.users
      FOR EACH ROW
      EXECUTE FUNCTION public.handle_new_user();
  END IF;
END $$;
