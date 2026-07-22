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
        organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
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
    FOR INSERT WITH CHECK (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can update channels in their org" ON channels;
CREATE POLICY "Users can update channels in their org" ON channels
    FOR UPDATE USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can delete channels in their org" ON channels;
CREATE POLICY "Users can delete channels in their org" ON channels
    FOR DELETE USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));

-- Channel Members RLS Policies
DROP POLICY IF EXISTS "Users can view channel members in their org" ON channel_members;
CREATE POLICY "Users can view channel members in their org" ON channel_members
    FOR SELECT USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can insert channel members in their org" ON channel_members;
CREATE POLICY "Users can insert channel members in their org" ON channel_members
    FOR INSERT WITH CHECK (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can update channel members in their org" ON channel_members;
CREATE POLICY "Users can update channel members in their org" ON channel_members
    FOR UPDATE USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can delete channel members in their org" ON channel_members;
CREATE POLICY "Users can delete channel members in their org" ON channel_members
    FOR DELETE USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));


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
        organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
        AND EXISTS (
            SELECT 1 FROM conversation_participants
            WHERE conversation_participants.conversation_id = id
            AND conversation_participants.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can insert conversations in their org" ON conversations;
CREATE POLICY "Users can insert conversations in their org" ON conversations
    FOR INSERT WITH CHECK (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can view conversation participants" ON conversation_participants;
CREATE POLICY "Users can view conversation participants" ON conversation_participants
    FOR SELECT
    USING (
        organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
        AND EXISTS (
            SELECT 1 FROM conversation_participants cp2
            WHERE cp2.conversation_id = conversation_participants.conversation_id
            AND cp2.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can insert conversation participants" ON conversation_participants;
CREATE POLICY "Users can insert conversation participants" ON conversation_participants
    FOR INSERT WITH CHECK (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));


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

-- Messages RLS Policies
DROP POLICY IF EXISTS "Users can view messages in their org or assigned projects" ON messages;
CREATE POLICY "Users can view messages in their org or assigned projects" ON messages
FOR SELECT USING (
  organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
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
  organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
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
