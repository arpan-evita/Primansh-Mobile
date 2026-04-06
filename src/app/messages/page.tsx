import { useState, useRef, useEffect, useCallback } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { PortalLayout } from "@/components/layout/PortalLayout";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useMessages, Message, Conversation } from "@/hooks/useMessages";
import { usePresence } from "@/hooks/usePresence";
import { toast } from "sonner";
import { ChatMediaUpload } from "@/components/chat/ChatMediaUpload";
import { AudioRecorder } from "@/components/chat/AudioRecorder";
import { canMessage, getAllowedRecipients } from "@/lib/canMessage";
import {
  Send, Search, User, MessageSquare,
  Loader2, Plus, ArrowLeft, MoreVertical,
  CheckCheck, Check, Clock, ChevronRight, Trash2, AlertTriangle,
  Image as ImageIcon, FileText, Download, Play, Pause,
  X, ZoomIn, Mic, Paperclip, Archive, Video, Phone
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import { MeetingCard } from "@/components/chat/MeetingCard";

// ── Helpers ────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatTime(ts: string) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function lastMsgPreview(msg?: Message): string {
  if (!msg) return "No messages yet";
  const prefix = msg.message_type === 'audio' ? '🎤 ' : 
                 msg.message_type === 'image' ? '📷 ' : 
                 msg.message_type === 'file' ? '📎 ' : '';
  
  if (msg.message_type === 'audio') {
    const dur = msg.content ? ` (${Math.floor(parseInt(msg.content) / 60)}:${(parseInt(msg.content) % 60).toString().padStart(2, '0')})` : '';
    return `${prefix}Voice message${dur}`;
  }
  return `${prefix}${msg.content || (msg.message_type === 'image' ? 'Photo' : 'File')}`;
}

function formatLastSeen(ts?: string | null): string {
  if (!ts) return "Offline";
  const date = new Date(ts);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  
  if (diff < 60000) return "Online";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

// ── Media Renderers ────────────────────────────────────────────────────────

function ImageMessage({ url, name }: { url: string; name?: string | null }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <>
      <div className="relative group cursor-pointer" onClick={() => setExpanded(true)}>
        <img
          src={url}
          alt={name || "Image"}
          className="max-w-[260px] max-h-[200px] object-cover rounded-2xl border border-white/10 shadow-xl"
          loading="lazy"
        />
        <div className="absolute inset-0 rounded-2xl bg-black/0 group-hover:bg-black/30 flex items-center justify-center transition-all">
          <ZoomIn size={20} className="text-white opacity-0 group-hover:opacity-100" />
        </div>
      </div>
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4 backdrop-blur-sm"
            onClick={() => setExpanded(false)}
          >
            <button className="absolute top-4 right-4 text-white/60 hover:text-white" onClick={() => setExpanded(false)}>
              <X size={28} />
            </button>
            <img src={url} alt={name || "Image"} className="max-w-full max-h-[90vh] rounded-2xl shadow-2xl" />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function AudioMessage({ url, content }: { url: string; content?: string | null }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(content ? parseInt(content) : 0);
  const [loading, setLoading] = useState(!content);
  const [error, setError] = useState(false);

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  const fmt = (s: number) =>
    `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, '0')}`;

  const toggle = async () => {
    const a = audioRef.current;
    if (!a || error) return;
    if (playing) { a.pause(); setPlaying(false); }
    else { try { await a.play(); setPlaying(true); } catch { setError(true); } }
  };

  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    const a = audioRef.current;
    const bar = progressRef.current;
    if (!a || !bar || !duration) return;
    const rect = bar.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    a.currentTime = ratio * duration;
    setCurrentTime(ratio * duration);
  };

  // Waveform bar heights (pseudo-random but stable)
  const bars = [4, 8, 12, 7, 14, 10, 6, 13, 9, 5, 11, 8, 14, 6, 10, 12, 7, 9, 11, 5];

  return (
    <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-2xl px-4 py-3 min-w-[220px] max-w-[280px]">
      <audio
        ref={audioRef}
        src={url}
        preload="metadata"
        onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime || 0)}
        onLoadedMetadata={() => { setDuration(audioRef.current?.duration || 0); setLoading(false); }}
        onCanPlay={() => setLoading(false)}
        onEnded={() => { setPlaying(false); setCurrentTime(0); }}
        onError={() => { setError(true); setLoading(false); }}
      />

      {/* Play / Pause button */}
      <button
        onClick={toggle}
        disabled={loading || error}
        className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center shrink-0 shadow-lg shadow-blue-500/30 hover:bg-blue-500 transition-colors disabled:opacity-50"
      >
        {loading
          ? <Loader2 size={14} className="text-white animate-spin" />
          : playing
            ? <Pause size={14} className="text-white" />
            : <Play size={14} className="text-white ml-0.5" />
        }
      </button>

      {/* Waveform + seek */}
      <div className="flex-1 min-w-0">
        {error ? (
          <p className="text-[10px] text-red-400">Could not load audio</p>
        ) : (
          <>
            {/* Animated waveform bars that double as a seek bar */}
            <div
              ref={progressRef}
              onClick={seek}
              className="flex items-center gap-[2px] h-8 cursor-pointer group relative"
              title="Click to seek"
            >
              {bars.map((h, i) => {
                const barProgress = (i / bars.length) * 100;
                const filled = barProgress <= progress;
                return (
                  <div
                    key={i}
                    className={cn(
                      "rounded-full transition-all duration-75 shrink-0",
                      filled ? "bg-blue-500" : "bg-white/15 group-hover:bg-white/25"
                    )}
                    style={{
                      width: 3,
                      height: playing && filled
                        ? `${h * 0.8 + Math.sin(Date.now() / 200 + i) * 4}px`
                        : `${h}px`,
                      minHeight: 3,
                      animation: playing && filled ? `pulse ${0.3 + i * 0.05}s ease-in-out infinite alternate` : 'none',
                    }}
                  />
                );
              })}
            </div>

            {/* Time */}
            <div className="flex justify-between items-center mt-0.5">
              <span className="text-[9px] text-slate-500 font-mono tabular-nums">
                {fmt(currentTime)}
              </span>
              <span className="text-[9px] text-slate-600 font-mono tabular-nums">
                {duration ? fmt(duration) : '--:--'}
              </span>
            </div>
          </>
        )}
      </div>

      {/* Mic icon */}
      <Mic size={11} className="text-slate-600 shrink-0" />
    </div>
  );
}

