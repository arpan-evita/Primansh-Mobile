-- Create case_studies table
CREATE TABLE IF NOT EXISTS case_studies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  client TEXT NOT NULL,
  location TEXT,
  service TEXT,
  challenge TEXT,
  solution TEXT,
  results JSONB DEFAULT '[]'::jsonb,
  testimonial TEXT,
  color TEXT DEFAULT 'accent',
  is_published BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE case_studies ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Allow public read access" ON case_studies
  FOR SELECT USING (true);

-- For simple admin access (since we don't have complex auth yet, we'll allow all for now or the user can restrict)
CREATE POLICY "Allow all access for now" ON case_studies
  FOR ALL USING (true);

-- Insert initial data
INSERT INTO case_studies (slug, client, location, service, challenge, solution, results, testimonial, color)
VALUES 
(
  'sharma-associates', 
  'Sharma & Associates', 
  'Mumbai, Maharashtra', 
  'Local SEO + Website', 
  'No online presence, losing clients to competitors who ranked on Google.', 
  'Built a modern website with service pages for ITR, GST, and Audit. Implemented local SEO strategy targeting ''CA in Mumbai''.',
  '[{"metric": "Organic Traffic", "value": "+300%", "icon": "trending-up"}, {"metric": "Client Inquiries", "value": "+150%", "icon": "users"}, {"metric": "Google Ranking", "value": "#1 Local", "icon": "search"}]',
  'Primansh transformed our practice. We now get 5-10 new client calls every week from Google alone.',
  'accent'
),
(
  'patel-tax-consultants', 
  'Patel Tax Consultants', 
  'Ahmedabad, Gujarat', 
  'SEO Content Strategy', 
  'Had a website but zero organic traffic. No blog or content strategy.', 
  'Created 50+ SEO-optimized blog posts targeting GST, income tax, and compliance keywords. Built internal linking structure.',
  '[{"metric": "Blog Traffic", "value": "10K/mo", "icon": "trending-up"}, {"metric": "Lead Generation", "value": "+200%", "icon": "users"}, {"metric": "Keywords Ranked", "value": "120+", "icon": "globe"}]',
  'Our blog now generates more clients than referrals. The ROI from Primansh''s content strategy is incredible.',
  'hot'
);
