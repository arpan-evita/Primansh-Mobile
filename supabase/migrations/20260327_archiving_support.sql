-- Migration: Archiving Support
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT false;

-- Index for archived filtering
CREATE INDEX IF NOT EXISTS idx_conversations_archived ON conversations(is_archived);
