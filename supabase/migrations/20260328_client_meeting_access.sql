-- Migration: Client Meeting Access Fix
-- This updates RLS to ensure clients can access meetings they create via the chatbot or dashboard.

-- 1. Meetings RLS Upgrade
-- Allow users to see meetings if they are the creator, or part of the linked conversation.
DROP POLICY IF EXISTS "Users can see meetings for their conversations" ON public.meetings;
CREATE POLICY "Users can see meetings they create or participate in" ON public.meetings
    FOR SELECT USING (
        creator_id = auth.uid() OR
        conversation_id IN (SELECT conversation_id FROM conversation_participants WHERE profile_id = auth.uid()) OR
        (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
    );

-- 2. Meeting Participants RLS Upgrade
DROP POLICY IF EXISTS "Users can see participants for their meetings" ON public.meeting_participants;
CREATE POLICY "Users can see participants for meetings they create or participate in" ON public.meeting_participants
    FOR SELECT USING (
        meeting_id IN (
            SELECT id FROM public.meetings 
            WHERE creator_id = auth.uid() OR 
            conversation_id IN (SELECT conversation_id FROM conversation_participants WHERE profile_id = auth.uid())
        ) OR
        (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
    );

-- 3. Meeting Messages RLS Upgrade
DROP POLICY IF EXISTS "Users can see messages for meetings they can access" ON public.meeting_messages;
CREATE POLICY "Users can see messages for meetings they create or participate in" ON public.meeting_messages
    FOR SELECT USING (
        meeting_id IN (
            SELECT id FROM public.meetings 
            WHERE creator_id = auth.uid() OR 
            conversation_id IN (SELECT conversation_id FROM conversation_participants WHERE profile_id = auth.uid())
        ) OR
        (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
    );

DROP POLICY IF EXISTS "Users can send messages to meetings they are in" ON public.meeting_messages;
CREATE POLICY "Users can send messages to meetings they can access" ON public.meeting_messages
    FOR INSERT WITH CHECK (
        auth.uid() = sender_id AND
        meeting_id IN (
            SELECT id FROM public.meetings 
            WHERE creator_id = auth.uid() OR 
            conversation_id IN (SELECT conversation_id FROM conversation_participants WHERE profile_id = auth.uid())
        )
    );
