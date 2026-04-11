"use client";

import { useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import {
  Search, Loader2, Mail, Phone, Building2, MessageSquare,
  Globe, Bot, Users, Trash2, ChevronDown, ChevronUp,
  Filter, RefreshCw, TrendingUp
} from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

const SOURCE_CONFIG: Record<string, { label: string; color: string; bg: string; border: string; icon: any }> = {
  website_bot:   { label: "Chatbot",       color: "text-purple-400", bg: "bg-purple-500/10", border: "border-purple-500/20", icon: Bot },
  contact_page:  { label: "Contact Page",  color: "text-blue-400",   bg: "bg-blue-500/10",   border: "border-blue-500/20",   icon: Globe },
  homepage:      { label: "Homepage",      color: "text-emerald-400",bg: "bg-emerald-500/10",border: "border-emerald-500/20",icon: TrendingUp },
  unknown:       { label: "Website",       color: "text-slate-400",  bg: "bg-slate-500/10",  border: "border-slate-500/20",  icon: Users },
};

const STATUS_OPTIONS = ["new", "contacted", "qualified", "closed"];
const STATUS_COLORS: Record<string, string> = {
  new:        "text-blue-400 bg-blue-500/10 border-blue-500/20",
  contacted:  "text-amber-400 bg-amber-500/10 border-amber-500/20",
  qualified:  "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  closed:     "text-slate-400 bg-slate-500/10 border-slate-500/20",
};

export default function LeadsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: leads = [], isLoading, refetch } = useQuery({
    queryKey: ["admin_leads"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leads")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("leads").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin_leads"] });
      toast.success("Lead status updated");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("leads").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin_leads"] });
      toast.success("Lead deleted");
    },
  });

  const convertMutation = useMutation({
    mutationFn: async (leadId: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Unauthorized");

      const { data, error } = await supabase.rpc("convert_lead_to_client", {
        lead_id: leadId,
        admin_id: user.id
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (clientId) => {
      queryClient.invalidateQueries({ queryKey: ["admin_leads"] });
      queryClient.invalidateQueries({ queryKey: ["admin_clients"] });
      toast.success("Lead converted to Client! 🚀");
    },
    onError: (err: any) => {
      toast.error(`Conversion failed: ${err.message}`);
    }
  });

  const filteredLeads = leads.filter((l: any) => {
    const matchesSearch =
      l.name?.toLowerCase().includes(search.toLowerCase()) ||
      l.email?.toLowerCase().includes(search.toLowerCase()) ||
      l.industry?.toLowerCase().includes(search.toLowerCase()) ||
      l.message?.toLowerCase().includes(search.toLowerCase());
    const matchesSource = sourceFilter === "all" || l.source === sourceFilter;
    return matchesSearch && matchesSource;
  });

  const sourceCounts = leads.reduce((acc: any, l: any) => {
    acc[l.source || "unknown"] = (acc[l.source || "unknown"] || 0) + 1;
    return acc;
  }, {});

  return (
    <AppShell title="Leads" subtitle="All form submissions from the website">
      <div className="fade-up max-w-6xl mx-auto px-4 sm:px-6">

        {/* Stats Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          {[
            { label: "Total Leads", value: leads.length, icon: Users, color: "text-blue-400" },
            { label: "New",        value: leads.filter((l: any) => l.status === "new" || !l.status).length, icon: TrendingUp, color: "text-emerald-400" },
            { label: "Chatbot",   value: sourceCounts["website_bot"] || 0, icon: Bot, color: "text-purple-400" },
            { label: "Forms",     value: (sourceCounts["contact_page"] || 0) + (sourceCounts["homepage"] || 0), icon: Globe, color: "text-amber-400" },
          ].map(stat => (
            <div key={stat.label} className="glass-card p-5 rounded-2xl border border-white/5 bg-[#0a0f1d]/60 backdrop-blur-xl">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{stat.label}</span>
                <stat.icon size={14} className={stat.color} />
              </div>
              <p className={cn("text-2xl font-bold", stat.color)}>{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              className="w-full bg-[#0a0f1d]/60 border border-white/10 rounded-2xl py-3 pl-11 pr-4 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition-all"
              placeholder="Search by name, email, or message..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <select
              value={sourceFilter}
              onChange={e => setSourceFilter(e.target.value)}
              className="bg-[#0a0f1d]/60 border border-white/10 rounded-2xl py-3 px-4 text-sm text-slate-300 focus:outline-none"
            >
              <option value="all">All Sources</option>
              <option value="website_bot">Chatbot</option>
              <option value="contact_page">Contact Page</option>
              <option value="homepage">Homepage</option>
            </select>
            <button
              onClick={() => refetch()}
              className="p-3 rounded-2xl bg-[#0a0f1d]/60 border border-white/10 text-slate-400 hover:text-white transition-colors"
              title="Refresh"
            >
              <RefreshCw size={15} />
            </button>
          </div>
        </div>

        {/* Leads Table */}
        <div className="glass-card rounded-[32px] border border-white/5 bg-[#0a0f1d]/40 backdrop-blur-xl overflow-hidden">
          <div className="hidden sm:grid grid-cols-[2fr,2fr,1fr,1.2fr,80px] items-center px-8 py-4 border-b border-white/5 bg-white/[0.02]">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">Contact</span>
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">Details</span>
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">Source</span>
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">Status</span>
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">Actions</span>
          </div>

          <div className="divide-y divide-white/5">
            {isLoading ? (
              <div className="py-20 flex flex-col items-center gap-4">
                <Loader2 className="animate-spin text-blue-500" size={32} />
                <p className="text-xs text-slate-500">Loading leads...</p>
              </div>
            ) : filteredLeads.length === 0 ? (
              <div className="py-20 text-center">
                <Users size={36} className="mx-auto text-slate-700 mb-3" />
                <p className="text-slate-500 text-sm">No leads yet. They'll appear here as forms are submitted.</p>
              </div>
            ) : (
              filteredLeads.map((lead: any) => {
                const src = SOURCE_CONFIG[lead.source] || SOURCE_CONFIG["unknown"];
                const SrcIcon = src.icon;
                const isExpanded = expandedId === lead.id;
                const status = lead.status || "new";

                return (
                  <motion.div key={lead.id} layout>
                    <div
                      className="grid grid-cols-1 sm:grid-cols-[2fr,2fr,1fr,1.2fr,80px] items-center px-8 py-5 hover:bg-white/[0.02] transition-colors group/row cursor-pointer"
                      onClick={() => setExpandedId(isExpanded ? null : lead.id)}
                    >
                      {/* Contact */}
                      <div className="flex items-center gap-3 mb-3 sm:mb-0">
                        <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 font-bold text-sm flex-shrink-0">
                          {lead.name?.[0]?.toUpperCase() || "?"}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-white truncate">{lead.name || "Anonymous"}</p>
                          <p className="text-[10px] text-slate-500 flex items-center gap-1 truncate">
                            <Mail size={10} /> {lead.email || "—"}
                          </p>
                        </div>
                      </div>

                      {/* Details */}
                      <div className="mb-3 sm:mb-0 space-y-0.5">
                        {lead.industry && (
                          <p className="text-xs text-slate-400 flex items-center gap-1">
                            <Building2 size={10} className="text-slate-600" /> {lead.industry}
                          </p>
                        )}
                        {lead.phone && (
                          <p className="text-xs text-slate-400 flex items-center gap-1">
                            <Phone size={10} className="text-slate-600" /> {lead.phone}
                          </p>
                        )}
                        {lead.budget && (
                          <p className="text-xs text-slate-500">Budget: <span className="text-slate-300">{lead.budget}</span></p>
                        )}
                        <p className="text-[10px] text-slate-600">
                          {new Date(lead.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>

                      {/* Source */}
                      <div className="mb-3 sm:mb-0">
                        <span className={cn("inline-flex items-center gap-1.5 text-[9px] font-bold px-2.5 py-1 rounded-full uppercase border", src.color, src.bg, src.border)}>
                          <SrcIcon size={10} /> {src.label}
                        </span>
                      </div>

                      {/* Status */}
                      <div className="mb-3 sm:mb-0" onClick={e => e.stopPropagation()}>
                        <select
                          value={status}
                          onChange={e => updateStatusMutation.mutate({ id: lead.id, status: e.target.value })}
                          className={cn(
                            "text-[9px] font-bold px-2.5 py-1.5 rounded-full uppercase border bg-transparent cursor-pointer focus:outline-none",
                            STATUS_COLORS[status] || STATUS_COLORS["new"]
                          )}
                        >
                          {STATUS_OPTIONS.map(s => <option key={s} value={s} className="bg-slate-900 text-white">{s}</option>)}
                        </select>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                        {status === "qualified" && (
                          <button
                            onClick={() => convertMutation.mutate(lead.id)}
                            disabled={convertMutation.isPending}
                            className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500 hover:text-white transition-all shadow-lg shadow-emerald-900/10"
                            title="Convert to Client"
                          >
                            {convertMutation.isPending ? <Loader2 className="animate-spin" size={14} /> : <Users size={14} />}
                          </button>
                        )}
                        <button
                          onClick={() => setExpandedId(isExpanded ? null : lead.id)}
                          className="p-2 rounded-lg bg-white/5 text-slate-400 hover:text-white transition-colors"
                          title={isExpanded ? "Collapse" : "Expand"}
                        >
                          {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </button>
                        <button
                          onClick={() => deleteMutation.mutate(lead.id)}
                          className="p-2 rounded-lg text-red-400/50 hover:text-red-400 hover:bg-red-500/10 transition-all opacity-0 group-hover/row:opacity-100"
                          title="Delete lead"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>

                    {/* Expanded message / notes */}
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="px-8 pb-6">
                            <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/5">
                              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                                <MessageSquare size={11} /> Message / Notes
                              </p>
                              <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">
                                {lead.message || lead.notes || "No message provided."}
                              </p>
                              {lead.firm_name && (
                                <p className="text-xs text-slate-500 mt-3">Firm: <span className="text-slate-300">{lead.firm_name}</span></p>
                              )}
                              {lead.service && (
                                <p className="text-xs text-slate-500 mt-1">Service: <span className="text-slate-300">{lead.service}</span></p>
                              )}
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })
            )}
          </div>
        </div>

      </div>
    </AppShell>
  );
}
