-- Mobile client integration foundation
-- Adds client metadata, strict client access rules, assignment syncing, and realtime publication
-- for the mobile Client tab and detail views.

-- ============================================================
-- 1. Client schema extensions
-- ============================================================

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS onboarding_date DATE;

ALTER TABLE public.clients
  ALTER COLUMN updated_at SET DEFAULT timezone('utc'::text, now());

UPDATE public.clients
SET
  onboarding_date = COALESCE(onboarding_date, created_at::date),
  updated_at = COALESCE(updated_at, created_at, timezone('utc'::text, now()))
WHERE onboarding_date IS NULL
   OR updated_at IS NULL;

CREATE OR REPLACE FUNCTION public.touch_client_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := timezone('utc'::text, now());

  IF TG_OP = 'INSERT' AND NEW.onboarding_date IS NULL THEN
    NEW.onboarding_date := CURRENT_DATE;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_touch_client_updated_at ON public.clients;
CREATE TRIGGER tr_touch_client_updated_at
  BEFORE INSERT OR UPDATE ON public.clients
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_client_updated_at();

-- ============================================================
-- 2. Optional multi-assignment compatibility layer
-- ============================================================

CREATE TABLE IF NOT EXISTS public.team_assigned_clients (
  team_member_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  PRIMARY KEY (team_member_id, client_id)
);

ALTER TABLE public.team_assigned_clients ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_team_assigned_clients_client_id
  ON public.team_assigned_clients(client_id);

CREATE INDEX IF NOT EXISTS idx_team_assigned_clients_team_member_id
  ON public.team_assigned_clients(team_member_id);

