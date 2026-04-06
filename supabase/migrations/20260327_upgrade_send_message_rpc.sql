-- Migration: Upgrade send_message_v2 to support meeting_id
-- Drop to avoid signature mismatch
DROP FUNCTION IF EXISTS send_message_v2(UUID, TEXT, TEXT, TEXT, TEXT, INTEGER, TEXT);

CREATE OR REPLACE FUNCTION send_message_v2(
  p_conversation_id UUID,
  p_content TEXT DEFAULT NULL,
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
  v_sender_id UUID := auth.uid();
BEGIN
  IF v_sender_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Verify the sender is a participant
  IF NOT EXISTS (
    SELECT 1 FROM conversation_participants
    WHERE conversation_id = p_conversation_id AND profile_id = v_sender_id
  ) THEN
    RAISE EXCEPTION 'Not a participant of this conversation';
  END IF;

  INSERT INTO messages (
    conversation_id, 
    sender_id, 
    content,
    message_type, 
    file_url, 
    file_name, 
    file_size, 
    mime_type,
    meeting_id,
    is_read, 
    status
  )
  VALUES (
    p_conversation_id, 
    v_sender_id, 
    p_content,
    p_message_type, 
    p_file_url, 
    p_file_name, 
    p_file_size, 
    p_mime_type,
    p_meeting_id,
    false, 
    'sent'
  )
  RETURNING id INTO v_message_id;

  -- Update conversation timestamp
  UPDATE conversations SET updated_at = now() WHERE id = p_conversation_id;

  RETURN v_message_id;
END;
$$;
