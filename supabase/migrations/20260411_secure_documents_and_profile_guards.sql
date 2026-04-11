-- Secure client document storage and close profile privilege-escalation gaps.

-- ============================================================
-- 1. Harden profile self-updates
-- ============================================================

CREATE OR REPLACE FUNCTION public.enforce_profile_self_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor_id UUID := auth.uid();
  actor_role TEXT;
BEGIN
  IF actor_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT public.normalize_agency_role(role)
  INTO actor_role
  FROM public.profiles
  WHERE id = actor_id;

  IF actor_role = 'admin' THEN
    RETURN NEW;
  END IF;

  IF actor_id <> OLD.id THEN
    RAISE EXCEPTION 'You are not allowed to edit this profile';
  END IF;

  IF NEW.role IS DISTINCT FROM OLD.role
    OR NEW.email IS DISTINCT FROM OLD.email
    OR NEW.associated_client_id IS DISTINCT FROM OLD.associated_client_id
    OR NEW.id IS DISTINCT FROM OLD.id
    OR NEW.created_at IS DISTINCT FROM OLD.created_at
  THEN
    RAISE EXCEPTION 'Only admins can change role, email, or client association';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_enforce_profile_self_update ON public.profiles;
CREATE TRIGGER tr_enforce_profile_self_update
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_profile_self_update();

DROP POLICY IF EXISTS "Users can update their own profiles" ON public.profiles;
CREATE POLICY "Users can update their own profiles"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id OR public.is_admin())
  WITH CHECK (auth.uid() = id OR public.is_admin());

-- ============================================================
-- 2. Client document schema parity
-- ============================================================

ALTER TABLE public.client_documents
  ADD COLUMN IF NOT EXISTS mime_type TEXT,
  ADD COLUMN IF NOT EXISTS uploaded_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now());

UPDATE public.client_documents
SET updated_at = COALESCE(updated_at, created_at, timezone('utc'::text, now()))
WHERE updated_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_client_documents_client_created_at
  ON public.client_documents(client_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.touch_client_document_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := timezone('utc'::text, now());

  IF NEW.uploaded_by IS NULL THEN
    NEW.uploaded_by := auth.uid();
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_touch_client_document_updated_at ON public.client_documents;
CREATE TRIGGER tr_touch_client_document_updated_at
  BEFORE INSERT OR UPDATE ON public.client_documents
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_client_document_updated_at();

CREATE OR REPLACE FUNCTION public.can_manage_client_documents(
  p_client_id UUID,
  p_user_id UUID DEFAULT auth.uid()
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = COALESCE(p_user_id, auth.uid())
      AND (
        public.normalize_agency_role(p.role) = 'admin'
        OR (
          public.normalize_agency_role(p.role) IN ('team', 'seo', 'content', 'developer')
          AND public.can_manage_client_data(p_client_id, p.id)
        )
      )
  );
$$;

DROP POLICY IF EXISTS "Allow full access to admins" ON public.client_documents;
DROP POLICY IF EXISTS "Allow view access to matching team members" ON public.client_documents;
DROP POLICY IF EXISTS "Allow view access to clients for their own docs" ON public.client_documents;
DROP POLICY IF EXISTS "Team members can view assigned client documents" ON public.client_documents;

CREATE POLICY "Client documents are readable by scoped users"
  ON public.client_documents
  FOR SELECT
  TO authenticated
  USING (public.can_access_client(client_id));

CREATE POLICY "Client documents can be inserted by scoped staff"
  ON public.client_documents
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.can_manage_client_documents(client_id)
    AND COALESCE(uploaded_by, auth.uid()) = auth.uid()
  );

CREATE POLICY "Client documents can be updated by scoped staff"
  ON public.client_documents
  FOR UPDATE
  TO authenticated
  USING (public.can_manage_client_documents(client_id))
  WITH CHECK (public.can_manage_client_documents(client_id));

CREATE POLICY "Client documents can be deleted by scoped staff"
  ON public.client_documents
  FOR DELETE
  TO authenticated
  USING (public.can_manage_client_documents(client_id));

-- ============================================================
-- 3. Private client document bucket + storage policies
-- ============================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('client-documents', 'client-documents', false)
ON CONFLICT (id) DO UPDATE SET public = false;

DROP POLICY IF EXISTS "Client documents upload policy" ON storage.objects;
CREATE POLICY "Client documents upload policy"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'client-documents'
  AND public.safe_uuid((storage.foldername(name))[1]) IS NOT NULL
  AND public.can_manage_client_documents(public.safe_uuid((storage.foldername(name))[1]))
);

