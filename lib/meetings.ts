import { supabase } from "./supabase";

export interface MobileProfile {
  id: string;
  full_name: string;
  avatar_url?: string | null;
  role: string;
  associated_client_id?: string | null;
}

export interface MobileMeeting {
  id: string;
  conversation_id: string;
  creator_id: string;
  status: "active" | "ended" | "scheduled";
  room_id: string;
  created_at: string;
  start_time: string;
  end_time?: string | null;
  is_audio_only?: boolean | null;
  conversation?: {
    title?: string | null;
  } | null;
}

const STAFF_ROLES = ["seo", "content", "developer", "team"];

export function normalizeRole(role: string): string {
  if (!role) return "client";

  const normalized = role.toLowerCase().trim().replace(/[\s_-]+/g, "");

  if (normalized.includes("admin") || normalized.includes("manager") || normalized.includes("owner")) return "admin";
  if (normalized.includes("seo")) return "seo";
  if (normalized.includes("content")) return "content";
  if (normalized.includes("dev")) return "developer";
  if (normalized.includes("team")) return "team";
  if (normalized.includes("client")) return "client";

  return "client";
}

function canStartSessionWith(
  sender: MobileProfile,
  receiver: MobileProfile,
  senderAssignedClientIds: string[]
) {
  if (sender.id === receiver.id) return false;

  const senderRole = normalizeRole(sender.role);
  const receiverRole = normalizeRole(receiver.role);

  if (senderRole === "admin") return true;
  if (receiverRole === "admin") return true;

  if (senderRole === "client") {
    if (receiverRole === "client") return false;
    return receiver.associated_client_id === sender.associated_client_id;
  }

  if (STAFF_ROLES.includes(senderRole) && receiverRole === "client") {
    return senderAssignedClientIds.includes(receiver.associated_client_id || "");
  }

  return false;
}

export async function getCurrentMobileProfile(): Promise<MobileProfile | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.user?.id) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, avatar_url, role, associated_client_id")
    .eq("id", session.user.id)
    .single();

  if (error) throw error;
  return data as MobileProfile;
}

export async function listAllowedMeetingProfiles(currentProfile: MobileProfile) {
  const currentRole = normalizeRole(currentProfile.role);
  let assignedClientIds: string[] = [];

  if (STAFF_ROLES.includes(currentRole)) {
    const { data: assignments, error } = await supabase
      .from("team_assigned_clients")
      .select("client_id")
      .eq("team_member_id", currentProfile.id);

    if (error) throw error;
    assignedClientIds = (assignments || []).map((item) => item.client_id);
  }

  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("id, full_name, avatar_url, role, associated_client_id")
    .neq("id", currentProfile.id)
    .order("full_name");

  if (error) throw error;

  return (profiles || []).filter((profile) =>
    canStartSessionWith(currentProfile, profile as MobileProfile, assignedClientIds)
  ) as MobileProfile[];
}

export async function listAccessibleMeetings(currentProfile: MobileProfile) {
  const { data: participations, error: participationError } = await supabase
    .from("conversation_participants")
    .select("conversation_id")
    .eq("profile_id", currentProfile.id);

  if (participationError) throw participationError;

  const conversationIds = (participations || []).map((item) => item.conversation_id);

  if (normalizeRole(currentProfile.role) !== "admin" && conversationIds.length === 0) {
    return [] as MobileMeeting[];
  }

  let query = supabase
    .from("meetings")
    .select("*, conversation:conversations(title)")
    .order("start_time", { ascending: false })
    .limit(30);

  if (normalizeRole(currentProfile.role) !== "admin") {
    query = query.in("conversation_id", conversationIds);
  }

  const { data, error } = await query;
  if (error) throw error;

  return (data || []) as MobileMeeting[];
}

export async function createConversationForMeeting(
  currentProfile: MobileProfile,
  participantIds: string[],
  title?: string | null
) {
  const uniqueIds = Array.from(new Set([currentProfile.id, ...participantIds]));

  const { data, error } = await supabase.rpc("upsert_conversation_v1", {
    p_participant_ids: uniqueIds,
    p_title: title || null,
    p_client_id: null,
    p_context_type: null,
    p_context_id: null,
  });

  if (error) throw error;
  return data as string;
}

async function sendIndividualInvitation(
  creatorId: string,
  targetProfileId: string,
  meetingId: string,
  content: string
) {
  try {
    const { data: convId, error: convError } = await supabase.rpc("upsert_conversation_v1", {
      p_participant_ids: [creatorId, targetProfileId],
      p_title: null,
      p_client_id: null,
      p_context_type: null,
      p_context_id: null,
    });
    if (convError || !convId) return;

    const { error: messageError } = await supabase.rpc("send_message_v2", {
      p_conversation_id: convId as string,
      p_content: content,
      p_message_type: "meeting",
      p_meeting_id: meetingId,
    });
    if (messageError) {
      await supabase.rpc("send_message_v2", {
        p_conversation_id: convId as string,
        p_content: content,
        p_message_type: "text",
      });
    }
  } catch {
    // Ignore individual invite errors so it doesn't block the rest
  }
}

