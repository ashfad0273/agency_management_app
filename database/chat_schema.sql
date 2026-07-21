-- Messages Table
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE, -- Nullable for Global chat
    sender_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE messages;

-- Enable RLS
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view messages in their org
CREATE POLICY "Users can view messages in their org" ON messages
FOR SELECT USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));

-- Policy: Users can insert messages in their org
CREATE POLICY "Users can insert messages in their org" ON messages
FOR INSERT WITH CHECK (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));

-- Policy: Users can update their own messages
CREATE POLICY "Users can update their own messages" ON messages
FOR UPDATE
USING (sender_id = auth.uid())
WITH CHECK (sender_id = auth.uid());

-- Policy: Users can delete their own messages
CREATE POLICY "Users can delete their own messages" ON messages
FOR DELETE
USING (sender_id = auth.uid());