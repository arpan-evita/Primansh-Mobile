import { CheckSquare, PenTool, MessageSquare, TrendingUp, Clock, Star, Activity, Zap, ChevronRight, Award } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface TeamDashboardProps {
  profile: any;
  stats: any;
}

export function TeamDashboard({ profile, stats }: TeamDashboardProps) {
  const completionRate = stats?.tasks.length ? Math.round((stats.tasksDone / stats.tasks.length) * 100) : 0;
  
  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 max-w-7xl mx-auto">
      {/* 👤 PERSONAL STATUS HEADER */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-2 border-b border-white/5 mx-1">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
              <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">Active Node</span>
            </div>
            <span className="text-slate-500 text-[10px] uppercase tracking-widest font-mono">// OPERATOR: {profile?.full_name?.split(' ')[0] || 'PR-01'}</span>
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3">
            Performance <span className="text-accent italic font-light font-mono text-2xl">Matrix</span>
          </h1>
        </div>

        <div className="flex items-center gap-8 text-right">
          <div className="hidden sm:block">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Weekly Throughput</p>
            <div className="flex items-center justify-end gap-2 text-white/80 font-mono text-lg font-medium">
              <Activity size={16} className="text-accent/60" />
              {stats?.tasksDone || 0} / {stats?.tasks.length || 0}
            </div>
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Current Standing</p>
            <div className="flex items-center justify-end gap-2 text-emerald-400 font-mono text-lg font-medium">
              <Award size={16} className="text-emerald-500/60" />
              {completionRate >= 90 ? 'ELITE' : completionRate >= 70 ? 'CORE' : 'INCUBATION'}
            </div>
          </div>
        </div>
      </div>

      {/* 📊 CORE METRICS GRID */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard 
          label="Total Workflow" 
          value={stats?.tasks.length || 0} 
          icon={CheckSquare} 
          color="#3b82f6" 
          bg="rgba(59,130,246,0.12)"
          sub="Assigned Tasks" 
        />
        <StatCard 
          label="Achievement" 
          value={`${completionRate}%`} 
          icon={Star} 
          color="#10b981" 
          bg="rgba(16,185,129,0.12)"
          sub="Completion Rate" 
        />
        <StatCard 
          label="Content Units" 
          value={stats?.blogsCount || 0} 
          icon={PenTool} 
          color="#a78bfa" 
          bg="rgba(167,139,250,0.12)"
          sub={`${stats?.blogsPublished || 0} Published`} 
        />
        <StatCard 
          label="Comm. Pulses" 
          value={stats?.messagesCount || 0} 
          icon={MessageSquare} 
          color="#f59e0b" 
          bg="rgba(245,158,11,0.12)"
          sub="Signals Dispatched"
        />
      </div>

      {/* 📉 DETAILED ANALYSIS ROW */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.5fr] gap-6">
        {/* Completion ring */}
        <div className="glass-premium p-8 flex flex-col items-center justify-center relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-accent/[0.02] pointer-events-none" />
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-[0.2em] mb-8 relative z-10">Productivity Pulse</p>
          
          <div className="relative z-10 mb-8">
            <DonutRing done={stats?.tasksDone || 0} total={stats?.tasks.length || 0} color="#3b82f6" />
          </div>

          <div className="grid grid-cols-3 gap-6 w-full relative z-10 pt-6 border-t border-white/5">
            {Object.entries(stats?.tasksByStatus || {}).map(([key, count]) => {
              const cfg = STATUS_CONFIG[key];
              return (
                <div key={key} className="flex flex-col items-center gap-2 group/status">
                  <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold border transition-all duration-300 group-hover/status:scale-110 shadow-lg shadow-black/20", cfg.bg, cfg.color, cfg.border)}>
                    {count as number}
                  </div>
                  <span className="text-[9px] text-slate-600 uppercase font-black tracking-widest group-hover/status:text-slate-400 transition-colors">{cfg.label}</span>
                </div>
              );
            })}
          </div>

          {(stats?.overdue || 0) > 0 && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-8 flex items-center gap-3 px-4 py-2 rounded-2xl bg-red-500/10 border border-red-500/20 shadow-[0_0_20px_rgba(239,68,68,0.1)]"
            >
              <Activity size={14} className="text-red-400 animate-pulse" />
              <span className="text-[10px] font-bold text-red-400 uppercase tracking-widest">{stats?.overdue} CRITICAL OVERDUE</span>
            </motion.div>
          )}
        </div>

        {/* Intelligence Feed / Recent Activity */}
        <div className="glass-premium p-8 flex flex-col">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-sm font-bold text-white flex items-center gap-2 uppercase tracking-widest">
              <Zap size={16} className="text-accent" /> Achievement log
            </h3>
            <p className="text-[10px] text-slate-600 font-mono tracking-tighter uppercase">// ROLE: {(profile?.role || 'team').toUpperCase()}</p>
          </div>

          <div className="flex-1 space-y-4">
            {(stats?.recentActivity || []).map((item: any, i: number) => (
              <div key={i} className="flex items-center justify-between p-4 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-white/10 hover:bg-white/[0.04] transition-all group">
                <div className="flex items-center gap-4">
                  <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-500 group-hover:scale-110",
                    item.type === "blog" ? "bg-purple-500/10 text-purple-400" : "bg-blue-500/10 text-blue-400")}>
                    {item.type === "blog" ? <PenTool size={16} /> : <CheckSquare size={16} />}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-white truncate group-hover:text-accent transition-colors">{item.label}</p>
                    <div className="flex items-center gap-3 mt-1">
                      <span className={cn("text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-widest border",
                        item.status === "done" || item.status === "published" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
                        item.status === "in_progress" ? "bg-blue-500/10 text-blue-400 border-blue-500/20" : "bg-slate-500/10 text-slate-500 border-slate-500/20")}>
                        {item.status?.replace("_", " ")}
                      </span>
                      <span className="text-[10px] text-slate-700 font-mono flex items-center gap-1">
                        <Clock size={10} />
                        {new Date(item.date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                      </span>
                    </div>
                  </div>
                </div>
                <ChevronRight size={14} className="text-slate-800 group-hover:translate-x-1 group-hover:text-accent transition-all" />
              </div>
            ))}
            {!stats?.recentActivity?.length && (
              <div className="flex flex-col items-center justify-center py-12 text-center opacity-30">
                <Activity size={40} className="mb-4 text-slate-600" />
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-600">No telemetry recorded for current period</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 🚀 EXPANDED PERFORMANCE BAR */}
      <div className="glass-premium p-8 relative overflow-hidden group">
        <div className="absolute inset-0 bg-gradient-to-r from-accent/[0.02] to-transparent pointer-events-none" />
        <div className="flex items-center gap-2 text-[11px] font-bold text-slate-500 uppercase tracking-[0.2em] mb-8 relative z-10">
          <TrendingUp size={14} className="text-accent" /> Cumulative Standing
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10 relative z-10">
          {[
            { label: "Execution Efficiency", value: stats?.tasks.length ? Math.round((stats.tasksDone / stats.tasks.length) * 100) : 0, color: "#3b82f6", suffix: "%", glow: "shadow-[0_0_12px_rgba(59,130,246,0.3)]" },
            { label: "Creative Output", value: stats?.blogsPublished || 0, color: "#a78bfa", suffix: "/" + (stats?.blogsCount || 0), pct: stats?.blogsCount ? ((stats?.blogsPublished || 0) / stats?.blogsCount) * 100 : 0, glow: "shadow-[0_0_12px_rgba(167,139,250,0.3)]" },
            { label: "Operational Risks", value: stats?.overdue || 0, color: (stats?.overdue || 0) > 0 ? "#ef4444" : "#10b981", suffix: " Overdue", pct: (stats?.overdue || 0) > 0 ? 100 : 0, glow: "shadow-[0_0_12px_rgba(239,68,68,0.3)]" },
          ].map(item => (
            <div key={item.label} className="group/item">
              <div className="flex justify-between items-end mb-3">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest group-hover/item:text-slate-300 transition-colors">{item.label}</span>
                <span className="text-sm font-black font-mono" style={{ color: item.color }}>{item.value}{item.suffix}</span>
              </div>
              <div className="h-2 rounded-full bg-white/5 overflow-hidden ring-1 ring-white/5 p-[1px]">
                <motion.div
                  className={cn("h-full rounded-full transition-all duration-300 group-hover/item:brightness-125", item.glow)}
                  style={{ background: `linear-gradient(to right, ${item.color}88, ${item.color})` }}
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(100, item.pct ?? item.value)}%` }}
                  transition={{ duration: 1.5, ease: "easeOut" }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── INTERNAL HELPER COMPONENTS ──

function StatCard({ label, value, icon: Icon, color, bg, sub }: any) {
  return (
    <div className="glass-premium p-6 group hover:bg-white/[0.04] transition-all duration-500 stat-card">
      <div className="flex items-start justify-between mb-6">
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-500 group-hover:scale-110 shadow-lg"
          style={{ background: bg }}
        >
          <Icon size={22} style={{ color }} />
        </div>
        <div className="w-10 h-px bg-white/5 self-center" />
      </div>
      <p className="text-3xl font-bold text-white mb-1.5 tracking-tighter">{value}</p>
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 mb-0.5 group-hover:text-slate-300 transition-colors">
          {label}
        </p>
        <p className="text-[10px] font-medium text-slate-700 group-hover:text-slate-500 transition-colors italic">
          {sub}
        </p>
      </div>
    </div>
  );
}

function DonutRing({ done, total, color }: { done: number; total: number; color: string }) {
  const r = 38;
  const circ = 2 * Math.PI * r;
  const pct = total > 0 ? done / total : 0;
  const offset = circ - pct * circ;
  return (
    <div className="relative flex items-center justify-center w-32 h-32 mx-auto group/donut">
      <div className="absolute inset-0 bg-accent/5 rounded-full blur-2xl opacity-0 group-hover/donut:opacity-100 transition-opacity duration-700" />
      <svg width={100} height={100} viewBox="0 0 100 100">
        <circle cx={50} cy={50} r={r} fill="none" stroke="rgba(255,255,255,0.02)" strokeWidth={10} />
        <motion.circle
          cx={50} cy={50} r={r} fill="none" 
          stroke={color} strokeWidth={10}
          strokeDasharray={circ}
          initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.5, ease: "circOut" }}
          strokeLinecap="round"
          transform="rotate(-90 50 50)"
          className="drop-shadow-[0_0_12px_rgba(59,130,246,0.3)]"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-black text-white tracking-widest">{done}</span>
        <div className="h-px w-6 bg-white/10 my-1" />
        <span className="text-[10px] uppercase font-black text-slate-600 tracking-tighter">{total} UNITS</span>
      </div>
    </div>
  );
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  todo:        { label: "Protocol",   color: "text-slate-500",   bg: "bg-slate-500/10",   border: "border-slate-500/20" },
  in_progress: { label: "Execution",  color: "text-blue-400",    bg: "bg-blue-500/10",    border: "border-blue-500/20"  },
  done:        { label: "Archived",   color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20" },
};
