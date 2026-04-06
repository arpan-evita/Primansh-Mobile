-- Migration: Meeting System Architecture
CREATE TABLE IF NOT EXISTS meetings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
    creator_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    start_time TIMESTAMPTZ DEFAULT now() NOT NULL,
    end_time TIMESTAMPTZ,
    status TEXT DEFAULT 'active' CHECK (status IN ('scheduled', 'active', 'ended')),
    room_id TEXT NOT NULL, -- External room reference (e.g., Jitsi, Daily, etc. or pure internal ID)
    is_recording BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS meeting_participants (
    meeting_id UUID REFERENCES meetings(id) ON DELETE CASCADE,
    profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    joined_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    left_at TIMESTAMPTZ,
    role_in_meeting TEXT DEFAULT 'participant', -- 'host', 'participant'
    PRIMARY KEY (meeting_id, profile_id)
);

-- Enable RLS
ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_participants ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can see meetings for their conversations" ON meetings
    FOR SELECT USING (
        conversation_id IN (SELECT conversation_id FROM conversation_participants WHERE profile_id = auth.uid()) OR
        (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
    );

CREATE POLICY "Users can see participants for their meetings" ON meeting_participants
    FOR SELECT USING (
        meeting_id IN (SELECT id FROM meetings WHERE conversation_id IN (SELECT conversation_id FROM conversation_participants WHERE profile_id = auth.uid())) OR
        (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
    );

-- Index for lookup
CREATE INDEX IF NOT EXISTS idx_meetings_conversation ON meetings(conversation_id);
