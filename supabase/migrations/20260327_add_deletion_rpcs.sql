-- 1. RPC to delete a conversation and all its associated data
CREATE OR REPLACE FUNCTION public.delete_conversation_v1(p_conversation_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Verify the caller is a participant or an admin
  IF NOT EXISTS (
    SELECT 1 FROM public.conversation_participants 
    WHERE conversation_id = p_conversation_id AND profile_id = auth.uid()
  ) AND NOT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Unauthorized: You are not a participant in this conversation.';
  END IF;

  -- Delete participants first (foreign key constraints)
  DELETE FROM public.conversation_participants WHERE conversation_id = p_conversation_id;
  
  -- Delete messages
  DELETE FROM public.messages WHERE conversation_id = p_conversation_id;
  
  -- Delete meetings associated with this conversation
  DELETE FROM public.meetings WHERE conversation_id = p_conversation_id;
  
  -- Delete the conversation itself
  DELETE FROM public.conversations WHERE id = p_conversation_id;
  
  RETURN TRUE;
END;
$$;

-- 2. RPC to delete a single message
CREATE OR REPLACE FUNCTION public.delete_message_v1(p_message_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_sender_id UUID;
BEGIN
  -- Get the sender of the message
  SELECT sender_id INTO v_sender_id FROM public.messages WHERE id = p_message_id;
  
  -- Verify the caller is the sender or an admin
  IF v_sender_id != auth.uid() AND NOT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Unauthorized: You can only delete your own messages.';
  END IF;

  -- Delete the message
  DELETE FROM public.messages WHERE id = p_message_id;
  
  RETURN TRUE;
END;
$$;
