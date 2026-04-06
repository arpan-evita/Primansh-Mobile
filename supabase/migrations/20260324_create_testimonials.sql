-- Create testimonials table
CREATE TABLE IF NOT EXISTS testimonials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  rating INTEGER DEFAULT 5 CHECK (rating >= 1 AND rating <= 5),
  is_published BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE testimonials ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Allow public read access" ON testimonials
  FOR SELECT USING (true);

CREATE POLICY "Allow all access for admin" ON testimonials
  FOR ALL USING (true);

-- Insert initial data
INSERT INTO testimonials (quote, name, role, rating)
VALUES 
('Primansh transformed our firm''s online presence. We went from 0 to 45+ qualified GST inquiries in just 3 months. Highly recommended for any CA firm.', 'CA Rajesh Mehta', 'Senior Partner, Mehta & Associates', 5),
('The lead generation system they built is a lifesaver. No more manual follow-ups; the automation handles everything while I focus on audits.', 'CA Anjali Sharma', 'Practicing CA', 5),
('Our website is now our best salesperson. It ranks on the first page of Google for ''Best CA in Pune'', bringing high-value clients consistently.', 'CA Vikram Singh', 'Proprietor, Singh & Co', 5);
