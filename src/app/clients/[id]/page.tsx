import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  leads, tasks, keywords, seoChecklist,
  invoices, blogs, analyticsData,
} from "@/lib/mockData";
import {
  getStatusColor, getHealthBg, formatCurrency, cn,
} from "@/lib/utils";
import {
  ArrowLeft, Globe, Phone, Mail, MapPin,
  TrendingUp, TrendingDown, Minus,
  CheckCircle2, Circle, Plus, Loader2, Trash2, Users, ChevronRight,
  MessageSquare, Video, Code, Check, Copy, ExternalLink, Shield, Zap, AlertCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from "recharts";
import { motion, AnimatePresence } from "framer-motion";
import { Star } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

const TABS = ["Overview", "SEO", "Leads", "Tasks", "Content", "Billing", "Connection"] as const;
type Tab = (typeof TABS)[number];

function HealthRing({ score }: { score: number }) {
  const r = 26;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  const color = score >= 75 ? "#10b981" : score >= 50 ? "#f59e0b" : "#ef4444";
  return (
    <div className="relative flex items-center justify-center">
        <svg width={70} height={70} viewBox="0 0 70 70" className="drop-shadow-[0_0_8px_rgba(0,0,0,0.5)]">
            <circle cx={35} cy={35} r={r} fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth={5} />
            <motion.circle 
                initial={{ strokeDashoffset: circ }}
                animate={{ strokeDashoffset: offset }}
                transition={{ duration: 1.5, ease: "easeOut" }}
                cx={35} cy={35} r={r} fill="none" stroke={color} strokeWidth={5}
                strokeDasharray={circ}
                strokeLinecap="round" transform="rotate(-90 35 35)"
            />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-lg font-black tracking-tighter" style={{ color }}>{score}</span>
            <span className="text-[7px] uppercase font-bold text-slate-500 -mt-1 tracking-tighter">Health</span>
        </div>
    </div>
  );
}

function StatCard({ label, value, color, icon: Icon }: any) {
    return (
        <div className="glass-card p-5 group relative overflow-hidden">
            <div className="absolute top-0 right-0 w-20 h-20 -mt-6 -mr-6 rounded-full blur-3xl opacity-5 transition-opacity group-hover:opacity-10" style={{ background: color }} />
            <div className="flex justify-between items-start relative z-10">
                <div>
                    <p className="text-[10px] uppercase tracking-widest font-bold text-slate-500 mb-1">{label}</p>
                    <h3 className="text-2xl font-bold text-white tracking-tight">{value}</h3>
                </div>
                <div className="p-2.5 rounded-xl bg-white/5 border border-white/5 transition-all group-hover:border-white/10">
                    <Icon size={18} style={{ color }} />
                </div>
            </div>
        </div>
    );
}

export default function ClientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("Overview");
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  const isTeam = profile?.role?.toLowerCase() === "team";

  // Fetch Client Intelligence Data
  const { data: client, isLoading: isClientLoading } = useQuery({
    queryKey: ['client_detail', id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!id
  });

  // Fetch Related Analytics Data
  const { data: relatedData, isLoading: isRelatedLoading } = useQuery({
    queryKey: ['client_analytics', id],
    queryFn: async () => {
      if (!id) return null;
      const results = await Promise.all([
        supabase.from('leads').select('*').eq('client_id', id).order('created_at', { ascending: false }),
        supabase.from('tasks').select('*').eq('client_id', id).order('created_at', { ascending: false }),
        supabase.from('keywords').select('*').eq('client_id', id).order('last_checked', { ascending: false }),
        supabase.from('invoices').select('*').eq('client_id', id).order('issued_date', { ascending: false }),
        supabase.from('blogs').select('*').eq('client_id', id).order('created_at', { ascending: false }),
        supabase.from('profiles').select('id').eq('associated_client_id', id).limit(1),
        supabase.from('site_analytics').select('*').eq('client_id', id).order('timestamp', { ascending: false }).limit(100),
      ]);
      
      const [leadsRes, tasksRes, keywordsRes, invoicesRes, blogsRes, profilesRes, analyticsRes] = results;
      
      let clientProfileId = profilesRes.data?.[0]?.id;
      if (!clientProfileId && client?.contact_email) {
        const { data: p } = await supabase.from('profiles').select('id').eq('email', client.contact_email).limit(1);
        clientProfileId = p?.[0]?.id;
      }

      return {
        leads: leadsRes.data || [],
        tasks: tasksRes.data || [],
        keywords: keywordsRes.data || [],
        invoices: invoicesRes.data || [],
        blogs: blogsRes.data || [],
        clientProfileId,
        siteAnalytics: analyticsRes.data || [],
      };
    },
    enabled: !!id && !!client
  });

  const isLoading = isClientLoading || isRelatedLoading;

  // Delete Mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('clients')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_clients'] });
      toast.success("Client removed from network.");
      navigate('/clients');
    },
    onError: (error: any) => {
      toast.error(`Delete failed: ${error.message}`);
    }
  });

  const handleDelete = () => {
    if (window.confirm("Are you sure you want to PERMANENTLY remove this client firm? All data will be lost.")) {
      deleteMutation.mutate(id as string);
    }
  };

  if (isLoading) return (
    <AppShell title="Loading Client" subtitle="Synchronizing business intelligence...">
        <div className="flex flex-col items-center justify-center py-32 gap-4">
            <Loader2 className="animate-spin text-accent" size={40} />
            <span className="text-sm text-muted-foreground">Retrieving firm records...</span>
        </div>
    </AppShell>
  );

  if (!id || !client) return (
    <AppShell title="Not Found">
        <div className="py-20 text-center">
            <p className="text-slate-400 mb-6 font-medium">This business node does not exist in our active network.</p>
            <Button onClick={() => navigate('/clients')} variant="accent" size="sm">
                Return to Network Hub
            </Button>
        </div>
    </AppShell>
  );

  const clientLeads = relatedData?.leads || [];
  const clientTasks = relatedData?.tasks || [];
  const clientKeywords = relatedData?.keywords || [];
  const clientInvoices = relatedData?.invoices || [];
  const clientBlogs = relatedData?.blogs || [];

  // Dynamic Health Score Calculation
  const doneTasks = clientTasks.filter((t : any) => t.status === 'done').length;
  const totalTasks = clientTasks.length;
  const healthScore = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : (client?.health_score || 50);
  
  // SEO Checklist Calculation (Dynamic based on tasks/keywords)
  const checklist = clientTasks.filter((t : any) => t.module === 'seo').map((t : any) => ({
      item: t.title,
      done: t.status === 'done'
  }));
  const checklistDone = checklist.filter((i: any) => i.done).length;
  
  // Real Analytics Processing
  const siteAnalytics = relatedData?.siteAnalytics || [];
  const processedAnalytics = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const dateStr = d.toISOString().split('T')[0];
    const dayVisits = siteAnalytics.filter((a: any) => a.timestamp && a.timestamp.startsWith(dateStr)).length;
    return { 
      date: format(d, 'MMM dd'), 
      traffic: dayVisits 
    };
  });

  const uniqueVisitors = new Set(siteAnalytics.map((a: any) => a.session_id)).size;
  const totalLeads = clientLeads.length;
  const activeKeywords = clientKeywords.filter((k: any) => k.current_pos > 0).length;

  return (
    <AppShell title="Firm Intelligence" subtitle={`Analyzing business performance for ${client.firm_name}`}>
      <div className="fade-up space-y-6">
        {/* Back + Header */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 mb-2">
          <div className="flex items-center gap-5">
            <Link 
              to="/clients" 
              className="w-10 h-10 rounded-full flex items-center justify-center bg-white/5 border border-white/5 hover:bg-white/10 hover:border-white/10 transition-all group"
            >
              <ArrowLeft size={16} className="text-slate-400 group-hover:text-white transition-colors" />
            </Link>
            <div className="flex items-center gap-5">
              <div
                className="w-16 h-16 rounded-[2rem] flex items-center justify-center text-2xl font-black shadow-2xl relative group overflow-hidden"
                style={{ 
                    background: "linear-gradient(135deg, rgba(59,130,246,0.3), rgba(147,51,234,0.3))", 
                    color: "#fff",
                    border: "1px solid rgba(147,51,234,0.2)" 
                }}
              >
                <div className="absolute inset-0 bg-gradient-to-tr from-accent/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                {client.firm_name ? client.firm_name[0] : 'C'}
              </div>
              <div>
                <div className="flex items-center gap-3 mb-1">
                    <h2 className="text-3xl font-black text-white tracking-tighter">{client.firm_name}</h2>
                    <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${getStatusColor(client.status)}`}>
                        {client.status}
                    </span>
                </div>
                <div className="flex items-center gap-4">
                  <span className={`px-3 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-widest border ${client.plan_type === "premium" ? "bg-purple-500/10 text-purple-400 border-purple-500/20" : client.plan_type === "growth" ? "bg-blue-500/10 text-blue-400 border-blue-500/20" : "bg-slate-500/10 text-slate-400 border-slate-500/20"}`}>
                    {client.plan_type} Tier
                  </span>
                  <span className="text-[11px] font-bold text-slate-500 flex items-center gap-1.5">
                    <Users size={12} className="text-slate-600" />
                    Assigned to <span className="text-slate-300 font-black uppercase tracking-tighter">{client.assigned_to || 'Senior Associate'}</span>
                  </span>
                </div>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-6 self-end md:self-auto">
            <HealthRing score={healthScore} />
            <div className="flex flex-col items-end gap-3">
                <div className="flex items-center gap-2">
                    <Link 
                        to={`/clientportal/${client.id}`} 
                        className="btn-accent text-[10px] font-black tracking-widest py-2 px-4 flex items-center gap-2 rounded-xl"
                    >
                        ACCESS PORTAL <ChevronRight size={14} />
                    </Link>
                    
                    {relatedData?.clientProfileId && (
                      <div className="flex items-center gap-2">
                        <Link
                          to={`/messages?userId=${relatedData.clientProfileId}`}
                          className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-lg shadow-blue-500/20 hover:bg-blue-500 transition-all border border-blue-400/20"
                          title="Message Client"
                        >
                          <MessageSquare size={16} />
                        </Link>
                        <Link
                          to={`/messages?userId=${relatedData.clientProfileId}&startMeeting=true`}
                          className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-lg shadow-emerald-500/20 hover:bg-emerald-500 transition-all border border-emerald-400/20"
                          title="Start Video Call"
                        >
                          <Video size={16} />
                        </Link>
                      </div>
                    )}

                    {!isTeam && (
                      <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={handleDelete}
                          className="w-10 h-10 p-0 rounded-xl bg-red-400/5 text-red-400/50 hover:text-red-400 hover:bg-red-400/10 border border-transparent hover:border-red-400/20 transition-all"
                      >
                          <Trash2 size={16} />
                      </Button>
                    )}
                </div>
                <p className="text-[10px] font-bold text-slate-600 uppercase tracking-tighter">Last synced: Today, 11:42 AM</p>
            </div>
          </div>
        </div>

        {/* Info Ribbon */}
        <div className="flex items-center gap-8 py-4 px-6 glass-card border-white/5 bg-white/[0.01]">
          {[
            { icon: Globe, value: client.website_url || 'N/A', label: "Website", visible: true },
            { icon: Phone, value: client.contact_phone || '+91 99999-99999', label: "Mobile", visible: !isTeam },
            { icon: Mail, value: client.contact_email || 'contact@firm.com', label: "Email", visible: !isTeam },
            { icon: MapPin, value: client.location || 'India', label: "Office", visible: true },
          ].filter(info => info.visible).map((info, i) => (
            <div key={info.label} className="flex items-center gap-3 group cursor-default">
              <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center transition-colors group-hover:bg-accent/10 group-hover:text-accent">
                <info.icon size={13} />
              </div>
              <div className="flex flex-col">
                <span className="text-[9px] uppercase font-black tracking-widest text-slate-600">{info.label}</span>
                <span className="text-[11px] font-bold text-slate-300 truncate max-w-[150px]">{info.value}</span>
              </div>
            </div>
          ))}
          <div className="ml-auto flex gap-1.5 overflow-hidden max-w-[200px]">
            {(client.services || []).map((s: string) => (
                <span key={s} className="px-2 py-0.5 rounded-md bg-white/5 border border-white/5 text-[9px] font-bold text-slate-500 uppercase tracking-tighter whitespace-nowrap">
                    {s}
                </span>
            ))}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1.5 p-1 glass-card border-white/5 bg-white/[0.02] overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "px-5 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all duration-300 relative",
                tab === t ? "text-white" : "text-slate-500 hover:text-slate-300 hover:bg-white/5"
              )}
            >
              {tab === t && (
                  <motion.div 
                    layoutId="active-nav-tab"
                    className="absolute inset-0 bg-accent shadow-[0_0_15px_rgba(59,130,246,0.5)] rounded-xl -z-10"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                  />
              )}
              {t}
            </button>
          ))}
        </div>

        {/* ── OVERVIEW ── */}
        {tab === "Overview" && (
          <div className="space-y-4">
            {/* Metric Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard label="Visitors (7d)" value={uniqueVisitors} icon={TrendingUp} color="#3b82f6" />
              <StatCard label="Total Leads" value={totalLeads} icon={Users} color="#10b981" />
              <StatCard label="Live Keywords" value={activeKeywords} icon={Star} color="#a78bfa" />
              <StatCard label="Monthly Revenue" value={formatCurrency(client.monthly_revenue || 0)} icon={Globe} color="#f59e0b" />
            </div>

            {/* Traffic Chart */}
            <div className="glass-card p-5">
              <h3 className="text-sm font-semibold text-white mb-4">Site Traffic (Last 7 Days)</h3>
              <div className="h-[180px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={processedAnalytics}>
                    <defs>
                      <linearGradient id="tblue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="rgba(99,128,191,0.08)" strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="date" tick={{ fill: "#475569", fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: "#475569", fontSize: 10 }} axisLine={false} tickLine={false} />
                    <Tooltip 
                      contentStyle={{ background: "#0f1629", border: "1px solid rgba(99,128,191,0.2)", borderRadius: 8, fontSize: 10 }} 
                      itemStyle={{ color: "#fff" }}
                    />
                    <Area type="monotone" dataKey="traffic" stroke="#3b82f6" strokeWidth={2} fill="url(#tblue)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Recent tasks + leads */}
            <div className="grid grid-cols-2 gap-4">
              <div className="glass-card p-4">
                <p className="text-sm font-semibold text-white mb-3">Recent Tasks</p>
                <div className="space-y-2.5">
                  {clientTasks.slice(0, 4).map((t) => (
                    <div key={t.id} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${t.priority === "high" ? "bg-red-400" : t.priority === "medium" ? "bg-amber-400" : "bg-slate-400"}`} />
                        <span className="text-xs text-white truncate max-w-[180px]">{t.title}</span>
                      </div>
                      <span className={`badge text-xs ${getStatusColor(t.status)}`}>{t.status.replace("_", " ")}</span>
                    </div>
                  ))}
                  {clientTasks.length === 0 && <p className="text-xs" style={{ color: "#475569" }}>No tasks yet.</p>}
                </div>
              </div>
              <div className="glass-card p-4">
                <p className="text-sm font-semibold text-white mb-3">Recent Leads</p>
                <div className="space-y-2.5">
                  {clientLeads.slice(0, 4).map((l) => (
                    <div key={l.id} className="flex items-center justify-between">
                      <div>
                        <p className="text-xs text-white">{l.name}</p>
                        <p className="text-xs" style={{ color: "#475569" }}>{l.source}</p>
                      </div>
                      <span className={`badge ${getStatusColor(l.status)}`}>{l.status}</span>
                    </div>
                  ))}
                  {clientLeads.length === 0 && <p className="text-xs" style={{ color: "#475569" }}>No leads yet.</p>}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── SEO ── */}
        {tab === "SEO" && (
          <div className="space-y-4">
            {/* Checklist progress */}
            <div className="glass-card p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-white">Monthly SEO Checklist</h3>
                <div className="flex items-center gap-3">
                  <div className="h-1.5 rounded-full w-32" style={{ background: "rgba(99,128,191,0.1)" }}>
                    <div className="h-1.5 rounded-full bg-emerald-500 transition-all"
                      style={{ width: `${checklist.length ? (checklistDone / checklist.length) * 100 : 0}%` }} />
                  </div>
                  <span className="text-sm font-bold text-emerald-400">{checklistDone}/{checklist.length}</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {checklist.map((item: any, i: number) => (
                  <div key={i} className="flex items-center gap-2.5 py-2 px-3 rounded-lg" style={{ background: "rgba(99,128,191,0.04)", border: "1px solid rgba(99,128,191,0.08)" }}>
                    {item.done
                      ? <CheckCircle2 size={15} className="text-emerald-400 flex-shrink-0" />
                      : <Circle size={15} style={{ color: "#334155" }} className="flex-shrink-0" />}
                    <span className="text-xs" style={{ color: item.done ? "#94a3b8" : "#64748b" }}>{item.item}</span>
                  </div>
                ))}
                {checklist.length === 0 && (
                  <p className="text-xs col-span-2" style={{ color: "#475569" }}>No checklist for this client yet.</p>
                )}
              </div>
            </div>

            {/* Keywords table */}
            <div className="glass-card overflow-hidden">
              <div className="flex items-center justify-between p-4" style={{ borderBottom: "1px solid rgba(99,128,191,0.1)" }}>
                <h3 className="text-sm font-semibold text-white">Keyword Rankings</h3>
                <button className="btn-primary flex items-center gap-1.5 text-xs"><Plus size={12} /> Add Keyword</button>
              </div>
              <div className="grid text-xs font-semibold px-4 py-2.5" style={{ color: "#475569", gridTemplateColumns: "2fr 1fr 1fr 1fr", borderBottom: "1px solid rgba(99,128,191,0.06)" }}>
                <span>KEYWORD</span>
                <span className="text-center">TARGET</span>
                <span className="text-center">CURRENT</span>
                <span className="text-center">TREND</span>
              </div>
              {clientKeywords.map((kw) => (
                <div key={kw.id} className="grid px-4 py-3 table-row items-center text-sm" style={{ gridTemplateColumns: "2fr 1fr 1fr 1fr" }}>
                  <span className="text-white font-medium">{kw.keyword}</span>
                  <span className="text-center text-xs" style={{ color: "#94a3b8" }}>#{kw.target_pos}</span>
                  <span className="text-center text-xs font-bold" style={{ color: kw.current_pos <= kw.target_pos ? "#10b981" : "#f59e0b" }}>#{kw.current_pos}</span>
                  <div className="flex justify-center">
                    {kw.trend === "up" && <TrendingUp size={14} className="text-emerald-400" />}
                    {kw.trend === "down" && <TrendingDown size={14} className="text-red-400" />}
                    {kw.trend === "stable" && <Minus size={14} style={{ color: "#64748b" }} />}
                  </div>
                </div>
              ))}
              {clientKeywords.length === 0 && <p className="text-xs text-center py-8" style={{ color: "#475569" }}>No keywords tracked yet.</p>}
            </div>
          </div>
        )}

        {/* ── LEADS ── */}
        {tab === "Leads" && (
          <div className="glass-card overflow-hidden">
            <div className="flex items-center justify-between p-4" style={{ borderBottom: "1px solid rgba(99,128,191,0.1)" }}>
              <h3 className="text-sm font-semibold text-white">Leads ({clientLeads.length})</h3>
              <button className="btn-primary flex items-center gap-1.5 text-xs"><Plus size={12} /> Add Lead</button>
            </div>
            <div className="grid text-xs font-semibold px-4 py-2.5" style={{ color: "#475569", gridTemplateColumns: isTeam ? "1.5fr 1fr 1fr 1fr" : "1.5fr 1fr 1fr 1fr 1fr", borderBottom: "1px solid rgba(99,128,191,0.06)" }}>
              <span>NAME</span>{!isTeam && <span>PHONE</span>}<span>SOURCE</span><span>STATUS</span><span>DATE</span>
            </div>
            {clientLeads.map((l) => (
              <div key={l.id} className="grid px-4 py-3.5 table-row items-center text-sm" style={{ gridTemplateColumns: isTeam ? "1.5fr 1fr 1fr 1fr" : "1.5fr 1fr 1fr 1fr 1fr" }}>
                <div>
                  <p className="text-white font-medium">{l.name}</p>
                  {!isTeam && <p className="text-xs" style={{ color: "#475569" }}>{l.email}</p>}
                </div>
                {!isTeam && <span className="text-xs" style={{ color: "#94a3b8" }}>{l.phone}</span>}
                <span className="badge capitalize" style={{ background: "rgba(99,128,191,0.08)", color: "#94a3b8", border: "1px solid rgba(99,128,191,0.12)" }}>{l.source}</span>
                <span className={`badge ${getStatusColor(l.status)}`}>{l.status}</span>
                <span className="text-xs" style={{ color: "#475569" }}>{l.created_at}</span>
              </div>
            ))}
            {clientLeads.length === 0 && <p className="text-xs text-center py-10" style={{ color: "#475569" }}>No leads for this client.</p>}
          </div>
        )}

        {/* ── TASKS ── */}
        {tab === "Tasks" && (
          <div>
            <div className="flex justify-end mb-3">
              <button className="btn-primary flex items-center gap-1.5 text-xs"><Plus size={12} /> New Task</button>
            </div>
            {(["todo", "in_progress", "done"] as const).map((col) => {
              const colTasks = clientTasks.filter((t) => t.status === col);
              const colLabel = col === "todo" ? "To Do" : col === "in_progress" ? "In Progress" : "Done";
              const colColor = col === "todo" ? "#64748b" : col === "in_progress" ? "#3b82f6" : "#10b981";
              return (
                <div key={col} className="mb-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="w-2 h-2 rounded-full" style={{ background: colColor }} />
                    <span className="text-xs font-semibold" style={{ color: colColor }}>{colLabel}</span>
                    <span className="text-xs" style={{ color: "#334155" }}>({colTasks.length})</span>
                  </div>
                  <div className="space-y-2">
                    {colTasks.map((t) => (
                      <div key={t.id} className="kanban-card">
                        <div className="flex items-start justify-between">
                          <p className="text-sm font-medium text-white">{t.title}</p>
                          <span className={`badge ml-2 ${t.priority === "high" ? "bg-red-500/20 text-red-400 border-red-500/30" : t.priority === "medium" ? "bg-amber-500/20 text-amber-400 border-amber-500/30" : "bg-slate-500/20 text-slate-400 border-slate-500/30"}`}>{t.priority}</span>
                        </div>
                        <p className="text-xs mt-1 mb-2" style={{ color: "#64748b" }}>{t.description}</p>
                        <div className="flex items-center justify-between">
                          <span className="text-xs" style={{ color: "#475569" }}>@{t.assigned_to}</span>
                          <span className="text-xs" style={{ color: "#475569" }}>Due {t.due_date}</span>
                        </div>
                      </div>
                    ))}
                    {colTasks.length === 0 && (
                      <div className="py-4 text-center text-xs" style={{ color: "#334155", border: "1px dashed rgba(99,128,191,0.1)", borderRadius: 10 }}>
                        No tasks here
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── CONTENT ── */}
        {tab === "Content" && (
          <div className="glass-card overflow-hidden">
            <div className="flex items-center justify-between p-4" style={{ borderBottom: "1px solid rgba(99,128,191,0.1)" }}>
              <h3 className="text-sm font-semibold text-white">Blog Posts ({clientBlogs.length})</h3>
              <button className="btn-primary flex items-center gap-1.5 text-xs"><Plus size={12} /> New Blog</button>
            </div>
            {clientBlogs.map((b) => (
              <div key={b.id} className="flex items-center justify-between px-4 py-3.5 table-row">
                <div>
                  <p className="text-sm font-medium text-white">{b.title}</p>
                  <p className="text-xs mt-0.5" style={{ color: "#475569" }}>by {b.author} · {b.created_at}</p>
                </div>
                <span className={`badge ${getStatusColor(b.status)}`}>{b.status.replace("_", " ")}</span>
              </div>
            ))}
            {clientBlogs.length === 0 && <p className="text-xs text-center py-10" style={{ color: "#475569" }}>No blog posts yet.</p>}
          </div>
        )}

        {/* ── BILLING ── */}
        {tab === "Billing" && (
          <div className="space-y-4">
            <div className="glass-card p-5">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <p className="text-xs mb-1" style={{ color: "#475569" }}>Plan</p>
                  <p className="text-sm font-bold text-white capitalize">{client.plan_type}</p>
                </div>
                <div>
                  <p className="text-xs mb-1" style={{ color: "#475569" }}>Monthly Amount</p>
                  <p className="text-sm font-bold text-white">{formatCurrency(client.monthly_revenue)}</p>
                </div>
                <div>
                  <p className="text-xs mb-1" style={{ color: "#475569" }}>Next Due</p>
                  <p className="text-sm font-bold text-white">Apr 01, 2024</p>
                </div>
              </div>
            </div>
            <div className="glass-card overflow-hidden">
              <div className="p-4 text-sm font-semibold text-white" style={{ borderBottom: "1px solid rgba(99,128,191,0.1)" }}>
                Invoice History
              </div>
              <div className="grid text-xs font-semibold px-4 py-2.5" style={{ color: "#475569", gridTemplateColumns: "1fr 1fr 1fr 1fr", borderBottom: "1px solid rgba(99,128,191,0.06)" }}>
                <span>INVOICE</span><span>AMOUNT</span><span>DATE</span><span>STATUS</span>
              </div>
              {clientInvoices.map((inv) => (
                <div key={inv.id} className="grid px-4 py-3 table-row items-center text-sm" style={{ gridTemplateColumns: "1fr 1fr 1fr 1fr" }}>
                  <span className="text-white font-medium">#{inv.id.toUpperCase()}</span>
                  <span className="text-white">{formatCurrency(inv.amount)}</span>
                  <span className="text-xs" style={{ color: "#94a3b8" }}>{inv.issued_date}</span>
                  <span className={`badge ${getStatusColor(inv.status)}`}>{inv.status}</span>
                </div>
              ))}
              {clientInvoices.length === 0 && <p className="text-xs text-center py-8" style={{ color: "#475569" }}>No invoices yet.</p>}
            </div>
          </div>
        )}

        {/* ── CONNECTION ── */}
        {tab === "Connection" && (
          <div className="space-y-6">
            <div className="glass-card p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400">
                  <Globe size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Website Tracking</h3>
                  <p className="text-xs text-slate-500 uppercase tracking-widest font-bold">Real-time Analytics</p>
                </div>
              </div>
              
              <p className="text-sm text-slate-400 mb-6">
                Copy and paste this snippet into the <code>&lt;head&gt;</code> of your client's website to enable real-time traffic monitoring.
              </p>

              <div className="relative group">
                <pre className="bg-black/40 border border-white/5 p-4 rounded-xl text-[11px] font-mono text-blue-300 overflow-x-auto">
                  {`<script 
  src="${window.location.origin}/tracker.js" 
  data-id="${client.tracking_id}" 
  async
></script>`}
                </pre>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity bg-white/5 border-white/10 hover:bg-white/10"
                  onClick={() => {
                    navigator.clipboard.writeText(`<script src="${window.location.origin}/tracker.js" data-id="${client.tracking_id}" async></script>`);
                    toast.success("Snippet copied to clipboard");
                  }}
                >
                  Copy Code
                </Button>
              </div>
            </div>

            <div className="glass-card p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
                  <CheckCircle2 size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Form Integration (Elementor)</h3>
                  <p className="text-xs text-slate-500 uppercase tracking-widest font-bold">Lead Automation</p>
                </div>
              </div>
              
              <p className="text-sm text-slate-400 mb-4">
                Use this Webhook URL in Elementor Forms (Actions After Submit {">"} Webhook) to automatically capture leads.
              </p>

              <div className="flex items-center gap-2">
                <div className="flex-1 bg-black/40 border border-white/5 p-3 rounded-xl text-xs font-mono text-emerald-400 truncate">
                  {`https://tpeskbbvrfebtjiituwi.supabase.co/functions/v1/process-webhook?client_id=${client.id}`}
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="bg-white/5 border-white/10 hover:bg-white/10"
                  onClick={() => {
                    const url = `https://tpeskbbvrfebtjiituwi.supabase.co/functions/v1/process-webhook?client_id=${client.id}`;
                    navigator.clipboard.writeText(url);
                    toast.success("Webhook URL copied");
                  }}
                >
                  Copy
                </Button>
              </div>
            </div>

            <div className="glass-card p-6 lg:col-span-2">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400">
                  <Code size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Custom Forms (JavaScript)</h3>
                  <p className="text-xs text-slate-500 uppercase tracking-widest font-bold">Raw Backend Bridge</p>
                </div>
              </div>
              
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <p className="text-sm text-slate-400 leading-relaxed">
                    Use this script snippet in your client's custom-built website (React, HTML, PHP) to capture leads directly into this dashboard.
                  </p>
                  <div className="flex items-center gap-2 p-3 bg-indigo-500/5 border border-indigo-500/10 rounded-xl text-[10px] text-indigo-400">
                    <AlertCircle size={12} className="shrink-0" />
                    <span>Provide this code to the client's developer for non-WordPress sites.</span>
                  </div>
                </div>
                <div className="relative">
                  <pre className="bg-black/60 border border-white/5 rounded-xl p-4 text-[9px] font-mono text-indigo-300 overflow-x-auto whitespace-pre-wrap leading-relaxed min-h-[160px]">
{`const WEBHOOK_URL = "https://tpeskbbvrfebtjiituwi.supabase.co/functions/v1/process-webhook?client_id=${client.id}";

document.querySelector('#form-id').addEventListener('submit', async (e) => {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(e.target).entries());
  
  await fetch(WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
});`}
                  </pre>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="absolute top-2 right-2 h-7 px-2 text-[10px] hover:bg-white/10"
                    onClick={() => {
                        const code = `const WEBHOOK_URL = "https://tpeskbbvrfebtjiituwi.supabase.co/functions/v1/process-webhook?client_id=${client.id}";\n\ndocument.querySelector('#form-id').addEventListener('submit', async (e) => {\n  e.preventDefault();\n  const data = Object.fromEntries(new FormData(e.target).entries());\n  \n  await fetch(WEBHOOK_URL, {\n    method: 'POST',\n    headers: { 'Content-Type': 'application/json' },\n    body: JSON.stringify(data)\n  });\n});`;
                        navigator.clipboard.writeText(code);
                        toast.success("JS Snippet copied");
                    }}
                  >
                    Copy Snippet
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
