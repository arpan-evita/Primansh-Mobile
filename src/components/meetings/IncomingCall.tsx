import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Phone, PhoneOff, Video, Mic, User, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface IncomingCallProps {
  meetingId: string;
  callerName: string;
  callerAvatar?: string;
  isAudioOnly: boolean;
  onAccept: () => void;
  onDecline: () => void;
}

export const IncomingCall: React.FC<IncomingCallProps> = ({
  callerName,
  callerAvatar,
  isAudioOnly,
  onAccept,
  onDecline
}) => {
  const [timeLeft, setTimeLeft] = useState(30);

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          onDecline();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [onDecline]);

  return (
    <motion.div
      initial={{ y: -100, opacity: 0, scale: 0.9 }}
      animate={{ y: 0, opacity: 1, scale: 1 }}
      exit={{ y: -100, opacity: 0, scale: 0.9 }}
      className="fixed top-6 left-1/2 -translate-x-1/2 z-[9999] w-full max-w-md px-4"
    >
      <div className="bg-slate-900/95 backdrop-blur-2xl border border-white/10 rounded-[2rem] p-4 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.6)] flex items-center gap-4">
        <div className="relative">
          <div className="w-14 h-14 rounded-2xl bg-blue-600/20 flex items-center justify-center overflow-hidden border border-blue-500/20">
            {callerAvatar ? (
              <img src={callerAvatar} alt={callerName} className="w-full h-full object-cover" />
            ) : (
              <User size={24} className="text-blue-400" />
            )}
          </div>
          <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-lg bg-blue-600 flex items-center justify-center border-2 border-slate-900">
            {isAudioOnly ? <Mic size={12} className="text-white" /> : <Video size={12} className="text-white" />}
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-black text-blue-400 uppercase tracking-[0.2em] mb-0.5">Incoming {isAudioOnly ? "Voice" : "Video"} Call</p>
          <h4 className="text-sm font-bold text-white truncate">{callerName}</h4>
          <div className="flex items-center gap-2 mt-1">
            <div className="flex gap-1">
              {[...Array(3)].map((_, i) => (
                <motion.div
                  key={i}
                  animate={{ scale: [1, 1.5, 1], opacity: [0.3, 1, 0.3] }}
                  transition={{ repeat: Infinity, duration: 1.5, delay: i * 0.2 }}
                  className="w-1 h-1 rounded-full bg-blue-500"
                />
              ))}
            </div>
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{timeLeft}s remaining</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onDecline}
            className="w-10 h-10 rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all flex items-center justify-center"
          >
            <PhoneOff size={18} />
          </button>
          <button
            onClick={onAccept}
            className="w-10 h-10 rounded-xl bg-green-500 text-white hover:bg-green-600 transition-all flex items-center justify-center shadow-lg shadow-green-500/20 animate-bounce-subtle"
          >
            <Phone size={18} />
          </button>
        </div>
      </div>
    </motion.div>
  );
};