function FileMessage({ url, name, size }: { url: string; name?: string | null; size?: number | null }) {
  return (
    <a
      href={url}
      download={name || "file"}
      target="_blank"
      rel="noreferrer"
      className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-2xl px-4 py-3 hover:bg-white/10 transition-all group"
    >
      <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0">
        <FileText size={18} className="text-blue-400" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-white truncate">{name || "File"}</p>
        {size && <p className="text-[10px] text-slate-500">{formatBytes(size)}</p>}
      </div>
      <Download size={14} className="text-slate-400 group-hover:text-white transition-colors shrink-0" />
    </a>
  );
}

function MessageBubble({ 
  msg, 
  isOwn, 
  onJoinMeeting, 
  onDelete,
  isSelectionMode,
  isSelected,
  onSelect,
  onLongPress 
}: { 
  msg: Message; 
  isOwn: boolean; 
  onJoinMeeting?: (id: string, isAudioOnly?: boolean) => void; 
  onDelete?: (id: string) => void;
  isSelectionMode?: boolean;
  isSelected?: boolean;
  onSelect?: (id: string) => void;
  onLongPress?: (id: string) => void;
}) {
  const longPressTimer = useRef<any>(null);

  const handleStart = () => {
    longPressTimer.current = setTimeout(() => {
      onLongPress?.(msg.id);
    }, 500);
  };

  const handleEnd = () => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
  };

  return (
    <motion.div
      key={msg.id}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      onTouchStart={handleStart}
      onTouchEnd={handleEnd}
      onMouseDown={handleStart}
      onMouseUp={handleEnd}
      onClick={() => isSelectionMode && onSelect?.(msg.id)}
      className={cn(
        "flex flex-col max-w-[75%] group relative transition-all", 
        isOwn ? "ml-auto items-end" : "items-start",
        isSelectionMode ? "cursor-pointer scale-[0.98]" : ""
      )}
    >
      {/* Selection Indicator */}
      {isSelectionMode && (
        <div className={cn(
          "absolute -left-10 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all",
          isSelected ? "bg-blue-500 border-blue-500 text-white" : "bg-white/5 border-white/20"
        )}>
          {isSelected && <Check size={14} strokeWidth={3} />}
        </div>
      )}

      {/* Delete Button (Visible if active or on hover for desktop) */}
      {!isSelectionMode && (
        <div className={cn(
          "absolute top-0 transition-opacity z-10",
          "opacity-100 md:opacity-0 md:group-hover:opacity-100", // Always visible on mobile, hover on desktop
          isOwn ? "-left-10" : "-right-10"
        )}>
          <button 
            onClick={(e) => { e.stopPropagation(); onDelete?.(msg.id); }}
            className="w-8 h-8 rounded-full bg-slate-900/50 hover:bg-red-500/20 text-slate-500 hover:text-red-500 flex items-center justify-center transition-all border border-white/5"
            title="Delete Message"
          >
            <Trash2 size={14} />
          </button>
        </div>
      )}

      {/* Bubble */}
      <div className={cn(
        "relative",
        msg.message_type === 'text'
          ? cn("px-5 py-3 rounded-2xl text-sm leading-relaxed",
              isOwn
                ? "bg-blue-600 text-white rounded-tr-none shadow-xl shadow-blue-600/20"
                : "bg-white/[0.06] text-slate-100 border border-white/10 rounded-tl-none shadow-xl")
          : ""
      )}>
        {msg.message_type === 'text' && <p className="whitespace-pre-wrap break-words">{msg.content}</p>}
        {msg.message_type === 'image' && <ImageMessage url={msg.file_url!} name={msg.file_name} />}
        {msg.message_type === 'audio' && <AudioMessage url={msg.file_url!} content={msg.content} />}
        {msg.message_type === 'file' && <FileMessage url={msg.file_url!} name={msg.file_name} size={msg.file_size} />}
        {msg.message_type === 'meeting' && msg.meeting && (
          <MeetingCard
            meetingId={msg.meeting.id}
            status={msg.meeting.status}
            startTime={msg.meeting.start_time}
            isOwn={isOwn}
            isAudioOnly={msg.content === 'Voice Call Invitation'}
            chatSummary={msg.meeting.chat_summary}
            onJoin={(id: string) => onJoinMeeting?.(id, msg.content === 'Voice Call Invitation')}
          />
        )}
      </div>

      {/* Meta */}
      <div className="flex items-center gap-1.5 mt-1.5 px-1 opacity-50 group-hover:opacity-100 transition-opacity">
        <span className="text-[10px] font-medium text-slate-500">{formatTime(msg.created_at)}</span>
        {isOwn && (
          <div className="flex items-center ml-1">
            {msg.status === 'read' ? (
              <CheckCheck size={13} className="text-blue-400" />
            ) : msg.status === 'delivered' ? (
              <CheckCheck size={13} className="text-slate-500" />
            ) : msg.status === 'sent' ? (
              <Check size={13} className="text-slate-500" />
            ) : (
              <Clock size={10} className="text-slate-500 animate-pulse" />
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────

export default function MessagesPage() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { isOnline } = usePresence();
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [isNewChatModalOpen, setIsNewChatModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [potentialParticipants, setPotentialParticipants] = useState<any[]>([]);
  const [messageInput, setMessageInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [convSearch, setConvSearch] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [msgSearchQuery, setMsgSearchQuery] = useState("");
  const [isMsgSearchOpen, setIsMsgSearchOpen] = useState(false);
  const [tempTargetName, setTempTargetName] = useState<string | null>(null);
  const [activeOtherParticipantProfile, setActiveOtherParticipantProfile] = useState<any | null>(null);
  const [selectedMsgIds, setSelectedMsgIds] = useState<string[]>([]);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [isHeaderMenuOpen, setIsHeaderMenuOpen] = useState(false);
  const [senderAssignedClientIds, setSenderAssignedClientIds] = useState<string[]>([]);

  const {
    conversations,
    messages,
    isLoading,
    typingUsers,
    uploadProgress,
    sendMessage,
    sendMedia,
    broadcastTyping,
    createConversation,
    deleteConversation,
    deleteMessage,
    deleteMessages,
    startMeeting
  } = useMessages(activeConversationId || undefined);

  const toggleSelect = (id: string) => {
    setSelectedMsgIds(prev => 
      prev.includes(id) ? prev.filter(mid => mid !== id) : [...prev, id]
    );
  };

  const handleLongPress = (id: string) => {
    if (!isSelectionMode) {
      setIsSelectionMode(true);
      setSelectedMsgIds([id]);
    }
  };

  const cancelSelection = () => {
    setIsSelectionMode(false);
    setSelectedMsgIds([]);
  };

  const handleBatchDelete = async () => {
    if (selectedMsgIds.length === 0) return;
    const ok = await deleteMessages(selectedMsgIds);
    if (ok) cancelSelection();
  };

  const isPortal = pathname.startsWith("/clientportal");
  const ADMIN_EMAIL = "arpansadhu13@gmail.com";

  // Auto-open admin convo for portal clients
  useEffect(() => {
    if (!isPortal || !profile) return;
    const connect = async () => {
      const { data } = await supabase.from('profiles').select('id').eq('email', ADMIN_EMAIL).limit(1);
      const adminId = data?.[0]?.id;
      if (adminId) await startChat(adminId);
    };
    connect();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPortal, profile]);

  // Fetch other participant profile if not in activeConv
  useEffect(() => {
    if (!activeConversationId || !profile) {
      setActiveOtherParticipantProfile(null);
      return;
    }

    const fetchOtherProfile = async () => {
      const activeConv = conversations.find(c => c.id === activeConversationId);
      if (activeConv) {
        const other = activeConv.participants.find(p => p.profile_id !== profile.id)?.profile;
        if (other) {
          setActiveOtherParticipantProfile(other);
          return;
        }
      }

      // If not in conversations list yet, fetch from DB
      const { data: participation } = await supabase
        .from('conversation_participants')
        .select('profile:profiles(*)')
        .eq('conversation_id', activeConversationId)
        .neq('profile_id', profile.id)
        .maybeSingle();
      
      if (participation?.profile) {
        setActiveOtherParticipantProfile(participation.profile);
      }
    };

    fetchOtherProfile();
  }, [activeConversationId, profile, conversations]);

  // Handle Query Parameters (e.g. ?userId=...&contextId=...&contextType=...)
  useEffect(() => {
    if (!profile) return;
    const params = new URLSearchParams(window.location.search);
    const userId = params.get('userId');
    const contextId = params.get('contextId');
    const contextType = params.get('contextType');

    if (userId) {
      const handleDeepLink = async () => {
        // Try to find existing conversation with this user
        const { data: participation } = await supabase
          .from('conversation_participants')
          .select('conversation_id')
          .eq('profile_id', userId);
        
        const myparticipation = await supabase
          .from('conversation_participants')
          .select('conversation_id')
          .eq('profile_id', profile.id);
        
        const common = participation?.filter(p => myparticipation.data?.some(mp => mp.conversation_id === p.conversation_id));
        
        if (common && common.length > 0) {
          const cid = common[0].conversation_id;
          setActiveConversationId(cid);
          if (params.get('startMeeting') === 'true') {
            const meeting = await (startMeeting as any)(cid);
            if (meeting) window.open(`/meeting/${meeting.id}`, '_blank');
          }
        } else {
          // Create new one
          const newId = await createConversation([userId], undefined, contextId || undefined);
          if (newId) {
            setActiveConversationId(newId);
            if (params.get('startMeeting') === 'true') {
              const meeting = await (startMeeting as any)(newId);
              if (meeting) window.open(`/meeting/${meeting.id}`, '_blank');
            }
          }
        }
        
        // Clear params to avoid loop
        const newUrl = window.location.pathname;
        window.history.replaceState({}, '', newUrl);
      };
      handleDeepLink();
    }
  }, [profile, createConversation]);

  // Handle name-based search deep link
  useEffect(() => {
    if (!profile) return;
    const params = new URLSearchParams(window.location.search);
    const searchName = params.get('search');
    if (!searchName) return;

    const resolveAndStart = async () => {
      // Find user by name
      const { data: matches } = await supabase
        .from('profiles')
        .select('id')
        .ilike('full_name', `%${searchName}%`)
        .limit(1);
      
      const userId = matches?.[0]?.id;
      if (userId) {
        const contextId = params.get('contextId');
        const contextType = params.get('contextType');
        
        // Try find common convo
        const { data: common } = await supabase.rpc('find_common_conversation', {
            p_user1: profile.id,
            p_user2: userId
        });
        
        if (common) {
            setActiveConversationId(common);
            if (params.get('startMeeting') === 'true') {
                const meeting = await (startMeeting as any)(common);
                if (meeting) window.open(`/meeting/${meeting.id}`, '_blank');
            }
        } else {
            const newId = await (createConversation as any)([userId], undefined, undefined, contextType || undefined, contextId || undefined);
            if (newId) {
                setActiveConversationId(newId);
                if (params.get('startMeeting') === 'true') {
                    const meeting = await (startMeeting as any)(newId);
                    if (meeting) window.open(`/meeting/${meeting.id}`, '_blank');
                }
            }
        }
        
        // Clear params
        window.history.replaceState({}, '', window.location.pathname);
      }
    };
    resolveAndStart();
  }, [profile, createConversation, startMeeting]);
  
  // Fetch assigned clients for team members to enable filtering
  useEffect(() => {
    if (!profile) return;
    const fetchAssignments = async () => {
      const role = profile.role?.toLowerCase();
      if (['seo', 'content', 'developer', 'team', 'general manager'].includes(role)) {
        const { data: clients } = await supabase
          .from('clients')
          .select('id')
          .eq('assigned_team_member_id', profile.id);
        if (clients) setSenderAssignedClientIds(clients.map(c => c.id));
      }
    };
    fetchAssignments();
  }, [profile]);

  // Scroll to bottom
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages]);

  // Load potential participants when modal opens
  useEffect(() => {
    if (isNewChatModalOpen) fetchPotentialParticipants();
  }, [isNewChatModalOpen]);

  const fetchPotentialParticipants = async () => {
    if (!profile) return;

    let senderAssignedClientIds: string[] = [];
    let clientAssignedTeamMemberId: string | null = null;
    const role = profile.role?.toLowerCase();

    // 1. Fetch assignment data based on role
    if (['seo', 'content', 'developer', 'team', 'general manager'].includes(role)) {
      const { data: clients } = await supabase
        .from('clients')
        .select('id')
        .eq('assigned_team_member_id', profile.id);
      senderAssignedClientIds = clients?.map(c => c.id) || [];
    } else if (role === 'client' && profile.associated_client_id) {
      const { data: clientFirm } = await supabase
        .from('clients')
        .select('assigned_team_member_id')
        .eq('id', profile.associated_client_id)
        .single();
      clientAssignedTeamMemberId = clientFirm?.assigned_team_member_id || null;
    }

    // 2. Fetch all other profiles
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, email, role, associated_client_id, avatar_url')
      .neq('id', profile.id);

    // 3. Map profiles to include a temporary associated_client_id for team members if they match the client's assignment
    // but the pure function canMessage approach with senderAssignedClientIds is better for team -> client.
    // For client -> team, we can use a similar approach or just rely on the receiver comparison.
    
    const sender = {
      id: profile.id,
      role: profile.role,
      associated_client_id: profile.associated_client_id,
    };

    const allowed = profiles?.filter(p => {
      // Direct pass for team -> client
      if (canMessage(sender, p as any, senderAssignedClientIds)) return true;
      
      // Manual check for client -> team back-communication
      if (role === 'client' && p.id === clientAssignedTeamMemberId) return true;
      
      return false;
    }) || [];

    setPotentialParticipants(allowed);
  };

  // Typing broadcasting
  const handleInputChange = (val: string) => {
    setMessageInput(val);
    if (!isTyping) { setIsTyping(true); broadcastTyping(true); }
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      broadcastTyping(false);
    }, 1500);
  };

  const handleSend = () => {
    if (!messageInput.trim()) return;
    sendMessage(messageInput.trim());
    setMessageInput("");
    broadcastTyping(false);
    setIsTyping(false);
  };

  const startChat = async (userId: string) => {
    // 1. Look for existing conversation in local state
    let existing = conversations.find(c => 
      c.participants.length === 2 && 
      c.participants.some(p => p.profile_id === userId)
    );

    if (existing) {
      setActiveConversationId(existing.id);
    } else {
      const newId = await createConversation([userId]);
      if (newId) {
        setActiveConversationId(newId);
      } else {
        // Fallback to userId if creation failed (to at least show something)
        setActiveConversationId(userId);
        const target = potentialParticipants.find(p => p.id === userId);
        if (target) setTempTargetName(target.full_name);
      }
    }
    setIsNewChatModalOpen(false);
  };

  const handleDeleteChat = async () => {
    if (!activeConversationId) return;
    const ok = await deleteConversation(activeConversationId);
    if (ok) { setActiveConversationId(null); setIsDeleteModalOpen(false); }
  };

  const handleArchiveChat = async () => {
    if (!activeConversationId) return;
    try {
      const { error } = await supabase
        .from('conversations')
        .update({ is_archived: true })
        .eq('id', activeConversationId);
      if (error) throw error;
      setActiveConversationId(null);
      toast.success('Conversation archived');
    } catch (err) {
      console.error('Archive failed:', err);
      toast.error('Failed to archive chat');
    }
  };

  const activeConv = conversations.find(c => c.id === activeConversationId);
  
  const otherParticipant = activeOtherParticipantProfile || (activeConv 
    ? activeConv.participants.find(p => p.profile_id !== profile?.id)?.profile as any
    : null); // Fallback to null if not found in activeConv or activeOtherParticipantProfile

  const displayName = otherParticipant?.full_name || tempTargetName || 'Member';
  const displayAvatar = otherParticipant?.avatar_url;

  const filteredConversations = conversations.filter(c => {
    const other = c.participants.find(p => p.profile_id !== profile?.id)?.profile as any;
    if (!other || !profile) return false;

    // Strict Privacy: Normal team members cannot see other team members
    const sender = { id: profile.id, role: profile.role, associated_client_id: profile.associated_client_id };
    if (!canMessage(sender, other, senderAssignedClientIds)) return false;

    if (!convSearch) return true;
    const name = (other?.full_name || other?.email || "").toLowerCase();
    return name.includes(convSearch.toLowerCase());
  });

  const layoutProps = { title: "Messages", subtitle: "Secure communication node" };
  const Layout = isPortal ? PortalLayout : AppShell;

  return (
    <Layout {...layoutProps} noPadding hideBottomNav={!!activeConversationId}>
      <div className="flex bg-[#070b14]/30 overflow-hidden h-[calc(100dvh-var(--header-height))] md:h-[calc(100vh-var(--header-height))] min-h-[500px] backdrop-blur-3xl relative">
        {/* Mobile-only subtle border/glow at top */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/5 to-transparent z-10 md:hidden" />

        {/* ── Sidebar ─────────────────────────────────────────────────── */}
        <div className={cn(
          "w-full md:w-80 border-r border-white/5 flex flex-col bg-white/[0.02] transition-all duration-300 shrink-0",
          activeConversationId ? "hidden md:flex" : "flex"
        )}>
          <div className="p-6 border-b border-white/5 flex justify-between items-center bg-white/[0.01]">
            <h2 className="text-sm font-bold text-white tracking-tight">Messages</h2>
            <button
              onClick={() => setIsNewChatModalOpen(true)}
              className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center hover:bg-blue-500 transition-all shadow-lg shadow-blue-500/10"
            >
              <Plus size={16} />
            </button>
          </div>

          {/* Conversation Search */}
          <div className="p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
              <input
                type="text"
                placeholder="Search chats..."
                value={convSearch}
                onChange={e => setConvSearch(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl py-2 pl-10 pr-4 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-blue-500/50 transition-all"
              />
            </div>
          </div>

          {/* Conversation List */}
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {isLoading ? (
              <div className="flex justify-center py-20"><Loader2 className="animate-spin text-blue-500" size={20} /></div>
            ) : filteredConversations.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 px-10 text-center">
                <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center text-slate-700 mb-4 border border-white/5">
                  <MessageSquare size={20} />
                </div>
                <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest leading-relaxed">
                  {convSearch ? "No matching chats" : "No messages yet"}
                </p>
              </div>
            ) : (
              filteredConversations.map(conv => {
                const other = conv.participants.find(p => p.profile_id !== profile?.id)?.profile as any;
                const isActive = conv.id === activeConversationId;
                const displayName = other?.full_name || other?.email?.split('@')[0] || 'User';
                const preview = lastMsgPreview((conv as any).last_message);

                return (
                  <div
                    key={conv.id}
                    onClick={() => setActiveConversationId(conv.id)}
                    className={cn(
                      "px-4 py-4 cursor-pointer transition-all border-l-2 relative group",
                      isActive ? "bg-blue-500/5 border-blue-500" : "hover:bg-white/[0.02] border-transparent"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className="relative shrink-0">
                        <div className="w-10 h-10 rounded-full bg-slate-800 border border-white/10 flex items-center justify-center text-xs font-bold text-white uppercase overflow-hidden shadow-lg">
                          {other?.avatar_url
                            ? <img src={other.avatar_url} alt="" className="w-full h-full object-cover" />
                            : (displayName?.[0] || 'U')}
                        </div>
                        <div className={cn(
                          "absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-[#0a0f1d]",
                          isOnline(other?.id) ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" : "bg-slate-600"
                        )} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start mb-0.5">
                          <p className={cn("text-sm font-semibold truncate", isActive ? "text-white" : "text-slate-300 group-hover:text-white transition-colors")}>
                            {displayName}
                          </p>
                          <div className="flex flex-col items-end gap-1 shrink-0 ml-2">
                            <span className="text-[10px] text-slate-600">
                              {conv.updated_at ? new Date(conv.updated_at).toLocaleDateString([], { month: 'short', day: 'numeric' }) : ''}
                            </span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveConversationId(conv.id);
                                setIsDeleteModalOpen(true);
                              }}
                              className="opacity-0 group-hover:opacity-100 p-1 text-slate-500 hover:text-red-500 transition-all"
                              title="Delete Chat"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>
                        <p className="text-xs text-slate-500 truncate">{preview}</p>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ── Chat Window ──────────────────────────────────────────────── */}
        <div className={cn(
          "flex-1 flex flex-col bg-gradient-to-b from-white/[0.01] to-transparent min-w-0",
          !activeConversationId ? "hidden md:flex" : "flex"
        )}>
          {activeConversationId ? (
            <>
              {/* Header */}
              <div className="p-4 md:p-5 border-b border-white/5 flex justify-between items-center bg-white/[0.02] backdrop-blur-md shrink-0 relative z-30">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setActiveConversationId(null)}
                    className="md:hidden w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-slate-400"
                  >
                    <ArrowLeft size={18} />
                  </button>
                  <div className="w-10 h-10 rounded-2xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/20 shrink-0 overflow-hidden">
                    {otherParticipant?.avatar_url ? (
                      <img src={otherParticipant.avatar_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <User size={16} className="text-white" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold text-white truncate leading-none mb-1">
                      {otherParticipant?.full_name || otherParticipant?.email?.split('@')[0] || 'Member'}
                    </h3>
                    <div className="flex items-center gap-1.5 min-w-0">
                      {isOnline(otherParticipant?.id) ? (
                        <>
                          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          <p className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider">Online</p>
                        </>
                      ) : (
                        <p className="text-[10px] text-slate-500 font-medium truncate">
                          Last seen {formatLastSeen(otherParticipant?.last_seen_at)}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1 md:gap-2">
                  <button
                    onClick={async () => {
                      const meeting = await (startMeeting as any)(undefined, true);
                      if (meeting) window.location.assign(`/meeting/${meeting.id}?audioOnly=true`);
                    }}
                    className="w-8 h-8 md:w-10 md:h-10 rounded-xl bg-white/5 text-slate-400 hover:text-white hover:bg-white/10 transition-all flex items-center justify-center border border-white/5"
                    title="Start Voice Call"
                  >
                    <Phone size={16} />
                  </button>

                  <button
                    onClick={async () => {
                      const meeting = await (startMeeting as any)();
                      if (meeting) window.location.assign(`/meeting/${meeting.id}`);
                    }}
                    className="flex items-center gap-2 px-3 py-1.5 md:px-4 md:py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-500 transition-all shadow-lg shadow-blue-500/20 border border-blue-400/20"
                    title="Start Video Call"
                  >
                    <Video size={16} />
                    <span className="text-[10px] md:text-xs font-bold uppercase tracking-widest hidden sm:inline">Call</span>
                  </button>
                  
                  <button 
                    onClick={() => setIsMsgSearchOpen(!isMsgSearchOpen)}
                    className={cn(
                      "w-8 h-8 rounded-xl transition-all flex items-center justify-center border",
                      isMsgSearchOpen ? "bg-blue-600 border-blue-600 text-white" : "bg-white/5 border-white/5 text-slate-400 hover:text-white"
                    )}
                    title="Search Messages"
                  >
                    <Search size={15} />
                  </button>

                  <div className="relative">
                    <button 
                      onClick={(e) => { e.stopPropagation(); setIsHeaderMenuOpen(!isHeaderMenuOpen); }}
                      className="w-8 h-8 rounded-xl bg-white/5 text-slate-400 hover:text-white transition-all flex items-center justify-center border border-white/5"
                    >
                      <MoreVertical size={15} />
                    </button>
                    <AnimatePresence>
                      {isHeaderMenuOpen && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.95, y: -5 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.95, y: -5 }}
                          className="absolute right-0 top-full mt-2 w-48 bg-[#0f172a] border border-white/10 rounded-2xl shadow-2xl py-2 z-50 overflow-hidden"
                        >
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleArchiveChat(); setIsHeaderMenuOpen(false); }}
                            className="w-full px-4 py-2.5 text-left text-xs font-semibold text-slate-300 hover:text-white hover:bg-white/5 flex items-center gap-3 transition-colors"
                          >
                            <Archive size={14} />
                            Archive Chat
                          </button>
                          <button 
                            onClick={(e) => { e.stopPropagation(); setIsDeleteModalOpen(true); setIsHeaderMenuOpen(false); }}
                            className="w-full px-4 py-2.5 text-left text-xs font-semibold text-red-400 hover:text-red-300 hover:bg-red-500/10 flex items-center gap-3 transition-colors"
                          >
                            <Trash2 size={14} />
                            Delete Chat
                          </button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </div>

              {/* Message Search Bar */}
              <AnimatePresence>
                {isMsgSearchOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="px-6 py-3 bg-blue-500/5 border-b border-blue-500/10 relative z-20"
                  >
                    <div className="relative max-w-lg mx-auto">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-400" size={14} />
                      <input
                        type="text"
                        autoFocus
                        placeholder="Search messages in this conversation..."
                        value={msgSearchQuery}
                        onChange={e => setMsgSearchQuery(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-xl py-2 pl-10 pr-4 text-xs text-white focus:outline-none focus:border-blue-500/50"
                      />
                      {msgSearchQuery && (
                        <button onClick={() => setMsgSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white">
                          <X size={14} />
                        </button>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Upload progress bar */}
              <AnimatePresence>
                {uploadProgress !== null && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="px-6 py-2 bg-blue-500/5 border-b border-blue-500/10"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                        <motion.div
                          className="h-full bg-blue-500 rounded-full"
                          initial={{ width: 0 }}
                          animate={{ width: `${uploadProgress}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-blue-400 font-bold">{uploadProgress}%</span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Messages Area */}
              <div className="flex-1 overflow-y-auto p-4 md:p-10 space-y-6 custom-scrollbar bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] bg-fixed opacity-90">
                <div className="max-w-4xl mx-auto w-full flex flex-col space-y-5">
                  {messages
                    .filter(m => !msgSearchQuery || (m.content || "").toLowerCase().includes(msgSearchQuery.toLowerCase()))
                    .map(msg => (
                      <MessageBubble
                        key={msg.id}
                        msg={msg}
                        isOwn={msg.sender_id === profile?.id}
                        isSelectionMode={isSelectionMode}
                        isSelected={selectedMsgIds.includes(msg.id)}
                        onJoinMeeting={(id, isAudioOnly) => {
                          const url = `/meeting/${id}${isAudioOnly ? '?audioOnly=true' : ''}`;
                          window.location.assign(url);
                        }}
                        onDelete={(id) => deleteMessage(id)}
                        onSelect={toggleSelect}
                        onLongPress={handleLongPress}
                      />
                    ))}

                  {/* Typing indicator */}
                  <AnimatePresence>
                    {typingUsers.length > 0 && (
                      <motion.div
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 6 }}
                        className="flex items-center gap-2"
                      >
                        <div className="px-4 py-3 bg-white/[0.06] border border-white/10 rounded-2xl rounded-tl-none">
                          <div className="flex items-center gap-1">
                            {[0, 1, 2].map(i => (
                              <div
                                key={i}
                                className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce"
                                style={{ animationDelay: `${i * 0.15}s` }}
                              />
                            ))}
                          </div>
                        </div>
                        <span className="text-[10px] text-slate-500">{typingUsers[0]} is typing...</span>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div ref={scrollRef} />
                </div>
              </div>

              {/* Selection Toolbar */}
              <AnimatePresence>
                {isSelectionMode && (
                  <motion.div
                    initial={{ y: 100 }}
                    animate={{ y: 0 }}
                    exit={{ y: 100 }}
                    className="fixed bottom-24 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-lg bg-blue-600 border border-blue-400/30 rounded-3xl shadow-2xl p-4 md:p-6 flex items-center justify-between z-40 mb-2 md:mb-0"
                  >
                    <div className="flex items-center gap-4">
                      <button 
                        onClick={cancelSelection}
                        className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-all"
                      >
                        <X size={20} />
                      </button>
                      <div>
                        <p className="text-sm font-bold text-white leading-none">{selectedMsgIds.length} Selected</p>
                        <p className="text-[10px] text-blue-100/70 mt-1 font-medium">Messages in this chat</p>
                      </div>
                    </div>
                    <button 
                      onClick={handleBatchDelete}
                      disabled={selectedMsgIds.length === 0}
                      className="px-6 py-3 bg-white text-blue-600 rounded-2xl font-bold text-xs hover:bg-blue-50 transition-all shadow-xl shadow-black/10 flex items-center gap-2"
                    >
                      <Trash2 size={14} />
                      Delete Selected
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Input Area */}
              <div className="p-4 md:p-6 border-t border-white/5 bg-[#0a0f1d]/80 backdrop-blur-md shrink-0">
                <div className="max-w-4xl mx-auto flex items-center gap-3">
                  {/* Audio Recorder */}
                  <AudioRecorder
                    onAudioReady={file => sendMedia(file)}
                    disabled={uploadProgress !== null}
                  />

                  {/* Media Upload */}
                  <ChatMediaUpload
                    onFileSelected={file => sendMedia(file)}
                    disabled={uploadProgress !== null}
                    uploadProgress={uploadProgress}
                  />

                  {/* Text Input */}
                  <div className="flex-1 relative">
                    <input
                      type="text"
                      value={messageInput}
                      onChange={e => handleInputChange(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
                      placeholder="Type a message..."
                      className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 px-5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-blue-500/50 transition-all font-medium"
                    />
                  </div>

                  {/* Send */}
                  <button
                    onClick={handleSend}
                    disabled={!messageInput.trim() && uploadProgress !== null}
                    className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center hover:bg-blue-500 transition-all shadow-xl shadow-blue-500/20 border border-blue-400/20 shrink-0 disabled:opacity-50"
                  >
                    <Send size={18} />
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-20 bg-white/[0.01]">
              <div className="w-24 h-24 rounded-[2rem] bg-gradient-to-br from-blue-600/10 to-indigo-600/10 border border-white/5 flex items-center justify-center text-blue-500 mb-8 shadow-2xl">
                <MessageSquare size={40} />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Direct Messaging</h3>
              <p className="text-sm text-slate-500 max-w-sm leading-relaxed font-medium">
                Select a conversation or start a new one. Supports text, images, voice messages and files.
              </p>
              <div className="flex items-center gap-4 mt-6 text-xs text-slate-600">
                <span className="flex items-center gap-1.5"><ImageIcon size={12} /> Images</span>
                <span className="flex items-center gap-1.5"><Mic size={12} /> Voice</span>
                <span className="flex items-center gap-1.5"><Paperclip size={12} /> Files</span>
              </div>
              <button
                onClick={() => setIsNewChatModalOpen(true)}
                className="mt-8 px-8 py-3 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl transition-all shadow-xl shadow-blue-500/20"
              >
                Start New Chat
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── New Chat Modal ──────────────────────────────────────────────── */}
      <AnimatePresence>
        {isNewChatModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setIsNewChatModalOpen(false)}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-[#0f172a] border border-white/10 rounded-[2rem] shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-white/5 bg-white/[0.02] flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white">New Message</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Select someone to message</p>
                </div>
                <button onClick={() => setIsNewChatModalOpen(false)} className="text-slate-500 hover:text-white">
                  <X size={18} />
                </button>
              </div>

              <div className="p-4">
                <div className="relative mb-3">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" size={14} />
                  <input
                    type="text"
                    placeholder="Search people..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-blue-500/50 transition-all"
                  />
                </div>
              </div>

              <div className="px-4 pb-4 max-h-[360px] overflow-y-auto custom-scrollbar space-y-1">
                {potentialParticipants
                  .filter(u => (u.full_name || u.email || '').toLowerCase().includes(searchQuery.toLowerCase()))
                  .map(user => (
                    <button
                      key={user.id}
                      onClick={() => {
                        startChat(user.id);
                        setTempTargetName(user.full_name || user.email?.split('@')[0] || 'Member');
                      }}
                      className="flex items-center gap-4 p-4 hover:bg-white/5 rounded-2xl cursor-pointer transition-all border border-transparent hover:border-white/5 group"
                    >
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white font-bold text-xs shadow-lg shrink-0 overflow-hidden">
                        {user.avatar_url ? (
                          <img src={user.avatar_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          (user.full_name?.[0] || user.email?.[0] || 'U').toUpperCase()
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-white truncate group-hover:text-blue-400 transition-colors">
                          {user.full_name || user.email?.split('@')[0]}
                        </p>
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{user.role}</p>
                      </div>
                      <ChevronRight size={14} className="text-slate-700 group-hover:text-blue-400 transition-all" />
                    </button>
                  ))}
                {potentialParticipants.length === 0 && (
                  <div className="py-10 text-center text-slate-500 text-xs font-medium">
                    No users available to message.
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Delete Modal ────────────────────────────────────────────────── */}
      <AnimatePresence>
        {isDeleteModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 text-white">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setIsDeleteModalOpen(false)}
              className="absolute inset-0 bg-slate-950/90 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-sm bg-slate-900 border border-white/10 rounded-[2.5rem] shadow-2xl p-8 text-center"
            >
              <div className="w-16 h-16 rounded-2xl bg-red-500/20 text-red-500 flex items-center justify-center mx-auto mb-6 border border-red-500/20">
                <AlertTriangle size={32} />
              </div>
              <h3 className="text-xl font-bold mb-2">Delete Conversation?</h3>
              <p className="text-sm text-slate-400 mb-8 leading-relaxed">
                This will permanently delete all messages and media in this conversation. This cannot be undone.
              </p>
              <div className="flex flex-col gap-3">
                <button onClick={handleDeleteChat} className="w-full py-4 bg-red-600 hover:bg-red-500 rounded-2xl font-bold text-sm transition-all shadow-xl shadow-red-600/20">
                  Confirm Delete
                </button>
                <button onClick={() => setIsDeleteModalOpen(false)} className="w-full py-4 bg-white/5 hover:bg-white/10 rounded-2xl font-bold text-sm transition-all border border-white/5">
                  Cancel
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </Layout>
  );
}
