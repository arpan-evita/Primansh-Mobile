-- Migration: Notification Triggers
-- Sets up database triggers to call the send-push Edge Function

-- 1. Helper Function to Call Edge Function
CREATE OR REPLACE FUNCTION notify_recipients(
  profile_ids UUID[],
  title TEXT,
  body TEXT,
  data JSONB DEFAULT '{}'::JSONB
)
RETURNS VOID AS $$
DECLARE
  payload JSONB;
  request_id TEXT;
  edge_function_url TEXT := 'https://' || (SELECT current_setting('request.header.host', true)) || '/functions/v1/send-push';
  anon_key TEXT := (SELECT current_setting('request.header.apikey', true));
BEGIN
  payload := jsonb_build_object(
    'profile_ids', profile_ids,
    'title', title,
    'body', body,
    'data', data
  );

  -- Use pg_net to call the edge function asynchronously
  -- Note: Ensure pg_net is enabled in your Supabase instance
  PERFORM net.http_post(
    url := edge_function_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || anon_key
    ),
    body := payload
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Trigger for New Messages
CREATE OR REPLACE FUNCTION on_new_message_notify()
RETURNS TRIGGER AS $$
DECLARE
  recipient_ids UUID[];
  sender_name TEXT;
  conv_title TEXT;
BEGIN
  -- Get sender name
  SELECT full_name INTO sender_name FROM profiles WHERE id = NEW.sender_id;
  
  -- Get conversation title or first participant's name
  SELECT COALESCE(title, 'New Message') INTO conv_title FROM conversations WHERE id = NEW.conversation_id;

  -- Find all participants except sender
  SELECT array_agg(profile_id) INTO recipient_ids
  FROM conversation_participants
  WHERE conversation_id = NEW.conversation_id AND profile_id != NEW.sender_id;

  IF recipient_ids IS NOT NULL AND array_length(recipient_ids, 1) > 0 THEN
    PERFORM notify_recipients(
      recipient_ids,
      'Primansh Hub: ' || conv_title,
      sender_name || ': ' || LEFT(NEW.content, 50) || (CASE WHEN length(NEW.content) > 50 THEN '...' ELSE '' END),
      jsonb_build_object('url', '/messages', 'conversation_id', NEW.conversation_id)
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER tr_on_new_message_notify
  AFTER INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION on_new_message_notify();

-- 3. Trigger for Assigned Tasks
CREATE OR REPLACE FUNCTION on_task_assigned_notify()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.assigned_to IS NOT NULL AND (TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND OLD.assigned_to IS DISTINCT FROM NEW.assigned_to)) THEN
    PERFORM notify_recipients(
      ARRAY[NEW.assigned_to],
      'Primansh Workflow: New Task',
      'You have been assigned: ' || NEW.title,
      jsonb_build_object('url', '/tasks', 'task_id', NEW.id)
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER tr_on_task_assigned_notify
  AFTER INSERT OR UPDATE ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION on_task_assigned_notify();
