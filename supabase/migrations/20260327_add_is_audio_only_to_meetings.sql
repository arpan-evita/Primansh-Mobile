-- Migration to add is_audio_only to meetings table
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS is_audio_only BOOLEAN DEFAULT FALSE;

-- Update existing meetings based on invitation message content if possible (optional)
-- UPDATE meetings SET is_audio_only = TRUE WHERE id IN (
--   SELECT meeting_id FROM messages WHERE content ILIKE '%Voice Call Invitation%'
-- );
