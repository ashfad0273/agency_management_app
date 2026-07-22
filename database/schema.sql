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
-- Row-Level Security (RLS)
-- ========================

-- Organizations RLS
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Users can view their own org" ON organizations FOR SELECT USING (id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));
  CREATE POLICY "Users can update their own org" ON organizations FOR UPDATE USING (id = (SELECT organization_id FROM profiles WHERE id = auth.uid())) WITH CHECK (id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));
  CREATE POLICY "Users can delete their own org" ON organizations FOR DELETE USING (id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Profiles RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Users can view profiles in their org" ON profiles FOR SELECT USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));
  CREATE POLICY "Users can insert their own profile" ON profiles FOR INSERT WITH CHECK (id = auth.uid());
  CREATE POLICY "Users can update profiles in their org" ON profiles FOR UPDATE USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())) WITH CHECK (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));
  CREATE POLICY "Users can delete profiles in their org" ON profiles FOR DELETE USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Projects RLS
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Users can view projects in their org" ON projects FOR SELECT USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));
  CREATE POLICY "Users can insert projects in their org" ON projects FOR INSERT WITH CHECK (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));
  CREATE POLICY "Users can update projects in their org" ON projects FOR UPDATE USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())) WITH CHECK (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));
  CREATE POLICY "Users can delete projects in their org" ON projects FOR DELETE USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Tasks RLS
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Users can view tasks in their org" ON tasks FOR SELECT USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));
  CREATE POLICY "Users can insert tasks in their org" ON tasks FOR INSERT WITH CHECK (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));
  CREATE POLICY "Users can update tasks in their org" ON tasks FOR UPDATE USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));
  CREATE POLICY "Users can delete tasks in their org" ON tasks FOR DELETE USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Milestones RLS
ALTER TABLE milestones ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Users can view milestones in their org" ON milestones FOR SELECT USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));
  CREATE POLICY "Users can insert milestones in their org" ON milestones FOR INSERT WITH CHECK (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));
  CREATE POLICY "Users can update milestones in their org" ON milestones FOR UPDATE USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));
  CREATE POLICY "Users can delete milestones in their org" ON milestones FOR DELETE USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Project Members RLS
ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Users can view project members in their org" ON project_members FOR SELECT USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));
  CREATE POLICY "Users can insert project members in their org" ON project_members FOR INSERT WITH CHECK (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));
  CREATE POLICY "Users can update project members in their org" ON project_members FOR UPDATE USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())) WITH CHECK (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));
  CREATE POLICY "Users can delete project members in their org" ON project_members FOR DELETE USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =============================================
-- Auto-Create Organization & Profile on Signup
-- =============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  org_id UUID;
  org_name TEXT;
  channel_id UUID;
BEGIN
  -- Use the user's email domain as org name, or a default
  org_name := COALESCE(
    NEW.raw_user_meta_data ->> 'organization_name',
    split_part(NEW.email, '@', 2),
    'My Organization'
  );

  -- Create organization
  INSERT INTO public.organizations (name, domain)
  VALUES (org_name, NEW.email)
  RETURNING id INTO org_id;

  -- Create profile with admin role
  INSERT INTO public.profiles (id, organization_id, email, role)
  VALUES (NEW.id, org_id, NEW.email, 'admin');

  -- Create #general channel for the org
  INSERT INTO public.channels (organization_id, name, description, created_by)
  VALUES (org_id, 'general', 'General discussion', NEW.id)
  RETURNING id INTO channel_id;

  -- Add the creator as a member of #general
  INSERT INTO public.channel_members (channel_id, user_id, organization_id, role)
  VALUES (channel_id, NEW.id, org_id, 'admin');

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