DROP POLICY IF EXISTS "Client documents read policy" ON storage.objects;
CREATE POLICY "Client documents read policy"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'client-documents'
  AND public.safe_uuid((storage.foldername(name))[1]) IS NOT NULL
  AND public.can_access_client(public.safe_uuid((storage.foldername(name))[1]))
);

DROP POLICY IF EXISTS "Client documents update policy" ON storage.objects;
CREATE POLICY "Client documents update policy"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'client-documents'
  AND public.safe_uuid((storage.foldername(name))[1]) IS NOT NULL
  AND public.can_manage_client_documents(public.safe_uuid((storage.foldername(name))[1]))
)
WITH CHECK (
  bucket_id = 'client-documents'
  AND public.safe_uuid((storage.foldername(name))[1]) IS NOT NULL
  AND public.can_manage_client_documents(public.safe_uuid((storage.foldername(name))[1]))
);

DROP POLICY IF EXISTS "Client documents delete policy" ON storage.objects;
CREATE POLICY "Client documents delete policy"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'client-documents'
  AND public.safe_uuid((storage.foldername(name))[1]) IS NOT NULL
  AND public.can_manage_client_documents(public.safe_uuid((storage.foldername(name))[1]))
);

-- ============================================================
-- 4. Realtime publication
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.client_documents;
  EXCEPTION
    WHEN duplicate_object THEN NULL;
  END;
END $$;

-- ============================================================
-- 5. Duplicate-client protection
-- ============================================================

CREATE OR REPLACE FUNCTION public.prevent_duplicate_client_records()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  normalized_firm_name TEXT := lower(regexp_replace(btrim(coalesce(NEW.firm_name, '')), '\s+', ' ', 'g'));
  normalized_email TEXT := lower(btrim(coalesce(NEW.contact_email, '')));
BEGIN
  IF normalized_firm_name = '' THEN
    RAISE EXCEPTION 'Client firm name is required';
  END IF;

  IF normalized_email <> '' AND EXISTS (
    SELECT 1
    FROM public.clients c
    WHERE c.id <> NEW.id
      AND lower(btrim(coalesce(c.contact_email, ''))) = normalized_email
  ) THEN
    RAISE EXCEPTION 'A client with this contact email already exists';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.clients c
    WHERE c.id <> NEW.id
      AND lower(regexp_replace(btrim(coalesce(c.firm_name, '')), '\s+', ' ', 'g')) = normalized_firm_name
  ) THEN
    RAISE EXCEPTION 'A client with this firm name already exists';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_prevent_duplicate_client_records ON public.clients;
CREATE TRIGGER tr_prevent_duplicate_client_records
  BEFORE INSERT OR UPDATE OF firm_name, contact_email ON public.clients
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_duplicate_client_records();

-- ============================================================
-- 6. Task transition guardrails
-- ============================================================

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION public.enforce_task_transition_rules()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status IN ('in_progress', 'done') AND NEW.assigned_to_user_id IS NULL THEN
      RAISE EXCEPTION 'Task must be assigned before it can start or complete';
    END IF;

    IF NEW.status = 'in_progress' THEN
      NEW.started_at := COALESCE(NEW.started_at, timezone('utc'::text, now()));
    ELSIF NEW.status = 'done' THEN
      NEW.started_at := COALESCE(NEW.started_at, timezone('utc'::text, now()));
      NEW.completed_at := COALESCE(NEW.completed_at, timezone('utc'::text, now()));
    END IF;

    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF OLD.status = 'todo' AND NEW.status NOT IN ('in_progress', 'done') THEN
      RAISE EXCEPTION 'Tasks can only move from todo to in_progress or done';
    END IF;

    IF OLD.status = 'in_progress' AND NEW.status NOT IN ('todo', 'done') THEN
      RAISE EXCEPTION 'Tasks in progress can only move back to todo or forward to done';
    END IF;

    IF OLD.status = 'done' AND NEW.status NOT IN ('done', 'in_progress') THEN
      RAISE EXCEPTION 'Completed tasks can only stay done or be reopened to in_progress';
    END IF;

    IF NEW.status IN ('in_progress', 'done') AND COALESCE(NEW.assigned_to_user_id, OLD.assigned_to_user_id) IS NULL THEN
      RAISE EXCEPTION 'Assigned owner is required before a task can start or complete';
    END IF;

    IF NEW.status = 'in_progress' THEN
      NEW.started_at := COALESCE(OLD.started_at, timezone('utc'::text, now()));
      NEW.completed_at := NULL;
    ELSIF NEW.status = 'done' THEN
      NEW.started_at := COALESCE(OLD.started_at, NEW.started_at, timezone('utc'::text, now()));
      NEW.completed_at := COALESCE(NEW.completed_at, timezone('utc'::text, now()));
    ELSE
      NEW.completed_at := NULL;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_enforce_task_transition_rules ON public.tasks;
