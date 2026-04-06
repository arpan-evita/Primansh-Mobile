-- Migration: Meeting-Specific Chat Isolation
-- This table stores messages that belong only to a specific meeting instance.

CREATE TABLE IF NOT EXISTS meeting_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    meeting_id UUID REFERENCES meetings(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE meeting_messages ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can see messages for meetings they can access" ON meeting_messages
    FOR SELECT USING (
        meeting_id IN (
            SELECT id FROM meetings 
            WHERE conversation_id IN (
                SELECT conversation_id FROM conversation_participants WHERE profile_id = auth.uid()
            )
        ) OR
        (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
    );

CREATE POLICY "Users can send messages to meetings they are in" ON meeting_messages
    FOR INSERT WITH CHECK (
        auth.uid() = sender_id AND
        meeting_id IN (
            SELECT id FROM meetings 
            WHERE conversation_id IN (
                SELECT conversation_id FROM conversation_participants WHERE profile_id = auth.uid()
            )
        )
    );

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_meeting_messages_meeting ON meeting_messages(meeting_id);
