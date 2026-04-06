-- 1. Add missing columns to the messages table
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS message_type TEXT DEFAULT 'text';
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'sent';
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS file_url TEXT;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS file_name TEXT;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS file_size INTEGER;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS mime_type TEXT;

-- 2. Ensure constraints for message_type and status
DO $$
BEGIN
    -- message_type check
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'messages_message_type_check') THEN
        ALTER TABLE messages ADD CONSTRAINT messages_message_type_check 
            CHECK (message_type IN ('text', 'image', 'audio', 'file', 'meeting'));
    END IF;

    -- status check
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'messages_status_check') THEN
        ALTER TABLE messages ADD CONSTRAINT messages_status_check 
            CHECK (status IN ('sent', 'delivered', 'read'));
    END IF;
END $$;

-- 3. Recreate the definitive 8-argument version to ensure it uses the new columns
CREATE OR REPLACE FUNCTION public.send_message_v2(
  p_conversation_id UUID,
  p_content TEXT,
  p_message_type TEXT DEFAULT 'text',
  p_file_url TEXT DEFAULT NULL,
  p_file_name TEXT DEFAULT NULL,
  p_file_size INTEGER DEFAULT NULL,
  p_mime_type TEXT DEFAULT NULL,
  p_meeting_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_message_id UUID;
BEGIN
  -- Insert the message
  INSERT INTO public.messages (
    conversation_id,
    sender_id,
    content,
    message_type,
    file_url,
    file_name,
    file_size,
    mime_type,
    meeting_id,
    status
  )
  VALUES (
    p_conversation_id,
    auth.uid(),
    p_content,
    p_message_type,
    p_file_url,
    p_file_name,
    p_file_size,
    p_mime_type,
    p_meeting_id,
    'sent'
  )
  RETURNING id INTO v_message_id;

  -- Update conversation last message timestamp
  UPDATE public.conversations
  SET updated_at = NOW()
  WHERE id = p_conversation_id;

  RETURN v_message_id;
END;
$$;
