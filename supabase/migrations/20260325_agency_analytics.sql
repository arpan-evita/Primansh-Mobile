-- Create agency_analytics table for historical trend tracking
CREATE TABLE IF NOT EXISTS agency_analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    month TEXT NOT NULL,
    traffic INTEGER DEFAULT 0,
    leads INTEGER DEFAULT 0,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE agency_analytics ENABLE ROW LEVEL SECURITY;

-- Create policy for all (admin-only in production usually)
CREATE POLICY "Allow all on agency_analytics" ON agency_analytics
    FOR ALL USING (true);

-- Seed with historical data matching the mock dashboard
INSERT INTO agency_analytics (month, traffic, leads, sort_order) VALUES
('Oct', 5200, 28, 1),
('Nov', 6800, 35, 2),
('Dec', 6100, 30, 3),
('Jan', 8900, 47, 4),
('Feb', 11600, 61, 5),
('Mar', 14200, 78, 6);
