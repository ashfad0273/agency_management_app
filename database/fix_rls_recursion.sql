-- ============================================================
-- Clean Non-Recursive Supabase RLS Policies for Chat System
-- Run this entire file in Supabase SQL Editor.
-- ============================================================

-- 1. Reset messages policies to pure org-based scope (no subqueries)
DROP POLICY IF EXISTS "messages_select" ON messages;
DROP POLICY IF EXISTS "messages_insert" ON messages;
DROP POLICY IF EXISTS "messages_update" ON messages;
DROP POLICY IF EXISTS "messages_delete" ON messages;
DROP POLICY IF EXISTS "msg_select" ON messages;
DROP POLICY IF EXISTS "msg_insert" ON messages;
DROP POLICY IF EXISTS "Users can view messages in their org or assigned projects" ON messages;
DROP POLICY IF EXISTS "Users can insert messages in their org or assigned projects" ON messages;
DROP POLICY IF EXISTS "Users can update their own messages" ON messages;
DROP POLICY IF EXISTS "Users can delete their own messages" ON messages;

CREATE POLICY "messages_select" ON messages
FOR SELECT USING (
  organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid() LIMIT 1)
);

CREATE POLICY "messages_insert" ON messages
FOR INSERT WITH CHECK (
  organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid() LIMIT 1)
);

CREATE POLICY "messages_update" ON messages
FOR UPDATE USING (sender_id = auth.uid()) WITH CHECK (sender_id = auth.uid());

CREATE POLICY "messages_delete" ON messages
FOR DELETE USING (sender_id = auth.uid());


-- 2. Reset project_members policies (non-recursive)
DROP POLICY IF EXISTS "project_members_select" ON project_members;
DROP POLICY IF EXISTS "project_members_insert" ON project_members;
DROP POLICY IF EXISTS "project_members_update" ON project_members;
DROP POLICY IF EXISTS "project_members_delete" ON project_members;
DROP POLICY IF EXISTS "pm_select" ON project_members;
DROP POLICY IF EXISTS "pm_insert" ON project_members;
DROP POLICY IF EXISTS "pm_update" ON project_members;
DROP POLICY IF EXISTS "pm_delete" ON project_members;
DROP POLICY IF EXISTS "Users can view project members in their org" ON project_members;
DROP POLICY IF EXISTS "Users can insert project members in their org" ON project_members;
DROP POLICY IF EXISTS "Users can update project members in their org" ON project_members;
DROP POLICY IF EXISTS "Users can delete project members in their org" ON project_members;

CREATE POLICY "project_members_select" ON project_members
FOR SELECT USING (
  user_id = auth.uid()
  OR
  project_id IN (
    SELECT id FROM projects
    WHERE organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid() LIMIT 1)
  )
);

CREATE POLICY "project_members_insert" ON project_members
FOR INSERT WITH CHECK (true);


-- 3. Fix channel_members policies — OLD policies self-referenced channel_members causing recursion
DROP POLICY IF EXISTS "cm_select" ON channel_members;
DROP POLICY IF EXISTS "cm_insert" ON channel_members;
DROP POLICY IF EXISTS "cm_update" ON channel_members;
DROP POLICY IF EXISTS "cm_delete" ON channel_members;
DROP POLICY IF EXISTS "channel_members_select" ON channel_members;
DROP POLICY IF EXISTS "channel_members_insert" ON channel_members;
DROP POLICY IF EXISTS "channel_members_update" ON channel_members;
DROP POLICY IF EXISTS "channel_members_delete" ON channel_members;
DROP POLICY IF EXISTS "Users can view channel members in their org" ON channel_members;
DROP POLICY IF EXISTS "Users can insert channel members in their org" ON channel_members;
DROP POLICY IF EXISTS "Users can update channel members in their org" ON channel_members;
DROP POLICY IF EXISTS "Users can delete channel members in their org" ON channel_members;

CREATE POLICY "cm_select" ON channel_members FOR SELECT USING (
    user_id = auth.uid()
    OR organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid() LIMIT 1)
);

CREATE POLICY "cm_insert" ON channel_members FOR INSERT WITH CHECK (
    organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid() LIMIT 1)
);

CREATE POLICY "cm_update" ON channel_members FOR UPDATE USING (
    organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid() LIMIT 1)
);

CREATE POLICY "cm_delete" ON channel_members FOR DELETE USING (
    organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid() LIMIT 1)
);


-- 4. Fix channels policies — OLD ch_select referenced channel_members, causing recursion
DROP POLICY IF EXISTS "ch_select" ON channels;
DROP POLICY IF EXISTS "ch_insert" ON channels;
DROP POLICY IF EXISTS "ch_update" ON channels;
DROP POLICY IF EXISTS "ch_delete" ON channels;
DROP POLICY IF EXISTS "channels_select" ON channels;
DROP POLICY IF EXISTS "channels_insert" ON channels;
DROP POLICY IF EXISTS "channels_update" ON channels;
DROP POLICY IF EXISTS "channels_delete" ON channels;
DROP POLICY IF EXISTS "Users can view channels in their org" ON channels;
DROP POLICY IF EXISTS "Users can insert channels in their org" ON channels;
DROP POLICY IF EXISTS "Users can update channels in their org" ON channels;
DROP POLICY IF EXISTS "Users can delete channels in their org" ON channels;

CREATE POLICY "ch_select" ON channels FOR SELECT USING (
    organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid() LIMIT 1)
);

CREATE POLICY "ch_insert" ON channels FOR INSERT WITH CHECK (
    organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid() LIMIT 1)
);

CREATE POLICY "ch_update" ON channels FOR UPDATE USING (
    organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid() LIMIT 1)
);

CREATE POLICY "ch_delete" ON channels FOR DELETE USING (
    organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid() LIMIT 1)
);


-- 5. Fix conversations SELECT policy — was failing for createOrGetConversation
-- because is_conversation_participant() returned false before participants were added.
DROP POLICY IF EXISTS "conv_select" ON conversations;
DROP POLICY IF EXISTS "conv_insert" ON conversations;
DROP POLICY IF EXISTS "Users can view their conversations" ON conversations;
DROP POLICY IF EXISTS "Users can insert conversations in their org" ON conversations;

CREATE POLICY "conv_select" ON conversations FOR SELECT USING (
    organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid() LIMIT 1)
);

CREATE POLICY "conv_insert" ON conversations FOR INSERT WITH CHECK (
    organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid() LIMIT 1)
);
