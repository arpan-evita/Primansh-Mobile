-- 1. Ensure columns exist in profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ DEFAULT NOW();

-- 2. Ensure columns exist in conversations table
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS context_type TEXT;
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS context_id UUID;
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT false;

-- 3. Create or replace the presence update function
CREATE OR REPLACE FUNCTION public.update_last_seen(p_user_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE public.profiles
    SET last_seen_at = NOW()
    WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Unified RPC for creating or finding conversations with context and participants
CREATE OR REPLACE FUNCTION public.upsert_conversation_v1(
    p_participant_ids UUID[],
    p_title TEXT DEFAULT NULL,
    p_client_id UUID DEFAULT NULL,
    p_context_type TEXT DEFAULT NULL,
    p_context_id UUID DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    v_conversation_id UUID;
BEGIN
    -- Try to find existing conversation with the same participants and context
    IF p_context_id IS NOT NULL THEN
        SELECT c.id INTO v_conversation_id
        FROM conversations c
        JOIN conversation_participants cp ON c.id = cp.conversation_id
        WHERE c.context_id = p_context_id 
          AND c.context_type = p_context_type
        GROUP BY c.id
        HAVING array_agg(cp.profile_id ORDER BY cp.profile_id) = (SELECT array_agg(pid ORDER BY pid) FROM (SELECT DISTINCT unnest(p_participant_ids) pid) sub);
    END IF;

    -- If no context-specific match, try to find a general 1:1 or small group with these participants
    IF v_conversation_id IS NULL THEN
        SELECT c.id INTO v_conversation_id
        FROM conversations c
        JOIN conversation_participants cp ON c.id = cp.conversation_id
        WHERE c.context_id IS NULL -- Only general conversations
        GROUP BY c.id
        HAVING array_agg(cp.profile_id ORDER BY cp.profile_id) = (SELECT array_agg(pid ORDER BY pid) FROM (SELECT DISTINCT unnest(p_participant_ids) pid) sub);
    END IF;

    -- If still null, create a new one
    IF v_conversation_id IS NULL THEN
        INSERT INTO conversations (title, client_id, context_type, context_id)
        VALUES (p_title, p_client_id, p_context_type, p_context_id)
        RETURNING id INTO v_conversation_id;

        -- Add participants
        INSERT INTO conversation_participants (conversation_id, profile_id)
        SELECT v_conversation_id, pid FROM (SELECT DISTINCT unnest(p_participant_ids) pid) sub;
    ELSE
        -- Update the conversation (mark as unarchived if it was archived)
        UPDATE conversations SET is_archived = false, updated_at = now() WHERE id = v_conversation_id;
    END IF;

    RETURN v_conversation_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. RPC to find a common 1:1 conversation between two users
CREATE OR REPLACE FUNCTION public.find_common_conversation(p_user1 UUID, p_user2 UUID)
RETURNS UUID AS $$
    SELECT cp1.conversation_id
    FROM conversation_participants cp1
    JOIN conversation_participants cp2 ON cp1.conversation_id = cp2.conversation_id
    JOIN conversations c ON cp1.conversation_id = c.id
    WHERE cp1.profile_id = p_user1 
      AND cp2.profile_id = p_user2
      AND c.context_id IS NULL -- Only general chats
    LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER;
