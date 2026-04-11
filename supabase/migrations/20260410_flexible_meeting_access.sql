-- 1. Add a more flexible RLS policy for meetings to allow access by invitation
-- This allows anyone who received a 'meeting' message for a specific meeting
-- to view that meeting's record, even if they aren't in the host conversation.
DROP POLICY IF EXISTS "Users can see meetings they are invited to via messages" ON public.meetings;

CREATE POLICY "Users can see meetings they are invited to via messages" ON public.meetings
    FOR SELECT USING (
        id IN (
            SELECT meeting_id 
            FROM public.messages 
            WHERE meeting_id IS NOT NULL 
              AND (
                -- Case A: I am the sender of the invitation
                sender_id = auth.uid() OR
                -- Case B: I am a participant in the conversation where the invitation was sent
                conversation_id IN (
                    SELECT conversation_id 
                    FROM public.conversation_participants 
                    WHERE profile_id = auth.uid()
                )
              )
        ) OR
        -- Existing participation-based access
        conversation_id IN (
            SELECT conversation_id 
            FROM public.conversation_participants 
            WHERE profile_id = auth.uid()
        ) OR
        -- Admin access
        (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
    );
