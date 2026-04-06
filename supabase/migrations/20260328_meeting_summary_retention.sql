-- Migration: Meeting Summary and 30-Day Chat Retention
-- This migration adds storage for a post-meeting chat recap and a TTL (Time-To-Live) cleanup function.

-- 1. Add summary storage to meetings
ALTER TABLE public.meetings ADD COLUMN IF NOT EXISTS chat_summary JSONB;

-- 2. Create RPC to finalize meeting and generate summary
CREATE OR REPLACE FUNCTION finalize_meeting_summary(p_meeting_id UUID)
RETURNS VOID 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_summary JSONB;
BEGIN
  -- Aggregate all messages for this meeting into a JSON array
  SELECT jsonb_agg(
    jsonb_build_object(
      'sender_id', m.sender_id,
      'sender_name', p.full_name,
      'content', m.content,
      'created_at', m.created_at
    ) ORDER BY m.created_at ASC
  ) INTO v_summary
  FROM public.meeting_messages m
  LEFT JOIN public.profiles p ON m.sender_id = p.id
  WHERE m.meeting_id = p_meeting_id;

  -- Update meeting record with summary and mark as ended
  UPDATE public.meetings
  SET 
    chat_summary = v_summary,
    status = 'ended',
    end_time = now()
  WHERE id = p_meeting_id;
END;
$$;

-- 3. Create cleanup function for 30-day retention
CREATE OR REPLACE FUNCTION cleanup_expired_meeting_messages()
RETURNS VOID 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Delete raw meeting messages older than 30 days
  DELETE FROM public.meeting_messages
  WHERE created_at < (now() - interval '30 days');
END;
$$;

-- Note: In a production Supabase environment, you would schedule 
-- cleanup_expired_meeting_messages using pg_cron or an Edge Function.
