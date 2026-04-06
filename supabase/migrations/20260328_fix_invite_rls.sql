-- Migration: Fix Invite RLS
-- Allows conversation participants to add other people to the conversation (for meeting invites)

-- Ensure the policy exists and handles existing participants and admins
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'conversation_participants' 
        AND policyname = 'Users can add others to their conversations'
    ) THEN
        CREATE POLICY "Users can add others to their conversations" ON conversation_participants
            FOR INSERT 
            WITH CHECK (
                EXISTS (
                    SELECT 1 FROM conversation_participants 
                    WHERE conversation_id = conversation_participants.conversation_id 
                    AND profile_id = auth.uid()
                ) OR 
                (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'team')
            );
    END IF;
END $$;
