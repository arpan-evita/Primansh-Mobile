-- 1. Enable Realtime for Messaging Tables
-- Ensure the publication exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        CREATE PUBLICATION supabase_realtime;
    END IF;
END $$;

-- Safer way to add tables: SET TABLE replaces the entire list
-- This ensures these 3 tables are in the publication and doesn't care if they were already there
ALTER PUBLICATION supabase_realtime SET TABLE 
    public.messages, 
    public.conversations, 
    public.conversation_participants;

-- Set replica identity to FULL so we get complete row data on all events
ALTER TABLE public.messages REPLICA IDENTITY FULL;
ALTER TABLE public.conversations REPLICA IDENTITY FULL;

-- 2. Fix/Re-create Deletion RPCs (SECURITY DEFINER to bypass RLS)
CREATE OR REPLACE FUNCTION public.delete_message_v1(p_message_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_sender_id UUID;
BEGIN
  -- Get the sender
  SELECT sender_id INTO v_sender_id FROM public.messages WHERE id = p_message_id;
  
  -- Verify ownership or admin role
  IF v_sender_id != auth.uid() AND NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Unauthorized: You can only delete your own messages.';
  END IF;

  DELETE FROM public.messages WHERE id = p_message_id;
  RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_conversation_v1(p_conversation_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Verify participation or admin role
  IF NOT EXISTS (
    SELECT 1 FROM public.conversation_participants 
    WHERE conversation_id = p_conversation_id AND profile_id = auth.uid()
  ) AND NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Unauthorized: You are not a participant in this conversation.';
  END IF;

  -- Cascade delete (Handled by FKs if ON DELETE CASCADE, but safer to be explicit here)
  DELETE FROM public.conversation_participants WHERE conversation_id = p_conversation_id;
  DELETE FROM public.messages WHERE conversation_id = p_conversation_id;
  DELETE FROM public.meetings WHERE conversation_id = p_conversation_id;
  DELETE FROM public.conversations WHERE id = p_conversation_id;
  
  RETURN TRUE;
END;
$$;

-- 3. Verify RLS for Messages (Ensuring SELECT/INSERT are open for participants)
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can see messages in their conversations" ON public.messages;
CREATE POLICY "Users can see messages in their conversations" ON public.messages
    FOR SELECT USING (
        conversation_id IN (SELECT conversation_id FROM public.conversation_participants WHERE profile_id = auth.uid()) OR
        (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
    );

DROP POLICY IF EXISTS "Users can insert messages in their conversations" ON public.messages;
CREATE POLICY "Users can insert messages in their conversations" ON public.messages
    FOR INSERT WITH CHECK (
        conversation_id IN (SELECT conversation_id FROM public.conversation_participants WHERE profile_id = auth.uid()) OR
        (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
    );
