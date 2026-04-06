import { useState, useEffect } from "react";
import { useParams, Link, useLocation, useNavigate } from "react-router-dom";
import { PortalLayout } from "@/components/layout/PortalLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { 
  Loader2 
} from "lucide-react";
import {
  getStatusColor, formatCurrency, cn, formatBytes
} from "@/lib/utils";
import {
  Globe, TrendingUp, TrendingDown, Minus,
  CheckCircle2, Circle, Clock, AlertCircle,
  FileText, BarChart3, Search, CreditCard,
  LayoutDashboard, MessageSquare, Download,
  FolderOpen, Lock, File as FileIcon, ShieldCheck,
  Copy, Check, ExternalLink, Shield, Zap, Code
} from "lucide-react";
import { format } from "date-fns";
import { generateInvoicePDF } from "@/lib/invoice-pdf";
import { AgencyChatbot } from "@/components/chat/AgencyChatbot";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from "recharts";

const TABS = ["Overview", "SEO", "Updates", "Documents", "Billing", "Connection"] as const;
type Tab = (typeof TABS)[number];

const DOC_TYPE_ICONS: Record<string, any> = {
  asset: FileIcon,
  credentials: ShieldCheck,
  report: FileText,
};
const DOC_TYPE_COLORS: Record<string, string> = {
  asset: "text-blue-400",
  credentials: "text-purple-400",
  report: "text-amber-400",
};

