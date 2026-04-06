-- Migration: Add Participant RPC
-- A security definer function to allow users to invite others to their conversations safely.

CREATE OR REPLACE FUNCTION add_conversation_participant_v1(
    p_conversation_id UUID,
    p_profile_id UUID
) RETURNS VOID AS $$
BEGIN
    -- Check if the CURRENT user is already a participant of the conversation
    -- OR if they are an admin
    IF EXISTS (
        SELECT 1 FROM conversation_participants 
        WHERE conversation_id = p_conversation_id 
        AND profile_id = auth.uid()
    ) OR (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'team') THEN
        INSERT INTO conversation_participants (conversation_id, profile_id)
        VALUES (p_conversation_id, p_profile_id)
        ON CONFLICT (conversation_id, profile_id) DO NOTHING;
    ELSE
        RAISE EXCEPTION 'Not authorized to invite to this conversation';
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
