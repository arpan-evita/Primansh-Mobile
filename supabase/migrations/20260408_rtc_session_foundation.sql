-- Phase 1 foundation for the Primansh communication layer.
-- Supabase remains the control plane while media can be migrated
-- from mesh WebRTC to an SFU without changing the session contract.

CREATE TABLE IF NOT EXISTS public.rtc_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE,
    session_class TEXT NOT NULL CHECK (session_class IN ('call', 'meeting')),
    call_type TEXT CHECK (call_type IN ('one_to_one', 'group')),
    meeting_type TEXT CHECK (meeting_type IN ('instant', 'scheduled')),
    media_mode TEXT NOT NULL CHECK (media_mode IN ('audio', 'video')),
    title TEXT,
    initiator_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    host_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'created' CHECK (
        status IN (
            'created',
            'scheduled',
            'inviting',
            'ringing',
            'connecting',
            'active',
            'reconnecting',
            'ended',
            'rejected',
            'missed',
            'canceled',
            'failed'
        )
    ),
    scheduled_start_at TIMESTAMPTZ,
    started_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    ring_expires_at TIMESTAMPTZ,
    room_name TEXT NOT NULL UNIQUE,
    provider TEXT NOT NULL DEFAULT 'livekit',
    recording_enabled BOOLEAN NOT NULL DEFAULT false,
    screen_share_enabled BOOLEAN NOT NULL DEFAULT true,
    conversation_message_id UUID REFERENCES public.messages(id) ON DELETE SET NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.rtc_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES public.rtc_sessions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    session_role TEXT NOT NULL DEFAULT 'participant' CHECK (session_role IN ('host', 'moderator', 'participant')),
    invite_state TEXT NOT NULL DEFAULT 'pending' CHECK (
        invite_state IN ('pending', 'ringing', 'accepted', 'rejected', 'missed', 'canceled', 'joined', 'left', 'removed')
    ),
    joined_at TIMESTAMPTZ,
    left_at TIMESTAMPTZ,
    left_reason TEXT,
    device_count INTEGER NOT NULL DEFAULT 0,
    is_muted BOOLEAN NOT NULL DEFAULT false,
    is_video_enabled BOOLEAN NOT NULL DEFAULT false,
    is_hand_raised BOOLEAN NOT NULL DEFAULT false,
    last_network_quality TEXT,
    last_seen_at TIMESTAMPTZ,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (session_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.rtc_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES public.rtc_sessions(id) ON DELETE CASCADE,
    participant_id UUID REFERENCES public.rtc_participants(id) ON DELETE SET NULL,
    event_type TEXT NOT NULL,
    actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    target_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rtc_sessions_conversation_id ON public.rtc_sessions(conversation_id);
CREATE INDEX IF NOT EXISTS idx_rtc_sessions_status ON public.rtc_sessions(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rtc_sessions_initiator ON public.rtc_sessions(initiator_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rtc_participants_session_id ON public.rtc_participants(session_id);
CREATE INDEX IF NOT EXISTS idx_rtc_participants_user_id ON public.rtc_participants(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_rtc_events_session_id ON public.rtc_events(session_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rtc_events_target_user_id ON public.rtc_events(target_user_id, created_at DESC);

DROP TRIGGER IF EXISTS update_rtc_sessions_updated_at ON public.rtc_sessions;
CREATE TRIGGER update_rtc_sessions_updated_at
    BEFORE UPDATE ON public.rtc_sessions
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_rtc_participants_updated_at ON public.rtc_participants;
CREATE TRIGGER update_rtc_participants_updated_at
    BEFORE UPDATE ON public.rtc_participants
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.is_admin_v1(p_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.profiles
        WHERE id = p_user_id
          AND lower(coalesce(role, '')) = 'admin'
    );
$$;

CREATE OR REPLACE FUNCTION public.can_access_conversation_v1(
    p_conversation_id UUID,
    p_user_id UUID DEFAULT auth.uid()
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT
        p_conversation_id IS NOT NULL
        AND (
            public.is_admin_v1(p_user_id)
            OR EXISTS (
                SELECT 1
                FROM public.conversation_participants cp
                WHERE cp.conversation_id = p_conversation_id
                  AND cp.profile_id = p_user_id
            )
        );
$$;

CREATE OR REPLACE FUNCTION public.can_access_rtc_session_v1(
    p_session_id UUID,
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
        FROM public.rtc_sessions s
        WHERE s.id = p_session_id
          AND (
              public.is_admin_v1(p_user_id)
              OR EXISTS (
                  SELECT 1
                  FROM public.rtc_participants rp
                  WHERE rp.session_id = s.id
                    AND rp.user_id = p_user_id
              )
              OR public.can_access_conversation_v1(s.conversation_id, p_user_id)
          )
    );
$$;

CREATE OR REPLACE FUNCTION public.insert_rtc_event_v1(
    p_session_id UUID,
    p_event_type TEXT,
    p_actor_id UUID DEFAULT auth.uid(),
    p_target_user_id UUID DEFAULT NULL,
    p_payload JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_event_id UUID;
    v_participant_id UUID;
BEGIN
    SELECT id
    INTO v_participant_id
    FROM public.rtc_participants
    WHERE session_id = p_session_id
      AND user_id = p_actor_id
    LIMIT 1;

    INSERT INTO public.rtc_events (
        session_id,
        participant_id,
        event_type,
        actor_id,
        target_user_id,
        payload
    )
    VALUES (
        p_session_id,
        v_participant_id,
        p_event_type,
        p_actor_id,
        p_target_user_id,
        coalesce(p_payload, '{}'::jsonb)
    )
    RETURNING id INTO v_event_id;

    RETURN v_event_id;
END;
$$;

ALTER TABLE public.rtc_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rtc_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rtc_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view rtc sessions" ON public.rtc_sessions;
CREATE POLICY "Users can view rtc sessions"
    ON public.rtc_sessions
    FOR SELECT
    USING (public.can_access_rtc_session_v1(id, auth.uid()));

DROP POLICY IF EXISTS "Users can view rtc participants" ON public.rtc_participants;
CREATE POLICY "Users can view rtc participants"
    ON public.rtc_participants
    FOR SELECT
    USING (public.can_access_rtc_session_v1(session_id, auth.uid()));

DROP POLICY IF EXISTS "Users can update their rtc participant flags" ON public.rtc_participants;
CREATE POLICY "Users can update their rtc participant flags"
    ON public.rtc_participants
    FOR UPDATE
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can view rtc events" ON public.rtc_events;
CREATE POLICY "Users can view rtc events"
    ON public.rtc_events
    FOR SELECT
    USING (public.can_access_rtc_session_v1(session_id, auth.uid()));

CREATE OR REPLACE FUNCTION public.start_rtc_session_v1(
    p_conversation_id UUID,
    p_session_class TEXT,
    p_media_mode TEXT DEFAULT 'audio',
    p_call_type TEXT DEFAULT NULL,
    p_meeting_type TEXT DEFAULT NULL,
    p_title TEXT DEFAULT NULL,
    p_scheduled_start_at TIMESTAMPTZ DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}'::jsonb,
    p_ring_timeout_seconds INTEGER DEFAULT 30
)
RETURNS public.rtc_sessions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_existing public.rtc_sessions;
    v_session public.rtc_sessions;
    v_session_id UUID := gen_random_uuid();
    v_status TEXT;
    v_room_name TEXT := 'rtc-' || replace(v_session_id::text, '-', '');
    v_participant_ids UUID[];
    v_participant_count INTEGER;
    v_target_user_id UUID;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    IF p_session_class NOT IN ('call', 'meeting') THEN
        RAISE EXCEPTION 'Invalid session_class';
    END IF;

    IF p_media_mode NOT IN ('audio', 'video') THEN
        RAISE EXCEPTION 'Invalid media_mode';
    END IF;

    IF NOT public.can_access_conversation_v1(p_conversation_id, auth.uid()) THEN
        RAISE EXCEPTION 'Not authorized to start a communication session for this conversation';
    END IF;

    SELECT array_agg(pid ORDER BY pid), count(*)
    INTO v_participant_ids, v_participant_count
    FROM (
        SELECT DISTINCT cp.profile_id AS pid
        FROM public.conversation_participants cp
        WHERE cp.conversation_id = p_conversation_id

        UNION

        SELECT auth.uid() AS pid
    ) participants;

    IF v_participant_count IS NULL OR v_participant_count = 0 THEN
        RAISE EXCEPTION 'Conversation has no participants';
    END IF;

    IF p_session_class = 'call' AND v_participant_count < 2 THEN
        RAISE EXCEPTION 'Voice calls require at least two participants';
    END IF;

    SELECT *
    INTO v_existing
    FROM public.rtc_sessions s
    WHERE s.conversation_id = p_conversation_id
      AND s.session_class = p_session_class
      AND s.media_mode = p_media_mode
      AND coalesce(s.call_type, '') = coalesce(p_call_type, '')
      AND coalesce(s.meeting_type, '') = coalesce(p_meeting_type, '')
      AND s.status IN ('created', 'inviting', 'ringing', 'connecting', 'active', 'reconnecting')
    ORDER BY s.created_at DESC
    LIMIT 1;

    IF v_existing.id IS NOT NULL THEN
        RETURN v_existing;
    END IF;

    v_status := CASE
        WHEN p_meeting_type = 'scheduled' AND p_scheduled_start_at IS NOT NULL AND p_scheduled_start_at > now() THEN 'scheduled'
        WHEN p_session_class = 'call' THEN 'ringing'
        WHEN p_session_class = 'meeting' THEN 'connecting'
        ELSE 'created'
    END;

    INSERT INTO public.rtc_sessions (
        id,
        conversation_id,
        session_class,
        call_type,
        meeting_type,
        media_mode,
        title,
        initiator_id,
        host_id,
        status,
        scheduled_start_at,
        ring_expires_at,
        room_name,
        metadata
    )
    VALUES (
        v_session_id,
        p_conversation_id,
        p_session_class,
        p_call_type,
        p_meeting_type,
        p_media_mode,
        p_title,
        auth.uid(),
        auth.uid(),
        v_status,
        p_scheduled_start_at,
        CASE
            WHEN p_session_class = 'call' THEN now() + make_interval(secs => greatest(5, coalesce(p_ring_timeout_seconds, 30)))
            ELSE NULL
        END,
        v_room_name,
        coalesce(p_metadata, '{}'::jsonb)
    )
    RETURNING * INTO v_session;

    INSERT INTO public.rtc_participants (
        session_id,
        user_id,
        session_role,
        invite_state,
        last_seen_at
    )
    SELECT
        v_session.id,
        participant_id,
        CASE WHEN participant_id = auth.uid() THEN 'host' ELSE 'participant' END,
        CASE
            WHEN participant_id = auth.uid() THEN 'accepted'
            WHEN p_session_class = 'call' THEN 'ringing'
            WHEN v_status = 'scheduled' THEN 'pending'
            ELSE 'pending'
        END,
        now()
    FROM unnest(v_participant_ids) AS participant_id
    ON CONFLICT (session_id, user_id) DO NOTHING;

    IF p_session_class = 'call' THEN
        PERFORM public.insert_rtc_event_v1(
            v_session.id,
            'call_initiated',
            auth.uid(),
            NULL,
            jsonb_build_object(
                'conversation_id', p_conversation_id,
                'call_type', coalesce(p_call_type, 'one_to_one'),
                'media_mode', p_media_mode
            )
        );

        FOREACH v_target_user_id IN ARRAY v_participant_ids
        LOOP
            IF v_target_user_id <> auth.uid() THEN
                PERFORM public.insert_rtc_event_v1(
                    v_session.id,
                    'call_ringing',
                    auth.uid(),
                    v_target_user_id,
                    jsonb_build_object(
                        'conversation_id', p_conversation_id,
                        'ring_expires_at', v_session.ring_expires_at,
                        'media_mode', p_media_mode
                    )
                );
            END IF;
        END LOOP;
    ELSIF v_status = 'scheduled' THEN
        PERFORM public.insert_rtc_event_v1(
            v_session.id,
            'meeting_scheduled',
            auth.uid(),
            NULL,
            jsonb_build_object(
                'conversation_id', p_conversation_id,
                'scheduled_start_at', p_scheduled_start_at,
                'title', coalesce(p_title, 'Scheduled Meeting')
            )
        );
    ELSE
        PERFORM public.insert_rtc_event_v1(
            v_session.id,
            'meeting_started',
            auth.uid(),
            NULL,
            jsonb_build_object(
                'conversation_id', p_conversation_id,
                'media_mode', p_media_mode,
                'title', p_title
            )
        );
    END IF;

    RETURN v_session;
END;
$$;

CREATE OR REPLACE FUNCTION public.accept_rtc_session_v1(
    p_session_id UUID
)
RETURNS public.rtc_sessions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_session public.rtc_sessions;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    SELECT *
    INTO v_session
    FROM public.rtc_sessions
    WHERE id = p_session_id;

    IF v_session.id IS NULL THEN
        RAISE EXCEPTION 'Session not found';
    END IF;

    IF NOT public.can_access_rtc_session_v1(p_session_id, auth.uid()) THEN
        RAISE EXCEPTION 'Not authorized to accept this session';
    END IF;

    UPDATE public.rtc_participants
    SET
        invite_state = CASE
            WHEN invite_state IN ('ringing', 'pending', 'missed') THEN 'accepted'
            ELSE invite_state
        END,
        last_seen_at = now()
    WHERE session_id = p_session_id
      AND user_id = auth.uid();

    IF v_session.status IN ('created', 'inviting', 'ringing') THEN
        UPDATE public.rtc_sessions
        SET status = 'connecting'
        WHERE id = p_session_id;
    END IF;

    PERFORM public.insert_rtc_event_v1(
        p_session_id,
        'call_accepted',
        auth.uid(),
        v_session.initiator_id,
        jsonb_build_object('status', 'connecting')
    );

    SELECT *
    INTO v_session
    FROM public.rtc_sessions
    WHERE id = p_session_id;

    RETURN v_session;
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_rtc_session_v1(
    p_session_id UUID
)
RETURNS public.rtc_sessions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_session public.rtc_sessions;
    v_open_remote_count INTEGER;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    SELECT *
    INTO v_session
    FROM public.rtc_sessions
    WHERE id = p_session_id;

    IF v_session.id IS NULL THEN
        RAISE EXCEPTION 'Session not found';
    END IF;

    IF NOT public.can_access_rtc_session_v1(p_session_id, auth.uid()) THEN
        RAISE EXCEPTION 'Not authorized to reject this session';
    END IF;

    UPDATE public.rtc_participants
    SET
        invite_state = 'rejected',
        left_at = coalesce(left_at, now()),
        left_reason = 'rejected',
        last_seen_at = now()
    WHERE session_id = p_session_id
      AND user_id = auth.uid();

    PERFORM public.insert_rtc_event_v1(
        p_session_id,
        'call_rejected',
        auth.uid(),
        v_session.initiator_id,
        jsonb_build_object('user_id', auth.uid())
    );

    IF v_session.session_class = 'call' THEN
        SELECT count(*)
        INTO v_open_remote_count
        FROM public.rtc_participants rp
        WHERE rp.session_id = p_session_id
          AND rp.user_id <> v_session.initiator_id
          AND rp.invite_state IN ('ringing', 'pending', 'accepted', 'joined');

        IF v_open_remote_count = 0 THEN
            UPDATE public.rtc_sessions
            SET
                status = 'rejected',
                ended_at = coalesce(ended_at, now())
            WHERE id = p_session_id;
        END IF;
    END IF;

    SELECT *
    INTO v_session
    FROM public.rtc_sessions
    WHERE id = p_session_id;

    RETURN v_session;
END;
$$;

CREATE OR REPLACE FUNCTION public.join_rtc_session_v1(
    p_session_id UUID,
    p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS public.rtc_sessions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_session public.rtc_sessions;
    v_joined_count INTEGER;
    v_next_status TEXT;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    SELECT *
    INTO v_session
    FROM public.rtc_sessions
    WHERE id = p_session_id;

    IF v_session.id IS NULL THEN
        RAISE EXCEPTION 'Session not found';
    END IF;

    IF v_session.status IN ('ended', 'rejected', 'missed', 'canceled', 'failed') THEN
        RAISE EXCEPTION 'This session is no longer joinable';
    END IF;

    IF NOT public.can_access_rtc_session_v1(p_session_id, auth.uid()) THEN
        RAISE EXCEPTION 'Not authorized to join this session';
    END IF;

    UPDATE public.rtc_participants
    SET
        invite_state = 'joined',
        joined_at = coalesce(joined_at, now()),
        left_at = NULL,
        left_reason = NULL,
        device_count = greatest(device_count, 0) + 1,
        last_seen_at = now(),
        metadata = coalesce(metadata, '{}'::jsonb) || coalesce(p_metadata, '{}'::jsonb)
    WHERE session_id = p_session_id
      AND user_id = auth.uid();

    SELECT count(*)
    INTO v_joined_count
    FROM public.rtc_participants
    WHERE session_id = p_session_id
      AND invite_state = 'joined';

    v_next_status := CASE
        WHEN v_session.session_class = 'call' AND v_joined_count >= 2 THEN 'active'
        WHEN v_session.session_class = 'call' THEN 'connecting'
        ELSE 'active'
    END;

    UPDATE public.rtc_sessions
    SET
        started_at = coalesce(started_at, now()),
        status = v_next_status
    WHERE id = p_session_id;

    PERFORM public.insert_rtc_event_v1(
        p_session_id,
        'user_joined',
        auth.uid(),
        NULL,
        jsonb_build_object('joined_count', v_joined_count)
    );

    SELECT *
    INTO v_session
    FROM public.rtc_sessions
    WHERE id = p_session_id;

    RETURN v_session;
END;
$$;

CREATE OR REPLACE FUNCTION public.leave_rtc_session_v1(
    p_session_id UUID,
    p_reason TEXT DEFAULT 'left'
)
RETURNS public.rtc_sessions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_session public.rtc_sessions;
    v_joined_count INTEGER;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    SELECT *
    INTO v_session
    FROM public.rtc_sessions
    WHERE id = p_session_id;

    IF v_session.id IS NULL THEN
        RAISE EXCEPTION 'Session not found';
    END IF;

    IF NOT public.can_access_rtc_session_v1(p_session_id, auth.uid()) THEN
        RAISE EXCEPTION 'Not authorized to leave this session';
    END IF;

    UPDATE public.rtc_participants
    SET
        invite_state = 'left',
        left_at = coalesce(left_at, now()),
        left_reason = coalesce(p_reason, 'left'),
        device_count = greatest(device_count - 1, 0),
        last_seen_at = now()
    WHERE session_id = p_session_id
      AND user_id = auth.uid();

    SELECT count(*)
    INTO v_joined_count
    FROM public.rtc_participants
    WHERE session_id = p_session_id
      AND invite_state = 'joined';

    IF v_joined_count = 0 THEN
        UPDATE public.rtc_sessions
        SET
            status = 'ended',
            ended_at = coalesce(ended_at, now())
        WHERE id = p_session_id;
    ELSIF v_session.session_class = 'call' AND v_joined_count < 2 THEN
        UPDATE public.rtc_sessions
        SET status = 'connecting'
        WHERE id = p_session_id;
    END IF;

    PERFORM public.insert_rtc_event_v1(
        p_session_id,
        'user_left',
        auth.uid(),
        NULL,
        jsonb_build_object('reason', coalesce(p_reason, 'left'))
    );

    SELECT *
    INTO v_session
    FROM public.rtc_sessions
    WHERE id = p_session_id;

    RETURN v_session;
END;
$$;

CREATE OR REPLACE FUNCTION public.end_rtc_session_v1(
    p_session_id UUID,
    p_for_all BOOLEAN DEFAULT true
)
RETURNS public.rtc_sessions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_session public.rtc_sessions;
    v_is_host BOOLEAN;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    SELECT *
    INTO v_session
    FROM public.rtc_sessions
    WHERE id = p_session_id;

    IF v_session.id IS NULL THEN
        RAISE EXCEPTION 'Session not found';
    END IF;

    IF NOT public.can_access_rtc_session_v1(p_session_id, auth.uid()) THEN
        RAISE EXCEPTION 'Not authorized to end this session';
    END IF;

    SELECT EXISTS (
        SELECT 1
        FROM public.rtc_participants rp
        WHERE rp.session_id = p_session_id
          AND rp.user_id = auth.uid()
          AND rp.session_role IN ('host', 'moderator')
    ) OR public.is_admin_v1(auth.uid())
    INTO v_is_host;

    IF NOT p_for_all THEN
        RETURN public.leave_rtc_session_v1(p_session_id, 'left');
    END IF;

    IF NOT v_is_host AND auth.uid() <> v_session.initiator_id THEN
        RAISE EXCEPTION 'Only the host or initiator can end this session for everyone';
    END IF;

    UPDATE public.rtc_sessions
    SET
        status = 'ended',
        ended_at = coalesce(ended_at, now())
    WHERE id = p_session_id;

    UPDATE public.rtc_participants
    SET
        invite_state = CASE
            WHEN invite_state IN ('ringing', 'pending', 'accepted') THEN 'canceled'
            WHEN invite_state = 'joined' THEN 'left'
            ELSE invite_state
        END,
        left_at = CASE
            WHEN invite_state = 'joined' THEN coalesce(left_at, now())
            ELSE left_at
        END,
        left_reason = CASE
            WHEN invite_state = 'joined' THEN coalesce(left_reason, 'ended_for_all')
            ELSE left_reason
        END,
        last_seen_at = now()
    WHERE session_id = p_session_id;

    PERFORM public.insert_rtc_event_v1(
        p_session_id,
        CASE WHEN v_session.session_class = 'call' THEN 'call_ended' ELSE 'meeting_ended' END,
        auth.uid(),
        NULL,
        jsonb_build_object('for_all', p_for_all)
    );

    SELECT *
    INTO v_session
    FROM public.rtc_sessions
    WHERE id = p_session_id;

    RETURN v_session;
END;
$$;

CREATE OR REPLACE FUNCTION public.expire_rtc_ringing_sessions_v1()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_session RECORD;
    v_count INTEGER := 0;
BEGIN
    FOR v_session IN
        SELECT id
        FROM public.rtc_sessions
        WHERE session_class = 'call'
          AND status = 'ringing'
          AND ring_expires_at IS NOT NULL
          AND ring_expires_at < now()
    LOOP
        UPDATE public.rtc_sessions
        SET
            status = 'missed',
            ended_at = coalesce(ended_at, now())
        WHERE id = v_session.id;

        UPDATE public.rtc_participants
        SET
            invite_state = CASE
                WHEN invite_state = 'ringing' THEN 'missed'
                ELSE invite_state
            END,
            left_at = CASE
                WHEN invite_state = 'ringing' THEN coalesce(left_at, now())
                ELSE left_at
            END,
            left_reason = CASE
                WHEN invite_state = 'ringing' THEN 'missed'
                ELSE left_reason
            END,
            last_seen_at = now()
        WHERE session_id = v_session.id;

        PERFORM public.insert_rtc_event_v1(
            v_session.id,
            'call_missed',
            NULL,
            NULL,
            jsonb_build_object('expired_at', now())
        );

        v_count := v_count + 1;
    END LOOP;

    RETURN v_count;
END;
$$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        CREATE PUBLICATION supabase_realtime;
    END IF;

    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.rtc_sessions;
    EXCEPTION WHEN duplicate_object THEN
        NULL;
    END;

    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.rtc_participants;
    EXCEPTION WHEN duplicate_object THEN
        NULL;
    END;

    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.rtc_events;
    EXCEPTION WHEN duplicate_object THEN
        NULL;
    END;
END $$;
