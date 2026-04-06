-- 1. Create Notifications Table
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT NOT NULL, -- 'task', 'lead', 'message', 'system'
    metadata JSONB DEFAULT '{}'::jsonb,
    read BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Policies for Notifications
CREATE POLICY "Users can view their own notifications" ON notifications
    FOR SELECT USING (auth.uid() = profile_id);

CREATE POLICY "Users can update their own notifications (mark as read)" ON notifications
    FOR UPDATE USING (auth.uid() = profile_id);

-- 2. Trigger Function for Task Notifications
CREATE OR REPLACE FUNCTION notify_on_task_change()
RETURNS TRIGGER AS $$
DECLARE
    admin_name TEXT;
    member_name TEXT;
    client_profile_id UUID;
BEGIN
    -- Get Admin Name (the person performing the action)
    SELECT full_name INTO admin_name FROM profiles WHERE id = auth.uid();
    
    -- Get Member Name
    IF NEW.assigned_to IS NOT NULL THEN
        SELECT full_name INTO member_name FROM profiles WHERE id = NEW.assigned_to;
        
        -- A. Notify Assigned Member
        INSERT INTO notifications (profile_id, title, message, type, metadata)
        VALUES (
            NEW.assigned_to,
            'New Task Assigned',
            NEW.title || ' assigned by ' || COALESCE(admin_name, 'Admin'),
            'task',
            jsonb_build_object('task_id', NEW.id)
        );
        
        -- B. Notify Admins (other than the one who did it? Or just the current one as confirmation)
        -- The user said "as an admin when we add... we should receive 'task added to ...'"
        INSERT INTO notifications (profile_id, title, message, type, metadata)
        VALUES (
            auth.uid(),
            'Assignment Confirmed',
            'Task added and assigned to ' || COALESCE(member_name, 'Team Member'),
            'task',
            jsonb_build_object('task_id', NEW.id)
        );
    END IF;

    -- C. Notify Client(s) associated with this client_id
    FOR client_profile_id IN 
        SELECT id FROM profiles 
        WHERE role = 'client' AND associated_client_id = NEW.client_id
    LOOP
        INSERT INTO notifications (profile_id, title, message, type, metadata)
        VALUES (
            client_profile_id,
            'New Task for You',
            'A new strategic task has been created: ' || NEW.title,
            'task',
            jsonb_build_object('task_id', NEW.id)
        );
    END LOOP;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for Task Creation
DROP TRIGGER IF EXISTS tr_notify_task_insert ON tasks;
CREATE TRIGGER tr_notify_task_insert
AFTER INSERT ON tasks
FOR EACH ROW EXECUTE FUNCTION notify_on_task_change();

-- 3. Trigger Function for Lead Notifications
CREATE OR REPLACE FUNCTION notify_on_new_lead()
RETURNS TRIGGER AS $$
DECLARE
    admin_profile_id UUID;
BEGIN
    -- Notify all Admins
    FOR admin_profile_id IN 
        SELECT id FROM profiles WHERE role = 'admin'
    LOOP
        INSERT INTO notifications (profile_id, title, message, type, metadata)
        VALUES (
            admin_profile_id,
            'New Lead Captured',
            NEW.name || ' just submitted a request via the website.',
            'lead',
            jsonb_build_object('lead_id', NEW.id)
        );
    END LOOP;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for Lead Creation
DROP TRIGGER IF EXISTS tr_notify_lead_insert ON leads;
CREATE TRIGGER tr_notify_lead_insert
AFTER INSERT ON leads
FOR EACH ROW EXECUTE FUNCTION notify_on_new_lead();
