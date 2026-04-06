-- Migration: Add connection fields to clients and create site_analytics
-- Target: Supabase

-- 1. Add fields to clients to support site connections
ALTER TABLE clients ADD COLUMN IF NOT EXISTS tracking_id UUID DEFAULT gen_random_uuid();
ALTER TABLE clients ADD COLUMN IF NOT EXISTS site_api_key TEXT DEFAULT encode(gen_random_bytes(24), 'base64');
ALTER TABLE clients ADD COLUMN IF NOT EXISTS connected_at TIMESTAMP WITH TIME ZONE;

-- 2. Create site_analytics table for raw traffic data
CREATE TABLE IF NOT EXISTS site_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  event_type TEXT DEFAULT 'pageview', -- 'pageview', 'session_start', 'conversion'
  page_path TEXT NOT NULL,
  page_title TEXT,
  referrer TEXT,
  session_id TEXT,
  device_type TEXT,
  browser TEXT,
  user_agent TEXT,
  location_country TEXT,
  metadata JSONB DEFAULT '{}'
);

-- 3. Enable RLS and Policies
ALTER TABLE site_analytics ENABLE ROW LEVEL SECURITY;

-- Allow public insertion (for the tracking pixel)
-- In a production environment, we'd use a more secure method or a Supabase Edge Function to validate tracking_id
CREATE POLICY "Allow anonymous track" ON site_analytics FOR INSERT WITH CHECK (true);

-- Allow authenticated users (Admins/Teams) to view analytics
CREATE POLICY "Allow authenticated analytics view" ON site_analytics 
  FOR SELECT USING (auth.role() = 'authenticated');

-- 4. Keyword Data Enhancements
-- Already exists: keywords table. Let's ensure it has an SEO score field.
ALTER TABLE keywords ADD COLUMN IF NOT EXISTS seo_score INTEGER;
ALTER TABLE keywords ADD COLUMN IF NOT EXISTS search_volume INTEGER;
ALTER TABLE keywords ADD COLUMN IF NOT EXISTS difficulty INTEGER;

-- 5. Leads Table Enhancement
-- Ensure source is accurate for webhooks
ALTER TABLE leads ALTER COLUMN source SET DEFAULT 'website';
ALTER TABLE leads ADD COLUMN IF NOT EXISTS payload JSONB DEFAULT '{}'; -- For custom form data
