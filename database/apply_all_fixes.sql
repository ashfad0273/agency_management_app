-- ============================================================
-- APPLY ALL FIXES - Run this entire file in Supabase SQL Editor
--
-- ORDER: Run schema.sql → chat_schema.sql → rbac_schema.sql (optional)
--        → apply_all_fixes.sql
--
-- This file is safe to run at any point and will not overwrite
-- existing role definitions. It conditionally seeds default roles
-- only if the RBAC extension has been applied.
-- ============================================================

-- ============================================
-- FIX 1: Invitations table, helper, RLS
-- ============================================

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

-- Helper to look up invitation by token (SECURITY DEFINER = bypasses RLS)
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

DROP POLICY IF EXISTS "Users can view invites in their org" ON invitations;
CREATE POLICY "Users can view invites in their org" ON invitations
  FOR SELECT USING (organization_id = public.get_user_organization_id());

DROP POLICY IF EXISTS "Users can create invites in their org" ON invitations;
CREATE POLICY "Users can create invites in their org" ON invitations
  FOR INSERT WITH CHECK (organization_id = public.get_user_organization_id());

DROP POLICY IF EXISTS "Users can update invites they created" ON invitations;
CREATE POLICY "Users can update invites they created" ON invitations
  FOR UPDATE USING (invited_by = auth.uid()) WITH CHECK (invited_by = auth.uid());

-- ============================================
-- FIX 5: Add status and deadline to projects
-- ============================================
ALTER TABLE projects ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS deadline DATE;


-- ============================================
-- FIX 2: Updated handle_new_user trigger
-- Supports invite tokens so invited users join the correct org
-- ============================================

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
      IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'seed_default_roles') THEN
        PERFORM public.seed_default_roles(v_org_id);
      END IF;
    END IF;
  ELSE
    v_org_name := COALESCE(
      NEW.raw_user_meta_data ->> 'organization_name',
      split_part(NEW.email, '@', 2),
      'My Organization'
    );

    INSERT INTO public.organizations (name, domain)
    VALUES (v_org_name, NEW.email)
    RETURNING id INTO v_org_id;

    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'seed_default_roles') THEN
      PERFORM public.seed_default_roles(v_org_id);
    END IF;
  END IF;

  INSERT INTO public.profiles (id, organization_id, email, role)
  VALUES (NEW.id, v_org_id, NEW.email, CASE WHEN v_invite_token IS NOT NULL THEN 'employee' ELSE 'admin' END);

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


-- ============================================
-- FIX 3: Fix infinite recursion in conversation_participants RLS
-- ============================================

CREATE OR REPLACE FUNCTION public.is_conversation_participant(conv_id UUID, uid UUID)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM conversation_participants
    WHERE conversation_id = conv_id
    AND user_id = uid
  )
$$;

DROP POLICY IF EXISTS "Users can view their conversations" ON conversations;
CREATE POLICY "Users can view their conversations" ON conversations
    FOR SELECT
    USING (
        organization_id = public.get_user_organization_id()
        AND public.is_conversation_participant(id, auth.uid())
    );

DROP POLICY IF EXISTS "Users can view conversation participants" ON conversation_participants;
CREATE POLICY "Users can view conversation participants" ON conversation_participants
    FOR SELECT
    USING (
        organization_id = public.get_user_organization_id()
        AND public.is_conversation_participant(conversation_id, auth.uid())
    );


-- ============================================
-- FIX 4: Upsert function for message_reads (fixes 409 Conflict)
-- ============================================

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
  -- Ensure users can only upsert their own read receipts
  IF p_user_id != auth.uid() THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;

  LOOP
    -- First try to update the existing row
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

    IF FOUND THEN
      RETURN;
    END IF;

    -- No existing row, try to insert
    BEGIN
      INSERT INTO message_reads (user_id, organization_id, project_id, channel_id, conversation_id, last_read_at)
      VALUES (p_user_id, p_organization_id, p_project_id, p_channel_id, p_conversation_id, now());
      RETURN;
    EXCEPTION WHEN unique_violation THEN
      -- Race condition: another session inserted concurrently; loop back to UPDATE
    END;
  END LOOP;
END;
$$;