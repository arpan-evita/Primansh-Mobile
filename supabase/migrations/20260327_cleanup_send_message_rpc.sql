-- 1. Drop the old 7-argument version (if it exists)
-- Parameters: conversation_id, content, message_type, file_url, file_name, file_size, mime_type
DROP FUNCTION IF EXISTS public.send_message_v2(UUID, TEXT, TEXT, TEXT, TEXT, INTEGER, TEXT);

-- 2. Drop the newer 8-argument version (to recreate it cleanly)
-- Parameters: conversation_id, content, message_type, file_url, file_name, file_size, mime_type, meeting_id
DROP FUNCTION IF EXISTS public.send_message_v2(UUID, TEXT, TEXT, TEXT, TEXT, INTEGER, TEXT, UUID);

-- 3. Recreate the definitive 8-argument version
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
