import { Video, Calendar, ArrowRight, UserPlus, Phone } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useState } from "react";
import { MessageSquare, X as CloseIcon } from "lucide-react";

// Checklist for meeting summary feature:
// - [x] 1. Create `20260328_meeting_summary_retention.sql` for DB changes and RPCs.
// - [x] 2. Update `MeetingRoomPage` `endMeeting` to trigger the summary finalization.
// - [x] 3. Update `MessageCard` to show "View Recap" button for meetings with summaries.
// - [x] 4. Commit, Push, and request user test.

interface MeetingCardProps {
  meetingId: string;
  status: 'active' | 'ended' | 'scheduled';
  startTime: string;
  isOwn: boolean;
  isAudioOnly?: boolean;
  chatSummary?: any[];
  onJoin: (id: string) => void;
}

export function MeetingCard({ meetingId, status, startTime, isOwn, isAudioOnly, chatSummary, onJoin }: MeetingCardProps) {
  const [showRecap, setShowRecap] = useState(false);
  const isActive = status === 'active';
  const isEnded = status === 'ended';

  return (
    <div className={cn(
      "p-4 rounded-2xl border flex flex-col gap-4 min-w-[260px] max-w-[320px] transition-all",
      isActive 
        ? "bg-blue-600/10 border-blue-500/30 shadow-lg shadow-blue-500/10" 
        : "bg-white/5 border-white/10 opacity-80"
    )}>
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className={cn(
            "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
            isActive ? "bg-blue-500 text-white" : "bg-slate-700 text-slate-400"
          )}>
            {isAudioOnly ? <Phone size={20} /> : <Video size={20} />}
          </div>
          <div>
            <h4 className="text-sm font-bold text-white">
              {isAudioOnly ? "Voice Call" : "Video Meeting"}
            </h4>
            <p className="text-[10px] text-slate-400 font-medium">
              {isActive ? "Happening now" : isEnded ? "Meeting ended" : "Scheduled"}
            </p>
          </div>
        </div>
        
        {isActive && (
          <div className="flex gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-ping" />
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 text-[11px] text-slate-400 bg-white/5 rounded-lg px-3 py-2">
        <Calendar size={12} />
        <span>{format(new Date(startTime), "MMM do, h:mm a")}</span>
      </div>

      {!isEnded && (
        <button
          onClick={() => onJoin(meetingId)}
          className={cn(
            "w-full py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all",
            isActive 
              ? "bg-blue-600 text-white hover:bg-blue-500 shadow-md shadow-blue-600/20"
              : "bg-white/10 text-white hover:bg-white/15"
          )}
        >
          {isActive ? "Join Meeting" : "Set Reminder"}
          <ArrowRight size={14} />
        </button>
      )}

      {isEnded && (
        <div className="flex flex-col gap-2">
          <div className="text-center py-1">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Ended</span>
          </div>
          {chatSummary && chatSummary.length > 0 && (
            <button
              onClick={() => setShowRecap(true)}
              className="w-full py-2 bg-blue-600/10 text-blue-400 border border-blue-500/20 rounded-xl text-[11px] font-bold hover:bg-blue-600/20 transition-all flex items-center justify-center gap-2"
            >
              <MessageSquare size={13} />
              View Chat Recap
            </button>
          )}
        </div>
      )}

      {/* Recap Modal */}
      {showRecap && chatSummary && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-white/10 w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[80vh]">
            <div className="p-5 border-b border-white/5 flex items-center justify-between bg-white/5">
              <div>
                <h3 className="text-sm font-bold text-white">Meeting Chat Recap</h3>
                <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mt-0.5">
                  {format(new Date(startTime), "MMMM do, yyyy")}
                </p>
              </div>
              <button onClick={() => setShowRecap(false)} className="p-2 hover:bg-white/5 rounded-full text-slate-500 hover:text-white transition-all">
                <CloseIcon size={20} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar bg-[#020617]">
              {chatSummary.map((msg: any, i: number) => (
                <div key={i} className="flex flex-col gap-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold text-blue-400">{msg.sender_name}</span>
                    <span className="text-[9px] text-slate-600">{format(new Date(msg.created_at), "h:mm a")}</span>
                  </div>
                  <div className="bg-white/5 border border-white/5 p-3 rounded-2xl rounded-tl-none text-xs text-slate-200 leading-relaxed max-w-[90%]">
                    {msg.content}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
