-- Migration: Enhanced Task Notification System V2
-- Handles multi-recipient notifications for assignments and status changes
-- Ensures base notification infrastructure exists

-- 0. Ensure Notifications Table Exists
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT NOT NULL, -- 'task', 'lead', 'message', 'system'
    metadata JSONB DEFAULT '{}'::jsonb,
    read BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Ensure RLS on notifications (if just created)
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view their own notifications') THEN
        CREATE POLICY "Users can view their own notifications" ON public.notifications
            FOR SELECT USING (auth.uid() = profile_id);
    END IF;
END $$;

-- 1. Helper: Canonical Role Normalization
CREATE OR REPLACE FUNCTION public.normalize_agency_role(p_role TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  normalized TEXT;
BEGIN
  normalized := lower(regexp_replace(coalesce(p_role, 'client'), '[\s_-]+', '', 'g'));

  IF normalized LIKE '%admin%' OR normalized LIKE '%manager%' OR normalized LIKE '%owner%' OR normalized LIKE '%agency%' THEN
    RETURN 'admin';
  ELSIF normalized LIKE '%seo%' THEN
    RETURN 'seo';
  ELSIF normalized LIKE '%content%' THEN
    RETURN 'content';
  ELSIF normalized LIKE '%dev%' THEN
    RETURN 'developer';
  ELSIF normalized LIKE '%team%' OR normalized LIKE '%staff%' THEN
    RETURN 'team';
  ELSIF normalized LIKE '%pending%' THEN
    RETURN 'pending';
  END IF;

  RETURN 'client';
END;
$$;

-- 2. Helper to get recipients for a task status change
CREATE OR REPLACE FUNCTION get_task_notification_recipients(
    p_task_id UUID,
    p_actor_id UUID,
    p_event_type TEXT -- 'assignment' or 'status_change'
)
RETURNS TABLE (profile_id UUID, role TEXT) AS $$
DECLARE
    v_task_record RECORD;
    v_actor_role TEXT;
BEGIN
    -- Get task info
    SELECT t.assigned_to_user_id, t.created_by, t.client_id
    INTO v_task_record
    FROM tasks t
    WHERE t.id = p_task_id;

    -- Get actor role
    SELECT public.normalize_agency_role(p.role) INTO v_actor_role FROM profiles p WHERE id = p_actor_id;

    -- A. ALWAYS NOTIFY ADMINS (except the actor)
    RETURN QUERY 
    SELECT p.id, 'admin'::TEXT
    FROM profiles p 
    WHERE public.normalize_agency_role(p.role) = 'admin' 
      AND p.id != p_actor_id;

    -- B. NOTIFY TEAM MEMBER (if assigned and not the actor)
    IF v_task_record.assigned_to_user_id IS NOT NULL AND v_task_record.assigned_to_user_id != p_actor_id THEN
        RETURN QUERY SELECT v_task_record.assigned_to_user_id, 'team'::TEXT;
    END IF;

    -- C. NOTIFY CLIENTS (associated with this client_id and not the actor)
    IF v_task_record.client_id IS NOT NULL THEN
        RETURN QUERY 
        SELECT p.id, 'client'::TEXT
        FROM profiles p 
        WHERE public.normalize_agency_role(p.role) = 'client' 
          AND p.associated_client_id = v_task_record.client_id
          AND p.id != p_actor_id;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Consolidated Trigger Function for Task Events
CREATE OR REPLACE FUNCTION handle_task_notification_event()
RETURNS TRIGGER AS $$
DECLARE
    r RECORD;
    v_actor_name TEXT;
    v_title TEXT := 'Task Notification';
    v_body TEXT := 'A task was updated';
    v_recipient_ids UUID[] := '{}';
BEGIN
    -- Get actor name
    SELECT COALESCE(full_name, 'Someone') INTO v_actor_name FROM profiles WHERE id = auth.uid();

    -- CASE 1: NEW ASSIGNMENT (INSERT OR ASSIGNEE UPDATE)
    IF (TG_OP = 'INSERT' AND NEW.assigned_to_user_id IS NOT NULL) OR 
       (TG_OP = 'UPDATE' AND NEW.assigned_to_user_id IS DISTINCT FROM OLD.assigned_to_user_id) THEN
        
        v_title := 'New Task Assignment';
        v_body := COALESCE(NEW.title, 'A task') || ' has been assigned to ' || COALESCE(NEW.assigned_to, 'a team member');
        
        -- Collect recipients for assignment
        SELECT array_agg(profile_id) INTO v_recipient_ids 
        FROM get_task_notification_recipients(NEW.id, auth.uid(), 'assignment');

    -- CASE 2: STATUS CHANGE
    ELSIF (TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status) THEN
        
        v_title := 'Task Status Updated';
        v_body := COALESCE(v_actor_name, 'Someone') || ' updated "' || COALESCE(NEW.title, 'task') || '" to ' || 
                  CASE 
                    WHEN NEW.status = 'in_progress' THEN 'In Progress'
                    WHEN NEW.status = 'done' THEN 'Completed'
                    ELSE 'Todo'
                  END;

        -- Collect recipients for status change
        SELECT array_agg(profile_id) INTO v_recipient_ids 
        FROM get_task_notification_recipients(NEW.id, auth.uid(), 'status_change');
    END IF;

    -- INSERT NOTIFICATIONS AND TRIGGER PUSH
    IF v_recipient_ids IS NOT NULL AND array_length(v_recipient_ids, 1) > 0 THEN
        -- Link In-app Notifications
        INSERT INTO public.notifications (profile_id, title, message, type, metadata)
        SELECT 
            pid, 
            v_title, 
            COALESCE(v_body, 'Task was updated'), 
            'task', 
            jsonb_build_object('task_id', NEW.id, 'status', NEW.status)
        FROM unnest(v_recipient_ids) AS pid;

        -- Trigger Push Notification (via existing helper if it exists)
        BEGIN
            PERFORM notify_recipients(
                v_recipient_ids,
                'Primansh: ' || v_title,
                COALESCE(v_body, 'Task was updated'),
                jsonb_build_object('url', '/tasks', 'task_id', NEW.id)
            );
        EXCEPTION WHEN OTHERS THEN
            -- Fallback if push helper fails or doesn't exist
            NULL;
        END;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Cleanup old triggers and apply the new consolidated one
DROP TRIGGER IF EXISTS tr_notify_task_insert ON tasks;
DROP TRIGGER IF EXISTS tr_on_task_assigned_notify ON tasks;
DROP TRIGGER IF EXISTS tr_task_lifecycle_notifications ON tasks;

CREATE TRIGGER tr_task_lifecycle_notifications
AFTER INSERT OR UPDATE ON tasks
FOR EACH ROW
EXECUTE FUNCTION handle_task_notification_event();
