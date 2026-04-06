-- Create analytics tables for Growth Intelligence

-- Tasks Table
CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  assigned_to UUID REFERENCES profiles(id),
  status TEXT DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'done')),
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  module TEXT DEFAULT 'general' CHECK (module IN ('seo', 'content', 'website', 'general')),
  due_date DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Leads Table
CREATE TABLE IF NOT EXISTS leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  source TEXT DEFAULT 'website',
  status TEXT DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'converted', 'lost')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Keywords Table
CREATE TABLE IF NOT EXISTS keywords (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  keyword TEXT NOT NULL,
  target_pos INTEGER NOT NULL,
  current_pos INTEGER NOT NULL,
  trend TEXT DEFAULT 'stable' CHECK (trend IN ('up', 'down', 'stable')),
  last_checked DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Invoices Table
CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('paid', 'pending', 'overdue')),
  issued_date DATE DEFAULT CURRENT_DATE,
  paid_date DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for all
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE keywords ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

-- Simple Policies (Expand as needed)
CREATE POLICY "Allow authenticated tasks" ON tasks FOR ALL USING (true);
CREATE POLICY "Allow authenticated leads" ON leads FOR ALL USING (true);
CREATE POLICY "Allow authenticated keywords" ON keywords FOR ALL USING (true);
CREATE POLICY "Allow authenticated invoices" ON invoices FOR ALL USING (true);

-- Growth Intelligence View
CREATE OR REPLACE VIEW client_health_overview AS
WITH task_stats AS (
  SELECT 
    client_id,
    COUNT(*) as total_tasks,
    COUNT(*) FILTER (WHERE status = 'done') as done_tasks
  FROM tasks
  GROUP BY client_id
),
lead_stats AS (
  SELECT 
    client_id,
    COUNT(*) as total_leads,
    COUNT(*) FILTER (WHERE status = 'converted') as converted_leads
  FROM leads
  WHERE status != 'lost'
  GROUP BY client_id
),
seo_stats AS (
  SELECT 
    client_id,
    AVG(CASE WHEN current_pos > 0 THEN LEAST(100, (target_pos::float / current_pos::float) * 100) ELSE 0 END) as seo_performance
  FROM keywords
  GROUP BY client_id
),
billing_stats AS (
  SELECT 
    client_id,
    COUNT(*) as total_invoices,
    COUNT(*) FILTER (WHERE status = 'overdue') as overdue_invoices
  FROM invoices
  GROUP BY client_id
)
SELECT 
  c.*,
  ROUND(COALESCE(t.done_tasks::float / NULLIF(t.total_tasks, 0) * 100, 50)) as task_score,
  ROUND(COALESCE(l.converted_leads::float / NULLIF(l.total_leads, 0) * 100, 50)) as conversion_score,
  ROUND(COALESCE(s.seo_performance, 50)) as seo_score,
  ROUND(COALESCE((NULLIF(b.total_invoices, 0) - b.overdue_invoices)::float / NULLIF(b.total_invoices, 0) * 100, 100)) as billing_score,
  ROUND(
    (COALESCE(t.done_tasks::float / NULLIF(t.total_tasks, 0) * 100, 50) * 0.3) +
    (COALESCE(l.converted_leads::float / NULLIF(l.total_leads, 0) * 100, 50) * 0.3) +
    (COALESCE(s.seo_performance, 50) * 0.2) +
    (COALESCE((NULLIF(b.total_invoices, 0) - b.overdue_invoices)::float / NULLIF(b.total_invoices, 0) * 100, 100) * 0.2)
  ) as total_health_score
FROM clients c
LEFT JOIN task_stats t ON c.id = t.client_id
LEFT JOIN lead_stats l ON c.id = l.client_id
LEFT JOIN seo_stats s ON c.id = s.client_id
LEFT JOIN billing_stats b ON c.id = b.client_id;
