-- Mobile task integration foundation
-- Extends the existing tasks backend without replacing the current web admin workflow.

-- ============================================================
-- 1. Canonical helpers
-- ============================================================

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

CREATE OR REPLACE FUNCTION public.safe_uuid(p_value TEXT)
RETURNS UUID
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF p_value IS NULL OR btrim(p_value) = '' THEN
    RETURN NULL;
  END IF;

  RETURN p_value::uuid;
EXCEPTION
  WHEN OTHERS THEN
    RETURN NULL;
END;
$$;

-- ============================================================
-- 2. Task schema parity for mobile/web sync
-- ============================================================

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now()),
  ADD COLUMN IF NOT EXISTS assigned_to_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS tasks_module_check;
ALTER TABLE public.tasks
  ADD CONSTRAINT tasks_module_check
  CHECK (module IN ('seo', 'content', 'website', 'general', 'development', 'ops'));

CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to_user_id ON public.tasks(assigned_to_user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_client_status_priority ON public.tasks(client_id, status, priority);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON public.tasks(due_date);

UPDATE public.tasks
SET updated_at = COALESCE(updated_at, created_at, timezone('utc'::text, now()))
WHERE updated_at IS NULL;

UPDATE public.tasks AS t
SET assigned_to_user_id = p.id,
    assigned_to = COALESCE(NULLIF(p.full_name, ''), p.email)
FROM public.profiles AS p
WHERE t.assigned_to_user_id IS NULL
  AND t.assigned_to IS NOT NULL
  AND lower(btrim(t.assigned_to)) = lower(btrim(COALESCE(NULLIF(p.full_name, ''), p.email)));

UPDATE public.tasks
SET created_by = COALESCE(created_by, assigned_to_user_id)
WHERE created_by IS NULL
  AND assigned_to_user_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.sync_task_metadata()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  matched_profile RECORD;
BEGIN
  IF NEW.created_by IS NULL THEN
    NEW.created_by := auth.uid();
  END IF;

  NEW.updated_at := timezone('utc'::text, now());

  IF NEW.assigned_to_user_id IS NOT NULL THEN
    SELECT id, COALESCE(NULLIF(full_name, ''), email) AS display_name
    INTO matched_profile
    FROM public.profiles
    WHERE id = NEW.assigned_to_user_id
    LIMIT 1;

    IF matched_profile.id IS NOT NULL THEN
      NEW.assigned_to := matched_profile.display_name;
    END IF;
  ELSIF NEW.assigned_to IS NOT NULL AND btrim(NEW.assigned_to) <> '' THEN
    SELECT id, COALESCE(NULLIF(full_name, ''), email) AS display_name
    INTO matched_profile
    FROM public.profiles
    WHERE lower(btrim(COALESCE(NULLIF(full_name, ''), email))) = lower(btrim(NEW.assigned_to))
    ORDER BY full_name NULLS LAST, email NULLS LAST
    LIMIT 1;

    IF matched_profile.id IS NOT NULL THEN
      NEW.assigned_to_user_id := matched_profile.id;
      NEW.assigned_to := matched_profile.display_name;
    END IF;
  ELSE
    NEW.assigned_to := NULL;
    NEW.assigned_to_user_id := NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_sync_task_metadata ON public.tasks;
DROP TRIGGER IF EXISTS tr_a_sync_task_metadata ON public.tasks;
CREATE TRIGGER tr_a_sync_task_metadata
  BEFORE INSERT OR UPDATE ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_task_metadata();

-- ============================================================
-- 3. Permission helpers
-- ============================================================

CREATE OR REPLACE FUNCTION public.can_access_task(p_task_id UUID, p_user_id UUID DEFAULT auth.uid())
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
  task_scope AS (
    SELECT
      t.id,
      t.client_id,
      t.assigned_to_user_id,
      c.assigned_team_member_id
    FROM public.tasks AS t
    LEFT JOIN public.clients AS c
      ON c.id = t.client_id
    WHERE t.id = p_task_id
  )
  SELECT EXISTS (
    SELECT 1
    FROM actor AS a
    JOIN task_scope AS s ON TRUE
    WHERE
      a.role = 'admin'
      OR (
        a.role IN ('team', 'seo', 'content', 'developer')
        AND s.assigned_to_user_id = a.id
      )
      OR (
        a.role = 'client'
        AND a.associated_client_id IS NOT NULL
        AND a.associated_client_id = s.client_id
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.can_create_task_for_client(p_client_id UUID, p_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles AS p
    LEFT JOIN public.clients AS c
      ON c.id = p_client_id
    WHERE p.id = COALESCE(p_user_id, auth.uid())
      AND (
        public.normalize_agency_role(p.role) = 'admin'
        OR (
          public.normalize_agency_role(p.role) IN ('team', 'seo', 'content', 'developer')
          AND c.assigned_team_member_id = p.id
        )
        OR (
          public.normalize_agency_role(p.role) = 'client'
          AND p.associated_client_id = p_client_id
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.can_comment_on_task(p_task_id UUID, p_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.can_access_task(p_task_id, p_user_id);
$$;

CREATE OR REPLACE FUNCTION public.can_attach_to_task(p_task_id UUID, p_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.can_access_task(p_task_id, p_user_id);
$$;

CREATE OR REPLACE FUNCTION public.enforce_task_write_permissions()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor_role TEXT;
  actor_client_id UUID;
  actor_id UUID := auth.uid();
BEGIN
  IF actor_id IS NULL THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;
    RETURN NEW;
  END IF;

  SELECT
    public.normalize_agency_role(role),
    associated_client_id
  INTO actor_role, actor_client_id
  FROM public.profiles
  WHERE id = actor_id;

  IF actor_role = 'admin' THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF actor_role IN ('team', 'seo', 'content', 'developer') THEN
      IF NOT public.can_create_task_for_client(NEW.client_id, actor_id) THEN
        RAISE EXCEPTION 'You are not allowed to create tasks for this client';
      END IF;

      IF NEW.assigned_to_user_id IS NOT NULL AND NEW.assigned_to_user_id <> actor_id THEN
        RAISE EXCEPTION 'Team members can only create tasks assigned to themselves';
      END IF;

      RETURN NEW;
    END IF;

    IF actor_role = 'client' THEN
      IF actor_client_id IS DISTINCT FROM NEW.client_id THEN
        RAISE EXCEPTION 'Clients can only create request tasks for their own project';
      END IF;

      IF NEW.assigned_to_user_id IS NOT NULL THEN
        RAISE EXCEPTION 'Clients cannot self-assign tasks';
      END IF;

      RETURN NEW;
    END IF;

    RAISE EXCEPTION 'You are not allowed to create tasks';
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF actor_role IN ('team', 'seo', 'content', 'developer') THEN
      IF NOT public.can_access_task(OLD.id, actor_id) THEN
        RAISE EXCEPTION 'You are not allowed to update this task';
      END IF;

      IF NEW.title IS DISTINCT FROM OLD.title
        OR NEW.description IS DISTINCT FROM OLD.description
        OR NEW.client_id IS DISTINCT FROM OLD.client_id
        OR NEW.priority IS DISTINCT FROM OLD.priority
        OR NEW.due_date IS DISTINCT FROM OLD.due_date
        OR NEW.module IS DISTINCT FROM OLD.module
        OR NEW.assigned_to IS DISTINCT FROM OLD.assigned_to
        OR NEW.assigned_to_user_id IS DISTINCT FROM OLD.assigned_to_user_id THEN
        RAISE EXCEPTION 'Team members can only update task status';
      END IF;

      RETURN NEW;
    END IF;

    IF actor_role = 'client' THEN
      RAISE EXCEPTION 'Clients cannot edit tasks directly';
    END IF;

    RAISE EXCEPTION 'You are not allowed to update this task';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Only admins can delete tasks';
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS tr_enforce_task_write_permissions ON public.tasks;
DROP TRIGGER IF EXISTS tr_z_enforce_task_write_permissions ON public.tasks;
CREATE TRIGGER tr_z_enforce_task_write_permissions
  BEFORE INSERT OR UPDATE OR DELETE ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_task_write_permissions();

-- ============================================================
-- 4. Task comments + attachments
-- ============================================================

CREATE TABLE IF NOT EXISTS public.task_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.task_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_url TEXT,
  file_size BIGINT,
  mime_type TEXT,
  uploaded_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_task_comments_task_created_at
  ON public.task_comments(task_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_task_attachments_task_created_at
  ON public.task_attachments(task_id, created_at DESC);

ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_attachments ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.touch_task_comment()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := timezone('utc'::text, now());
  IF NEW.created_by IS NULL THEN
    NEW.created_by := auth.uid();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_touch_task_comment ON public.task_comments;
CREATE TRIGGER tr_touch_task_comment
  BEFORE INSERT OR UPDATE ON public.task_comments
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_task_comment();

DROP POLICY IF EXISTS "Task comments are readable to task members" ON public.task_comments;
CREATE POLICY "Task comments are readable to task members"
ON public.task_comments FOR SELECT
TO authenticated
USING (public.can_access_task(task_id));

DROP POLICY IF EXISTS "Task comments can be inserted by task members" ON public.task_comments;
CREATE POLICY "Task comments can be inserted by task members"
ON public.task_comments FOR INSERT
TO authenticated
WITH CHECK (
  public.can_comment_on_task(task_id)
  AND COALESCE(created_by, auth.uid()) = auth.uid()
);

DROP POLICY IF EXISTS "Task comments can be updated by author or admin" ON public.task_comments;
CREATE POLICY "Task comments can be updated by author or admin"
ON public.task_comments FOR UPDATE
TO authenticated
USING (
  created_by = auth.uid()
  OR public.normalize_agency_role((SELECT role FROM public.profiles WHERE id = auth.uid())) = 'admin'
)
WITH CHECK (
  public.can_comment_on_task(task_id)
  AND (
    created_by = auth.uid()
    OR public.normalize_agency_role((SELECT role FROM public.profiles WHERE id = auth.uid())) = 'admin'
  )
);

DROP POLICY IF EXISTS "Task comments can be deleted by author or admin" ON public.task_comments;
CREATE POLICY "Task comments can be deleted by author or admin"
ON public.task_comments FOR DELETE
TO authenticated
USING (
  created_by = auth.uid()
  OR public.normalize_agency_role((SELECT role FROM public.profiles WHERE id = auth.uid())) = 'admin'
);

DROP POLICY IF EXISTS "Task attachments are readable to task members" ON public.task_attachments;
CREATE POLICY "Task attachments are readable to task members"
ON public.task_attachments FOR SELECT
TO authenticated
USING (public.can_access_task(task_id));

DROP POLICY IF EXISTS "Task attachments can be inserted by task members" ON public.task_attachments;
CREATE POLICY "Task attachments can be inserted by task members"
ON public.task_attachments FOR INSERT
TO authenticated
WITH CHECK (
  public.can_attach_to_task(task_id)
  AND COALESCE(uploaded_by, auth.uid()) = auth.uid()
);

DROP POLICY IF EXISTS "Task attachments can be deleted by uploader or admin" ON public.task_attachments;
CREATE POLICY "Task attachments can be deleted by uploader or admin"
ON public.task_attachments FOR DELETE
TO authenticated
USING (
  uploaded_by = auth.uid()
  OR public.normalize_agency_role((SELECT role FROM public.profiles WHERE id = auth.uid())) = 'admin'
);

-- ============================================================
-- 5. Tighten task RLS
-- ============================================================

DROP POLICY IF EXISTS "Allow authenticated tasks" ON public.tasks;

DROP POLICY IF EXISTS "Task records are readable by scoped users" ON public.tasks;
CREATE POLICY "Task records are readable by scoped users"
ON public.tasks FOR SELECT
TO authenticated
USING (public.can_access_task(id));

DROP POLICY IF EXISTS "Task records can be created by scoped users" ON public.tasks;
CREATE POLICY "Task records can be created by scoped users"
ON public.tasks FOR INSERT
TO authenticated
WITH CHECK (public.can_create_task_for_client(client_id));

DROP POLICY IF EXISTS "Task records can be updated by scoped users" ON public.tasks;
CREATE POLICY "Task records can be updated by scoped users"
ON public.tasks FOR UPDATE
TO authenticated
USING (public.can_access_task(id))
WITH CHECK (public.can_access_task(id));

DROP POLICY IF EXISTS "Task records can be deleted by admins" ON public.tasks;
CREATE POLICY "Task records can be deleted by admins"
ON public.tasks FOR DELETE
TO authenticated
USING (
  public.normalize_agency_role((SELECT role FROM public.profiles WHERE id = auth.uid())) = 'admin'
);

-- ============================================================
-- 6. Storage for task attachments
-- ============================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('task-attachments', 'task-attachments', false)
ON CONFLICT (id) DO UPDATE SET public = false;

DROP POLICY IF EXISTS "Task attachments upload policy" ON storage.objects;
CREATE POLICY "Task attachments upload policy"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'task-attachments'
  AND public.safe_uuid((storage.foldername(name))[1]) IS NOT NULL
  AND public.can_attach_to_task(public.safe_uuid((storage.foldername(name))[1]))
);

DROP POLICY IF EXISTS "Task attachments read policy" ON storage.objects;
CREATE POLICY "Task attachments read policy"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'task-attachments'
  AND public.safe_uuid((storage.foldername(name))[1]) IS NOT NULL
  AND public.can_access_task(public.safe_uuid((storage.foldername(name))[1]))
);

DROP POLICY IF EXISTS "Task attachments delete policy" ON storage.objects;
CREATE POLICY "Task attachments delete policy"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'task-attachments'
  AND public.safe_uuid((storage.foldername(name))[1]) IS NOT NULL
  AND public.can_attach_to_task(public.safe_uuid((storage.foldername(name))[1]))
);

-- ============================================================
-- 7. Realtime publication
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;
  EXCEPTION
    WHEN duplicate_object THEN NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.task_comments;
  EXCEPTION
    WHEN duplicate_object THEN NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.task_attachments;
  EXCEPTION
    WHEN duplicate_object THEN NULL;
  END;
END $$;
