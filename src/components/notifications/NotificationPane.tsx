import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, X, CheckCircle2, MessageSquare, UserPlus, Info, ChevronRight } from 'lucide-react';
import { useGlobalUI } from '@/contexts/GlobalUIContext';
import { cn } from '@/lib/utils';
import { useNotifications, Notification } from '@/hooks/useNotifications';

export function NotificationPane() {
  const { isNotificationsOpen, setIsNotificationsOpen } = useGlobalUI();
  const { notifications, markAsRead, loading, markAllAsRead } = useNotifications();

  const formatNotifTime = (ts: string) => {
    const date = new Date(ts);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  return (
    <AnimatePresence>
      {isNotificationsOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsNotificationsOpen(false)}
            className="fixed inset-0 z-[150] bg-slate-950/40 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, x: 20, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 20, scale: 0.95 }}
            className="fixed top-[calc(var(--header-height)+12px)] right-6 z-[160] w-full max-w-sm bg-[#0b0f1a] border border-white/10 rounded-[2.5rem] shadow-2xl shadow-black/80 overflow-hidden"
          >
            <div className="p-6 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
              <div>
                <h3 className="text-sm font-bold text-white tracking-tight">Activity Feed</h3>
                <p className="text-[10px] text-slate-500 font-medium uppercase tracking-widest mt-0.5">Real-time intelligence</p>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setIsNotificationsOpen(false)}
                  className="w-8 h-8 rounded-full hover:bg-white/5 flex items-center justify-center text-slate-500 transition-colors"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
              {notifications.length > 0 ? (
                <div className="divide-y divide-white/5">
                  {notifications.map((n) => (
                    <div 
                      key={n.id} 
                      onClick={() => markAsRead(n.id)}
                      className={cn(
                        "p-5 flex gap-4 hover:bg-white/[0.02] transition-colors cursor-pointer group relative",
                        !n.read && "bg-blue-500/[0.03]"
                      )}
                    >
                      {!n.read && (
                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500" />
                      )}
                      
                      <div className="shrink-0 mt-1">
                        <NotificationIcon type={n.type} />
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start mb-1">
                          <h4 className="text-xs font-bold text-white pr-2 leading-tight">{n.title}</h4>
                          <span className="text-[9px] text-slate-600 font-mono shrink-0 uppercase">{formatNotifTime(n.created_at)}</span>
                        </div>
                        <p className="text-[11px] text-slate-400 leading-relaxed line-clamp-3">{n.message}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-20 text-center">
                  <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center mx-auto mb-4 text-slate-700">
                    <Bell size={20} />
                  </div>
                  <p className="text-sm font-bold text-slate-600">{loading ? 'Loading notifications...' : 'All caught up!'}</p>
                </div>
              )}
            </div>

            <div className="p-4 bg-white/[0.01] border-t border-white/5">
              <button 
                onClick={markAllAsRead}
                className="w-full py-3 rounded-2xl bg-white/5 hover:bg-white/10 text-[10px] font-bold text-slate-400 hover:text-white uppercase tracking-widest transition-all flex items-center justify-center gap-2 group"
              >
                Mark all as read
                <ChevronRight size={12} className="group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function NotificationIcon({ type }: { type: string }) {
  switch (type) {
    case 'lead':
      return (
        <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500">
          <UserPlus size={14} />
        </div>
      );
    case 'task':
      return (
        <div className="w-8 h-8 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-500">
          <CheckCircle2 size={14} />
        </div>
      );
    case 'message':
      return (
        <div className="w-8 h-8 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-500">
          <MessageSquare size={14} />
        </div>
      );
    default:
      return (
        <div className="w-8 h-8 rounded-xl bg-slate-500/10 border border-slate-500/20 flex items-center justify-center text-slate-400">
          <Info size={14} />
        </div>
      );
  }
}
