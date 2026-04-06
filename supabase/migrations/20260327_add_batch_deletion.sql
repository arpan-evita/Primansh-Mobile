-- RPC to delete multiple messages at once
CREATE OR REPLACE FUNCTION public.delete_messages_v1(p_message_ids UUID[])
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_is_admin BOOLEAN;
BEGIN
  -- Check if user is admin
  SELECT (role = 'admin') INTO v_is_admin FROM public.profiles WHERE id = v_uid;

  -- Delete messages if they belong to the user OR user is admin
  DELETE FROM public.messages
  WHERE id = ANY(p_message_ids)
  AND (sender_id = v_uid OR v_is_admin);

  RETURN TRUE;
END;
$$;
