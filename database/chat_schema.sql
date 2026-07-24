-- =============================================
-- 1. CHANNELS & MEMBERS
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
    FOR SELECT
    USING (
        organization_id = public.get_user_organization_id()
        AND (
            is_private = false
            OR
            EXISTS (
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
-- 2. CONVERSATIONS (DIRECT MESSAGES)
-- =============================================
CREATE TABLE IF NOT EXISTS conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS conversation_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(conversation_id, user_id)
);

ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_participants ENABLE ROW LEVEL SECURITY;

-- Conversation RLS Policies
DROP POLICY IF EXISTS "Users can view their conversations" ON conversations;
CREATE POLICY "Users can view their conversations" ON conversations
    FOR SELECT
    USING (
        organization_id = public.get_user_organization_id()
        AND public.is_conversation_participant(id, auth.uid())
    );

DROP POLICY IF EXISTS "Users can insert conversations in their org" ON conversations;
CREATE POLICY "Users can insert conversations in their org" ON conversations
    FOR INSERT WITH CHECK (organization_id = public.get_user_organization_id());

-- SECURITY DEFINER helper to avoid infinite recursion when checking conversation participation
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

DROP POLICY IF EXISTS "Users can view conversation participants" ON conversation_participants;
CREATE POLICY "Users can view conversation participants" ON conversation_participants
    FOR SELECT
    USING (
        organization_id = public.get_user_organization_id()
        AND public.is_conversation_participant(conversation_id, auth.uid())
    );

DROP POLICY IF EXISTS "Users can insert conversation participants" ON conversation_participants;
CREATE POLICY "Users can insert conversation participants" ON conversation_participants
    FOR INSERT WITH CHECK (organization_id = public.get_user_organization_id());


-- =============================================
-- 3. MESSAGES TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    channel_id UUID REFERENCES channels(id) ON DELETE CASCADE,
    conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Ensure missing columns are added if the table already existed previously
ALTER TABLE messages ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE CASCADE;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS channel_id UUID REFERENCES channels(id) ON DELETE CASCADE;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE;

-- Ensure exactly one scope column (or all null for global messages)
ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_scope_check;
ALTER TABLE messages ADD CONSTRAINT messages_scope_check CHECK (
  (project_id IS NOT NULL AND channel_id IS NULL AND conversation_id IS NULL)
  OR (project_id IS NULL AND channel_id IS NOT NULL AND conversation_id IS NULL)
  OR (project_id IS NULL AND channel_id IS NULL AND conversation_id IS NOT NULL)
  OR (project_id IS NULL AND channel_id IS NULL AND conversation_id IS NULL)
);

-- Enable Realtime
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
    AND schemaname = 'public'
    AND tablename = 'messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE messages;
  END IF;
END $$;

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Performance Indexes for Chat Tables
CREATE INDEX IF NOT EXISTS idx_messages_organization_id ON messages(organization_id);
CREATE INDEX IF NOT EXISTS idx_messages_channel_id ON messages(channel_id);
CREATE INDEX IF NOT EXISTS idx_messages_project_id ON messages(project_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);
CREATE INDEX IF NOT EXISTS idx_channel_members_organization_id ON channel_members(organization_id);
CREATE INDEX IF NOT EXISTS idx_channel_members_channel_id ON channel_members(channel_id);
CREATE INDEX IF NOT EXISTS idx_channel_members_user_id ON channel_members(user_id);
CREATE INDEX IF NOT EXISTS idx_conversation_participants_organization_id ON conversation_participants(organization_id);
CREATE INDEX IF NOT EXISTS idx_conversation_participants_conversation_id ON conversation_participants(conversation_id);
CREATE INDEX IF NOT EXISTS idx_conversation_participants_user_id ON conversation_participants(user_id);

-- Messages RLS Policies
DROP POLICY IF EXISTS "Users can view messages in their org or assigned projects" ON messages;
CREATE POLICY "Users can view messages in their org or assigned projects" ON messages
FOR SELECT USING (
  organization_id = public.get_user_organization_id()
  AND (
    (channel_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM channel_members
      WHERE channel_members.channel_id = messages.channel_id
      AND channel_members.user_id = auth.uid()
    ))
    OR
    (project_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM project_members
      WHERE project_members.project_id = messages.project_id
      AND project_members.user_id = auth.uid()
    ))
    OR
    (conversation_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM conversation_participants
      WHERE conversation_participants.conversation_id = messages.conversation_id
      AND conversation_participants.user_id = auth.uid()
    ))
    OR
    (project_id IS NULL AND channel_id IS NULL AND conversation_id IS NULL)
  )
);

DROP POLICY IF EXISTS "Users can insert messages in their org or assigned projects" ON messages;
CREATE POLICY "Users can insert messages in their org or assigned projects" ON messages
FOR INSERT WITH CHECK (
  organization_id = public.get_user_organization_id()
  AND (
    (channel_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM channel_members
      WHERE channel_members.channel_id = messages.channel_id
      AND channel_members.user_id = auth.uid()
    ))
    OR
    (project_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM project_members
      WHERE project_members.project_id = messages.project_id
      AND project_members.user_id = auth.uid()
    ))
    OR
    (conversation_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM conversation_participants
      WHERE conversation_participants.conversation_id = messages.conversation_id
      AND conversation_participants.user_id = auth.uid()
    ))
    OR
    (project_id IS NULL AND channel_id IS NULL AND conversation_id IS NULL)
  )
);

DROP POLICY IF EXISTS "Users can update their own messages" ON messages;
CREATE POLICY "Users can update their own messages" ON messages
FOR UPDATE USING (sender_id = auth.uid()) WITH CHECK (sender_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete their own messages" ON messages;
CREATE POLICY "Users can delete their own messages" ON messages
FOR DELETE USING (sender_id = auth.uid());


-- =============================================
-- 4. MESSAGE READ RECEIPTS
-- =============================================
CREATE TABLE IF NOT EXISTS message_reads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    channel_id UUID REFERENCES channels(id) ON DELETE CASCADE,
    conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
    last_read_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE message_reads ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE CASCADE;
ALTER TABLE message_reads ADD COLUMN IF NOT EXISTS channel_id UUID REFERENCES channels(id) ON DELETE CASCADE;
ALTER TABLE message_reads ADD COLUMN IF NOT EXISTS conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS message_reads_global_unique ON message_reads(user_id) WHERE project_id IS NULL AND channel_id IS NULL AND conversation_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS message_reads_project_unique ON message_reads(user_id, project_id) WHERE project_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS message_reads_channel_unique ON message_reads(user_id, channel_id) WHERE channel_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS message_reads_conversation_unique ON message_reads(user_id, conversation_id) WHERE conversation_id IS NOT NULL;

ALTER TABLE message_reads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own read receipts" ON message_reads;
CREATE POLICY "Users can view their own read receipts" ON message_reads
FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert their own read receipts" ON message_reads;
CREATE POLICY "Users can insert their own read receipts" ON message_reads
FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update their own read receipts" ON message_reads;
CREATE POLICY "Users can update their own read receipts" ON message_reads
FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Atomic upsert function for message read receipts to avoid race conditions (409 Conflicts)
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
      (p_project_id IS NOT NULL AND project_id = p_project_id)
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