function DocumentsTabPanel({ documents, onDownload }: { documents: any[]; onDownload: (doc: any) => void }) {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");

  const filtered = documents.filter((d: any) => {
    const matchType = typeFilter === "all" || d.type === typeFilter;
    const matchSearch = d.name?.toLowerCase().includes(search.toLowerCase());
    return matchType && matchSearch;
  });

  const counts = {
    all: documents.length,
    asset: documents.filter((d: any) => d.type === "asset").length,
    credentials: documents.filter((d: any) => d.type === "credentials").length,
    report: documents.filter((d: any) => d.type === "report").length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-white">Your Documents</h2>
          <p className="text-xs text-slate-500 mt-0.5">All files shared with you by the Primansh team</p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-56">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              className="w-full bg-slate-900/60 border border-slate-800 rounded-xl pl-8 pr-3 py-2 text-xs text-slate-300 placeholder-slate-600 outline-none focus:border-blue-500/50 transition-colors"
              placeholder="Search files..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Type Filter Pills */}
      <div className="flex items-center gap-2 overflow-x-auto hide-scrollbar pb-1">
        {(["all", "asset", "credentials", "report"] as const).map(t => (
          <button
            key={t}
            onClick={() => setTypeFilter(t)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-wider whitespace-nowrap transition-all border",
              typeFilter === t
                ? "bg-blue-600 text-white border-blue-500 shadow-lg shadow-blue-600/20"
                : "text-slate-500 border-slate-800 hover:border-slate-700 hover:text-slate-300"
            )}
          >
            {t === "all" ? "All Files" : t === "asset" ? "Client Assets" : t === "credentials" ? "Credentials" : "Reports"}
            <span className={cn("px-1.5 py-0.5 rounded-full text-[9px]", typeFilter === t ? "bg-white/20" : "bg-slate-800")}>
              {counts[t]}
            </span>
          </button>
        ))}
      </div>

      {/* Document Cards */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 gap-4 bg-slate-900/30 rounded-3xl border border-slate-800">
          <div className="w-16 h-16 rounded-2xl bg-slate-800/60 flex items-center justify-center">
            <FolderOpen size={28} className="text-slate-600" />
          </div>
          <p className="text-sm text-slate-500 font-medium">No documents found</p>
          <p className="text-xs text-slate-600">Your team will upload files here as your project progresses</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((doc: any) => {
            const Icon = DOC_TYPE_ICONS[doc.type] || FileIcon;
            const color = DOC_TYPE_COLORS[doc.type] || "text-slate-400";
            return (
              <div
                key={doc.id}
                className="group bg-slate-900/40 border border-slate-800 rounded-2xl p-5 hover:border-blue-500/30 hover:bg-slate-900/70 transition-all cursor-pointer relative overflow-hidden"
                onClick={() => onDownload(doc)}
              >
                {/* Glow accent */}
                <div className="absolute top-0 right-0 w-20 h-20 rounded-full blur-2xl opacity-0 group-hover:opacity-10 bg-blue-500 transition-opacity" />

                <div className="flex items-start justify-between mb-4">
                  <div className={cn("w-11 h-11 rounded-xl flex items-center justify-center border", 
                    doc.type === "asset" ? "bg-blue-500/10 border-blue-500/20" :
                    doc.type === "credentials" ? "bg-purple-500/10 border-purple-500/20" :
                    "bg-amber-500/10 border-amber-500/20"
                  )}>
                    <Icon size={20} className={color} />
                  </div>
                  {doc.secure && (
                    <span className="flex items-center gap-1 text-[9px] font-bold text-purple-400 bg-purple-500/10 border border-purple-500/20 px-2 py-0.5 rounded-full">
                      <Lock size={8} /> Secure
                    </span>
                  )}
                </div>

                <p className="text-sm font-semibold text-white leading-tight mb-1 truncate group-hover:text-blue-300 transition-colors pr-2">
                  {doc.name}
                </p>
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-800/60">
                  <span className={cn("text-[10px] font-bold uppercase tracking-wider", color)}>
                    {doc.type === "asset" ? "Client Asset" : doc.type === "credentials" ? "Credential" : "Report"}
                  </span>
                  <div className="flex items-center gap-3 text-[10px] text-slate-500">
                    <span>{doc.size ? formatBytes(doc.size) : "—"}</span>
                    <span>{new Date(doc.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span>
                  </div>
                </div>

                {/* Download hint */}
                <div className="absolute bottom-4 right-4 w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all translate-y-1 group-hover:translate-y-0 shadow-lg shadow-blue-600/30">
                  <Download size={13} className="text-white" />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ConnectionTabPanel({ client }: { client: any }) {
  const [copied, setCopied] = useState<string | null>(null);

  const trackerCode = `<script \n  src="${window.location.origin}/tracker.js" \n  data-id="${client.tracking_id}" \n  async\n></script>`;
  const webhookUrl = `${window.location.origin}/api/v1/process-webhook?client_id=${client.id}`;

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-white">Website Connection</h2>
          <p className="text-xs text-slate-500 mt-0.5">Connect your website to sync real-time traffic and SEO data</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Tracker Snippet */}
        <div className="bg-slate-900/40 border border-slate-800 rounded-3xl p-6 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 blur-3xl rounded-full -mr-16 -mt-16 group-hover:bg-blue-500/10 transition-colors" />
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400 border border-blue-500/20">
              <Zap size={18} />
            </div>
            <h3 className="text-sm font-bold text-white">Traffic Tracker</h3>
          </div>
          <p className="text-xs text-slate-400 mb-4 leading-relaxed">
            Copy this snippet into your website's <code className="text-blue-300 font-mono bg-blue-500/10 px-1 rounded">&lt;head&gt;</code> to track real-time visitors and performance.
          </p>
          <div className="relative">
            <pre className="bg-black/50 border border-slate-800 rounded-xl p-4 text-[10px] font-mono text-blue-200 overflow-x-auto whitespace-pre-wrap leading-relaxed min-h-[100px]">
              {trackerCode}
            </pre>
            <button
              onClick={() => handleCopy(trackerCode, 'tracker')}
              className="absolute top-3 right-3 p-2 rounded-lg bg-slate-800 hover:bg-blue-600 text-slate-400 hover:text-white transition-all border border-slate-700 hover:border-blue-500"
            >
              {copied === 'tracker' ? <Check size={14} /> : <Copy size={14} />}
            </button>
          </div>
        </div>

        {/* Webhook URL */}
        <div className="bg-slate-900/40 border border-slate-800 rounded-3xl p-6 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 blur-3xl rounded-full -mr-16 -mt-16 group-hover:bg-emerald-500/10 transition-colors" />
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400 border border-emerald-500/20">
              <ExternalLink size={18} />
            </div>
            <h3 className="text-sm font-bold text-white">Elementor Webhook</h3>
          </div>
          <p className="text-xs text-slate-400 mb-4 leading-relaxed">
            Use this URL in your Elementor Forms or other form builders to automatically sync new leads to your portal.
          </p>
          <div className="relative">
            <div className="bg-black/50 border border-slate-800 rounded-xl p-4 text-[10px] font-mono text-emerald-200 break-all leading-relaxed flex items-center justify-between gap-3">
              <span className="truncate">{webhookUrl}</span>
              <button
                onClick={() => handleCopy(webhookUrl, 'webhook')}
                className="flex-shrink-0 p-2 rounded-lg bg-slate-800 hover:bg-emerald-600 text-slate-400 hover:text-white transition-all border border-slate-700 hover:border-emerald-500"
              >
                {copied === 'webhook' ? <Check size={14} /> : <Copy size={14} />}
              </button>
            </div>
          </div>
        </div>

        {/* SEO API Key */}
        <div className="bg-slate-900/40 border border-slate-800 rounded-3xl p-6 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/5 blur-3xl rounded-full -mr-16 -mt-16 group-hover:bg-purple-500/10 transition-colors" />
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-400 border border-purple-500/20">
              <Shield size={18} />
            </div>
            <h3 className="text-sm font-bold text-white">SEO Access Bridge</h3>
          </div>
          <p className="text-xs text-slate-400 mb-4 leading-relaxed">
            API Key for RankMath SEO plugin and other automated reporting tools.
          </p>
          <div className="flex items-center gap-2 bg-black/50 border border-slate-800 rounded-xl px-4 py-3 justify-between">
            <code className="text-xs font-mono text-purple-300">
              {client.site_api_key?.substring(0, 8)}••••••••••••
            </code>
            <button
              onClick={() => handleCopy(client.site_api_key, 'apikey')}
              className="p-1.5 rounded-lg text-slate-500 hover:text-purple-400 transition-colors"
            >
              {copied === 'apikey' ? <Check size={13} /> : <Copy size={13} />}
            </button>
          </div>
        </div>

        {/* Custom Form Integration */}
        <div className="lg:col-span-2 bg-slate-900/40 border border-slate-800 rounded-3xl p-6 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 blur-3xl rounded-full -mr-16 -mt-16 group-hover:bg-amber-500/10 transition-colors" />
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-400 border border-amber-500/20">
              <Code size={18} />
            </div>
            <h3 className="text-sm font-bold text-white">Custom Forms (JavaScript)</h3>
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <p className="text-xs text-slate-400 leading-relaxed">
                If you have a custom-built website, use this JavaScript snippet in your form submit handler to send leads directly to your portal.
              </p>
              <div className="flex items-center gap-2 p-3 bg-amber-500/5 border border-amber-500/10 rounded-xl text-[10px] text-amber-400">
                 <AlertCircle size={12} className="shrink-0" />
                 <span>Make sure to match your form field names (Email, Phone, Name) to sync correctly.</span>
              </div>
            </div>
            <div className="relative">
              <pre className="bg-black/50 border border-slate-800 rounded-xl p-4 text-[9px] font-mono text-amber-200 overflow-x-auto whitespace-pre-wrap leading-relaxed min-h-[160px]">
{`const WEBHOOK_URL = "${webhookUrl}";

document.querySelector('#my-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(e.target).entries());
  
  await fetch(WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  
  alert('Success!');
});`}
              </pre>
              <button
                onClick={() => handleCopy(`const WEBHOOK_URL = "${webhookUrl}";\n\ndocument.querySelector('#my-form').addEventListener('submit', async (e) => {\n  e.preventDefault();\n  const data = Object.fromEntries(new FormData(e.target).entries());\n  \n  await fetch(WEBHOOK_URL, {\n    method: 'POST',\n    headers: { 'Content-Type': 'application/json' },\n    body: JSON.stringify(data)\n  });\n  \n  alert('Success!');\n});`, 'custom-js')}
                className="absolute top-3 right-3 p-2 rounded-lg bg-slate-800 hover:bg-amber-600 text-slate-400 hover:text-white transition-all border border-slate-700 hover:border-amber-500"
              >
                {copied === 'custom-js' ? <Check size={14} /> : <Copy size={14} />}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PortalDashboard() {
  const { slug, subtab } = useParams<{ slug: string; subtab?: string }>();
  const [tab, setTab] = useState<Tab>("Overview");
  
  // ── LIVE DATA QUERIES ──
  const { data: client, isLoading: isClientLoading } = useQuery({
    queryKey: ['portal_client', slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .or(`slug.eq.${slug},id.eq.${slug}`)
        .single();
      if (error) throw error;
      return data;
    }
  });

  const { data: clientTasks = [], isLoading: isTasksLoading } = useQuery({
    queryKey: ['portal_tasks', client?.id],
    enabled: !!client?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('client_id', client?.id);
      if (error) throw error;
      return data;
    }
  });

  const { data: clientKeywords = [], isLoading: isKeywordsLoading } = useQuery({
    queryKey: ['portal_keywords', client?.id],
    enabled: !!client?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('keywords')
        .select('*')
        .eq('client_id', client?.id);
      if (error) throw error;
      return data;
    }
  });

  const { data: clientInvoices = [], isLoading: isInvoicesLoading } = useQuery({
    queryKey: ['portal_invoices', client?.id],
    enabled: !!client?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invoices')
        .select('*')
        .eq('client_id', client?.id)
        .order('issued_date', { ascending: false });
      if (error) throw error;
      return data;
    }
  });

  const { data: siteAnalytics = [], isLoading: isAnalyticsLoading } = useQuery({
    queryKey: ['portal_site_analytics', client?.id],
    enabled: !!client?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('site_analytics')
        .select('*')
        .eq('client_id', client?.id)
        .order('timestamp', { ascending: false })
        .limit(100);
      if (error) throw error;
      return data || [];
    }
  });

  // Process analytics into daily chart format
  const processedAnalytics = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const dateStr = d.toISOString().split('T')[0];
    const dayVisits = (siteAnalytics as any[]).filter((a: any) => a.timestamp && a.timestamp.startsWith(dateStr)).length;
    return { 
      month: format(d, 'MMM dd'), 
      traffic: dayVisits 
    };
  });

  const uniqueVisitors = new Set((siteAnalytics as any[]).map((a: any) => a.session_id)).size;

  const { data: documents = [], isLoading: isDocsLoading } = useQuery({
    queryKey: ['portal_documents', client?.id],
    enabled: !!client?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('client_documents' as any)
        .select('*')
        .eq('client_id', client?.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    }
  });

  const { profile, signOut } = useAuth();
  const isLoading = isClientLoading || isTasksLoading || isKeywordsLoading || isInvoicesLoading || isAnalyticsLoading || isDocsLoading;
  
  // Communication handlers
  const navigate = useNavigate();
  const handleOpenMessages = () => {
    navigate(`/clientportal/${slug}/messages`);
  };

  const handleDownload = async (doc: any) => {
    const { data, error } = await supabase.storage
      .from('client-documents')
      .createSignedUrl(doc.file_path, 60);
    if (error) return;
    window.open(data.signedUrl, '_blank');
  };
  
  // Security check: If user is a client, they can only access their associated firm
  // Admin and agency personnel can access any portal node
  const isAuthorized = !profile || profile.role !== 'client' || (client?.id === profile.associated_client_id);

  // Sync tab with subtab param
  useEffect(() => {
    if (subtab === "seo") setTab("SEO");
    else if (subtab === "tasks" || subtab === "updates") setTab("Updates");
    else if (subtab === "documents") setTab("Documents");
    else if (subtab === "billing") setTab("Billing");
    else if (subtab === "connection") setTab("Connection");
    else setTab("Overview");
  }, [subtab]);

  if (isLoading) return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4 bg-[#020617]">
      <Loader2 className="animate-spin text-blue-500" size={40} />
      <span className="text-sm text-slate-500 font-mono tracking-tighter">Synchronizing portal node...</span>
    </div>
  );

  if (!client || !isAuthorized) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen text-center p-6 bg-[#020617]">
        <AlertCircle size={48} className="text-red-500 mb-4" />
        <h1 className="text-2xl font-bold text-white mb-2">Portal Access Denied</h1>
        <p className="text-slate-400 mb-6">You are not authorized to view this specific project node.</p>
        <Link to="/" className="text-blue-400 hover:underline">Return to Home</Link>
      </div>
    );
  }

  return (
    <PortalLayout 
      title={`Welcome back, ${client?.firm_name?.split(' ')[0] || "Partner"}`} 
      subtitle={`Your project: ${client?.firm_name || "Active Node"} · ${client?.location || "India"}`}
      clientId={client?.id}
    >
      <div className="fade-up">
        {/* Navigation Tabs */}
        <div className="flex items-center gap-1 mb-6 rounded-xl p-1 bg-slate-900/50 border border-slate-800 w-full md:w-fit overflow-x-auto no-scrollbar scroll-smooth">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "px-5 py-2 rounded-lg text-xs font-semibold transition-all whitespace-nowrap",
                tab === t 
                  ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20" 
                  : "text-slate-500 hover:text-slate-300"
              )}
            >
              {t}
            </button>
          ))}
        </div>

        {/* ── OVERVIEW ── */}
        {tab === "Overview" && (
          <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-slate-900/40 border border-slate-800 p-5 rounded-2xl">
                <div className="flex items-center justify-between mb-3 text-blue-400">
                  <TrendingUp size={20} />
                  <span className="text-[10px] font-bold uppercase tracking-wider bg-blue-500/10 px-2 py-0.5 rounded">Growth</span>
                </div>
                <p className="text-2xl font-bold text-white mb-1">
                  {uniqueVisitors}
                </p>
                <p className="text-xs text-slate-400 font-medium">Monthly Visitors</p>
              </div>

              <div className="bg-slate-900/40 border border-slate-800 p-5 rounded-2xl">
                <div className="flex items-center justify-between mb-3 text-emerald-400">
                  <CheckCircle2 size={20} />
                  <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 px-2 py-0.5 rounded">Tasks</span>
                </div>
                <p className="text-2xl font-bold text-white mb-1">
                  {clientTasks.filter(t => t.status === 'done').length}
                </p>
                <p className="text-xs text-slate-400 font-medium">Milestones Achieved</p>
              </div>

              <div className="bg-slate-900/40 border border-slate-800 p-5 rounded-2xl">
                <div className="flex items-center justify-between mb-3 text-purple-400">
                  <Search size={20} />
                  <span className="text-[10px] font-bold uppercase tracking-wider bg-purple-500/10 px-2 py-0.5 rounded">SEO</span>
                </div>
                <p className="text-2xl font-bold text-white mb-1">
                  {clientKeywords.filter(k => k.current_pos <= 10).length}
                </p>
                <p className="text-xs text-slate-400 font-medium">Keywords in Top 10</p>
              </div>

              <div className="bg-slate-900/40 border border-slate-800 p-5 rounded-2xl">
                <div className="flex items-center justify-between mb-3 text-amber-400">
                  <Clock size={20} />
                  <span className="text-[10px] font-bold uppercase tracking-wider bg-amber-500/10 px-2 py-0.5 rounded">Status</span>
                </div>
                <p className="text-2xl font-bold text-white mb-1">Active</p>
                <p className="text-xs text-slate-400 font-medium">Project Plan: {client?.plan_type || "Premium"}</p>
              </div>
            </div>

            {/* Main Content Area */}
            <div className="grid lg:grid-cols-3 gap-6">
              {/* Left Column - Chart */}
              <div className="lg:col-span-2 space-y-6">
                <div className="bg-slate-900/40 border border-slate-800 p-6 rounded-2xl">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-sm font-bold text-white">Project Performance (last 30 days)</h3>
                    <div className="flex items-center gap-4">
                       <span className="flex items-center gap-2 text-[10px] text-slate-400">
                         <span className="w-2 h-2 rounded-full bg-blue-500" /> Web Traffic
                       </span>
                    </div>
                  </div >
                  <ResponsiveContainer width="100%" height={250}>
                    <AreaChart data={processedAnalytics}>
                      <defs>
                        <linearGradient id="portalTraffic" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="month" tick={{ fill: "#64748b", fontSize: 10 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: "#64748b", fontSize: 10 }} axisLine={false} tickLine={false} />
                      <Tooltip 
                        contentStyle={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 12, fontSize: 12 }} 
                        itemStyle={{ color: "#fff" }}
                      />
                      <Area type="monotone" dataKey="traffic" stroke="#3b82f6" strokeWidth={3} fill="url(#portalTraffic)" animationDuration={1500} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                <div className="bg-slate-900/40 border border-slate-800 p-6 rounded-2xl">
                  <h3 className="text-sm font-bold text-white mb-4">Latest SEO Tasks</h3>
                  <div className="space-y-3">
                    {clientTasks.slice(0, 3).map((t) => (
                      <div key={t.id} className="flex items-center justify-between p-3 rounded-xl bg-slate-800/20 border border-slate-800/50">
                        <div className="flex items-center gap-3">
                          {t.status === 'done' 
                            ? <CheckCircle2 size={16} className="text-emerald-500" /> 
                            : <Clock size={16} className="text-slate-500" />}
                          <span className={cn("text-xs font-medium", t.status === 'done' ? "text-slate-400" : "text-white")}>
                            {t.title}
                          </span>
                        </div>
                        <span className="text-[10px] font-bold text-slate-500">{t.due_date}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Right Column - Sidemats */}
              <div className="space-y-6">
                <div className="bg-gradient-to-br from-blue-600/20 to-indigo-600/20 border border-blue-500/20 p-6 rounded-2xl shadow-xl shadow-blue-500/5">
                  <h3 className="text-sm font-bold text-white mb-2">Project Manager</h3>
                  <div className="flex items-center gap-3 mt-4">
                    <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center font-bold text-white">
                      {(client?.assigned_to || "A")[0]}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-white">{client?.assigned_to || "Account Manager"}</p>
                      <p className="text-[10px] text-blue-400 font-medium">Growth Specialist</p>
                    </div>
                  </div>
                  <button 
                    onClick={handleOpenMessages}
                    className="w-full mt-6 py-2.5 bg-white text-blue-600 text-xs font-bold rounded-xl hover:bg-slate-100 transition-colors"
                  >
                    Send Message
                  </button>
                </div>

                <div className="bg-slate-900/40 border border-slate-800 p-6 rounded-2xl">
                  <h3 className="text-sm font-bold text-white mb-4">Quick Documents</h3>
                  <div className="space-y-3">
                    {documents.slice(0, 3).map((doc: any) => (
                      <div 
                        key={doc.id}
                        onClick={() => handleDownload(doc)}
                        className="flex items-center gap-3 p-2 group cursor-pointer hover:bg-slate-800/30 rounded-lg transition-colors"
                      >
                        <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-500 border border-blue-500/20">
                          <FileText size={14} />
                        </div>
                        <span className="text-xs font-medium group-hover:text-white transition-colors truncate">{doc.name}</span>
                      </div>
                    ))}
                    {documents.length === 0 && (
                      <p className="text-[10px] text-slate-500 italic py-2">No documents published yet.</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── SEO DETAILED ── */}
        {tab === "SEO" && (
          <div className="space-y-6">
            <div className="bg-slate-900/40 border border-slate-800 p-6 rounded-3xl">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h3 className="text-lg font-bold text-white">Keyword Visibility</h3>
                  <p className="text-xs text-slate-500">Track your rankings on search engines</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-slate-500 mb-1">Total Rank Volume</p>
                  <p className="text-xl font-bold text-blue-400">Top 100</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                 {[
                   { label: "Top 3", count: clientKeywords.filter(k => k.current_pos <= 3).length, color: "text-emerald-400" },
                   { label: "Top 10", count: clientKeywords.filter(k => k.current_pos <= 10).length, color: "text-blue-400" },
                   { label: "Top 50", count: clientKeywords.filter(k => k.current_pos <= 50).length, color: "text-slate-400" }
                 ].map(stat => (
                   <div key={stat.label} className="bg-slate-800/30 p-4 rounded-2xl border border-slate-800/50">
                      <p className="text-center text-xs text-slate-500 font-bold uppercase tracking-widest mb-2">{stat.label}</p>
                      <p className={cn("text-center text-3xl font-extrabold", stat.color)}>{stat.count}</p>
                   </div>
                 ))}
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="text-slate-500 text-[10px] font-bold uppercase tracking-widest border-b border-slate-800">
                      <th className="pb-4 px-2">Keyword</th>
                      <th className="pb-4 px-2 text-center">Current</th>
                      <th className="pb-4 px-2 text-center">Trend</th>
                      <th className="pb-4 px-2 text-right">Target</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50">
                    {clientKeywords.map(kw => (
                       <tr key={kw.id} className="group hover:bg-slate-800/20 transition-colors">
                          <td className="py-4 px-2 font-bold text-white">{kw.keyword}</td>
                          <td className="py-4 px-2 text-center">
                            <span className="bg-slate-800 border border-slate-700 px-2 py-1 rounded-lg font-bold">
                              #{kw.current_pos}
                            </span>
                          </td>
                          <td className="py-4 px-2 text-center">
                            <div className="flex justify-center">
                              {kw.trend === 'up' && <TrendingUp size={14} className="text-emerald-400" />}
                              {kw.trend === 'down' && <TrendingDown size={14} className="text-red-400" />}
                              {kw.trend === 'stable' && <Minus size={14} className="text-slate-600" />}
                            </div>
                          </td>
                          <td className="py-4 px-2 text-right text-slate-500 font-medium">#{kw.target_pos}</td>
                       </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ── UPDATES (TASKS) ── */}
        {tab === "Updates" && (
           <div className="space-y-6">
              <div className="bg-slate-900/40 border border-slate-800 p-6 rounded-3xl">
                 <h3 className="text-sm font-bold text-white mb-6 flex items-center gap-2">
                   <Clock size={16} className="text-blue-400" /> Active Milestones
                   <span className="ml-auto text-[10px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded-full">
                     {clientTasks.filter(t => t.status !== 'done').length} in progress
                   </span>
                 </h3>
                 {clientTasks.filter(t => t.status !== 'done').length === 0 ? (
                   <p className="text-xs text-slate-500 italic py-4 text-center">No active tasks right now.</p>
                 ) : (
                   <div className="space-y-4">
                     {clientTasks.filter(t => t.status !== 'done').map(t => (
                        <div key={t.id} className="p-5 rounded-2xl bg-slate-800/30 border border-slate-800/50 relative overflow-hidden group">
                          <div className={cn(
                            "absolute top-0 left-0 w-1 h-full rounded-l-2xl",
                            t.status === 'in_progress' ? "bg-blue-500" :
                            t.status === 'review'      ? "bg-amber-500" :
                            "bg-slate-600"
                          )} />
                          <div className="pl-3">
                            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                              <h4 className="text-sm font-bold text-white">{t.title}</h4>
                              <div className="flex items-center gap-2">
                                {t.priority && (
                                  <span className={cn("text-[9px] font-bold px-2 py-0.5 rounded-full uppercase",
                                    t.priority === 'high'   ? "bg-red-500/20 text-red-400 border border-red-500/20" :
                                    t.priority === 'medium' ? "bg-amber-500/20 text-amber-400 border border-amber-500/20" :
                                                              "bg-slate-500/20 text-slate-400 border border-slate-500/20"
                                  )}>{t.priority}</span>
                                )}
                                <span className={cn("text-[9px] font-bold px-2 py-0.5 rounded-full uppercase",
                                  t.status === 'in_progress' ? "bg-blue-500/20 text-blue-400 border border-blue-500/20" :
                                  t.status === 'review'      ? "bg-amber-500/20 text-amber-400 border border-amber-500/20" :
                                                               "bg-slate-500/20 text-slate-400 border border-slate-500/20"
                                )}>{t.status?.replace('_', ' ')}</span>
                              </div>
                            </div>
                            {t.description && (
                              <p className="text-xs text-slate-400 leading-relaxed mb-4">{t.description}</p>
                            )}
                            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-800/50">
                              <div className="flex items-center gap-2 text-[10px] text-slate-500">
                                <Clock size={11} />
                                <span>Due: <b className="text-slate-300">{t.due_date ? new Date(t.due_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'TBD'}</b></span>
                              </div>
                              {t.assigned_to && (
                                <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
                                  <div className="w-5 h-5 rounded-full bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-400 font-bold text-[8px]">{t.assigned_to[0]?.toUpperCase()}</div>
                                  <span>{t.assigned_to}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                     ))}
                   </div>
                 )}
              </div>

              <div className="bg-slate-900/40 border border-slate-800 p-6 rounded-3xl">
                 <h3 className="text-sm font-bold text-white mb-6 flex items-center gap-2">
                   <CheckCircle2 size={16} className="text-emerald-400" /> Completed Updates
                   <span className="ml-auto text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                     {clientTasks.filter(t => t.status === 'done').length} done
                   </span>
                 </h3>
                 {clientTasks.filter(t => t.status === 'done').length === 0 ? (
                   <p className="text-xs text-slate-500 italic py-4 text-center">No completed tasks yet.</p>
                 ) : (
                   <div className="space-y-4">
                     {clientTasks.filter(t => t.status === 'done').map(t => (
                        <div key={t.id} className="p-5 rounded-2xl bg-emerald-500/[0.03] border border-emerald-500/10 relative overflow-hidden">
                          <div className="absolute top-0 left-0 w-1 h-full rounded-l-2xl bg-emerald-500/40" />
                          <div className="pl-3">
                            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                              <h4 className="text-sm font-bold text-slate-300 line-through decoration-emerald-500/40">{t.title}</h4>
                              <div className="flex items-center gap-2">
                                {t.priority && (
                                  <span className={cn("text-[9px] font-bold px-2 py-0.5 rounded-full uppercase",
                                    t.priority === 'high'   ? "bg-red-500/10 text-red-400/60 border border-red-500/10" :
                                    t.priority === 'medium' ? "bg-amber-500/10 text-amber-400/60 border border-amber-500/10" :
                                                              "bg-slate-500/10 text-slate-400/60 border border-slate-500/10"
                                  )}>{t.priority}</span>
                                )}
                                <span className="text-[9px] font-bold px-2 py-0.5 rounded-full uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">completed</span>
                              </div>
                            </div>
                            {t.description && (
                              <p className="text-xs text-slate-500 leading-relaxed mb-4">{t.description}</p>
                            )}
                            <div className="flex items-center gap-2 pt-3 border-t border-emerald-500/10 text-[10px] text-slate-500">
                              <CheckCircle2 size={11} className="text-emerald-500" />
                              <span>Due date: <b className="text-slate-300">{t.due_date ? new Date(t.due_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}</b></span>
                            </div>
                          </div>
                        </div>
                     ))}
                   </div>
                 )}
              </div>
           </div>
        )}

        {/* ── BILLING ── */}
        {tab === "Billing" && (
           <div className="space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                 <div className="bg-slate-900/40 border border-slate-800 p-6 rounded-3xl">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Active Plan</p>
                    <p className="text-2xl font-extrabold text-white mb-6 uppercase">{client.plan_type}</p>
                    <div className="flex items-center justify-between p-4 rounded-2xl bg-blue-500/5 border border-blue-500/10">
                       <span className="text-sm text-slate-400">Monthly Subscription</span>
                       <span className="text-lg font-bold text-white">{formatCurrency(client.monthly_revenue)}</span>
                    </div>
                 </div>

                 <div className="bg-slate-900/40 border border-slate-800 p-6 rounded-3xl flex flex-col justify-center">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Payment Status</p>
                    <div className="flex items-center gap-2 text-emerald-400 mb-2">
                       <CheckCircle2 size={20} />
                       <span className="text-xl font-bold">Account Up to Date</span>
                    </div>
                    <p className="text-xs text-slate-500">Next invoice date: April 01, 2024</p>
                 </div>
              </div>

              <div className="bg-slate-900/40 border border-slate-800 p-6 rounded-3xl">
                 <h3 className="text-sm font-bold text-white mb-6">Payment History</h3>
                 <div className="space-y-2">
                       {clientInvoices.map(inv => (
                        <div key={inv.id} className="flex items-center justify-between p-4 rounded-2xl hover:bg-slate-800/20 border border-transparent hover:border-slate-800 transition-all group/row">
                           <div className="flex items-center gap-4">
                              <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-slate-400 group-hover/row:bg-blue-500/10 group-hover/row:text-blue-400 transition-colors">
                                 <CreditCard size={18} />
                              </div>
                              <div className="min-w-0">
                                 <p className="text-sm font-bold text-white truncate">Invoice #{inv.id.toUpperCase().substring(0, 8)}</p>
                                 <p className="text-[10px] text-slate-500">{inv.issued_date}</p>
                              </div>
                           </div>
                           <div className="flex items-center gap-4">
                              <div className="text-right hidden sm:block">
                                 <p className="text-sm font-bold text-white">{formatCurrency(inv.amount)}</p>
                                  <span className={`text-[9px] font-bold uppercase ${inv.status === 'paid' ? 'text-emerald-400' : inv.status === 'overdue' ? 'text-red-400' : 'text-amber-400'}`}>
                                    {inv.status}
                                  </span>
                              </div>
                              <button
                                 onClick={async () => await generateInvoicePDF({
                                    invoice_number: inv.id.toUpperCase().substring(0, 8),
                                    issued_date: inv.issued_date,
                                    client_name: client.firm_name, 
                                    client_address: client.location || "New Delhi, India", 
                                    client_phone: client.contact_phone || "+91 97173 55517",
                                    client_email: client.contact_email || "billing@primansh.com",
                                    contact_person: client.contact_name || "Account Manager",
                                    subtotal: inv.amount,
                                    tax_rate: 0,
                                    amount: inv.amount,
                                    items: [
                                       { description: "SEO Growth Pro & Digital Strategy", quantity: 1, rate: inv.amount }
                                    ],
                                    notes: "Professional digital acceleration and compliance services."
                                 })}
                                 className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-blue-500 text-slate-400 hover:text-white flex items-center justify-center transition-all shadow-lg"
                                 title="Download Invoice PDF"
                              >
                                 <Download size={16} />
                              </button>
                           </div>
                        </div>
                     ))}
                 </div>
              </div>
           </div>
        )}

        {/* ── DOCUMENTS ── */}
        {tab === "Documents" && (
          <DocumentsTabPanel documents={documents} onDownload={handleDownload} />
        )}

        {/* ── CONNECTION ── */}
        {tab === "Connection" && (
          <ConnectionTabPanel client={client} />
        )}
      </div>
    </PortalLayout>
  );
}
