-- Enhance client document storage with task-linking and visibility controls
-- Adds columns for task association, visibility levels, and refines RLS policies.

-- ============================================================
-- 0. CORE DEPENDENCIES (Ensures migration is 100% self-contained)
-- ============================================================

-- Function to standardize agency roles
CREATE OR REPLACE FUNCTION public.normalize_agency_role(p_role TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  normalized TEXT;
BEGIN
  normalized := lower(regexp_replace(coalesce(p_role, 'client'), '[\s_-]+', '', 'g'));
  IF normalized LIKE '%admin%' OR normalized LIKE '%manager%' OR normalized LIKE '%owner%' OR normalized LIKE '%agency%' THEN
    RETURN 'admin';
  ELSIF normalized LIKE '%seo%' THEN
    RETURN 'seo';
  ELSIF normalized LIKE '%content%' THEN
    RETURN 'content';
  ELSIF normalized LIKE '%dev%' THEN
    RETURN 'developer';
  ELSIF normalized LIKE '%team%' OR normalized LIKE '%staff%' THEN
    RETURN 'team';
  ELSIF normalized LIKE '%pending%' THEN
    RETURN 'pending';
  END IF;
  RETURN 'client';
END;
$$;

-- Function to check if actor is admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND public.normalize_agency_role(role) = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function for safe UUID conversion
CREATE OR REPLACE FUNCTION public.safe_uuid(p_value TEXT)
RETURNS UUID AS $$
BEGIN
  RETURN p_value::UUID;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Ensure join table for multi-assignments exists
CREATE TABLE IF NOT EXISTS public.team_assigned_clients (
  team_member_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  PRIMARY KEY (team_member_id, client_id)
);

-- Core function for client access checks
CREATE OR REPLACE FUNCTION public.can_access_client(p_client_id UUID, p_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH actor AS (
    SELECT p.id, public.normalize_agency_role(p.role) AS role, p.associated_client_id
    FROM public.profiles AS p
    WHERE p.id = COALESCE(p_user_id, auth.uid())
  ),
  client_scope AS (
    SELECT c.id, c.assigned_team_member_id
    FROM public.clients AS c
    WHERE c.id = p_client_id
  )
  SELECT EXISTS (
    SELECT 1
    FROM actor AS a
    JOIN client_scope AS c ON TRUE
    WHERE a.role = 'admin'
      OR (a.role = 'client' AND a.associated_client_id = c.id)
      OR (a.role IN ('team', 'seo', 'content', 'developer') AND (
        c.assigned_team_member_id = a.id
        OR EXISTS (SELECT 1 FROM public.team_assigned_clients tac WHERE tac.client_id = c.id AND tac.team_member_id = a.id)
      ))
  );
$$;

-- ============================================================
-- 1. Schema Extensions
-- ============================================================

ALTER TABLE public.client_documents
  ADD COLUMN IF NOT EXISTS linked_task_id UUID REFERENCES public.tasks(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'client' CHECK (visibility IN ('admin', 'team', 'client')),
  ADD COLUMN IF NOT EXISTS file_type TEXT;

CREATE INDEX IF NOT EXISTS idx_client_documents_task_id ON public.client_documents(linked_task_id);

-- ============================================================
-- 2. Enhanced RLS for client_documents
-- ============================================================

CREATE OR REPLACE FUNCTION public.can_view_document(
  p_doc_id UUID,
  p_client_id UUID,
  p_visibility TEXT,
  p_user_id UUID DEFAULT auth.uid()
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_role TEXT;
BEGIN
  SELECT public.normalize_agency_role(role)
  INTO v_actor_role
  FROM public.profiles
  WHERE id = COALESCE(p_user_id, auth.uid());

  IF v_actor_role = 'admin' THEN
    RETURN TRUE;
  END IF;

  IF p_visibility = 'admin' THEN
    RETURN FALSE;
  END IF;

  IF p_visibility = 'team' THEN
    RETURN v_actor_role IN ('team', 'seo', 'content', 'developer');
  END IF;

  RETURN public.can_access_client(p_client_id, COALESCE(p_user_id, auth.uid()));
END;
$$;

DROP POLICY IF EXISTS "Client documents are readable by scoped users" ON public.client_documents;
CREATE POLICY "Client documents are readable by scoped users"
  ON public.client_documents
  FOR SELECT
  TO authenticated
  USING (public.can_view_document(id, client_id, visibility));

-- ============================================================
-- 3. Update Storage Policies
-- ============================================================

DROP POLICY IF EXISTS "Client documents read policy" ON storage.objects;
CREATE POLICY "Client documents read policy"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'client-documents'
  AND (
    EXISTS (
      SELECT 1 
      FROM public.client_documents cd 
      WHERE cd.file_path = storage.objects.name 
        AND public.can_view_document(cd.id, cd.client_id, cd.visibility)
    )
    OR (
      public.is_admin()
      AND public.safe_uuid((storage.foldername(name))[1]) IS NOT NULL
      AND public.can_access_client(
        (public.safe_uuid((storage.foldername(name))[1]))::uuid, 
        (auth.uid())::uuid
      )
    )
  )
);
