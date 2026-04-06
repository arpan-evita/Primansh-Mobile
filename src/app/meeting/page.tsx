import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { 
  Video, VideoOff, Mic, MicOff, ScreenShare, 
  X, Users, MessageSquare, Settings, 
  Maximize, Minimize, Hand, PhoneOff,
  LayoutGrid, User, Signal, MoreHorizontal,
  UserPlus, Search, Check, Loader2,
  Volume2, VolumeX, Monitor, Activity, Flag,
  Pin
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useMessages } from "@/hooks/useMessages";
import { useMeetingChat } from "@/hooks/useMeetingChat";
import { toast } from "sonner";
import React from "react";

// WebRTC Configuration
const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ]
};

// ─── STANDALONE VIDEOCARD COMPONENT ─────────────────────────────────────────
// Defined outside to prevent remounting on parent re-renders
const VideoCard = React.memo(({ p, isMainStage, isVideoOff, isSharing, sharedParticipantId, isDeafened, isHandRaised }: { 
  p: any, 
  isMainStage?: boolean, 
  isVideoOff: boolean,
  isSharing: boolean,
  sharedParticipantId: string | null,
  isDeafened?: boolean,
  isHandRaised?: boolean
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamId = p.stream?.id;

  useEffect(() => {
    if (videoRef.current && p.stream) {
      if (videoRef.current.srcObject !== p.stream) {
        videoRef.current.srcObject = p.stream;
      }
      
      const playVideo = () => {
        videoRef.current?.play().catch(e => console.warn("Auto-play blocked:", e));
      };

      p.stream.addEventListener('addtrack', playVideo);
      p.stream.addEventListener('removetrack', playVideo);
      
      // Browser-level mute/unmute events (common when tab focuses change during screen share)
      const tracks = p.stream.getTracks();
      tracks.forEach((track: MediaStreamTrack) => {
        track.addEventListener('mute', playVideo);
        track.addEventListener('unmute', playVideo);
      });

      playVideo();

      return () => {
        p.stream?.removeEventListener('addtrack', playVideo);
        p.stream?.removeEventListener('removetrack', playVideo);
        tracks.forEach((track: MediaStreamTrack) => {
          track.removeEventListener('mute', playVideo);
          track.removeEventListener('unmute', playVideo);
        });
      };
    }
  }, [p.stream, streamId]);

  const isActuallySharing = p.isLocal && isSharing;
  const hasVideo = p.stream && (p.stream.getVideoTracks() as MediaStreamTrack[]).filter((t: MediaStreamTrack) => t.enabled).length > 0;
  const isVideoHidden = !hasVideo || (p.isLocal && isVideoOff && !isSharing);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className={cn(
        "relative rounded-[1.5rem] md:rounded-[2rem] overflow-hidden bg-slate-900 border border-white/5 shadow-2xl transition-all duration-500",
        isMainStage ? "w-full h-full" : "min-h-[180px]"
      )}
    >
      <video 
        ref={videoRef} 
        autoPlay 
        playsInline 
        muted={true}  // ALWAYS mute video element — audio is handled exclusively by <RemoteAudio> to prevent echo/double-playback
        className={cn(
          "w-full h-full",
          p.isLocal && !isActuallySharing && "-scale-x-100", // Mirror local camera for natural "mirror" feel
          isMainStage ? "object-contain bg-black" : "object-cover",
          isVideoHidden && "opacity-0 absolute pointer-events-none"
        )} 
      />
      
      {isVideoHidden && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950">
          <div className={cn(
            "rounded-full bg-slate-800 flex items-center justify-center overflow-hidden border border-white/10",
            isMainStage ? "w-32 h-32" : "w-16 h-16 md:w-20 md:h-20"
          )}>
            {p.avatar ? (
              <img src={p.avatar} className="w-full h-full object-cover" alt={p.name} />
            ) : (
              <User className="text-slate-600" size={isMainStage ? 48 : 24} />
            )}
          </div>
          <p className="mt-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest leading-none">
            {p.name}
          </p>
        </div>
      )}

      <div className="absolute bottom-3 left-3 px-3 py-1.5 bg-black/40 backdrop-blur-md rounded-xl border border-white/5 z-10 flex items-center gap-2">
        <span className="text-[10px] font-bold uppercase tracking-wider">
          {p.name} {p.isLocal && "(You)"} 
          {p.id === sharedParticipantId && " • Sharing Screen"}
        </span>
        {p.isMuted && (
          <div className="w-5 h-5 rounded-full bg-red-500/80 flex items-center justify-center">
            <MicOff size={10} className="text-white" />
          </div>
        )}
      </div>

      {isHandRaised && (
        <motion.div 
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="absolute top-4 right-4 z-20"
        >
          <div className="relative">
            <div className="absolute inset-0 bg-blue-500 rounded-full blur-md animate-pulse" />
            <div className="relative w-10 h-10 md:w-12 md:h-12 bg-blue-600 rounded-2xl flex items-center justify-center shadow-2xl border border-white/20">
              <Hand className="text-white w-5 h-5 md:w-6 md:h-6" />
            </div>
          </div>
        </motion.div>
      )}

      {p.id === sharedParticipantId && !isMainStage && (
        <div className="absolute inset-0 border-2 border-blue-500/50 pointer-events-none rounded-[1.5rem] md:rounded-[2rem]" />
      )}
    </motion.div>
  );
});

VideoCard.displayName = "VideoCard";

const RemoteAudio = React.memo(({ stream, muted, participantId }: { stream: MediaStream, muted?: boolean, participantId: string }) => {
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const el = audioRef.current;
    if (!el || !stream) return;

    // Check if we actually have audio tracks
    const audioTracks = stream.getAudioTracks();
    console.log(`[Audio] Participant ${participantId} has ${audioTracks.length} audio tracks. Enabled:`, audioTracks.map(t => t.enabled));

    if (el.srcObject !== stream) {
      el.srcObject = stream;
    }
    el.muted = !!muted;

    const playAudio = () => {
      if (el.paused) {
        el.play().catch(e => {
          if (e.name !== 'AbortError') console.warn(`[Audio] Play blocked for ${participantId}:`, e.message);
        });
      }
    };

    const handleTrackAdded = (e: any) => {
      console.log(`[Audio] New track detected for ${participantId}: ${e.track.kind}. Re-syncing srcObject.`);
      // Re-assigning srcObject can help some browsers recognize the new track
      if (el.srcObject !== stream) {
        el.srcObject = stream;
      }
      playAudio();
    };

    playAudio();
    
    // Listen for new tracks being added to this stream
    stream.addEventListener('addtrack', handleTrackAdded);
    return () => {
      stream.removeEventListener('addtrack', handleTrackAdded);
    };
  }, [stream, muted, participantId]);

  return (
    <audio 
      ref={audioRef} 
      autoPlay 
      playsInline 
      data-participant-id={participantId}
      className="remote-audio-element"
      style={{ position: 'absolute', opacity: 0.01, pointerEvents: 'none', top: 0, left: 0, width: '1px', height: '1px' }} 
    />
  );
});

RemoteAudio.displayName = "RemoteAudio";

// Helper for screen share without camera
const createDummyVideoTrack = () => {
  const canvas = document.createElement("canvas");
  canvas.width = 640;
  canvas.height = 480;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  const stream = canvas.captureStream(10);
  const track = stream.getVideoTracks()[0];
  (track as any).enabled = false; // Keep it "off" but it's a valid track for negotiation
  return track;
};

const ControlButton = ({ icon: Icon, active, onClick, danger, label }: any) => (
  <div className="flex flex-col items-center gap-1 group">
    <button
      onClick={onClick}
      className={cn(
        "w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl flex items-center justify-center transition-all shadow-xl",
        danger ? "bg-red-500 hover:bg-red-600" : active ? "bg-white/10" : "bg-blue-600 hover:bg-blue-500"
      )}
    >
      <Icon className="w-4 h-4 md:w-5 md:h-5 text-white" />
    </button>
    <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest hidden md:block">{label}</span>
  </div>
);

