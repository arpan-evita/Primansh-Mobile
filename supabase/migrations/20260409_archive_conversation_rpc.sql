CREATE OR REPLACE FUNCTION public.archive_conversation_v1(p_conversation_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.conversation_participants
    WHERE conversation_id = p_conversation_id
      AND profile_id = auth.uid()
  ) AND NOT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Unauthorized: You are not a participant in this conversation.';
  END IF;

  UPDATE public.conversations
  SET is_archived = true,
      updated_at = now()
  WHERE id = p_conversation_id;

  RETURN TRUE;
END;
$$;
