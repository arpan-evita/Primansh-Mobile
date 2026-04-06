-- Migration: Add Contextual Integration to Conversations
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS context_type TEXT; -- 'project', 'task', 'client'
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS context_id UUID;

-- Ensure message status is consistent
-- Add a constraint if not already present (already added in media support migration)
-- ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_status_check;
-- ALTER TABLE messages ADD CONSTRAINT messages_status_check CHECK (status IN ('sending', 'sent', 'delivered', 'read'));

-- Index for context-based lookups
CREATE INDEX IF NOT EXISTS idx_conversations_context ON conversations(context_type, context_id);
