-- Create clients table
CREATE TABLE IF NOT EXISTS clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_name TEXT NOT NULL,
  location TEXT NOT NULL,
  services TEXT[] DEFAULT '{}',
  website_url TEXT,
  contact_name TEXT NOT NULL,
  contact_phone TEXT,
  contact_email TEXT NOT NULL,
  plan_type TEXT DEFAULT 'basic' CHECK (plan_type IN ('basic', 'growth', 'premium')),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'trial')),
  health_score INTEGER DEFAULT 50 CHECK (health_score >= 0 AND health_score <= 100),
  assigned_to UUID,
  monthly_revenue NUMERIC DEFAULT 0,
  slug TEXT UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Allow authenticated access" ON clients
  FOR ALL USING (true); -- Simplified for now, should be restricted by role in production

-- Insert some initial data from mock
INSERT INTO clients (firm_name, location, services, website_url, contact_name, contact_email, plan_type, status, health_score, monthly_revenue)
VALUES 
('Sharma & Associates', 'Delhi', ARRAY['GST', 'ITR', 'Audit'], 'sharma-ca.com', 'Rakesh Sharma', 'rakesh@sharma-ca.com', 'premium', 'active', 87, 25000),
('Gupta Tax Consultants', 'Mumbai', ARRAY['GST', 'ITR'], 'guptatax.in', 'Anjali Gupta', 'anjali@guptatax.in', 'growth', 'active', 72, 18000),
('Mehta Financial Services', 'Ahmedabad', ARRAY['Audit', 'ITR', 'Advisory'], 'mehtafinancial.com', 'Deepak Mehta', 'deepak@mehtafinancial.com', 'premium', 'active', 91, 30000);
