import {
  Users, TrendingUp, CheckSquare, CreditCard,
  ArrowUpRight, ArrowDownRight, Activity,
  AlertTriangle, Star, Circle, PenTool, FileText, Loader2,
  Search, Video, Zap, Clock, ShieldCheck,
} from "lucide-react";
import {
  XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, AreaChart, Area,
} from "recharts";
import { Link } from "react-router-dom";
import { formatCurrency, cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface AdminDashboardProps {
  stats: any[];
  agencyTrend: any[];
  clients: any[];
  recentActivity: any[];
  topClients: any[];
  atRiskClients: any[];
  totalRevenue: number;
  activeClients: number;
}

export function AdminDashboard({
  stats, agencyTrend, clients, recentActivity, topClients, atRiskClients, totalRevenue, activeClients
}: AdminDashboardProps) {
  const currentTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* 🏛️ COMMAND CENTER HEADER */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-2 border-b border-white/5 mx-1">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="px-2 py-0.5 rounded-full bg-accent/10 border border-accent/20 flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
              <span className="text-[10px] font-bold text-accent uppercase tracking-widest">System Online</span>
            </div>
            <span className="text-slate-500 text-[10px] uppercase tracking-widest font-mono">// NODE: SG-ALPHA-01</span>
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3">
            Agency <span className="text-accent italic font-light font-mono text-2xl">OS</span>
          </h1>
        </div>

        <div className="flex items-center gap-8 text-right">
          <div className="hidden sm:block">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Local Terminal Time</p>
            <div className="flex items-center justify-end gap-2 text-white/80 font-mono text-lg font-medium">
              <Clock size={16} className="text-accent/60" />
              {currentTime}
            </div>
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Portfolio Health</p>
            <div className="flex items-center justify-end gap-2 text-emerald-400 font-mono text-lg font-medium">
              <ShieldCheck size={16} className="text-emerald-500/60" />
              94.2%
            </div>
          </div>
        </div>
      </div>

      {/* ⚡ QUICK ACTIONS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { to: "/blogs/editor/new", label: "New Article", sub: "Content Studio", icon: PenTool, color: "text-accent", bg: "bg-accent/10", border: "hover:border-accent/40" },
          { to: "/blogs", label: "Master List", sub: "Article Archive", icon: FileText, color: "text-blue-400", bg: "bg-blue-500/10", border: "hover:border-blue-500/40" },
          { to: "/content/testimonials", label: "Social Proof", sub: "Manage Feedback", icon: Star, color: "text-emerald-400", bg: "bg-emerald-500/10", border: "hover:border-emerald-500/40" },
          { to: "/team", label: "Team Hub", sub: "Manage Ranks", icon: Users, color: "text-amber-400", bg: "bg-amber-500/10", border: "hover:border-amber-500/40" },
        ].map((action) => (
          <Link 
            key={action.to}
            to={action.to} 
            className={cn(
              "glass-premium p-5 flex flex-col items-center justify-center gap-4 text-center transition-all duration-300 group cursor-pointer border-white/5",
              action.border
            )}
          >
            <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-500 group-hover:scale-110 shadow-lg", action.bg, action.color)}>
              <action.icon size={24} />
            </div>
            <div>
              <p className="text-sm font-bold text-white mb-0.5">{action.label}</p>
              <p className="text-[10px] text-slate-600 font-medium uppercase tracking-wider">{action.sub}</p>
            </div>
          </Link>
        ))}
      </div>

      {/* 📊 META STATS GRID */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => (
          <StatCard key={s.label} {...s} />
        ))}
      </div>

      {/* 📈 PERFORMANCE ROW */}
      <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-6">
        {/* Main Growth Chart */}
        <div className="glass-premium p-6 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-8 pointer-events-none opacity-5 group-hover:opacity-10 transition-opacity">
            <TrendingUp size={120} className="text-accent" />
          </div>
          
          <div className="flex items-start justify-between mb-8 relative z-10">
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Activity size={18} className="text-accent/60" /> Agency Throughput
              </h3>
              <p className="text-xs text-slate-500 mt-1 uppercase tracking-widest font-medium">Aggregate Performance // Last 6 Months</p>
            </div>
            <div className="flex items-center gap-6 text-[10px] font-bold uppercase tracking-widest text-slate-600">
              <span className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
                Inbound Traffic
              </span>
              <span className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                Verified Leads
              </span>
            </div>
          </div>

          <div className="h-[280px] w-full relative z-10">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={agencyTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradientTraffic" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradientLeads" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.03)" />
                <XAxis 
                  dataKey="month" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: "#475569", fontSize: 10, fontWeight: 700 }} 
                  dy={10}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: "#475569", fontSize: 10, fontWeight: 700 }} 
                />
                <Tooltip
                  contentStyle={{ background: "rgba(7, 11, 20, 0.95)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: "16px", backdropBlur: "12px", boxShadow: "0 20px 40px rgba(0,0,0,0.4)" }}
                  itemStyle={{ fontSize: "11px", fontWeight: "bold", textTransform: "uppercase", letterSpacing: "1px" }}
                  labelStyle={{ color: "#94a3b8", marginBottom: "8px", borderBottom: "1px solid rgba(255,255,255,0.05)", paddingBottom: "4px" }}
                />
                <Area type="monotone" dataKey="traffic" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#gradientTraffic)" />
                <Area type="monotone" dataKey="leads" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#gradientLeads)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Portfolio Distribution */}
        <div className="glass-premium p-6 flex flex-col">
          <h3 className="text-lg font-bold text-white mb-1">Portfolio Matrix</h3>
          <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mb-8">Client Plan Distribution</p>
          
          <div className="flex-1 space-y-5">
            {[
              { label: "Elite (Premium)", count: clients.filter((c) => c.plan_type === "premium").length, color: "#a78bfa", glow: "shadow-[0_0_12px_rgba(167,139,250,0.2)]" },
              { label: "Expansion (Growth)", count: clients.filter((c) => c.plan_type === "growth").length, color: "#3b82f6", glow: "shadow-[0_0_12px_rgba(59,130,246,0.2)]" },
              { label: "Core (Basic)", count: clients.filter((c) => c.plan_type === "basic").length, color: "#64748b", glow: "shadow-[0_0_12px_rgba(100,116,139,0.2)]" },
              { label: "Incubation (Trial)", count: clients.filter((c) => c.status === "trial").length, color: "#10b981", glow: "shadow-[0_0_12px_rgba(16,185,129,0.2)]" },
            ].map(({ label, count, color, glow }) => (
              <div key={label} className="group/item">
                <div className="flex justify-between text-[11px] mb-2 px-1">
                  <span className="font-bold text-slate-500 uppercase tracking-tighter group-hover/item:text-white/80 transition-colors">{label}</span>
                  <span style={{ color }} className="font-mono font-bold">{count} Units</span>
                </div>
                <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${(count / Math.max(1, clients.length)) * 100}%` }}
                    transition={{ duration: 1, ease: "easeOut" }}
                    className={cn("h-full rounded-full transition-all duration-300 group-hover/item:brightness-125", glow)}
                    style={{ background: color }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-8 pt-6 border-t border-white/5">
            <div className="flex justify-between items-center p-4 rounded-2xl bg-white/[0.02] border border-white/5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center text-accent">
                  <CreditCard size={18} />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest leading-none mb-1">Total MRR</p>
                  <p className="text-xl font-bold text-white tracking-tighter">{formatCurrency(totalRevenue)}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest leading-none mb-1">+12.4%</p>
                <p className="text-[10px] text-slate-600 font-bold uppercase tracking-tighter">vs Last Month</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 📋 CLIENT INTEL & ACTIVITY */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-6">
        {/* High Performance Clients */}
        <div className="glass-premium p-6 overflow-hidden">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Star size={18} className="text-amber-400" /> Key Accounts
              </h3>
              <p className="text-xs text-slate-500 mt-1">High-value client portfolio health</p>
            </div>
            <Link to="/clients" className="px-4 py-2 rounded-xl bg-white/5 border border-white/5 text-[10px] font-bold uppercase tracking-widest text-slate-400 hover:text-white hover:bg-white/10 transition-all">
              Initialize Ops View
            </Link>
          </div>
          
          <div className="space-y-4">
            {topClients.map((c) => (
              <Link
                key={c.id}
                to={`/clients/${c.id}`}
                className="flex items-center justify-between p-4 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-white/10 hover:bg-white/[0.04] transition-all group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-slate-900 to-black border border-white/10 flex items-center justify-center text-lg font-bold text-white group-hover:border-accent/30 transition-colors">
                    {c.firm_name[0]}
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">{c.firm_name}</h4>
                    <span className={cn(
                      "text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-widest",
                      c.plan_type === 'premium' ? "bg-purple-500/10 text-purple-400 border border-purple-500/20" : 
                      c.plan_type === 'growth' ? "bg-blue-500/10 text-blue-400 border border-blue-500/20" :
                      "bg-slate-500/10 text-slate-400 border border-slate-500/20"
                    )}>
                      {c.plan_type} Node
                    </span>
                  </div>
                </div>
                
                <div className="flex items-center gap-8">
                  <div className="hidden sm:block text-right">
                    <p className="text-[9px] font-bold text-slate-600 uppercase tracking-widest mb-1">Revenue Stream</p>
                    <p className="text-xs font-mono font-bold text-emerald-400">{formatCurrency(c.monthly_revenue)}</p>
                  </div>
                  <div className="flex flex-col items-center">
                    <p className="text-[9px] font-bold text-slate-600 uppercase tracking-widest mb-1 text-center">Health</p>
                    <HealthRing score={c.total_health_score || 0} />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Intelligence feed */}
        <div className="space-y-6">
          {/* Critical Alerts */}
          <div className="glass-premium p-6 border-red-500/10 bg-red-500/[0.02]">
            <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-6">
              <AlertTriangle size={16} className="text-red-500" /> Intervention Required
            </h3>
            <div className="space-y-4">
              {atRiskClients.map((c: any) => (
                <Link
                  key={c.id}
                  to={`/clients/${c.id}`}
                  className="flex items-center gap-4 p-3 rounded-2xl bg-slate-950/40 border border-red-500/5 hover:border-red-500/20 transition-all"
                >
                  <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center text-red-500">
                    <AlertTriangle size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-white truncate">{c.firm_name}</p>
                    <p className="text-[10px] text-slate-500 font-mono tracking-tighter uppercase">Health Score: {c.total_health_score || 0}%</p>
                  </div>
                  <ChevronRight size={14} className="text-slate-600" />
                </Link>
              ))}
              {atRiskClients.length === 0 && (
                <div className="text-center py-6">
                  <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500 mx-auto mb-3">
                    <Zap size={20} />
                  </div>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">System Harmonized</p>
                  <p className="text-[10px] text-slate-700 font-medium">No critical risks in current matrix</p>
                </div>
              )}
            </div>
          </div>

          {/* Activity Feed */}
          <div className="glass-premium p-6">
            <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-6">
              <Activity size={16} className="text-blue-400" /> Intelligence Feed
            </h3>
            <div className="relative space-y-6">
              <div className="absolute left-[7px] top-2 bottom-2 w-px bg-white/5" />
              {recentActivity.map((a: any, i: number) => (
                <div key={i} className="flex items-start gap-4 relative z-10 px-0.5">
                  <span className="w-3 h-3 rounded-full mt-1.5 flex-shrink-0 border-2 border-slate-950 shadow-[0_0_8px_rgba(0,0,0,0.5)]" style={{ background: a.dot }} />
                  <div>
                    <p className="text-xs text-white/90 font-medium leading-tight mb-1">{a.text}</p>
                    <p className="text-[10px] font-mono text-slate-600 uppercase tracking-tight">
                      <Clock size={8} className="inline mr-1" />
                      {new Date(a.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── INTERNAL HELPER COMPONENTS ──

function StatCard({
  label, value, sub, icon: Icon, color, bg, trend,
}: any) {
  const up = trend > 0;
  const down = trend < 0;
  const showTrend = trend !== 0;

  return (
    <div className="glass-premium p-6 group hover:bg-white/[0.04] transition-all duration-500 stat-card">
      <div className="flex items-start justify-between mb-6">
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-500 group-hover:scale-110 shadow-lg"
          style={{ background: bg }}
        >
          <Icon size={22} style={{ color }} />
        </div>
        <div>
          {showTrend ? (
            <span
              className={cn(
                "flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full border shadow-sm transition-transform active:scale-95",
                up ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20 shadow-emerald-500/5 rotate-3" : "text-orange-400 bg-orange-500/10 border-orange-500/20 shadow-orange-500/5 -rotate-3"
              )}
            >
              {up ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
              {Math.abs(trend)}%
            </span>
          ) : (
            <span className="text-[9px] font-bold text-slate-600 bg-white/5 border border-white/5 px-2 py-1 rounded-full uppercase tracking-widest">
              Stable_Node
            </span>
          )}
        </div>
      </div>
      <p className="text-3xl font-bold text-white mb-1.5 tracking-tighter">{value}</p>
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 mb-0.5 group-hover:text-slate-300 transition-colors">
          {label}
        </p>
        <p className="text-[10px] font-medium text-slate-700 group-hover:text-slate-500 transition-colors">
          {sub}
        </p>
      </div>
    </div>
  );
}

function HealthRing({ score }: { score: number }) {
  const r = 14;
  const circumference = 2 * Math.PI * r;
  const offset = circumference - (score / 100) * circumference;
  const color = score >= 75 ? "#10b981" : score >= 50 ? "#f59e0b" : "#ef4444";
  return (
    <div className="relative inline-flex items-center justify-center group/ring">
      <svg width={42} height={42} viewBox="0 0 36 36">
        <circle cx={18} cy={18} r={r} fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth={3} />
        <motion.circle
          cx={18} cy={18} r={r} fill="none"
          stroke={color} strokeWidth={3}
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.5, ease: "easeOut" }}
          strokeLinecap="round"
          transform="rotate(-90 18 18)"
          className="drop-shadow-[0_0_8px_var(--tw-shadow-color)]"
          style={{ '--tw-shadow-color': color } as any}
        />
        <text 
          x={18} y={22} 
          textAnchor="middle" 
          fontSize={10} 
          fill="white" 
          fontWeight={800} 
          className="font-mono"
        >
          {score}
        </text>
      </svg>
    </div>
  );
}

function ChevronRight({ size, className }: { size: number, className: string }) {
  return (
    <motion.div
      whileHover={{ x: 3 }}
      transition={{ type: "spring", stiffness: 400, damping: 10 }}
    >
      <Circle size={size} className={className} />
    </motion.div>
  );
}
