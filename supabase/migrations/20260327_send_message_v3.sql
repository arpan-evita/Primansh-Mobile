-- Migration: Send Message V3 with Meeting and Context Support
CREATE OR REPLACE FUNCTION public.send_message_v3(
  p_conversation_id UUID,
  p_content TEXT,
  p_message_type TEXT DEFAULT 'text',
  p_media_url TEXT DEFAULT NULL,
  p_meeting_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_message_id UUID;
  v_sender_id UUID;
BEGIN
  v_sender_id := auth.uid();
  
  -- 1. Verify participation or admin role
  IF NOT EXISTS (
    SELECT 1 FROM public.conversation_participants 
    WHERE conversation_id = p_conversation_id AND profile_id = v_sender_id
  ) AND NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = v_sender_id AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Unauthorized: You are not a participant in this conversation.';
  END IF;

  -- 2. Insert message
  INSERT INTO public.messages (
    conversation_id,
    sender_id,
    content,
    message_type,
    media_url,
    meeting_id
  ) VALUES (
    p_conversation_id,
    v_sender_id,
    p_content,
    p_message_type,
    p_media_url,
    p_meeting_id
  ) RETURNING id INTO v_message_id;

  -- 3. Update conversation last_message_at
  UPDATE public.conversations 
  SET updated_at = NOW() 
  WHERE id = p_conversation_id;

  RETURN v_message_id;
END;
$$;
