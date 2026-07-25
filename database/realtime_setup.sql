-- ============================================================
-- REALTIME SETUP: Notifications table + Realtime publication
-- Run this in Supabase SQL Editor after the main schema.
-- ============================================================

-- =============================================
-- 1. NOTIFICATIONS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    type TEXT NOT NULL DEFAULT 'info',
    title TEXT NOT NULL,
    body TEXT,
    data JSONB DEFAULT '{}'::jsonb,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Users can SELECT their own notifications within their org
CREATE POLICY "notifications_select" ON notifications
    FOR SELECT USING (
        organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
        AND user_id = auth.uid()
    );

-- Users can UPDATE their own notifications (mark as read)
CREATE POLICY "notifications_update" ON notifications
    FOR UPDATE USING (
        organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
        AND user_id = auth.uid()
    );

-- =============================================
-- 2. ENABLE REALTIME REPLICATION
-- =============================================
ALTER PUBLICATION supabase_realtime ADD TABLE IF NOT EXISTS notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE IF NOT EXISTS tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE IF NOT EXISTS project_members;
ALTER PUBLICATION supabase_realtime ADD TABLE IF NOT EXISTS projects;

-- =============================================
-- 3. TRIGGER: Notify on new messages
-- =============================================
CREATE OR REPLACE FUNCTION public.handle_message_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
    -- Channel messages: notify other channel members
    IF NEW.channel_id IS NOT NULL THEN
        INSERT INTO public.notifications (organization_id, user_id, type, title, body, data)
        SELECT NEW.organization_id, cm.user_id, 'message',
               'New message',
               LEFT(NEW.content, 120),
               jsonb_build_object(
                   'channel_id', NEW.channel_id,
                   'message_id', NEW.id,
                   'sender_id', NEW.sender_id
               )
        FROM public.channel_members cm
        WHERE cm.channel_id = NEW.channel_id
          AND cm.user_id != NEW.sender_id;
        RETURN NEW;
    END IF;

    -- DM messages: notify other participant
    IF NEW.conversation_id IS NOT NULL THEN
        INSERT INTO public.notifications (organization_id, user_id, type, title, body, data)
        SELECT NEW.organization_id, cp.user_id, 'message',
               'New DM',
               LEFT(NEW.content, 120),
               jsonb_build_object(
                   'conversation_id', NEW.conversation_id,
                   'message_id', NEW.id,
                   'sender_id', NEW.sender_id
               )
        FROM public.conversation_participants cp
        WHERE cp.conversation_id = NEW.conversation_id
          AND cp.user_id != NEW.sender_id;
        RETURN NEW;
    END IF;

    -- Project-scoped messages: notify project members
    IF NEW.project_id IS NOT NULL AND NEW.channel_id IS NULL AND NEW.conversation_id IS NULL THEN
        INSERT INTO public.notifications (organization_id, user_id, type, title, body, data)
        SELECT NEW.organization_id, pm.user_id, 'message',
               'New message',
               LEFT(NEW.content, 120),
               jsonb_build_object(
                   'project_id', NEW.project_id,
                   'message_id', NEW.id,
                   'sender_id', NEW.sender_id
               )
        FROM public.project_members pm
        WHERE pm.project_id = NEW.project_id
          AND pm.user_id != NEW.sender_id;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_message_insert ON messages;
CREATE TRIGGER on_message_insert
    AFTER INSERT ON messages
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_message_notification();

-- =============================================
-- 4. TRIGGER: Notify on task status change
-- =============================================
CREATE OR REPLACE FUNCTION public.handle_task_update_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
    v_actor_id uuid;
BEGIN
    v_actor_id := current_setting('request.jwt.claim.sub', true)::uuid;

    IF OLD.status IS DISTINCT FROM NEW.status THEN
        INSERT INTO public.notifications (organization_id, user_id, type, title, body, data)
        SELECT NEW.organization_id, pm.user_id, 'task',
               'Task: ' || NEW.title,
               CASE
                   WHEN NEW.status = 'completed' THEN 'Marked as completed'
                   WHEN NEW.status = 'in_progress' THEN 'Started'
                   ELSE 'Status: ' || NEW.status
               END,
               jsonb_build_object(
                   'project_id', NEW.project_id,
                   'task_id', NEW.id,
                   'old_status', OLD.status,
                   'new_status', NEW.status
               )
        FROM public.project_members pm
        WHERE pm.project_id = NEW.project_id
          AND (v_actor_id IS NULL OR pm.user_id != v_actor_id);
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_task_update ON tasks;
CREATE TRIGGER on_task_update
    AFTER UPDATE ON tasks
    FOR EACH ROW
    WHEN (OLD.status IS DISTINCT FROM NEW.status)
    EXECUTE FUNCTION public.handle_task_update_notification();

-- =============================================
-- 5. TRIGGER: Notify on new project member
-- =============================================
CREATE OR REPLACE FUNCTION public.handle_project_member_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
    v_project_name text;
    v_actor_id uuid;
BEGIN
    v_actor_id := current_setting('request.jwt.claim.sub', true)::uuid;

    SELECT name INTO v_project_name FROM public.projects WHERE id = NEW.project_id;

    INSERT INTO public.notifications (organization_id, user_id, type, title, body, data)
    SELECT NEW.organization_id, pm.user_id, 'project',
           'New team member',
           'Someone joined ' || COALESCE(v_project_name, 'a project'),
           jsonb_build_object(
               'project_id', NEW.project_id,
               'new_member_id', NEW.user_id
           )
    FROM public.project_members pm
    WHERE pm.project_id = NEW.project_id
      AND pm.user_id != v_actor_id;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_project_member_insert ON project_members;
CREATE TRIGGER on_project_member_insert
    AFTER INSERT ON project_members
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_project_member_notification();
