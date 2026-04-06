import React, { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/layout/AppShell";
import { PortalLayout } from "@/components/layout/PortalLayout";
import { 
  Video, 
  Phone, 
  Search, 
  Users, 
  Clock, 
  ArrowRight,
  Shield,
  Play,
  X,
  Check,
  Square
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { useNavigate, useParams } from "react-router-dom";
import { useMessages } from "@/hooks/useMessages";
import { canMessage, getAllowedRecipients, normalizeRole } from "@/lib/canMessage";
import { cn } from "@/lib/utils";

export default function MeetingsPage() {
  const { profile, user } = useAuth();
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const isPortal = window.location.pathname.includes("/clientportal/");
  
  const [searchQuery, setSearchQuery] = useState("");
  const [activeMeetings, setActiveMeetings] = useState<any[]>([]);
  const [endedMeetings, setEndedMeetings] = useState<any[]>([]);
  const [potentialParticipants, setPotentialParticipants] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'active' | 'history'>('active');
  const [selectedMeeting, setSelectedMeeting] = useState<any | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Use the messaging hook logic to handle conversation creation
  const { startMeeting, createConversation } = useMessages();

  useEffect(() => {
    if (profile) {
      fetchData();
      
      // Subscribe to meeting updates
      const channel = supabase
        .channel('meetings-sync')
        .on(
          'postgres_changes' as any,
          { 
            event: '*', 
            table: 'meetings', 
            schema: 'public' 
          }, 
          () => fetchData()
        )
        .subscribe();
        
      return () => { supabase.removeChannel(channel); };
    }
  }, [profile]);

  const fetchData = async () => {
    if (!profile) return;
    setIsLoading(true);
    try {
      // 1. Fetch Active Meetings for this user's conversations
      const { data: participation } = await supabase
        .from('conversation_participants')
        .select('conversation_id')
        .eq('profile_id', profile.id);
      
      const convIds = (participation || []).map(p => p.conversation_id);
      
      if (convIds.length > 0 || profile.role === 'admin') {
        let activeQuery = supabase
          .from('meetings')
          .select('*, conversation:conversations(title, participants:conversation_participants(profile:profiles(full_name, avatar_url, role)))')
          .eq('status', 'active')
          .order('start_time', { ascending: false });
        
        let endedQuery = supabase
          .from('meetings')
          .select('*, conversation:conversations(title, participants:conversation_participants(profile:profiles(full_name, avatar_url, role)))')
          .eq('status', 'ended')
          .order('end_time', { ascending: false })
          .limit(20);
        
        if (profile.role !== 'admin') {
          activeQuery = activeQuery.in('conversation_id', convIds);
          endedQuery = endedQuery.in('conversation_id', convIds);
        }
        
        const [activeRes, endedRes] = await Promise.all([activeQuery, endedQuery]);
        setActiveMeetings(activeRes.data || []);
        setEndedMeetings(endedRes.data || []);
      }

      // 2. Fetch Potential Participants based on RBAC
      const { data: allProfiles } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url, role, associated_client_id')
        .neq('id', profile.id);

      let senderAssignedClientIds: string[] = [];
      const sRole = normalizeRole(profile.role || '');
      const isStaff = ['seo', 'content', 'developer', 'team'].includes(sRole);

      if (isStaff) {
        const { data: assignments } = await supabase
          .from('team_assigned_clients')
          .select('client_id')
          .eq('team_member_id', profile.id);
        senderAssignedClientIds = (assignments || []).map(a => a.client_id);
      }

      const allowed = getAllowedRecipients(profile as any, allProfiles || [], senderAssignedClientIds);
      setPotentialParticipants(allowed);

    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartCall = async (targetUserId: string, isAudioOnly: boolean = false) => {
    try {
      // 1. Find or Create conversation
      const { data: common } = await supabase.rpc('find_common_conversation', {
        p_user1: profile?.id,
        p_user2: targetUserId
      });

      let conversationId = common;
      if (!conversationId) {
        conversationId = await createConversation([targetUserId]);
      }

      if (conversationId) {
        // 2. Check for existing active meeting first to avoid duplicate sessions
        const existingMeeting = activeMeetings.find(m => m.conversation_id === conversationId);
        
        if (existingMeeting) {
          joinMeeting(existingMeeting.id, existingMeeting.is_audio_only);
          return;
        }

        // 3. Start new meeting if none exist
        const meeting = await startMeeting(conversationId, isAudioOnly);
        if (meeting) {
          navigate(`/meeting/${meeting.id}${isAudioOnly ? '?audioOnly=true' : ''}`);
        }
      }
    } catch (err) {
      toast.error("Failed to initiate call");
    }
  };

  const handleStartGroupCall = async (isAudioOnly: boolean = false) => {
    if (selectedIds.length === 0) return;
    
    setIsLoading(true);
    try {
      // 1. Create group conversation
      const conversationId = await createConversation(selectedIds, "Group Meeting");
      
      if (conversationId) {
        // 2. Start meeting
        const meeting = await startMeeting(conversationId, isAudioOnly);
        if (meeting) {
          navigate(`/meeting/${meeting.id}${isAudioOnly ? '?audioOnly=true' : ''}`);
        }
      }
    } catch (err) {
      toast.error("Failed to initiate group call");
    } finally {
      setIsLoading(false);
    }
  };

  const toggleParticipantSelection = (uid: string) => {
    setSelectedIds(prev => 
      prev.includes(uid) 
        ? prev.filter(id => id !== uid) 
        : [...prev, uid]
    );
  };

  const joinMeeting = (id: string, isAudioOnly: boolean = false) => {
    navigate(`/meeting/${id}${isAudioOnly ? '?audioOnly=true' : ''}`);
  };

  const filteredParticipants = potentialParticipants.filter(p =>
    p.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.role?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const Content = (
    <div className="max-w-6xl mx-auto space-y-8 pb-20">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-3">
            <Video className="text-blue-500" /> Collaboration Hub
          </h1>
          <p className="text-slate-500 text-sm mt-1">Professional video and audio communication for your projects.</p>
        </div>

        <div className="relative group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-blue-500 transition-colors" size={18} />
          <input
            type="text"
            placeholder="Search people to call..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-white/5 border border-white/10 rounded-2xl pl-12 pr-6 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 w-full md:w-80 transition-all backdrop-blur-sm"
          />
        </div>
      </div>

      {/* Tab Switcher */}
      <div className="flex items-center gap-1 p-1 bg-white/5 border border-white/10 rounded-2xl w-fit">
        <button
          onClick={() => setActiveTab('active')}
          className={cn(
            "px-6 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all",
            activeTab === 'active' ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20" : "text-slate-500 hover:text-slate-300"
          )}
        >
          Active Sessions
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={cn(
            "px-6 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all",
            activeTab === 'history' ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20" : "text-slate-500 hover:text-slate-300"
          )}
        >
          Meeting History
        </button>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'active' ? (
          <motion.div
            key="active-tab"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="space-y-8"
          >
            {/* Active Meetings Section */}
            {activeMeetings.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <h2 className="text-sm font-bold text-white uppercase tracking-widest">Ongoing Sessions</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {activeMeetings.map((meeting) => (
                    <motion.div
                      key={meeting.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-gradient-to-br from-emerald-500/10 to-blue-500/10 border border-emerald-500/20 rounded-3xl p-6 relative overflow-hidden group hover:border-emerald-500/40 transition-all"
                    >
                      <div className="relative z-10">
                        <div className="flex justify-between items-start mb-4">
                          <div className="p-2.5 bg-emerald-500/20 rounded-xl text-emerald-400">
                            <Video size={20} />
                          </div>
                          <span className="text-[10px] font-black bg-emerald-500 text-white px-2 py-1 rounded-lg uppercase tracking-wider">LIVE</span>
                        </div>
                        <h3 className="text-lg font-bold text-white mb-1 line-clamp-1">
                          {meeting.conversation?.title || "Team Meeting"}
                        </h3>
                        <div className="flex items-center gap-2 text-slate-400 text-xs mb-6">
                          <Clock size={12} />
                          Started {new Date(meeting.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                        <button
                          onClick={() => joinMeeting(meeting.id, meeting.is_audio_only)}
                          className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-black text-xs py-3 rounded-xl transition-all shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2"
                        >
                          JOIN NOW <ArrowRight size={14} />
                        </button>
                      </div>
                      {/* Background Decoration */}
                      <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:opacity-10 transition-opacity">
                         <Video size={100} />
                      </div>
                    </motion.div>
                  ))}
                </div>
              </section>
            )}

            {/* Participants Grid */}
            <section>
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
                <div className="flex items-center gap-2">
                  <Users className="text-blue-500" size={18} />
                  <h2 className="text-sm font-bold text-white uppercase tracking-widest">Available to Call</h2>
                </div>

                <div className="flex items-center gap-2">
                  {isSelecting ? (
                    <>
                      <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest mr-2">
                        {selectedIds.length} Selected
                      </span>
                      <button
                        onClick={() => { setIsSelecting(false); setSelectedIds([]); }}
                        className="px-4 py-1.5 bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white text-[10px] font-black uppercase tracking-widest rounded-lg transition-all"
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => setIsSelecting(true)}
                      className="flex items-center gap-2 px-4 py-1.5 bg-blue-600/10 hover:bg-blue-600/20 text-blue-500 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all border border-blue-500/20"
                    >
                      <Users size={12} /> Group Meeting
                    </button>
                  )}
                </div>
              </div>

              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-20 bg-white/5 border border-white/10 rounded-[32px]">
                  <div className="w-10 h-10 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mb-4" />
                  <p className="text-slate-500 text-sm font-medium">Resolving permissions...</p>
                </div>
              ) : filteredParticipants.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {filteredParticipants.map((p) => (
                    <motion.div
                      key={p.id}
                      layout
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className={cn(
                        "bg-white/5 border border-white/10 rounded-[32px] p-5 hover:bg-white/[0.08] transition-all group border-b-4 relative",
                        selectedIds.includes(p.id) ? "border-blue-500 ring-2 ring-blue-500/20" : "hover:border-b-blue-500/50"
                      )}
                      onClick={isSelecting ? () => toggleParticipantSelection(p.id) : undefined}
                    >
                      {isSelecting && (
                        <div className="absolute top-4 right-4 z-10">
                          <div className={cn(
                            "w-6 h-6 rounded-lg flex items-center justify-center transition-all",
                            selectedIds.includes(p.id) ? "bg-blue-500 text-white" : "bg-white/5 border border-white/10 text-transparent"
                          )}>
                            <Check size={14} />
                          </div>
                        </div>
                      )}
                      <div className="flex items-center gap-4 mb-5">
                        <div className="relative">
                          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-lg font-black text-white overflow-hidden shadow-xl shadow-blue-500/10">
                            {p.avatar_url ? (
                              <img src={p.avatar_url} alt="" className="w-full h-full object-cover" />
                            ) : (
                              p.full_name?.[0] || "U"
                            )}
                          </div>
                          <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 border-2 border-[#070b14]" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h4 className="text-sm font-bold text-white truncate group-hover:text-blue-400 transition-colors">
                            {p.full_name}
                          </h4>
                          <p className="text-[10px] uppercase font-black tracking-widest text-slate-500 mt-0.5 flex items-center gap-1.5">
                            {p.role === 'admin' && <Shield size={10} className="text-blue-500" />}
                            {p.role}
                          </p>
                        </div>
                      </div>

                      {!isSelecting && (
                        <div className="flex gap-2">
                          <button
                            onClick={(e) => { e.stopPropagation(); handleStartCall(p.id, false); }}
                            className="flex-1 bg-blue-600 hover:bg-blue-500 text-white p-2.5 rounded-xl transition-all flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-wider shadow-lg shadow-blue-500/20"
                          >
                            <Video size={14} /> Video
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleStartCall(p.id, true); }}
                            className="px-3 bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white rounded-xl transition-all flex items-center justify-center border border-white/10"
                          >
                            <Phone size={14} />
                          </button>
                        </div>
                      )}
                    </motion.div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-20 bg-white/5 border border-white/10 rounded-[32px] text-center px-6">
                  <div className="w-16 h-16 bg-white/5 rounded-3xl flex items-center justify-center text-slate-600 mb-4">
                    <Users size={32} />
                  </div>
                  <h3 className="text-white font-bold mb-1">No contacts found</h3>
                  <p className="text-slate-500 text-xs max-w-xs">You can only start meetings with people assigned to your projects or team members.</p>
                </div>
              )}
            </section>
          </motion.div>
        ) : (
          <motion.div
            key="history-tab"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            <div className="flex items-center gap-2 mb-4">
              <Clock className="text-blue-500" size={18} />
              <h2 className="text-sm font-bold text-white uppercase tracking-widest">Recent Conclusions</h2>
            </div>

            {endedMeetings.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {endedMeetings.map((meeting) => (
                  <div
                    key={meeting.id}
                    className="bg-white/5 border border-white/10 rounded-[32px] p-6 hover:bg-white/[0.08] transition-all relative overflow-hidden group"
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div className="p-2.5 bg-white/5 rounded-xl text-slate-400">
                        <Play size={18} />
                      </div>
                      <div className="text-[9px] font-bold text-slate-500 bg-white/5 px-2 py-1 rounded-lg uppercase tracking-widest flex items-center gap-1.5">
                        <Clock size={10} /> {new Date(meeting.end_time || meeting.updated_at).toLocaleDateString()}
                      </div>
                    </div>
                    <h3 className="text-sm font-bold text-white mb-2 truncate">
                      {meeting.conversation?.title || "Team Sync"}
                    </h3>
                    <div className="space-y-2 mb-6">
                      <div className="flex items-center gap-2 text-[10px] text-slate-400 font-medium">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                        Started at {new Date(meeting.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-slate-400 font-medium">
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-600" />
                        Ended at {new Date(meeting.end_time || meeting.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                    <button
                      onClick={() => setSelectedMeeting(meeting)}
                      className="w-full bg-white/5 hover:bg-white/10 text-slate-300 text-[10px] font-black uppercase tracking-widest py-3 rounded-xl border border-white/5 transition-all flex items-center justify-center gap-2"
                    >
                      View Summary
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-20 bg-white/5 border border-white/10 rounded-[32px] text-center px-6">
                <div className="w-16 h-16 bg-white/5 rounded-3xl flex items-center justify-center text-slate-600 mb-4">
                  <Clock size={32} />
                </div>
                <h3 className="text-white font-bold mb-1">No history yet</h3>
                <p className="text-slate-500 text-xs max-w-xs">Completed meetings will appear here once they are formally ended.</p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Summary Side Panel */}
      <AnimatePresence>
        {selectedMeeting && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedMeeting(null)}
              className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50"
            />
            <motion.aside
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-slate-900 border-l border-white/10 z-[60] flex flex-col shadow-2xl"
            >
              <div className="p-6 border-b border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-500/10 rounded-xl text-blue-500">
                    <Clock size={20} />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white leading-tight">Meeting Summary</h3>
                    <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">
                      {new Date(selectedMeeting.start_time).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedMeeting(null)}
                  className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-slate-400 hover:text-white"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-8">
                <section>
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-4">Title & Context</h4>
                  <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
                    <h3 className="text-xl font-bold text-white mb-1">
                      {selectedMeeting.conversation?.title || "Team Collaboration"}
                    </h3>
                    <p className="text-xs text-slate-400">Regular agency project synchronization and discussion.</p>
                  </div>
                </section>

                <section>
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-4">Timeline</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
                      <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Started At</p>
                      <p className="text-sm font-bold text-blue-400">
                        {new Date(selectedMeeting.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
                      <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Ended At</p>
                      <p className="text-sm font-bold text-slate-300">
                        {new Date(selectedMeeting.end_time || selectedMeeting.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                </section>

                <section>
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-4">Participants ({selectedMeeting.conversation?.participants?.length || 0})</h4>
                  <div className="space-y-3">
                    {selectedMeeting.conversation?.participants?.map((p: any, idx: number) => (
                      <div key={idx} className="flex items-center gap-3 bg-white/5 p-3 rounded-2xl border border-white/10">
                        <div className="w-10 h-10 rounded-xl bg-blue-600/20 flex items-center justify-center text-sm font-black text-blue-500 overflow-hidden">
                          {p.profile?.avatar_url ? (
                            <img src={p.profile.avatar_url} className="w-full h-full object-cover" alt="" />
                          ) : (
                            p.profile?.full_name?.[0] || 'U'
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-white">{p.profile?.full_name}</p>
                          <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest">{p.profile?.role}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                <section>
                  <div className="bg-blue-600/10 border border-blue-500/20 rounded-2xl p-4 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
                      <Shield size={24} />
                    </div>
                    <div>
                      <h5 className="text-sm font-black text-white uppercase tracking-wider">Secure Call</h5>
                      <p className="text-[10px] text-blue-400 font-medium">This meeting was end-to-end synchronized.</p>
                    </div>
                  </div>
                </section>
              </div>

              <div className="p-6 border-t border-white/5 flex gap-3">
                <button
                  onClick={() => setSelectedMeeting(null)}
                  className="flex-1 bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white py-4 rounded-2xl text-xs font-black uppercase tracking-widest transition-all"
                >
                  Close Summary
                </button>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Group Call Floating Bar */}
      <AnimatePresence>
        {isSelecting && selectedIds.length > 0 && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-10 left-1/2 -translate-x-1/2 z-50 w-full max-w-sm px-4"
          >
            <div className="bg-slate-900/90 backdrop-blur-2xl border border-white/10 rounded-3xl p-4 shadow-2xl flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-600 flex items-center justify-center text-white font-black">
                  {selectedIds.length}
                </div>
                <div>
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none mb-1">Participants</p>
                  <p className="text-xs font-bold text-white">Selected for group call</p>
                </div>
              </div>
              
              <div className="flex gap-2">
                <button
                  onClick={() => handleStartGroupCall(false)}
                  className="w-10 h-10 bg-blue-600 hover:bg-blue-500 text-white rounded-xl flex items-center justify-center transition-all shadow-lg shadow-blue-500/20"
                >
                  <Video size={18} />
                </button>
                <button
                  onClick={() => handleStartGroupCall(true)}
                  className="w-10 h-10 bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white rounded-xl flex items-center justify-center transition-all border border-white/5"
                >
                  <Phone size={18} />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );

  if (isPortal) {
    return (
      <PortalLayout title="Collaboration" subtitle="Meetings & Calls" clientId={slug}>
        {Content}
      </PortalLayout>
    );
  }

  return (
    <AppShell title="Meetings" subtitle="Video & Audio Hub">
      {Content}
    </AppShell>
  );
}
