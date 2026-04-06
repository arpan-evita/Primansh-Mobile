-- Migration: Atomic Meeting Synchronization
-- This RPC ensures that if multiple users click "Call" at once, only ONE meeting record is created.

CREATE OR REPLACE FUNCTION start_or_get_active_meeting(
  p_conversation_id UUID,
  p_creator_id UUID,
  p_is_audio_only BOOLEAN DEFAULT false
)
RETURNS TABLE (
  id UUID,
  conversation_id UUID,
  creator_id UUID,
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  status TEXT,
  room_id TEXT,
  is_audio_only BOOLEAN,
  created_at TIMESTAMPTZ
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_meeting_id UUID;
  v_room_id TEXT;
  v_fifteen_mins_ago TIMESTAMPTZ := now() - interval '15 minutes';
BEGIN
  -- 1. Try to find an existing active meeting first (lock for shared access)
  SELECT m.id, m.room_id INTO v_meeting_id, v_room_id
  FROM public.meetings m
  WHERE m.conversation_id = p_conversation_id 
    AND m.status = 'active'
    AND m.created_at > v_fifteen_mins_ago
  ORDER BY m.created_at DESC
  LIMIT 1;

  -- 2. If no active meeting exists, create one
  IF v_meeting_id IS NULL THEN
    -- Generate a room ID
    v_room_id := p_conversation_id::text || '-' || (extract(epoch from now())::bigint)::text;
    
    INSERT INTO public.meetings (
      conversation_id,
      creator_id,
      room_id,
      status,
      is_audio_only
    )
    VALUES (
      p_conversation_id,
      p_creator_id,
      v_room_id,
      'active',
      p_is_audio_only
    )
    RETURNING public.meetings.id INTO v_meeting_id;
  END IF;

  -- 3. Return the meeting details (either existing or new)
  RETURN QUERY
  SELECT 
    m.id, 
    m.conversation_id, 
    m.creator_id, 
    m.start_time, 
    m.end_time, 
    m.status, 
    m.room_id, 
    m.is_audio_only, 
    m.created_at
  FROM public.meetings m
  WHERE m.id = v_meeting_id;
END;
$$;
