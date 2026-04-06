-- Fix client visibility issues
-- 1. Allow NULL on columns that the add-client form may not always provide
ALTER TABLE clients ALTER COLUMN location DROP NOT NULL;
ALTER TABLE clients ALTER COLUMN contact_name DROP NOT NULL;
ALTER TABLE clients ALTER COLUMN contact_email DROP NOT NULL;

-- 2. Ensure the view is accessible - recreate with explicit SECURITY INVOKER
DROP VIEW IF EXISTS client_health_overview;

CREATE OR REPLACE VIEW client_health_overview
WITH (security_invoker = true)
AS
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
