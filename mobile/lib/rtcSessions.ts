import { supabase } from "./supabase";

export type RtcSessionClass = "call" | "meeting";
export type RtcCallType = "one_to_one" | "group";
export type RtcMeetingType = "instant" | "scheduled";
export type RtcMediaMode = "audio" | "video";

export interface RtcSession {
  id: string;
  conversation_id: string | null;
  session_class: RtcSessionClass;
  call_type: RtcCallType | null;
  meeting_type: RtcMeetingType | null;
  media_mode: RtcMediaMode;
  title: string | null;
  initiator_id: string;
  host_id: string | null;
  status: string;
  scheduled_start_at: string | null;
  started_at: string | null;
  ended_at: string | null;
  ring_expires_at: string | null;
  room_name: string;
  provider: string;
  recording_enabled: boolean;
  screen_share_enabled: boolean;
  conversation_message_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface RtcEvent {
  id: string;
  session_id: string;
  participant_id: string | null;
  event_type: string;
  actor_id: string | null;
  target_user_id: string | null;
  payload: Record<string, unknown>;
  created_at: string;
}

export interface StartRtcSessionInput {
  conversationId: string;
  sessionClass: RtcSessionClass;
  mediaMode?: RtcMediaMode;
  callType?: RtcCallType | null;
  meetingType?: RtcMeetingType | null;
  title?: string | null;
  scheduledStartAt?: string | null;
  metadata?: Record<string, unknown>;
  ringTimeoutSeconds?: number;
}

function unwrapRpcRow<T>(data: T | T[] | null): T | null {
  if (!data) return null;
  return Array.isArray(data) ? data[0] ?? null : data;
}

export async function startRtcSession(input: StartRtcSessionInput) {
  const { data, error } = await supabase.rpc("start_rtc_session_v1", {
    p_conversation_id: input.conversationId,
    p_session_class: input.sessionClass,
    p_media_mode: input.mediaMode ?? "audio",
    p_call_type: input.callType ?? null,
    p_meeting_type: input.meetingType ?? null,
    p_title: input.title ?? null,
    p_scheduled_start_at: input.scheduledStartAt ?? null,
    p_metadata: input.metadata ?? {},
    p_ring_timeout_seconds: input.ringTimeoutSeconds ?? 30,
  });

  if (error) throw error;
  return unwrapRpcRow<RtcSession>(data);
}

export async function acceptRtcSession(sessionId: string) {
  const { data, error } = await supabase.rpc("accept_rtc_session_v1", {
    p_session_id: sessionId,
  });

  if (error) throw error;
  return unwrapRpcRow<RtcSession>(data);
}

export async function rejectRtcSession(sessionId: string) {
  const { data, error } = await supabase.rpc("reject_rtc_session_v1", {
    p_session_id: sessionId,
  });

  if (error) throw error;
  return unwrapRpcRow<RtcSession>(data);
}

export async function joinRtcSession(sessionId: string, metadata: Record<string, unknown> = {}) {
  const { data, error } = await supabase.rpc("join_rtc_session_v1", {
    p_session_id: sessionId,
    p_metadata: metadata,
  });

  if (error) throw error;
  return unwrapRpcRow<RtcSession>(data);
}

export async function leaveRtcSession(sessionId: string, reason = "left") {
  const { data, error } = await supabase.rpc("leave_rtc_session_v1", {
    p_session_id: sessionId,
    p_reason: reason,
  });

  if (error) throw error;
  return unwrapRpcRow<RtcSession>(data);
}

export async function endRtcSession(sessionId: string, forAll = true) {
  const { data, error } = await supabase.rpc("end_rtc_session_v1", {
    p_session_id: sessionId,
    p_for_all: forAll,
  });

  if (error) throw error;
  return unwrapRpcRow<RtcSession>(data);
}

export function subscribeToIncomingRtcEvents(profileId: string, onEvent: (event: RtcEvent) => void) {
  const channel = supabase
    .channel(`rtc-user:${profileId}`)
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "rtc_events" },
      (payload) => {
        const event = payload.new as RtcEvent;
        if (event.target_user_id && event.target_user_id !== profileId) return;
        onEvent(event);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
