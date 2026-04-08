import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-auth",
};

type SessionAction = "start" | "accept" | "reject" | "join" | "leave" | "end" | "list" | "snapshot";

async function getSessionSnapshot(supabase: ReturnType<typeof createClient>, sessionId: string) {
  const [{ data: session, error: sessionError }, { data: participants, error: participantsError }, { data: events, error: eventsError }] =
    await Promise.all([
      supabase.from("rtc_sessions").select("*").eq("id", sessionId).single(),
      supabase.from("rtc_participants").select("*").eq("session_id", sessionId).order("created_at", { ascending: true }),
      supabase.from("rtc_events").select("*").eq("session_id", sessionId).order("created_at", { ascending: false }).limit(20),
    ]);

  if (sessionError) throw sessionError;
  if (participantsError) throw participantsError;
  if (eventsError) throw eventsError;

  return {
    session,
    participants: participants ?? [],
    events: events ?? [],
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Authorization header required" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    });

    const {
      action,
      sessionId,
      conversationId,
      sessionClass,
      mediaMode,
      callType,
      meetingType,
      title,
      scheduledStartAt,
      metadata,
      reason,
      forAll,
      ringTimeoutSeconds,
      limit,
    } = await req.json();

    if (!action || !["start", "accept", "reject", "join", "leave", "end", "list", "snapshot"].includes(action)) {
      return new Response(JSON.stringify({ error: "Unsupported action" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const typedAction = action as SessionAction;

    if (typedAction === "list") {
      const { data, error } = await supabase
        .from("rtc_sessions")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(typeof limit === "number" ? limit : 20);

      if (error) throw error;

      return new Response(JSON.stringify({ sessions: data ?? [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (typedAction === "snapshot") {
      if (!sessionId) {
        return new Response(JSON.stringify({ error: "sessionId is required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const snapshot = await getSessionSnapshot(supabase, sessionId);

      return new Response(JSON.stringify(snapshot), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let rpcName = "";
    let rpcParams: Record<string, unknown> = {};

    switch (typedAction) {
      case "start":
        if (!conversationId || !sessionClass) {
          return new Response(JSON.stringify({ error: "conversationId and sessionClass are required" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        rpcName = "start_rtc_session_v1";
        rpcParams = {
          p_conversation_id: conversationId,
          p_session_class: sessionClass,
          p_media_mode: mediaMode ?? "audio",
          p_call_type: callType ?? null,
          p_meeting_type: meetingType ?? null,
          p_title: title ?? null,
          p_scheduled_start_at: scheduledStartAt ?? null,
          p_metadata: metadata ?? {},
          p_ring_timeout_seconds: ringTimeoutSeconds ?? 30,
        };
        break;
      case "accept":
        rpcName = "accept_rtc_session_v1";
        rpcParams = { p_session_id: sessionId };
        break;
      case "reject":
        rpcName = "reject_rtc_session_v1";
        rpcParams = { p_session_id: sessionId };
        break;
      case "join":
        rpcName = "join_rtc_session_v1";
        rpcParams = { p_session_id: sessionId, p_metadata: metadata ?? {} };
        break;
      case "leave":
        rpcName = "leave_rtc_session_v1";
        rpcParams = { p_session_id: sessionId, p_reason: reason ?? "left" };
        break;
      case "end":
        rpcName = "end_rtc_session_v1";
        rpcParams = { p_session_id: sessionId, p_for_all: forAll ?? true };
        break;
    }

    if (!rpcParams.p_session_id && typedAction !== "start") {
      return new Response(JSON.stringify({ error: "sessionId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data, error } = await supabase.rpc(rpcName, rpcParams);
    if (error) throw error;

    const session = Array.isArray(data) ? data[0] : data;
    const snapshot = session?.id ? await getSessionSnapshot(supabase, session.id) : { session, participants: [], events: [] };

    return new Response(JSON.stringify(snapshot), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("[rtc-session] Error:", err);

    return new Response(JSON.stringify({ error: err.message || "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