DROP POLICY IF EXISTS "Team assigned clients visible to scoped users" ON public.team_assigned_clients;
CREATE POLICY "Team assigned clients visible to scoped users"
  ON public.team_assigned_clients
  FOR SELECT
  TO authenticated
  USING (
    public.normalize_agency_role((SELECT role FROM public.profiles WHERE id = auth.uid())) = 'admin'
    OR team_member_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.clients c
      WHERE c.id = public.team_assigned_clients.client_id
        AND c.assigned_team_member_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Team assigned clients manageable by admins" ON public.team_assigned_clients;
CREATE POLICY "Team assigned clients manageable by admins"
  ON public.team_assigned_clients
  FOR ALL
  TO authenticated
  USING (public.normalize_agency_role((SELECT role FROM public.profiles WHERE id = auth.uid())) = 'admin')
  WITH CHECK (public.normalize_agency_role((SELECT role FROM public.profiles WHERE id = auth.uid())) = 'admin');

-- Keep the compatibility table aligned with the primary client assignment field.
CREATE OR REPLACE FUNCTION public.sync_primary_client_assignment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.team_assigned_clients
    WHERE client_id = OLD.id;
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.assigned_team_member_id IS DISTINCT FROM NEW.assigned_team_member_id THEN
    IF OLD.assigned_team_member_id IS NOT NULL THEN
      DELETE FROM public.team_assigned_clients
      WHERE client_id = NEW.id
        AND team_member_id = OLD.assigned_team_member_id;
    END IF;
  END IF;

  IF NEW.assigned_team_member_id IS NOT NULL THEN
    INSERT INTO public.team_assigned_clients (team_member_id, client_id)
    VALUES (NEW.assigned_team_member_id, NEW.id)
    ON CONFLICT (team_member_id, client_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_sync_primary_client_assignment ON public.clients;
CREATE TRIGGER tr_sync_primary_client_assignment
  AFTER INSERT OR UPDATE OF assigned_team_member_id OR DELETE ON public.clients
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_primary_client_assignment();

-- ============================================================
-- 3. Client access helpers
-- ============================================================

CREATE OR REPLACE FUNCTION public.can_access_client(p_client_id UUID, p_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH actor AS (
    SELECT
      p.id,
      public.normalize_agency_role(p.role) AS role,
      p.associated_client_id
    FROM public.profiles AS p
    WHERE p.id = COALESCE(p_user_id, auth.uid())
  ),
  client_scope AS (
    SELECT
      c.id,
      c.assigned_team_member_id
    FROM public.clients AS c
    WHERE c.id = p_client_id
  )
  SELECT EXISTS (
    SELECT 1
    FROM actor AS a
    JOIN client_scope AS c ON TRUE
    WHERE
      a.role = 'admin'
      OR (
        a.role = 'client'
        AND a.associated_client_id = c.id
      )
      OR (
        a.role IN ('team', 'seo', 'content', 'developer')
        AND (
          c.assigned_team_member_id = a.id
          OR EXISTS (
            SELECT 1
            FROM public.team_assigned_clients tac
            WHERE tac.client_id = c.id
              AND tac.team_member_id = a.id
          )
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.can_manage_client_data(p_client_id UUID, p_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles AS p
    WHERE p.id = COALESCE(p_user_id, auth.uid())
      AND public.normalize_agency_role(p.role) IN ('admin', 'team', 'seo', 'content', 'developer')
      AND public.can_access_client(p_client_id, p.id)
  );
$$;

CREATE OR REPLACE FUNCTION public.enforce_client_write_permissions()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor_role TEXT;
  actor_id UUID := auth.uid();
BEGIN
  SELECT public.normalize_agency_role(role)
  INTO actor_role
  FROM public.profiles
  WHERE id = actor_id;

  IF TG_OP = 'DELETE' THEN
    IF actor_role <> 'admin' THEN
      RAISE EXCEPTION 'Only admins can delete clients';
    END IF;
    RETURN OLD;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF actor_role <> 'admin' THEN
      RAISE EXCEPTION 'Only admins can create clients';
    END IF;

    IF NEW.onboarding_date IS NULL THEN
      NEW.onboarding_date := CURRENT_DATE;
    END IF;

    RETURN NEW;
  END IF;

  IF actor_role = 'admin' THEN
    RETURN NEW;
  END IF;

  IF actor_role IN ('team', 'seo', 'content', 'developer') THEN
    IF NOT public.can_access_client(OLD.id, actor_id) THEN
      RAISE EXCEPTION 'You are not allowed to update this client';
    END IF;

    IF NEW.firm_name IS DISTINCT FROM OLD.firm_name
      OR NEW.location IS DISTINCT FROM OLD.location
      OR NEW.services IS DISTINCT FROM OLD.services
      OR NEW.website_url IS DISTINCT FROM OLD.website_url
      OR NEW.contact_name IS DISTINCT FROM OLD.contact_name
      OR NEW.contact_phone IS DISTINCT FROM OLD.contact_phone
      OR NEW.contact_email IS DISTINCT FROM OLD.contact_email
      OR NEW.plan_type IS DISTINCT FROM OLD.plan_type
      OR NEW.assigned_to IS DISTINCT FROM OLD.assigned_to
      OR NEW.monthly_revenue IS DISTINCT FROM OLD.monthly_revenue
      OR NEW.slug IS DISTINCT FROM OLD.slug
      OR NEW.tracking_id IS DISTINCT FROM OLD.tracking_id
      OR NEW.site_api_key IS DISTINCT FROM OLD.site_api_key
      OR NEW.connected_at IS DISTINCT FROM OLD.connected_at
      OR NEW.assigned_team_member_id IS DISTINCT FROM OLD.assigned_team_member_id
      OR NEW.onboarding_date IS DISTINCT FROM OLD.onboarding_date
      OR NEW.health_score IS DISTINCT FROM OLD.health_score
      OR NEW.created_at IS DISTINCT FROM OLD.created_at
    THEN
      RAISE EXCEPTION 'Team members can only update status and notes';
    END IF;

    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'You are not allowed to update this client';
END;
$$;

DROP TRIGGER IF EXISTS tr_enforce_client_write_permissions ON public.clients;
CREATE TRIGGER tr_enforce_client_write_permissions
  BEFORE INSERT OR UPDATE OR DELETE ON public.clients
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_client_write_permissions();

-- ============================================================
-- 4. Strict client RLS
-- ============================================================

DROP POLICY IF EXISTS "Allow authenticated access" ON public.clients;
DROP POLICY IF EXISTS "Team member read assigned clients" ON public.clients;
DROP POLICY IF EXISTS "Clients can be read by scoped users" ON public.clients;
DROP POLICY IF EXISTS "Clients can be inserted by admins" ON public.clients;
DROP POLICY IF EXISTS "Clients can be updated by scoped users" ON public.clients;
DROP POLICY IF EXISTS "Clients can be deleted by admins" ON public.clients;

CREATE POLICY "Clients can be read by scoped users"
  ON public.clients
  FOR SELECT
  TO authenticated
  USING (public.can_access_client(id));

CREATE POLICY "Clients can be inserted by admins"
  ON public.clients
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.normalize_agency_role((SELECT role FROM public.profiles WHERE id = auth.uid())) = 'admin'
  );

CREATE POLICY "Clients can be updated by scoped users"
  ON public.clients
  FOR UPDATE
  TO authenticated
  USING (public.can_access_client(id))
  WITH CHECK (public.can_access_client(id));

CREATE POLICY "Clients can be deleted by admins"
  ON public.clients
  FOR DELETE
  TO authenticated
  USING (
    public.normalize_agency_role((SELECT role FROM public.profiles WHERE id = auth.uid())) = 'admin'
  );

-- ============================================================
-- 5. Secure read access to client-owned analytics tables
-- ============================================================

DROP POLICY IF EXISTS "Authenticated read for leads" ON public.leads;
DROP POLICY IF EXISTS "Allow authenticated leads" ON public.leads;
CREATE POLICY "Leads can be read by scoped users"
  ON public.leads
  FOR SELECT
  TO authenticated
  USING (public.can_access_client(client_id));

DROP POLICY IF EXISTS "Leads can be managed by scoped users" ON public.leads;
CREATE POLICY "Leads can be managed by scoped users"
  ON public.leads
  FOR INSERT
  TO authenticated
  WITH CHECK (public.can_manage_client_data(client_id));

DROP POLICY IF EXISTS "Leads can be updated by scoped users" ON public.leads;
CREATE POLICY "Leads can be updated by scoped users"
  ON public.leads
  FOR UPDATE
  TO authenticated
  USING (public.can_manage_client_data(client_id))
  WITH CHECK (public.can_manage_client_data(client_id));

DROP POLICY IF EXISTS "Leads can be deleted by scoped users" ON public.leads;
CREATE POLICY "Leads can be deleted by scoped users"
  ON public.leads
  FOR DELETE
  TO authenticated
  USING (public.can_manage_client_data(client_id));

DROP POLICY IF EXISTS "Allow authenticated keywords" ON public.keywords;
CREATE POLICY "Keywords can be read by scoped users"
  ON public.keywords
  FOR SELECT
  TO authenticated
  USING (public.can_access_client(client_id));

DROP POLICY IF EXISTS "Keywords can be managed by scoped users" ON public.keywords;
CREATE POLICY "Keywords can be managed by scoped users"
  ON public.keywords
  FOR INSERT
  TO authenticated
  WITH CHECK (public.can_manage_client_data(client_id));

DROP POLICY IF EXISTS "Keywords can be updated by scoped users" ON public.keywords;
CREATE POLICY "Keywords can be updated by scoped users"
  ON public.keywords
  FOR UPDATE
  TO authenticated
  USING (public.can_manage_client_data(client_id))
  WITH CHECK (public.can_manage_client_data(client_id));

DROP POLICY IF EXISTS "Keywords can be deleted by scoped users" ON public.keywords;
CREATE POLICY "Keywords can be deleted by scoped users"
  ON public.keywords
  FOR DELETE
  TO authenticated
  USING (public.can_manage_client_data(client_id));

DROP POLICY IF EXISTS "Allow authenticated invoices" ON public.invoices;
CREATE POLICY "Invoices can be read by scoped users"
  ON public.invoices
  FOR SELECT
  TO authenticated
  USING (public.can_access_client(client_id));

DROP POLICY IF EXISTS "Invoices can be managed by scoped users" ON public.invoices;
CREATE POLICY "Invoices can be managed by scoped users"
  ON public.invoices
  FOR INSERT
  TO authenticated
  WITH CHECK (public.can_manage_client_data(client_id));

DROP POLICY IF EXISTS "Invoices can be updated by scoped users" ON public.invoices;
CREATE POLICY "Invoices can be updated by scoped users"
  ON public.invoices
  FOR UPDATE
  TO authenticated
  USING (public.can_manage_client_data(client_id))
  WITH CHECK (public.can_manage_client_data(client_id));

DROP POLICY IF EXISTS "Invoices can be deleted by scoped users" ON public.invoices;
CREATE POLICY "Invoices can be deleted by scoped users"
  ON public.invoices
  FOR DELETE
  TO authenticated
  USING (public.can_manage_client_data(client_id));

DROP POLICY IF EXISTS "Allow authenticated analytics view" ON public.site_analytics;
CREATE POLICY "Site analytics can be read by scoped users"
  ON public.site_analytics
  FOR SELECT
  TO authenticated
  USING (public.can_access_client(client_id));

-- ============================================================
-- 6. Refresh the client overview view so new columns are exposed
-- ============================================================

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

-- ============================================================
-- 7. Realtime publication
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.clients;
  EXCEPTION
    WHEN duplicate_object THEN NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.team_assigned_clients;
  EXCEPTION
    WHEN duplicate_object THEN NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.leads;
  EXCEPTION
    WHEN duplicate_object THEN NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.keywords;
  EXCEPTION
    WHEN duplicate_object THEN NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.invoices;
  EXCEPTION
    WHEN duplicate_object THEN NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.site_analytics;
  EXCEPTION
    WHEN duplicate_object THEN NULL;
  END;
END $$;
