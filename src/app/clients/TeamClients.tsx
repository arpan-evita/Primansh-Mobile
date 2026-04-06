import { useState } from "react";
import { Link } from "react-router-dom";
import { Users, Search, Globe, MapPin, MessageSquare, Loader2, BarChart2 } from "lucide-react";
import { motion } from "framer-motion";

interface TeamClientsProps {
  clients: any[];
  isLoading: boolean;
}

export function TeamClients({ clients, isLoading }: TeamClientsProps) {
  const [query, setQuery] = useState("");

  const filtered = clients.filter((c: any) => {
    const q = query.toLowerCase();
    return !q || (c.firm_name || "").toLowerCase().includes(q) || (c.location || "").toLowerCase().includes(q);
  });

  return (
    <div className="fade-up space-y-6 max-w-5xl mx-auto">
      {/* Search */}
      <div className="relative">
        <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
        <input
          type="text"
          placeholder="Search assigned clients..."
          value={query}
          onChange={e => setQuery(e.target.value)}
          className="w-full bg-[#0a0f1d]/60 border border-white/10 rounded-2xl py-3 pl-11 pr-4 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition-all font-sans"
        />
      </div>

      {/* Client List */}
      {isLoading ? (
        <div className="py-20 flex justify-center"><Loader2 className="animate-spin text-blue-500" size={28} /></div>
      ) : filtered.length === 0 ? (
        <div className="py-20 text-center">
          <Users size={36} className="mx-auto text-slate-700 mb-3" />
          <p className="text-slate-500 text-sm">
            {clients.length === 0 ? "No clients have been assigned to you yet." : "No clients match your search."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((c: any) => (
            <div
              key={c.id}
              className="glass-card rounded-2xl border border-white/5 p-5 flex items-center gap-5 bg-[#0a0f1d]/40 hover:border-white/10 transition-all"
            >
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-xl font-black flex-shrink-0"
                style={{ background: "linear-gradient(135deg, rgba(59,130,246,0.2), rgba(99,102,241,0.2))", color: "#60a5fa", border: "1px solid rgba(59,130,246,0.15)" }}>
                {c.firm_name?.[0] || "C"}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-sm font-bold text-white truncate">{c.firm_name}</p>
                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase border ${c.status === "active" ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" : "text-slate-400 bg-slate-500/10 border-slate-500/20"}`}>
                    {c.status}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-xs text-slate-500">
                  {c.location && <span className="flex items-center gap-1"><MapPin size={10} />{c.location}</span>}
                  {c.website_url && <span className="flex items-center gap-1"><Globe size={10} />{c.website_url}</span>}
                </div>
                <div className="mt-2 max-w-[200px]">
                   <HealthBar score={c.total_health_score || 50} />
                </div>
              </div>

              <div className="hidden sm:flex gap-1.5 flex-wrap max-w-[180px]">
                {(c.services || []).slice(0, 3).map((s: string) => (
                  <span key={s} className="px-2 py-0.5 rounded-full bg-white/5 border border-white/5 text-[9px] font-bold text-slate-500 uppercase">{s}</span>
                ))}
              </div>

              <div className="flex flex-row sm:flex-col gap-2 flex-shrink-0">
                <Link
                  to={`/clients/${c.id}`}
                  className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-accent/10 border border-accent/20 text-accent text-[10px] font-black tracking-widest hover:bg-accent hover:text-white transition-all shadow-lg shadow-accent/5 group"
                >
                  <BarChart2 size={13} className="group-hover:scale-110 transition-transform" />
                  DETAILS
                </Link>
                <Link
                  to="/messages"
                  className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-slate-400 text-[10px] font-black tracking-widest hover:bg-white/10 hover:text-white transition-all group"
                >
                  <MessageSquare size={13} className="group-hover:scale-110 transition-transform" />
                  CHAT
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function HealthBar({ score }: { score: number }) {
  const color = score >= 75 ? "#10b981" : score >= 50 ? "#f59e0b" : "#ef4444";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1 rounded-full flex-1 relative overflow-hidden bg-white/5">
        <motion.div initial={{ width: 0 }} animate={{ width: `${score}%` }} transition={{ duration: 1 }} className="h-full rounded-full" style={{ background: color }} />
      </div>
      <span className="text-[10px] font-bold" style={{ color }}>{score}%</span>
    </div>
  );
}
