-- Migration: Expo Push Tokens for Mobile Notifications
-- Stores Expo Push Tokens for mobile devices to enable native push notifications

CREATE TABLE IF NOT EXISTS expo_push_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  device_info JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE expo_push_tokens ENABLE ROW LEVEL SECURITY;

-- Users can only manage their own tokens
CREATE POLICY "Users manage own expo push tokens"
  ON expo_push_tokens
  FOR ALL
  USING (profile_id = auth.uid())
  WITH CHECK (profile_id = auth.uid());

-- Index for faster lookups by profile_id
CREATE INDEX IF NOT EXISTS idx_expo_push_tokens_profile_id ON expo_push_tokens(profile_id);

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_expo_push_tokens_updated_at
    BEFORE UPDATE ON expo_push_tokens
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