export async function startInstantMeeting(options: {
  currentProfile: MobileProfile;
  participantIds: string[];
  title?: string | null;
  isAudioOnly?: boolean;
}) {
  const isOneOnOne = options.participantIds.length === 1;
  const targetId = isOneOnOne ? options.participantIds[0] : null;

  // We host the meeting in the FIRST participant's 1:1 chat to avoid creating "extra" chats in your list.
  // The new RLS policy allows everyone else to join via their personal invitations.
  const hostParticipantId = options.participantIds[0] || options.currentProfile.id;
  const conversationId = await createConversationForMeeting(
    options.currentProfile,
    [hostParticipantId],
    null
  );

  const { data, error } = await supabase.rpc("start_or_get_active_meeting", {
    p_conversation_id: conversationId,
    p_creator_id: options.currentProfile.id,
    p_is_audio_only: options.isAudioOnly ?? false,
  });

  if (error) throw error;

  const meeting = (Array.isArray(data) ? data[0] : data) as MobileMeeting | null;
  if (!meeting) throw new Error("Could not start meeting");

  try {
    const invContent = options.isAudioOnly ? "Voice Call Invitation" : "Meeting Invitation";

    // Send individual invitations in personal chats for everyone invited.
    // If it's a 1:1, we only send one message to the conversation itself (which IS the personal chat).
    // If it's a group, we send a personal message to each person's 1:1 chat with the creator.
    await Promise.all(
      options.participantIds.map(async (pid) => {
        // If it's a group meeting, send a personal invitation to each person.
        // If it's a 1:1, we only send it if the meeting isn't already hosted in that chat (it usually is).
        if (!isOneOnOne) {
          await sendIndividualInvitation(options.currentProfile.id, pid, meeting.id, invContent);
        } else {
          // For 1:1, just send the meeting message to the primary conversation
          await supabase.rpc("send_message_v2", {
            p_conversation_id: conversationId,
            p_content: invContent,
            p_message_type: "meeting",
            p_meeting_id: meeting.id,
          });
        }
      })
    );
  } catch (err) {
    console.error("[MobileMeetings] Invitation dispatch failed:", err);
    // Best effort invitation dispatch
  }

  return meeting;
}

export async function fetchMeetingById(meetingId: string) {
  const { data, error } = await supabase
    .from("meetings")
    .select("*, conversation:conversations(title)")
    .eq("id", meetingId)
    .single();

  if (error) throw error;
  return data as MobileMeeting;
}

export async function listInvitableMeetingProfiles(
  currentProfile: MobileProfile,
  conversationId: string
) {
  const [allowedProfiles, participantResult] = await Promise.all([
    listAllowedMeetingProfiles(currentProfile),
    supabase
      .from("conversation_participants")
      .select("profile_id")
      .eq("conversation_id", conversationId),
  ]);

  if (participantResult.error) throw participantResult.error;

  const existingParticipantIds = new Set(
    (participantResult.data || []).map((item) => item.profile_id)
  );

  return allowedProfiles.filter((profile) => !existingParticipantIds.has(profile.id));
}

export async function inviteProfileToMeeting(options: {
  meeting: MobileMeeting;
  targetProfileId: string;
  isAudioOnly?: boolean;
}) {
  const { error: participantError } = await supabase.rpc("add_conversation_participant_v1", {
    p_conversation_id: options.meeting.conversation_id,
    p_profile_id: options.targetProfileId,
  });

  if (participantError && participantError.code !== "23505") throw participantError;

  const invitationContent = options.isAudioOnly ? "Added to Voice Call" : "Added to Meeting";

  try {
    await sendIndividualInvitation(
      // We assume meeting has a creator_id. If missing, fallback to another safe id.
      (options.meeting as any).creator_id || options.targetProfileId, 
      options.targetProfileId, 
      options.meeting.id, 
      invitationContent
    );
  } catch {
    // Best effort invitation
  }
}

export async function endMeetingForAll(meetingId: string) {
  try {
    await supabase.rpc("finalize_meeting_summary", { p_meeting_id: meetingId });
  } catch {
    // Summary finalization is best effort.
  }

  const { error } = await supabase
    .from("meetings")
    .update({
      status: "ended",
      end_time: new Date().toISOString(),
    })
    .eq("id", meetingId);

  if (error) throw error;
}