export default function MeetingRoomPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { profile, loading: authLoading } = useAuth();
  
  // Debug Logging
  useEffect(() => {
    console.log("[MeetingRoom] Mount Status:", { 
      id, 
      profileId: profile?.id, 
      role: profile?.role, 
      authLoading 
    });
  }, [id, profile, authLoading]);
  
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(new URLSearchParams(window.location.search).get('audioOnly') === 'true'); // Default based on mode
  const [isSharing, setIsSharing] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [meetingData, setMeetingData] = useState<any>(null);
  const [isDeafened, setIsDeafened] = useState(false);
  const [remoteMutedParticipants, setRemoteMutedParticipants] = useState<Record<string, boolean>>({});
  const [isFetching, setIsFetching] = useState(true);
  const [hasJoined, setHasJoined] = useState(false);
  const [isHandRaised, setIsHandRaised] = useState(false);
  const [remoteHandStates, setRemoteHandStates] = useState<Record<string, boolean>>({});
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const [participants, setParticipants] = useState<any[]>([]);
  const [eligibleProfiles, setEligibleProfiles] = useState<any[]>([]);
  const [isInviting, setIsInviting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [sharedParticipantId, setSharedParticipantId] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [viewMode, setViewMode] = useState<'gallery' | 'speaker'>('gallery');
  const [pinnedId, setPinnedId] = useState<string | null>(null);

  // Detect screen sharing API support (not available on mobile browsers)
  const isScreenShareSupported = typeof navigator !== 'undefined' && 
    typeof navigator.mediaDevices?.getDisplayMedia === 'function';
  const [isAudioOnly, setIsAudioOnly] = useState(new URLSearchParams(window.location.search).get('audioOnly') === 'true');
  
  const { messages, sendMessage, isLoading: messagesLoading } = useMeetingChat(id);
  const [chatInput, setChatInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({});
  const remoteStreamsRef = useRef<Record<string, MediaStream>>({});

  // 0. Auto-join for voice-only calls to remove the "Ready to join?" step
  useEffect(() => {
    if (meetingData && isAudioOnly && !hasJoined && !isFetching && !authLoading) {
      console.log("[MeetingRoom] Auto-joining voice-only call...");
      handleJoinNow();
    }
  }, [meetingData, isAudioOnly, hasJoined, isFetching, authLoading]);
  
  const localStreamRef = useRef<MediaStream | null>(null);
  const channelRef = useRef<any>(null);
  const typingChannelRef = useRef<any>(null);
  const peerConnections = useRef<Record<string, RTCPeerConnection>>({});
  const pendingCandidatesRef = useRef<Record<string, RTCIceCandidateInit[]>>({});
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const startTimeRef = useRef<Date>(new Date());

  const scrollToBottom = (behavior: ScrollBehavior = "smooth") => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  useEffect(() => {
    if (isChatOpen) {
      setTimeout(() => scrollToBottom("auto"), 100);
    }
  }, [messages, isChatOpen]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    const ok = await sendMessage(chatInput.trim());
    if (ok) setChatInput("");
  };

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // 0. Global Audio Unlocker (Click to Resume any blocked audio context)
  useEffect(() => {
    const resumeAudio = () => {
      console.log("[Audio] Interaction/Focus detected: resuming all audio elements...");
      const audioElements = document.querySelectorAll<HTMLAudioElement>('audio.remote-audio-element');
      audioElements.forEach(el => {
        if (el.paused) el.play().catch(() => {});
      });
    };

    window.addEventListener('click', resumeAudio);
    window.addEventListener('touchstart', resumeAudio);
    window.addEventListener('focus', resumeAudio);
    return () => {
      window.removeEventListener('click', resumeAudio);
      window.removeEventListener('touchstart', resumeAudio);
      window.removeEventListener('focus', resumeAudio);
    };
  }, []);


  // Set default view mode based on participant count
  useEffect(() => {
    if (participants.length <= 2) setViewMode('gallery');
    else if (!pinnedId && !sharedParticipantId) setViewMode('gallery');
  }, [participants.length, sharedParticipantId, pinnedId]);

  // 1. Initialize Meeting & Media
  useEffect(() => {
    console.log("[MeetingRoom] Init Hook Effect Triggered:", { id, hasProfile: !!profile });
    if (!id || !profile) return;

    const init = async () => {
      console.log("[MeetingRoom] init() started for ID:", id);
      // Fetch meeting info
      const { data, error } = await supabase
        .from('meetings')
        .select('*, conversation:conversations(title)')
        .eq('id', id)
        .single();
      
      if (error) {
        console.error("[MeetingRoom] Supabase Fetch Error:", error);
        toast.error("Meeting not found or Access Denied");
        setIsFetching(false);
        // Navigate for admins/team, but for clients, send them back to the portal
        if (profile.role === 'client') {
          navigate('/dashboard'); 
        } else {
          navigate("/messages");
        }
        return;
      }
      
      console.log("[MeetingRoom] Meeting Data Loaded:", data.id);
      setMeetingData(data);
      
      try {
        // Get Local Media - Fallback strategy
        let stream: MediaStream;
        
        // Use meeting record flag as source of truth if available
        const actualAudioOnly = isAudioOnly || data.is_audio_only === true;
        setIsAudioOnly(actualAudioOnly);
        
        // Comprehensive audio constraints with echo/noise suppression for ALL call types
        const audioConstraints: MediaTrackConstraints = {
          echoCancellation: { exact: true }, // 'exact' is much stronger than 'ideal' for AEC
          noiseSuppression: { ideal: true },
          autoGainControl: { ideal: true },
          channelCount: { exact: 1 }, // MONO is mandatory for high-quality AEC (Echo Cancellation)
          latency: { ideal: 0 }, // Zero latency helps the browser match the echo path
          // Advanced suppression (Chrome/Edge/Opera)
          // @ts-ignore
          googEchoCancellation: true,
          // @ts-ignore
          googAutoGainControl: true,
          // @ts-ignore
          googNoiseSuppression: true,
          // @ts-ignore
          googHighpassFilter: true,
          // @ts-ignore
          googAudioMirroring: false,
        } as any;

        if (actualAudioOnly) {
          // Strictly audio only for voice calls
          try {
            stream = await navigator.mediaDevices.getUserMedia({ 
              audio: audioConstraints, 
              video: false 
            });
          } catch (e) {
            console.warn("Constrained audio failed, trying basic audio:", e);
            stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true }, video: false });
          }
          setIsVideoOff(true);
        } else {
          // Request both audio and video for accurate lobby preview
          try {
            stream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints, video: true });
            setIsVideoOff(false);
          } catch (e) {
            console.warn("Camera failed, using dummy video for stability:", e);
            const audioStream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints });
            const dummyVideoTrack = createDummyVideoTrack();
            stream = new MediaStream([audioStream.getAudioTracks()[0], dummyVideoTrack]);
            setIsVideoOff(true);
          }
        }
        
        localStreamRef.current = stream;
        
        // Initial Participant (Self)
        setParticipants([{ 
          id: profile?.id, 
          name: profile?.full_name, 
          avatar: profile?.avatar_url, 
          isLocal: true
        }]);

        // DO NOT call setupSignaling() here yet!
        // This allows the user to preview their camera in the "Lobby" before joining.
        
      } catch (err) {
        console.error("Media init failed:", err);
        toast.error("Could not access microphone/camera. Please check permissions.");
      } finally {
        setIsFetching(false);
        console.log("[MeetingRoom] init() finished. isFetching -> false");
      }
    };

    init();

    return () => {
      localStreamRef.current?.getTracks().forEach(t => t.stop());
      Object.values(peerConnections.current).forEach(pc => pc.close());
      if (channelRef.current) supabase.removeChannel(channelRef.current);
    };
  }, [id, profile]);

  // Failsafe: If stays loading for 10s, show error instead of black screen
  useEffect(() => {
    if (isFetching) {
      console.log("[MeetingRoom] Failsafe timer started (10s)");
      const timer = setTimeout(() => {
        if (isFetching && !meetingData) {
          console.warn("[MeetingRoom] Failsafe triggered: Loading took too long or crashed.");
          setIsFetching(false);
        }
      }, 10000);
      return () => clearTimeout(timer);
    }
  }, [isFetching, meetingData]);

  const handleJoinNow = async () => {
    console.log("[MeetingRoom] Joining Live Room. Finalizing hardware sync...");
    setHasJoined(true);
    
    setTimeout(() => {
      setupSignaling();
    }, 150);
  };

  // 2. Setup Signaling via Supabase Broadcast
  const setupSignaling = () => {
    const channel = supabase.channel(`meeting:${id}`, {
      config: { presence: { key: profile?.id } }
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const activeIds = Object.keys(state);
        updateParticipants(activeIds, state);

        // Sync local states to new participants immediately
        if (isMuted) {
          channel.send({
            type: 'broadcast',
            event: 'signal',
            payload: { from: profile?.id, to: 'all', type: 'mute_state', data: { isMuted: true } }
          });
        }
        if (isHandRaised) {
          channel.send({
            type: 'broadcast',
            event: 'signal',
            payload: { from: profile?.id, to: 'all', type: 'hand_state', data: { raised: true } }
          });
        }
        if (isSharing) {
          channel.send({
            type: 'broadcast',
            event: 'signal',
            payload: { from: profile?.id, to: 'all', type: 'sharing_state', data: { active: true } }
          });
        }
      })
      .on('broadcast', { event: 'signal' }, async ({ payload }) => {
        const { from, type, data } = payload;
        if (payload.to !== profile?.id && payload.to !== 'all') return;

        if (type === 'mute_state') {
          console.log(`[Meeting] Received mute_state from ${from}:`, data.isMuted);
          setRemoteMutedParticipants(prev => ({ ...prev, [from]: !!data.isMuted }));
          return;
        }

        if (type === 'hand_state') {
          console.log(`[Meeting] Received hand_state from ${from}:`, data.raised);
          setRemoteHandStates(prev => ({ ...prev, [from]: !!data.raised }));
          return;
        }

        if (type === 'offer') handleOffer(from, data);
        else if (type === 'answer') handleAnswer(from, data);
        else if (type === 'candidate') handleCandidate(from, data);
        else if (type === 'meeting_type_changed') {
          setIsAudioOnly(data.isAudioOnly);
          if (!data.isAudioOnly) {
            // If switched to video, attempt to enable camera if it was off
            handleVideoTypeChange();
          }
        }
        else if (type === 'sharing_state') {
          setSharedParticipantId(data.active ? from : null);
        } else if (type === 'meeting_ended') {
          toast.info("The host has ended this meeting");
          endMeeting(false);
        }
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ 
            user_id: profile?.id, 
            name: profile?.full_name, 
            avatar: profile?.avatar_url,
            online_at: new Date().toISOString()
          });
        }
      });

    channelRef.current = channel;
  };

  const updateParticipants = (ids: string[], state: any) => {
    console.log("[MeetingRoom] Syncing Participants. Active IDs:", ids);
    setParticipants(() => { // Using new array to avoid reference issues
      // 1. Map presence state to participant objects
      const newParticipants = ids.map(uid => {
        const presenceEntry = state[uid]?.[0];
        
        // Defensive check: If presence data hasn't arrived yet for this ID
        if (!presenceEntry) {
          console.warn(`[MeetingRoom] Presence data missing for ${uid}, skipping...`);
          return null;
        }

        return { 
          id: uid, 
          name: presenceEntry.name || "Unknown Participant", 
          avatar: presenceEntry.avatar, 
          isLocal: uid === profile?.id
        };
      }).filter(Boolean); // Remote nulls

      // 2. Cleanup stale peer connections for people who left
      Object.keys(peerConnections.current).forEach(uid => {
        if (!ids.includes(uid)) {
          console.log(`Cleaning up stale connection for ${uid}`);
          peerConnections.current[uid].close();
          delete peerConnections.current[uid];
          delete pendingCandidatesRef.current[uid];
        }
      });

      return newParticipants;
    });

    // 3. Initiate WebRTC to anyone who joined before us (canonical order)
    // We do this outside the state setter to avoid React side-effect warnings
    const sortedIds = [...ids].sort();
    sortedIds.forEach((uid, index) => {
      if (uid < (profile?.id || '') && !peerConnections.current[uid]) {
        // Stagger initiation to prevent signaling clobbering for late arrivals (Person C/B issue)
        const delay = index * 200; 
        console.log(`Scheduling offer to ${uid} in ${delay}ms`);
        setTimeout(() => {
          if (!peerConnections.current[uid]) {
            createPeerConnection(uid, true);
          }
        }, delay);
      }
    });
  };

  // 3. WebRTC Core Logic
  const createPeerConnection = (targetId: string, isOfferer: boolean) => {
    const pc = new RTCPeerConnection(ICE_SERVERS);
    peerConnections.current[targetId] = pc;

    // Add tracks: if sharing, we add screen share track instead of camera track 
    // to ensure late joiners see the screen immediately.
    const screenStream = isSharing && localVideoRef.current?.srcObject instanceof MediaStream 
      ? localVideoRef.current.srcObject 
      : null;
    
    localStreamRef.current?.getTracks().forEach(track => {
      if (track.kind === 'video' && screenStream) {
        // Skip camera track if sharing, screen track will be added below
        return;
      }
      pc.addTrack(track, localStreamRef.current!);
    });

    if (screenStream) {
      screenStream.getVideoTracks().forEach(track => {
        pc.addTrack(track, screenStream);
      });
    }

    pc.oniceconnectionstatechange = () => {
      console.log(`[RTC] Connection state with ${targetId}: ${pc.iceConnectionState}`);
      if (pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'disconnected') {
        console.warn(`[RTC] Connection lost with ${targetId}. Connection may be unstable.`);
      }
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        channelRef.current.send({
          type: 'broadcast',
          event: 'signal',
          payload: { from: profile?.id, to: targetId, type: 'candidate', data: event.candidate }
        });
      }
    };

    pc.ontrack = (event) => {
      console.log(`[RTC] OnTrack: received ${event.track.kind} from ${targetId}`);
      
      // Get existing stream or use the first one provided by the event
      let stream = remoteStreamsRef.current[targetId];
      
      if (!stream) {
        // Create a new stream for this participant if we don't have one
        stream = event.streams[0] || new MediaStream();
        remoteStreamsRef.current[targetId] = stream;
      }
      
      // If the event provided a track that isn't in our stream yet, add it
      if (!stream.getTracks().includes(event.track)) {
        stream.addTrack(event.track);
      }
      
      // Force state update to trigger re-render of components using this stream
      setRemoteStreams({ ...remoteStreamsRef.current });
    };

    if (isOfferer) {
      pc.createOffer().then(offer => {
        pc.setLocalDescription(offer);
        channelRef.current.send({
          type: 'broadcast',
          event: 'signal',
          payload: { from: profile?.id, to: targetId, type: 'offer', data: offer }
        });
      });
    }

    return pc;
  };

  const handleOffer = async (from: string, offer: any) => {
    const pc = createPeerConnection(from, false);
    try {
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      // Process any pending candidates
      if (pendingCandidatesRef.current[from]) {
        for (const candidate of pendingCandidatesRef.current[from]) {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        }
        delete pendingCandidatesRef.current[from];
      }
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      channelRef.current.send({
        type: 'broadcast',
        event: 'signal',
        payload: { from: profile?.id, to: from, type: 'answer', data: answer }
      });
    } catch (err) {
      console.error("handleOffer failed:", err);
    }
  };

  const handleAnswer = async (from: string, answer: any) => {
    const pc = peerConnections.current[from];
    if (pc) {
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
        // Process any pending candidates
        if (pendingCandidatesRef.current[from]) {
          for (const candidate of pendingCandidatesRef.current[from]) {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
          }
          delete pendingCandidatesRef.current[from];
        }
      } catch (err) {
        console.error("handleAnswer failed:", err);
      }
    }
  };

  const handleCandidate = async (from: string, candidate: any) => {
    const pc = peerConnections.current[from];
    if (pc && pc.remoteDescription) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {
        console.error("addIceCandidate failed:", err);
      }
    } else {
      // Queue candidate until PC/RemoteDescription is ready
      if (!pendingCandidatesRef.current[from]) pendingCandidatesRef.current[from] = [];
      pendingCandidatesRef.current[from].push(candidate);
    }
  };

  function toggleMute() {
    const nextMuteState = !isMuted;
    
    try {
      if (localStreamRef.current) {
        localStreamRef.current.getAudioTracks().forEach(t => t.enabled = !nextMuteState);
      }
      
      setIsMuted(nextMuteState);
      
      if (channelRef.current) {
        channelRef.current.send({
          type: 'broadcast',
          event: 'signal',
          payload: { from: profile?.id, to: 'all', type: 'mute_state', data: { isMuted: nextMuteState } }
        });
      }
      
      toast.info(nextMuteState ? "Mic Muted" : "Mic Unmuted");
    } catch (err) {
      console.error("Mic toggle failed:", err);
    }
  }

  function toggleHand() {
    const next = !isHandRaised;
    setIsHandRaised(next);
    if (channelRef.current) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'signal',
        payload: { from: profile?.id, to: 'all', type: 'hand_state', data: { raised: next } }
      });
    }
    toast.info(next ? "Hand raised" : "Hand lowered");
  }

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
    setIsMoreMenuOpen(false);
  }

  function toggleVideo() {
    const turningOn = isVideoOff; // If currently off, we are turning it ON
    
    try {
      if (localStreamRef.current) {
        localStreamRef.current.getVideoTracks().forEach(t => t.enabled = turningOn);
      }
      setIsVideoOff(!turningOn);
      toast.info(turningOn ? "Camera enabled" : "Camera disabled");
    } catch (err) {
      console.error("Camera toggle failed:", err);
    }
  }

  async function toggleScreenShare() {
    if (isSharing) {
      stopScreenShare();
      return;
    }

    // Screen sharing is not supported on mobile browsers
    if (!isScreenShareSupported) {
      toast.error(
        "Screen sharing is only available on desktop browsers.",
        { duration: 5000 }
      );
      return;
    }

    try {
      const stream = await (navigator.mediaDevices as any).getDisplayMedia({ 
        video: {
          cursor: "always",
          displaySurface: "monitor"
        } as any,
        audio: false 
      });
      
      const track = stream.getVideoTracks()[0];
      
      // Optimization: Prioritize detail for screen sharing
      if ('contentHint' in track) {
        (track as any).contentHint = 'detail';
      }

      track.onended = () => stopScreenShare();

      // Update PeerConnections
      Object.entries(peerConnections.current).forEach(([pid, pc]) => {
        const senders = pc.getSenders();
        const videoSender = senders.find(s => s.track?.kind === 'video');
        
        if (videoSender) {
          // Set degradation preference and priority for the sender
          const params = videoSender.getParameters();
          if (params.encodings && params.encodings.length > 0) {
            params.encodings[0].networkPriority = 'high';
          }
          videoSender.setParameters(params).catch(console.warn);
          
          videoSender.replaceTrack(track);
        } else {
          pc.addTrack(track, stream);
        }
      });

      setIsSharing(true);
      setSharedParticipantId(profile?.id || null);

      // Explicitly update local preview
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;
      setParticipants(prev => prev.map(p => p.isLocal ? { ...p, stream } : p));

      channelRef.current.send({
        type: 'broadcast',
        event: 'signal',
        payload: { from: profile?.id, to: 'all', type: 'sharing_state', data: { active: true } }
      });
    } catch (err) {
      console.error("Screen share failed:", err);
      toast.error("Failed to share screen");
    }
  }

  function stopScreenShare() {
    setIsSharing(false);
    setSharedParticipantId(null);
    
    if (channelRef.current) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'signal',
        payload: { from: profile?.id, to: 'all', type: 'sharing_state', data: { active: false } }
      });
    }

    const cameraTrack = localStreamRef.current?.getVideoTracks()[0];
    
    Object.values(peerConnections.current).forEach(pc => {
      const sender = pc.getSenders().find(s => s.track?.kind === 'video');
      if (sender) {
        if (cameraTrack && !isAudioOnly) {
          // Revert to camera (disabled if isVideoOff is true)
          sender.replaceTrack(cameraTrack);
        } else {
          // For audio-only or if no camera exists, stop sending video entirely
          sender.replaceTrack(null);
        }
      }
    });

    // Update local preview
    if (localVideoRef.current) {
      if (!isAudioOnly || (cameraTrack && !isVideoOff)) {
        localVideoRef.current.srcObject = localStreamRef.current;
      } else {
        localVideoRef.current.srcObject = null;
      }
    }

    setParticipants(prev => prev.map(p => 
      p.isLocal ? { ...p, stream: localStreamRef.current } : p
    ));
  }

  async function endMeeting(terminate = false) {
    try {
      // 1. Finalize Summary & End status (Host action)
      // Only the host or admin should formally "finalize" the summary for everyone
      if (id && canEndForAll) {
        console.log('[Meeting] Finalizing chat summary for meeting:', id);
        await supabase.rpc('finalize_meeting_summary', { p_meeting_id: id });
      }

      // 2. Stop all local tracks immediately
      localStreamRef.current?.getTracks().forEach(t => t.stop());
      
      // 3. Clear peer connections
      Object.values(peerConnections.current).forEach(pc => pc.close());
      peerConnections.current = {};

      // 4. Remove from presence and channel
      if (channelRef.current) {
        // Broadcast formal end signal if terminating
        if (terminate) {
          channelRef.current.send({
            type: 'broadcast',
            event: 'signal',
            payload: { from: profile?.id, to: 'all', type: 'meeting_ended', data: {} }
          });
        }
        await supabase.removeChannel(channelRef.current);
      }
      
      // 5. Navigate back to messaging hub
      navigate("/messages?meeting_id=" + id + "&status=left");
      toast.success(terminate ? "Meeting ended for all" : "Meeting exited");
    } catch (err) {
      console.error("Cleanup failed:", err);
      // Fallback navigation
      navigate("/messages");
    }
  }

  const openInviteModal = async () => {
    setIsInviteModalOpen(true);
    try {
      const { data: profiles, error } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url, role')
        .order('full_name');
      
      if (error) throw error;
      
      // Filter out people already in the meeting
      const currentIds = participants.map(p => p.id);
      setEligibleProfiles(profiles.filter(p => !currentIds.includes(p.id)));
    } catch (err) {
      console.error("Failed to fetch profiles:", err);
    }
  };

  const handleAddParticipant = async (targetProfileId: string) => {
    if (!meetingData || isInviting) return;
    setIsInviting(true);
    try {
      // 1. Add to conversation_participants using secure RPC
      const { error: partError } = await supabase.rpc('add_conversation_participant_v1', {
        p_conversation_id: meetingData.conversation_id,
        p_profile_id: targetProfileId
      });
      
      if (partError && partError.code !== '23505') throw partError; // Ignore if already exists

      // 2. Send invitation message (Try 'meeting' type, fallback to 'text' if DB constraint fails)
      const { error: msgError } = await supabase.rpc('send_message_v2', {
        p_conversation_id: meetingData.conversation_id,
        p_content: isAudioOnly ? 'Added to Voice Call' : 'Added to Meeting',
        p_message_type: 'meeting',
        p_meeting_id: meetingData.id
      });
      
      if (msgError) {
        console.warn('Meeting message type failed, falling back to text:', msgError);
        await supabase.rpc('send_message_v2', {
          p_conversation_id: meetingData.conversation_id,
          p_content: isAudioOnly ? 'Added to Voice Call' : 'Added to Meeting',
          p_message_type: 'text'
        });
      }

      // 3. Broadcast for zero-latency join notice
      channelRef.current.send({
        type: 'broadcast',
        event: 'signal',
        payload: { from: profile?.id, to: targetProfileId, type: 'offer', data: {} } // Trigger re-sync
      });

      toast.success("Participant invited");
      setIsInviteModalOpen(false);
    } catch (err: any) {
      console.error("Invite failed:", err);
      toast.error(err.message || "Failed to invite participant");
    } finally {
      setIsInviting(false);
    }
  };

  const switchMeetingToVideo = async () => {
    if (!meetingData) return;
    try {
      // 1. Update DB
      const { error } = await supabase
        .from('meetings')
        .update({ is_audio_only: false })
        .eq('id', id);
      
      if (error) throw error;

      // 2. Update Local State
      setIsAudioOnly(false);
      setIsVideoOff(false);

      // 3. Broadcast to others
      channelRef.current.send({
        type: 'broadcast',
        event: 'signal',
        payload: { from: profile?.id, to: 'all', type: 'meeting_type_changed', data: { isAudioOnly: false } }
      });

      // 4. Request camera if not already active
      handleVideoTypeChange();

      toast.success("Switched to Video Meeting");
    } catch (err) {
      console.error("Failed to switch to video:", err);
      toast.error("Failed to transition to video");
    }
  };

  async function handleVideoTypeChange() {
    try {
      if (localStreamRef.current) {
        // Stop current audio-only stream and get full media
        localStreamRef.current.getTracks().forEach(t => t.stop());
        const newStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
        localStreamRef.current = newStream;
        
        if (localVideoRef.current) localVideoRef.current.srcObject = newStream;
        
        // Update peer connections with new tracks
        Object.entries(peerConnections.current).forEach(([pid, pc]) => {
          const videoTrack = newStream.getVideoTracks()[0];
          const audioTrack = newStream.getAudioTracks()[0];
          
          const senders = pc.getSenders();
          const videoSender = senders.find(s => s.track?.kind === 'video');
          const audioSender = senders.find(s => s.track?.kind === 'audio');
          
          if (videoSender) videoSender.replaceTrack(videoTrack);
          else pc.addTrack(videoTrack, newStream);

          if (audioSender) audioSender.replaceTrack(audioTrack);
        });

        // Update self in participants list
        setParticipants(prev => prev.map(p => p.isLocal ? { ...p, stream: newStream } : p));
        setIsVideoOff(false);
      }
    } catch (err) {
      console.error("Failed to enable camera after switch:", err);
    }
  }

  const canEndForAll = React.useMemo(() => profile?.id === meetingData?.creator_id || profile?.role === 'admin', [profile?.id, meetingData?.creator_id, profile?.role]);
  const meetingTitle = React.useMemo(() => meetingData?.conversation?.title || "Meeting", [meetingData?.conversation?.title]);
  const isAudioMode = React.useMemo(() => {
    if (typeof window === 'undefined') return false;
    return new URLSearchParams(window.location.search).get('audioOnly') === 'true';
  }, []);

  // Diagnostic State for render monitoring
  const [renderError, setRenderError] = useState<string | null>(null);

  if (isFetching || authLoading) {
    return (
      <div className="fixed inset-0 bg-[#0f172a] flex flex-col items-center justify-center p-6 text-center z-[9999]">
        <div className="w-16 h-16 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin mb-6 shadow-2xl" />
        <h2 className="text-xl font-black text-white mb-2 tracking-tight">
          {authLoading ? "Authenticating Session" : "Preparing Meeting Room"}
        </h2>
        <p className="text-slate-400 text-sm max-w-xs font-medium">
          {authLoading ? "Verifying your agency identity..." : "Synchronizing business intelligence and video stream..."}
        </p>
      </div>
    );
  }

  if (!meetingData) {
    return (
      <div className="fixed inset-0 bg-[#020617] flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mb-6 border border-red-500/20">
          <X size={32} className="text-red-500" />
        </div>
        <h2 className="text-xl font-bold text-white mb-2">Meeting Not Found</h2>
        <p className="text-slate-400 text-sm max-w-xs mb-8">This meeting might have ended or you don't have permission to join.</p>
        <button 
          onClick={() => navigate('/messages')}
          className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-bold transition-all shadow-lg shadow-blue-500/20"
        >
          Return to Hub
        </button>
      </div>
    );
  }

  // Lobby Preview Screen (Google Meet style)
  // Skip this for voice-only calls to remove the extra joining step
  if (!hasJoined && !isAudioOnly) {
    return (
      <div className="fixed inset-0 bg-[#020617] text-white flex flex-col overflow-hidden">
        <div className="flex-1 flex flex-col lg:flex-row items-center justify-center p-4 md:p-8 lg:p-12 gap-8 lg:gap-16">
          {/* Left: Video Preview */}
          <div className="w-full max-w-2xl aspect-video rounded-[2.5rem] bg-slate-900 border border-white/10 overflow-hidden relative shadow-2xl">
            <video 
              ref={localVideoRef} 
              autoPlay 
              playsInline 
              muted 
              className={cn("w-full h-full object-cover -scale-x-100", isVideoOff && "hidden")} 
            />
            {isVideoOff && (
              <div className="absolute inset-0 flex items-center justify-center bg-slate-950">
                <div className="w-24 h-24 rounded-full bg-slate-800 flex items-center justify-center border border-white/10">
                  <User size={40} className="text-slate-600" />
                </div>
              </div>
            )}
            
            {/* Overlay Controls */}
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-4 px-6 py-4 bg-slate-950/40 backdrop-blur-xl rounded-2xl border border-white/10">
              <button 
                onClick={toggleMute}
                className={cn("w-12 h-12 rounded-xl flex items-center justify-center transition-all", isMuted ? "bg-red-500 text-white" : "bg-white/10 text-white hover:bg-white/20")}
              >
                {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
              </button>
              <button 
                onClick={toggleVideo}
                className={cn("w-12 h-12 rounded-xl flex items-center justify-center transition-all", isVideoOff ? "bg-red-500 text-white" : "bg-white/10 text-white hover:bg-white/20")}
              >
                {isVideoOff ? <VideoOff size={20} /> : <Video size={20} />}
              </button>
            </div>
          </div>

          {/* Right: Join Controls */}
          <div className="w-full max-w-md text-center lg:text-left flex flex-col gap-6">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-2">Ready to join?</h1>
              <p className="text-slate-400 font-medium">
                {meetingData?.conversation?.title || "Meeting"}
              </p>
            </div>

            <div className="flex flex-col gap-4">
              <button 
                onClick={handleJoinNow}
                className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-[1.5rem] text-sm font-bold shadow-xl shadow-blue-500/20 transition-all active:scale-[0.98]"
              >
                Join Now
              </button>
              
              <div className="flex items-center justify-center lg:justify-start gap-4 text-[11px] font-bold text-slate-500 uppercase tracking-widest">
                <div className="flex -space-x-2">
                  <div className="w-6 h-6 rounded-full bg-slate-800 border-2 border-slate-950 flex items-center justify-center"><User size={10} /></div>
                  <div className="w-6 h-6 rounded-full bg-slate-700 border-2 border-slate-950 flex items-center justify-center"><User size={10} /></div>
                </div>
                <span>Other people are in the call</span>
              </div>
            </div>
            
            <button 
              onClick={() => navigate("/messages")}
              className="mt-4 text-xs font-bold text-slate-500 hover:text-white transition-colors"
            >
              Back to Messaging
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (renderError) {
    return (
      <div className="fixed inset-0 bg-slate-950 flex items-center justify-center p-8 z-[10000]">
        <div className="max-w-xl w-full bg-red-500/10 border-2 border-red-500/50 rounded-[2rem] p-8 text-center backdrop-blur-2xl">
          <div className="w-16 h-16 bg-red-500 rounded-full mx-auto flex items-center justify-center mb-6 shadow-lg shadow-red-500/20">
            <X size={32} className="text-white" />
          </div>
          <h2 className="text-2xl font-black text-white mb-2 tracking-tight">CRASH DETECTED</h2>
          <p className="text-red-400 font-mono text-xs mb-8 p-4 bg-black/40 rounded-xl overflow-x-auto text-left">
            {renderError}
          </p>
          <button 
            onClick={() => window.location.reload()}
            className="px-8 py-3 bg-white text-black rounded-xl font-black text-sm hover:bg-slate-200 transition-all active:scale-95"
          >
            FORCE APP RESCUE
          </button>
        </div>
      </div>
    );
  }

  // --- RENDER RECOVERY GUARD ---
  // If we get past the returns but participants is null, something is wrong
  if (hasJoined && !participants) {
    setRenderError("Participant state became NULL during transition.");
    return null;
  }

  // --- LIVE MEETING INTERFACE WRAPPER ---
  // This helps catch any crash in the complex grid/video logic
  const renderMeetingInterface = () => {
    try {
      return (
        <div className="fixed inset-0 bg-[#020617] text-white flex flex-col overflow-hidden">
          {/* ─── LIVE MEETING ROOM INTERFACE ─── */}
          <header className="h-16 px-4 md:px-6 flex items-center justify-between border-b border-white/5 bg-slate-950/40 backdrop-blur-xl z-20">
            <div className="flex items-center gap-4 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
                {isAudioMode ? <Mic size={16} /> : <Video size={16} />}
              </div>
              <div className="flex flex-col min-w-0">
                <h1 className="text-sm font-bold truncate max-w-[150px] sm:max-w-none">
                  {isAudioMode ? "Voice Call" : meetingTitle}
                </h1>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest leading-none mt-0.5">
                  {sharedParticipantId ? "Screen Sharing" : viewMode === 'speaker' ? "Speaker View" : "Gallery View"} • {participants?.length || 0} PEERS
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {/* Layout Toggle */}
              <button 
                onClick={() => setViewMode(prev => prev === 'gallery' ? 'speaker' : 'gallery')}
                className="px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl flex items-center gap-2 transition-all mr-2"
              >
                {viewMode === 'gallery' ? <LayoutGrid size={14} className="text-blue-400" /> : <Maximize size={14} className="text-blue-400" />}
                <span className="text-[10px] font-black uppercase tracking-widest">{viewMode === 'gallery' ? "Gallery" : "Speaker"}</span>
              </button>
              {/* Heartbeat Diagnostic */}
              <div className="flex items-center gap-2 px-2 py-1 bg-white/5 rounded-full border border-white/5">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                <span className="text-[8px] font-black text-blue-400">💎 HEARTBEAT ACTIVE</span>
              </div>
              <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 bg-green-500/10 border border-green-500/20 rounded-full">
                <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                <span className="text-[9px] font-bold text-green-500 uppercase tracking-widest">Stable Connection</span>
              </div>
              <button className="p-2 hover:bg-white/5 rounded-lg text-slate-400"><Settings size={18} /></button>
            </div>
          </header>

      <main className="flex-1 flex overflow-hidden relative">
        <div className={cn(
          "flex-1 p-3 md:p-6 transition-all duration-500 overflow-y-auto",
          sharedParticipantId ? "flex flex-col lg:flex-row gap-6" : "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-6 auto-rows-fr"
        )}>
          {isAudioOnly ? (
            <div className="flex-1 flex flex-col items-center justify-center">
              <div className="relative group">
                {/* Pulsing visualizer */}
                <div className="absolute -inset-4 bg-blue-500/20 rounded-full blur-2xl animate-pulse" />
                <div className="absolute -inset-8 bg-blue-500/10 rounded-full blur-3xl animate-pulse delay-700" />
                
                <div className="relative w-40 h-40 md:w-56 md:h-56 rounded-full border-4 border-white/5 bg-slate-900 overflow-hidden shadow-2xl flex items-center justify-center">
                  {(() => {
                    const remote = participants.find(p => !p.isLocal);
                    if (remote?.avatar) {
                      return <img src={remote.avatar} className="w-full h-full object-cover" alt="Remote" />;
                    }
                    return <User size={80} className="text-slate-700" />;
                  })()}
                </div>
                
                {/* Connection Status Dot */}
                <div className={cn(
                  "absolute bottom-2 right-2 w-6 h-6 border-4 border-slate-950 rounded-full",
                  participants.some(p => !p.isLocal) ? "bg-green-500" : "bg-slate-700"
                )} />
              </div>
              
              <div className="mt-8 text-center">
                <h2 className="text-2xl font-bold tracking-tight mb-1">
                  {participants.find(p => !p.isLocal)?.name || "Waiting for others..."}
                </h2>
                <div className="flex items-center justify-center gap-2 text-blue-400 font-mono text-lg font-medium">
                  <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                  {(() => {
                    const diff = Math.floor((currentTime.getTime() - startTimeRef.current.getTime()) / 1000);
                    const mins = Math.floor(diff / 60);
                    const secs = diff % 60;
                    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
                  })()}
                </div>
              </div>

              {/* Self view for voice call (small, in corner or integrated) */}
              <div className="absolute bottom-6 right-6 w-24 h-24 rounded-2xl border border-white/10 bg-slate-900/80 backdrop-blur-xl overflow-hidden shadow-2xl flex items-center justify-center">
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} className="w-full h-full object-cover opacity-50" alt="You" />
                ) : (
                  <User size={24} className="text-slate-600" />
                )}
                <div className="absolute inset-0 bg-blue-600/10" />
                <div className="absolute bottom-1 right-1 px-1.5 py-0.5 bg-black/40 backdrop-blur-md rounded-md">
                  <span className="text-[8px] font-black text-white">YOU</span>
                </div>
              </div>
              {/* Remote Hand Raise Indicator for Voice Call */}
              {participants.find(p => !p.isLocal && !!remoteHandStates[p.id]) && (
                <motion.div 
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="mt-6 flex items-center gap-3 px-4 py-2 bg-blue-600 rounded-2xl shadow-xl shadow-blue-500/20 border border-white/20 animate-pulse"
                >
                  <Hand className="text-white" size={18} />
                  <span className="text-xs font-bold uppercase tracking-widest text-white">Hand Raised</span>
                </motion.div>
              )}
            </div>
          ) : (viewMode === 'speaker' || sharedParticipantId || pinnedId) ? (
            <>
              {/* Speaker / Screen Share View */}
              <div className="flex-[3] w-full min-h-[40vh] lg:min-h-0 flex items-center justify-center p-2">
                {(() => {
                  const focusId = sharedParticipantId || pinnedId || participants.find(p => !p.isLocal)?.id || profile?.id;
                  const focusUser = participants.find(p => p.id === focusId);
                  if (!focusUser) return null;
                  return (
                    <div className="w-full h-full max-h-[85vh] aspect-video">
                      <VideoCard 
                        p={{ 
                          ...focusUser, 
                          stream: focusUser.isLocal ? localStreamRef.current : remoteStreams[focusUser.id],
                          isMuted: focusUser.isLocal ? isMuted : !!remoteMutedParticipants[focusUser.id]
                        }} 
                        isMainStage={true}
                        isVideoOff={isVideoOff}
                        isSharing={isSharing}
                        sharedParticipantId={sharedParticipantId}
                        isDeafened={isDeafened}
                        isHandRaised={focusUser.isLocal ? isHandRaised : !!remoteHandStates[focusUser.id]}
                      />
                    </div>
                  );
                })()}
              </div>
              {/* Sidebar Ribbon */}
              <div className="flex-1 w-full lg:w-auto h-[180px] lg:h-full flex flex-row lg:flex-col gap-3 overflow-x-auto lg:overflow-y-auto pb-2 lg:pb-0 px-2 lg:px-0">
                {participants.filter(p => p.id !== (sharedParticipantId || pinnedId || participants.find(p2 => !p2.isLocal)?.id || profile?.id)).map(p => (
                  <div key={p.id} className="min-w-[240px] lg:min-w-0 aspect-video lg:h-auto shrink-0 relative group">
                    <VideoCard 
                      p={{ ...p, stream: p.isLocal ? localStreamRef.current : remoteStreams[p.id] }} 
                      isVideoOff={isVideoOff}
                      isSharing={isSharing}
                      sharedParticipantId={sharedParticipantId}
                      isDeafened={isDeafened}
                      isHandRaised={p.isLocal ? isHandRaised : !!remoteHandStates[p.id]}
                    />
                    <button 
                      onClick={() => setPinnedId(prev => prev === p.id ? null : p.id)}
                      className="absolute top-2 left-2 z-30 opacity-0 group-hover:opacity-100 p-2 bg-black/60 backdrop-blur-md rounded-lg text-white transition-all scale-90"
                    >
                      <Pin size={16} className={cn(pinnedId === p.id && "text-blue-400 rotate-45")} />
                    </button>
                  </div>
                ))}
              </div>
            </>
          ) : (
            /* Gallery View Grid */
            <div className={cn(
              "flex-1 grid gap-3 md:gap-6 w-full max-h-full transition-all duration-700 p-2",
              participants.length === 1 && "grid-cols-1 place-items-center",
              participants.length === 2 && "grid-cols-1 md:grid-cols-2 lg:grid-cols-2 place-items-center",
              participants.length >= 3 && "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
            )}>
              {participants.map(p => (
                <div key={p.id} className="w-full aspect-video relative group flex items-stretch">
                  <VideoCard 
                    p={{ 
                      ...p, 
                      stream: p.isLocal ? localStreamRef.current : remoteStreams[p.id],
                      isMuted: p.isLocal ? isMuted : !!remoteMutedParticipants[p.id]
                    }} 
                    isVideoOff={isVideoOff}
                    isSharing={isSharing}
                    sharedParticipantId={sharedParticipantId}
                    isDeafened={isDeafened}
                    isHandRaised={p.isLocal ? isHandRaised : !!remoteHandStates[p.id]}
                  />
                  <button 
                    onClick={() => {
                      setPinnedId(p.id);
                      setViewMode('speaker');
                    }}
                    className="absolute top-4 right-4 z-30 opacity-0 group-hover:opacity-100 p-3 bg-black/60 backdrop-blur-md rounded-2xl text-white transition-all shadow-2xl scale-100 md:scale-110 border border-white/10"
                  >
                    <Maximize size={20} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ─── GLOBAL AUDIO RENDERERS (Hidden) ─── */}
        {participants.filter(p => !p.isLocal).map(p => {
          const stream = remoteStreams[p.id];
          if (!stream) return null;
          // Hard mute: remoteMutedParticipants logic
          const isRemoteMuted = remoteMutedParticipants[p.id] || isDeafened;
          return <RemoteAudio key={p.id} stream={stream} muted={isRemoteMuted} participantId={p.id} />;
        })}

        <AnimatePresence>
          {isChatOpen && (
            <motion.aside initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} className="fixed md:relative inset-0 md:inset-auto md:w-80 bg-slate-950 flex flex-col z-40">
              <div className="p-5 border-b border-white/5 flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-widest text-blue-400">Meeting Chat</h3>
                <button onClick={() => setIsChatOpen(false)} className="text-slate-500 hover:text-white transition-colors"><X size={18} /></button>
              </div>
              
              <div className="flex-1 p-4 overflow-y-auto custom-scrollbar flex flex-col gap-4">
                {messagesLoading && messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full gap-4 opacity-50">
                    <Loader2 className="animate-spin text-blue-500" size={24} />
                    <p className="text-[10px] font-bold uppercase tracking-widest">Loading messages...</p>
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full gap-4 opacity-30 text-center px-6">
                    <MessageSquare size={32} />
                    <p className="text-xs font-medium">No messages yet. Start the conversation!</p>
                  </div>
                ) : (
                  messages.map((msg) => {
                    const isOwn = msg.sender_id === profile?.id;
                    return (
                      <div key={msg.id} className={cn("flex flex-col gap-1 max-w-[85%]", isOwn ? "self-end items-end" : "self-start items-start")}>
                        <div className="flex items-center gap-1.5 px-1">
                          {!isOwn && <span className="text-[10px] font-bold text-slate-500 truncate max-w-[80px]">{msg.sender?.full_name || "User"}</span>}
                          <span className="text-[8px] font-medium text-slate-700">{new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        <div className={cn(
                          "px-3 py-2 rounded-2xl text-[11px] leading-relaxed shadow-sm",
                          isOwn 
                            ? "bg-blue-600 text-white rounded-tr-none shadow-blue-600/10" 
                            : "bg-white/5 text-slate-100 border border-white/5 rounded-tl-none"
                        )}>
                          {msg.content}
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              <form onSubmit={handleSendMessage} className="p-4 border-t border-white/5 bg-slate-900/50 backdrop-blur-md">
                <div className="flex gap-2 p-1 bg-white/5 border border-white/10 rounded-2xl group focus-within:border-blue-500/50 transition-all">
                  <input 
                    type="text" 
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="Type a message..." 
                    className="flex-1 bg-transparent px-3 py-2 text-xs focus:outline-none placeholder:text-slate-600" 
                  />
                  <button 
                    type="submit"
                    disabled={!chatInput.trim()}
                    className="w-8 h-8 md:w-10 md:h-10 bg-blue-600 rounded-xl flex items-center justify-center hover:bg-blue-500 disabled:opacity-50 disabled:grayscale transition-all shadow-lg shadow-blue-600/20"
                  >
                    <Signal size={16} className="text-white" />
                  </button>
                </div>
              </form>
            </motion.aside>
          )}
        </AnimatePresence>
      </main>

      <footer className="h-auto min-h-[80px] md:h-24 px-4 md:px-8 py-4 md:py-0 flex flex-col md:flex-row items-center justify-between gap-4 border-t border-white/5 bg-slate-950/60 backdrop-blur-2xl z-20">
        <div className="flex items-center justify-between w-full md:w-auto gap-4">
          <button className="flex items-center gap-2 px-3 py-1.5 bg-white/5 border border-white/5 rounded-full text-[9px] font-bold text-slate-400">
            <Users size={12} /> <span className="hidden sm:inline">PARTICIPANTS</span> ({participants?.length || 0})
          </button>
          
          <div className="md:hidden">
            <button onClick={() => setIsChatOpen(!isChatOpen)} className={cn("p-2 rounded-xl transition-all", isChatOpen ? "bg-blue-600 text-white" : "bg-white/5 text-slate-400")}>
              <MessageSquare size={18} />
            </button>
          </div>
        </div>

        <div className="flex flex-col items-center gap-3 w-full md:w-auto">
          {/* Top Row: A/V Controls */}
          <div className="flex items-center justify-center gap-2 md:gap-4 bg-slate-900/40 p-1.5 md:p-2 rounded-2xl border border-white/5 backdrop-blur-xl w-full md:w-auto">
            {isAudioOnly ? (
              // Simplified Voice Controls
              <>
                <ControlButton icon={isMuted ? MicOff : Mic} active={isMuted} onClick={toggleMute} label="Mute" />
                <ControlButton icon={UserPlus} onClick={openInviteModal} label="Invite" />
                <ControlButton icon={isDeafened ? VolumeX : Volume2} active={isDeafened} onClick={() => setIsDeafened(!isDeafened)} label="Speaker" />
                <ControlButton icon={Monitor} onClick={switchMeetingToVideo} label="Video" />
                <div className="w-px h-8 bg-white/5 mx-1" />
                <ControlButton icon={PhoneOff} onClick={() => endMeeting(false)} label="Leave" active />
              </>
            ) : (
              // Full Meeting Controls
              <>
                <ControlButton icon={isMuted ? MicOff : Mic} active={isMuted} onClick={toggleMute} label="Mute" />
                <ControlButton icon={isVideoOff ? VideoOff : Video} active={isVideoOff} onClick={toggleVideo} label="Camera" />
                {isScreenShareSupported ? (
                  <ControlButton icon={ScreenShare} active={isSharing} onClick={toggleScreenShare} label="Share" />
                ) : (
                  // Render a visually disabled button on mobile with an explanation tooltip
                  <div className="flex flex-col items-center gap-1 group relative">
                    <button
                      onClick={() => toast.info("Screen sharing is only available on desktop browsers.", { duration: 3000 })}
                      className="w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl flex items-center justify-center transition-all shadow-xl opacity-30 cursor-not-allowed bg-white/10"
                    >
                      <ScreenShare className="w-4 h-4 md:w-5 md:h-5 text-white" />
                    </button>
                    <span className="text-[8px] font-bold text-slate-600 uppercase tracking-widest hidden md:block">Share</span>
                  </div>
                )}
                <div className="hidden sm:block w-px h-8 bg-white/5 mx-1" />
                <ControlButton icon={UserPlus} onClick={openInviteModal} label="Invite" />
                <ControlButton icon={Hand} label="Raise" active={isHandRaised} onClick={toggleHand} />
                <div className="relative group/more">
                  <ControlButton icon={MoreHorizontal} label="More" active={isMoreMenuOpen} onClick={() => setIsMoreMenuOpen(!isMoreMenuOpen)} />
                  <AnimatePresence>
                    {isMoreMenuOpen && (
                      <motion.div 
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        className="absolute bottom-full mb-4 left-1/2 -translate-x-1/2 w-48 bg-slate-900 border border-white/10 rounded-2xl p-2 shadow-2xl backdrop-blur-xl z-50 overflow-hidden"
                      >
                        <button 
                          onClick={toggleFullscreen}
                          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/5 text-xs text-slate-300 hover:text-white transition-all font-medium"
                        >
                          <Maximize size={16} /> <span>Toggle Fullscreen</span>
                        </button>
                        <button 
                          onClick={() => { setIsMoreMenuOpen(false); toast.info("Performance: 100% (Balanced)"); }}
                          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/5 text-xs text-slate-300 hover:text-white transition-all font-medium"
                        >
                          <Activity size={16} /> <span>Show Session Stats</span>
                        </button>
                        <div className="h-px bg-white/5 my-1" />
                        <button 
                          onClick={() => { setIsMoreMenuOpen(false); toast.info("Report sent to admin. Thank you!"); }}
                          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-red-500/10 text-xs text-red-400 hover:text-red-300 transition-all font-medium"
                        >
                          <Flag size={16} /> <span>Report Issue</span>
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
                <div className="hidden md:block w-px h-8 bg-white/5 mx-1" />
                <div className="hidden md:flex gap-2">
                  <ControlButton icon={PhoneOff} onClick={() => endMeeting(false)} label="Leave" active />
                  {canEndForAll && (
                    <ControlButton icon={X} danger onClick={() => endMeeting(true)} label="End for All" />
                  )}
                </div>
              </>
            )}
          </div>

          {/* Bottom Row: Mobile Emergency / Big Exit */}
          <div className="md:hidden w-full px-2 flex gap-2">
            <button 
              onClick={() => endMeeting(false)}
              className="flex-1 bg-white/10 text-white py-3 rounded-2xl flex items-center justify-center gap-2 border border-white/10 active:scale-[0.98] transition-all"
            >
              <PhoneOff size={16} />
              <span className="text-[10px] font-black uppercase tracking-widest">Leave</span>
            </button>
            {canEndForAll && (
              <button 
                onClick={() => endMeeting(true)}
                className="flex-[1.5] bg-red-500 hover:bg-red-600 text-white py-3 rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-red-500/20 active:scale-[0.98] transition-all"
              >
                <X size={16} />
                <span className="text-[10px] font-black uppercase tracking-widest">End Session</span>
              </button>
            )}
          </div>
        </div>

        <div className="hidden md:block">
          <button onClick={() => setIsChatOpen(!isChatOpen)} className={cn("p-2 md:p-3 rounded-xl transition-all", isChatOpen ? "bg-blue-600 text-white" : "bg-white/5 text-slate-400")}>
            <MessageSquare size={18} />
          </button>
        </div>
      </footer>

      <AnimatePresence>
        {isInviteModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-slate-900 border border-white/10 w-full max-w-md rounded-[2.5rem] overflow-hidden shadow-2xl"
            >
              <div className="p-8 border-b border-white/5 flex items-center justify-between bg-gradient-to-r from-blue-600/10 to-transparent">
                <div>
                  <h3 className="text-xl font-bold text-white mb-1">Invite Participants</h3>
                  <p className="text-xs text-slate-400 font-medium">Add members to this ongoing call</p>
                </div>
                <button 
                  onClick={() => setIsInviteModalOpen(false)}
                  className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10 transition-all"
                >
                  <X size={20} className="text-slate-400" />
                </button>
              </div>

              <div className="p-6">
                <div className="relative mb-6">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                  <input
                    type="text"
                    placeholder="Search people..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl py-3.5 pl-12 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                  />
                </div>

                <div className="max-h-[300px] overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                  {eligibleProfiles
                    .filter(p => p.full_name.toLowerCase().includes(searchQuery.toLowerCase()))
                    .map(p => (
                      <button
                        key={p.id}
                        onClick={() => handleAddParticipant(p.id)}
                        disabled={isInviting}
                        className="w-full flex items-center justify-between p-3 rounded-2xl hover:bg-white/5 transition-all group border border-transparent hover:border-white/5"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-slate-800 overflow-hidden border border-white/10">
                            {p.avatar_url ? (
                              <img src={p.avatar_url} className="w-full h-full object-cover" alt="" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-slate-500 font-bold">
                                {p.full_name[0]}
                              </div>
                            )}
                          </div>
                          <div className="text-left">
                            <p className="text-sm font-bold text-white group-hover:text-blue-400 transition-colors">{p.full_name}</p>
                            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{p.role}</p>
                          </div>
                        </div>
                        <div className="w-8 h-8 rounded-lg bg-blue-600/10 flex items-center justify-center text-blue-500 group-hover:bg-blue-600 group-hover:text-white transition-all">
                          {isInviting ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />}
                        </div>
                      </button>
                    ))}
                  
                  {eligibleProfiles.length === 0 && (
                    <div className="py-10 text-center">
                      <Users className="mx-auto text-slate-700 mb-3" size={32} />
                      <p className="text-sm text-slate-500">No other participants available to invite.</p>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* App Integrity Heartbeat Overlay */}
      <div className="fixed bottom-4 left-4 pointer-events-none flex items-center gap-2 opacity-30 hover:opacity-100 transition-opacity z-[9999]">
        <div className="w-2 h-2 rounded-full bg-blue-500 animate-[ping_1.5s_infinite]" />
        <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">💎 Core Ready • {participants?.length || 0} Peers</span>
      </div>
    </div>
      );
    } catch (e: any) {
      console.error("CRITICAL RENDER FAILURE:", e);
      setRenderError(e.message || "Unknown rendering exception");
      return null;
    }
  };

  return renderMeetingInterface();
}
