-- Project-Wide Repair Script
-- This migration ensures all core tables have the required columns for the mobile app
-- and rebuilds the health metrics view correctly.
-- Safe to run multiple times (idempotent).

-- 1. Repair CLIENTS table
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS assigned_team_member_id UUID REFERENCES public.profiles(id);
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS onboarding_date DATE;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS tracking_id TEXT;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS site_api_key TEXT;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS connected_at TIMESTAMPTZ;

-- 2. Repair TASKS table
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS assigned_to_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

-- 3. Repair LEADS table
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS payload JSONB DEFAULT '{}';

-- 4. Repair KEYWORDS table
ALTER TABLE public.keywords ADD COLUMN IF NOT EXISTS seo_score INTEGER;
ALTER TABLE public.keywords ADD COLUMN IF NOT EXISTS search_volume INTEGER;
ALTER TABLE public.keywords ADD COLUMN IF NOT EXISTS difficulty INTEGER;

-- 5. Repair INVOICES table
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS invoice_number TEXT;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS due_date DATE;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS notes TEXT;

-- 6. Repair CONVERSATIONS table
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());

-- 7. REBUILD Health Metrics View
DROP VIEW IF EXISTS public.client_health_overview CASCADE;

CREATE OR REPLACE VIEW public.client_health_overview
WITH (security_invoker = true)
AS
WITH task_stats AS (
  SELECT
    client_id,
    COUNT(*) AS total_tasks,
    COUNT(*) FILTER (WHERE status = 'done') AS done_tasks
  FROM public.tasks
  GROUP BY client_id
),
lead_stats AS (
  SELECT
    client_id,
    COUNT(*) AS total_leads,
    COUNT(*) FILTER (WHERE status = 'converted') AS converted_leads
  FROM public.leads
  WHERE status != 'lost'
  GROUP BY client_id
),
seo_stats AS (
  SELECT
    client_id,
    AVG(CASE WHEN current_pos > 0 THEN LEAST(100, (target_pos::float / current_pos::float) * 100) ELSE 0 END) AS seo_performance
  FROM public.keywords
  GROUP BY client_id
),
billing_stats AS (
  SELECT
    client_id,
    COUNT(*) AS total_invoices,
    COUNT(*) FILTER (WHERE status = 'overdue') AS overdue_invoices
  FROM public.invoices
  GROUP BY client_id
)
SELECT
  c.id,
  c.firm_name,
  c.location,
  c.services,
  c.website_url,
  c.contact_name,
  c.contact_phone,
  c.contact_email,
  c.plan_type,
  c.status,
  c.health_score,
  c.assigned_to,
  c.monthly_revenue,
  c.slug,
  c.tracking_id,
  c.site_api_key,
  c.connected_at,
  c.assigned_team_member_id,
  c.notes,
  c.onboarding_date,
  c.created_at,
  c.updated_at,
  -- Calculated Metrics
  ROUND(COALESCE(t.done_tasks::float / NULLIF(t.total_tasks, 0) * 100, 50)) AS task_score,
  ROUND(COALESCE(l.converted_leads::float / NULLIF(l.total_leads, 0) * 100, 50)) AS conversion_score,
  ROUND(COALESCE(s.seo_performance, 50)) AS seo_score,
  ROUND(COALESCE((NULLIF(b.total_invoices, 0) - b.overdue_invoices)::float / NULLIF(b.total_invoices, 0) * 100, 100)) AS billing_score,
  ROUND(
    (COALESCE(t.done_tasks::float / NULLIF(t.total_tasks, 0) * 100, 50) * 0.3) +
    (COALESCE(l.converted_leads::float / NULLIF(l.total_leads, 0) * 100, 50) * 0.3) +
    (COALESCE(s.seo_performance, 50) * 0.2) +
    (COALESCE((NULLIF(b.total_invoices, 0) - b.overdue_invoices)::float / NULLIF(b.total_invoices, 0) * 100, 100) * 0.2)
  ) AS total_health_score
FROM public.clients c
LEFT JOIN task_stats t ON c.id = t.client_id
LEFT JOIN lead_stats l ON c.id = l.client_id
LEFT JOIN seo_stats s ON c.id = s.client_id
LEFT JOIN billing_stats b ON c.id = b.client_id;

-- 8. Final touches
GRANT SELECT ON public.client_health_overview TO authenticated;
GRANT SELECT ON public.client_health_overview TO service_role;
