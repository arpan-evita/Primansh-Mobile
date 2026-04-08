import { useEffect, useState } from "react";
import { useAuth } from "./useAuth";
import { toast } from "sonner";
import {
  acceptRtcSession,
  endRtcSession,
  fetchAccessibleRtcSessions,
  joinRtcSession,
  leaveRtcSession,
  rejectRtcSession,
  RtcEvent,
  RtcSession,
  StartRtcSessionInput,
  startRtcSession,
  subscribeToIncomingRtcEvents,
  subscribeToRtcSession,
} from "@/lib/rtcSessions";

export function useRtcSessions(activeSessionId?: string) {
  const { profile } = useAuth();
  const [sessions, setSessions] = useState<RtcSession[]>([]);
  const [incomingEvents, setIncomingEvents] = useState<RtcEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!profile?.id) return;

    let mounted = true;

    const load = async () => {
      setIsLoading(true);
      try {
        const data = await fetchAccessibleRtcSessions();
        if (mounted) setSessions(data);
      } catch (err: any) {
        console.error("[RTC] Failed to load sessions:", err);
      } finally {
        if (mounted) setIsLoading(false);
      }
    };

    load();

    return () => {
      mounted = false;
    };
  }, [profile?.id]);

  useEffect(() => {
    if (!profile?.id) return;

    return subscribeToIncomingRtcEvents(profile.id, (event) => {
      setIncomingEvents((prev) => {
        if (prev.some((item) => item.id === event.id)) return prev;
        return [event, ...prev].slice(0, 25);
      });
    });
  }, [profile?.id]);

  useEffect(() => {
    if (!activeSessionId) return;

    return subscribeToRtcSession(activeSessionId, {
      onSessionChange: (next) => {
        if (!next.id) return;
        setSessions((prev) =>
          prev.some((session) => session.id === next.id)
            ? prev.map((session) => (session.id === next.id ? { ...session, ...next } as RtcSession : session))
            : [{ ...(next as RtcSession) }, ...prev]
        );
      },
      onEvent: (event) => {
        setIncomingEvents((prev) => {
          if (prev.some((item) => item.id === event.id)) return prev;
          return [event, ...prev].slice(0, 25);
        });
      },
    });
  }, [activeSessionId]);

  return {
    sessions,
    incomingEvents,
    isLoading,
    startSession: async (input: StartRtcSessionInput) => {
      try {
        const session = await startRtcSession(input);
        if (!session) return null;

        setSessions((prev) => {
          if (prev.some((item) => item.id === session.id)) return prev;
          return [session, ...prev];
        });

        return session;
      } catch (err: any) {
        console.error("[RTC] startSession failed:", err);
        toast.error(err.message || "Failed to start session");
        return null;
      }
    },
    acceptSession: async (sessionId: string) => {
      try {
        return await acceptRtcSession(sessionId);
      } catch (err: any) {
        toast.error(err.message || "Failed to accept session");
        return null;
      }
    },
    rejectSession: async (sessionId: string) => {
      try {
        return await rejectRtcSession(sessionId);
      } catch (err: any) {
        toast.error(err.message || "Failed to reject session");
        return null;
      }
    },
    joinSession: async (sessionId: string, metadata: Record<string, unknown> = {}) => {
      try {
        return await joinRtcSession(sessionId, metadata);
      } catch (err: any) {
        toast.error(err.message || "Failed to join session");
        return null;
      }
    },
    leaveSession: async (sessionId: string, reason = "left") => {
      try {
        return await leaveRtcSession(sessionId, reason);
      } catch (err: any) {
        toast.error(err.message || "Failed to leave session");
        return null;
      }
    },
    endSession: async (sessionId: string, forAll = true) => {
      try {
        return await endRtcSession(sessionId, forAll);
      } catch (err: any) {
        toast.error(err.message || "Failed to end session");
        return null;
      }
    },
  };
}