CREATE TRIGGER tr_enforce_task_transition_rules
  BEFORE INSERT OR UPDATE OF status, assigned_to_user_id ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_task_transition_rules();

-- ============================================================
-- 7. Server-side messaging authorization
-- ============================================================

CREATE OR REPLACE FUNCTION public.can_message_profile(
  p_sender_id UUID,
  p_receiver_id UUID
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH sender AS (
    SELECT
      p.id,
      public.normalize_agency_role(p.role) AS role,
      p.associated_client_id
    FROM public.profiles p
    WHERE p.id = p_sender_id
  ),
  receiver AS (
    SELECT
      p.id,
      public.normalize_agency_role(p.role) AS role,
      p.associated_client_id
    FROM public.profiles p
    WHERE p.id = p_receiver_id
  )
  SELECT EXISTS (
    SELECT 1
    FROM sender s
    JOIN receiver r ON TRUE
    WHERE s.id IS NOT NULL
      AND r.id IS NOT NULL
      AND s.id <> r.id
      AND (
        s.role = 'admin'
        OR r.role = 'admin'
        OR (
          s.role = 'client'
          AND r.role IN ('team', 'seo', 'content', 'developer')
          AND s.associated_client_id IS NOT NULL
          AND (
            EXISTS (
              SELECT 1
              FROM public.clients c
              WHERE c.id = s.associated_client_id
                AND c.assigned_team_member_id = r.id
            )
            OR EXISTS (
              SELECT 1
              FROM public.team_assigned_clients tac
              WHERE tac.client_id = s.associated_client_id
                AND tac.team_member_id = r.id
            )
          )
        )
        OR (
          s.role IN ('team', 'seo', 'content', 'developer')
          AND r.role = 'client'
          AND r.associated_client_id IS NOT NULL
          AND (
            EXISTS (
              SELECT 1
              FROM public.clients c
              WHERE c.id = r.associated_client_id
                AND c.assigned_team_member_id = s.id
            )
            OR EXISTS (
              SELECT 1
              FROM public.team_assigned_clients tac
              WHERE tac.client_id = r.associated_client_id
                AND tac.team_member_id = s.id
            )
          )
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.upsert_conversation_v1(
  p_participant_ids UUID[],
  p_title TEXT DEFAULT NULL,
  p_client_id UUID DEFAULT NULL,
  p_context_type TEXT DEFAULT NULL,
  p_context_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id UUID := auth.uid();
  v_conversation_id UUID;
  v_participant_id UUID;
  v_unique_participants UUID[];
BEGIN
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT ARRAY(
    SELECT DISTINCT participant_id
    FROM unnest(COALESCE(p_participant_ids, ARRAY[]::UUID[])) AS participant_id
    WHERE participant_id IS NOT NULL
    ORDER BY participant_id
  )
  INTO v_unique_participants;

  IF array_length(v_unique_participants, 1) IS NULL OR array_length(v_unique_participants, 1) < 2 THEN
    RAISE EXCEPTION 'At least two unique participants are required';
  END IF;

  IF NOT (v_actor_id = ANY(v_unique_participants)) THEN
    RAISE EXCEPTION 'Authenticated user must be included in the conversation';
  END IF;

  FOREACH v_participant_id IN ARRAY v_unique_participants
  LOOP
    IF v_participant_id = v_actor_id THEN
      CONTINUE;
    END IF;

    IF NOT public.can_message_profile(v_actor_id, v_participant_id) THEN
      RAISE EXCEPTION 'You are not allowed to start a conversation with participant %', v_participant_id;
    END IF;
  END LOOP;

  IF p_context_id IS NOT NULL THEN
    SELECT c.id INTO v_conversation_id
    FROM public.conversations c
    JOIN public.conversation_participants cp ON c.id = cp.conversation_id
    WHERE c.context_id = p_context_id
      AND c.context_type = p_context_type
    GROUP BY c.id
    HAVING array_agg(cp.profile_id ORDER BY cp.profile_id) = v_unique_participants;
  END IF;

  IF v_conversation_id IS NULL THEN
    SELECT c.id INTO v_conversation_id
    FROM public.conversations c
    JOIN public.conversation_participants cp ON c.id = cp.conversation_id
    WHERE c.context_id IS NULL
    GROUP BY c.id
    HAVING array_agg(cp.profile_id ORDER BY cp.profile_id) = v_unique_participants;
  END IF;

  IF v_conversation_id IS NULL THEN
    INSERT INTO public.conversations (title, client_id, context_type, context_id)
    VALUES (p_title, p_client_id, p_context_type, p_context_id)
    RETURNING id INTO v_conversation_id;

    INSERT INTO public.conversation_participants (conversation_id, profile_id)
    SELECT v_conversation_id, participant_id
    FROM unnest(v_unique_participants) AS participant_id;
  ELSE
    UPDATE public.conversations
    SET is_archived = false,
        updated_at = timezone('utc'::text, now())
    WHERE id = v_conversation_id;
  END IF;

  RETURN v_conversation_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.add_conversation_participant_v1(
  p_conversation_id UUID,
  p_profile_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id UUID := auth.uid();
  v_actor_role TEXT;
BEGIN
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT public.normalize_agency_role(role)
  INTO v_actor_role
  FROM public.profiles
  WHERE id = v_actor_id;

  IF NOT EXISTS (
    SELECT 1
    FROM public.conversation_participants
    WHERE conversation_id = p_conversation_id
      AND profile_id = v_actor_id
  ) AND v_actor_role <> 'admin' THEN
    RAISE EXCEPTION 'Not authorized to invite to this conversation';
  END IF;

  IF v_actor_role <> 'admin' AND NOT public.can_message_profile(v_actor_id, p_profile_id) THEN
    RAISE EXCEPTION 'You are not allowed to add this participant';
  END IF;

  INSERT INTO public.conversation_participants (conversation_id, profile_id)
  VALUES (p_conversation_id, p_profile_id)
  ON CONFLICT (conversation_id, profile_id) DO NOTHING;
END;
$$;

-- ============================================================
-- 8. Idempotent message sends
-- ============================================================

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS client_message_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_messages_sender_client_message_id
  ON public.messages(sender_id, client_message_id)
  WHERE client_message_id IS NOT NULL;

DROP FUNCTION IF EXISTS public.send_message_v2(UUID, TEXT, TEXT, TEXT, TEXT, INTEGER, TEXT, UUID);
DROP FUNCTION IF EXISTS public.send_message_v2(UUID, TEXT, TEXT, TEXT, TEXT, INTEGER, TEXT, UUID, TEXT);

CREATE OR REPLACE FUNCTION public.send_message_v2(
  p_conversation_id UUID,
  p_content TEXT,
  p_message_type TEXT DEFAULT 'text',
  p_file_url TEXT DEFAULT NULL,
  p_file_name TEXT DEFAULT NULL,
  p_file_size INTEGER DEFAULT NULL,
  p_mime_type TEXT DEFAULT NULL,
  p_meeting_id UUID DEFAULT NULL,
  p_client_message_id TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_message_id UUID;
  v_existing_id UUID;
  v_sender_id UUID := auth.uid();
BEGIN
  IF v_sender_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.conversation_participants
    WHERE conversation_id = p_conversation_id
      AND profile_id = v_sender_id
  ) AND NOT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = v_sender_id
      AND public.normalize_agency_role(role) = 'admin'
  ) THEN
    RAISE EXCEPTION 'Not authorized to send messages in this conversation';
  END IF;

  IF p_client_message_id IS NOT NULL THEN
    SELECT id
    INTO v_existing_id
    FROM public.messages
    WHERE sender_id = v_sender_id
      AND client_message_id = p_client_message_id
    LIMIT 1;

    IF v_existing_id IS NOT NULL THEN
      RETURN v_existing_id;
    END IF;
  END IF;

  INSERT INTO public.messages (
    conversation_id,
    sender_id,
    content,
    message_type,
    file_url,
    file_name,
    file_size,
    mime_type,
    meeting_id,
    client_message_id,
    status
  )
  VALUES (
    p_conversation_id,
    v_sender_id,
    p_content,
    p_message_type,
    p_file_url,
    p_file_name,
    p_file_size,
    p_mime_type,
    p_meeting_id,
    p_client_message_id,
    'sent'
  )
  RETURNING id INTO v_message_id;

  UPDATE public.conversations
  SET updated_at = timezone('utc'::text, now())
  WHERE id = p_conversation_id;

  RETURN v_message_id;
END;
$$;
