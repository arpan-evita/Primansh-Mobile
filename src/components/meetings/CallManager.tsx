import React, { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate, useLocation } from "react-router-dom";
import { IncomingCall } from "./IncomingCall";
import { AnimatePresence } from "framer-motion";

export const CallManager: React.FC = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [activeCall, setActiveCall] = useState<any>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!profile?.id) return;

    // Ringtone setup (optional but recommended for "real call feel")
    // Note: Most browsers require user interaction before playing audio.
    // We'll attempt to play it when the call arrives.
    if (!audioRef.current) {
      audioRef.current = new Audio("https://assets.mixkit.io/sfx/preview/mixkit-waiting-ringtone-1354.mp3");
      audioRef.current.loop = true;
    }

    const channel = supabase
      .channel("global-call-listener")
      .on(
        "postgres_changes",
        {
          event: "*", // Listen for all changes to handle both new calls and cancellations
          schema: "public",
          table: "meetings",
        },
        async (payload) => {
          if (payload.eventType === "INSERT") {
            const newMeeting = payload.new;
            if (newMeeting.status !== 'active') return;
            if (newMeeting.creator_id === profile.id) return;
            if (location.pathname.includes(`/meeting/${newMeeting.id}`)) return;

            const { data: meeting, error } = await supabase
              .from("meetings")
              .select(`
                *,
                creator:profiles!creator_id(full_name, avatar_url),
                conversation:conversations!conversation_id(title)
              `)
              .eq("id", newMeeting.id)
              .single();

            if (error || !meeting) return;
            setActiveCall(meeting);
            audioRef.current?.play().catch(() => console.log("Ringtone auto-play blocked"));
          } else if (payload.eventType === "UPDATE") {
            const updatedMeeting = payload.new;
            if (updatedMeeting.status === "ended" && activeCall?.id === updatedMeeting.id) {
              setActiveCall(null);
              audioRef.current?.pause();
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      audioRef.current?.pause();
    };
  }, [profile?.id, location.pathname]);

  const handleAccept = () => {
    if (activeCall) {
      const id = activeCall.id;
      setActiveCall(null);
      audioRef.current?.pause();
      navigate(`/meeting/${id}?audioOnly=${activeCall.is_audio_only}`);
    }
  };

  const handleDecline = () => {
    setActiveCall(null);
    audioRef.current?.pause();
  };

  return (
    <AnimatePresence>
      {activeCall && (
        <IncomingCall
          meetingId={activeCall.id}
          callerName={activeCall.creator?.full_name || "Unknown Caller"}
          callerAvatar={activeCall.creator?.avatar_url}
          isAudioOnly={activeCall.is_audio_only}
          onAccept={handleAccept}
          onDecline={handleDecline}
        />
      )}
    </AnimatePresence>
  );
};
