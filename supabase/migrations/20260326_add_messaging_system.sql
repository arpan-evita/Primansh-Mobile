-- Migration: Add Advanced Communication System
-- Roles: admin, team, client, seo, content, developer

-- 1. Conversations Table
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT, -- Optional, e.g., "Project Discussion: [Firm Name]"
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL, -- Optional, links to a specific firm
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 2. Participants Table
CREATE TABLE IF NOT EXISTS conversation_participants (
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  PRIMARY KEY (conversation_id, profile_id)
);

-- 3. Messages Table
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  is_read BOOLEAN DEFAULT false
);

-- 4. Enable RLS
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies

-- Participants: Can see who else is in their conversations
CREATE POLICY "Users can see participants in their conversations" ON conversation_participants
  FOR SELECT USING (
    profile_id = auth.uid() OR 
    conversation_id IN (SELECT conversation_id FROM conversation_participants WHERE profile_id = auth.uid()) OR
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  );

-- Conversations: Can see conversations they are part of
CREATE POLICY "Users can see their conversations" ON conversations
  FOR SELECT USING (
    id IN (SELECT conversation_id FROM conversation_participants WHERE profile_id = auth.uid()) OR
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  );

-- Messages: Can see messages in their conversations
CREATE POLICY "Users can see messages in their conversations" ON messages
  FOR SELECT USING (
    conversation_id IN (SELECT conversation_id FROM conversation_participants WHERE profile_id = auth.uid()) OR
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  );

-- Messages: Can send messages to their conversations
CREATE POLICY "Users can send messages to their conversations" ON messages
  FOR INSERT WITH CHECK (
    sender_id = auth.uid() AND (
      conversation_id IN (SELECT conversation_id FROM conversation_participants WHERE profile_id = auth.uid()) OR
      (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
    )
  );

-- 6. Trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_conversations_updated_at BEFORE UPDATE ON conversations
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
