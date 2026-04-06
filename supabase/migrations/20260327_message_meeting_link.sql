-- Migration: Link Messages to Meetings
ALTER TABLE messages ADD COLUMN IF NOT EXISTS meeting_id UUID REFERENCES meetings(id) ON DELETE SET NULL;

-- Update message_type check if it exists as a constraint
-- Check if constraint exists, if so drop and recreate
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'messages_message_type_check') THEN
        ALTER TABLE messages DROP CONSTRAINT messages_message_type_check;
    END IF;
END $$;

ALTER TABLE messages ADD CONSTRAINT messages_message_type_check 
    CHECK (message_type IN ('text', 'image', 'audio', 'file', 'meeting'));
