import { AppShell } from "@/components/layout/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  TrendingUp, TrendingDown, Minus, Search, Loader2, 
  Target, Plus, Trash2, Calendar, ClipboardCheck,
  ChevronRight, AlertCircle
} from "lucide-react";
import { Link } from "react-router-dom";
import { useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export default function SeoPage() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState("all");
  const [isAddKeywordOpen, setIsAddKeywordOpen] = useState(false);
  const [isAddTaskOpen, setIsAddTaskOpen] = useState(false);
  
  const [newKeyword, setNewKeyword] = useState({ 
    client_id: "", keyword: "", target_pos: 1, current_pos: 10, trend: "stable" 
  });
  const [newTask, setNewTask] = useState({ client_id: "", title: "", priority: "medium" });

  const { data: keywords = [], isLoading: isKeywordsLoading } = useQuery({
    queryKey: ['admin_keywords'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('keywords')
        .select('*, clients(firm_name)')
        .order('last_checked', { ascending: false });
      if (error) throw error;
      return data.map(k => ({ ...k, client_name: k.clients?.firm_name }));
    }
  });

  const { data: clients = [], isLoading: isClientsLoading } = useQuery({
    queryKey: ['admin_clients_simple'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('id, firm_name, status')
        .eq('status', 'active');
      if (error) throw error;
      return data;
    }
  });

  const { data: seoTasks = [], isLoading: isTasksLoading } = useQuery({
    queryKey: ['admin_seo_tasks'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('module', 'seo');
      if (error) throw error;
      return data;
    }
  });

  // ── MUTATIONS ──
  const addKeywordMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('keywords')
        .insert({
          ...newKeyword,
          last_checked: new Date().toISOString().split('T')[0]
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_keywords'] });
      toast.success("Keyword added to tracker! 🎯");
      setIsAddKeywordOpen(false);
      setNewKeyword({ client_id: "", keyword: "", target_pos: 1, current_pos: 10, trend: "stable" });
    },
    onError: (err: any) => toast.error(`Action failed: ${err.message}`)
  });

  const deleteKeywordMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('keywords').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_keywords'] });
      toast.success("Keyword removed.");
    }
  });

  const updateKeywordMutation = useMutation({
    mutationFn: async ({ id, newPos, oldPos }: { id: string, newPos: number, oldPos: number }) => {
      let trend: 'up' | 'down' | 'stable' = 'stable';
      if (newPos < oldPos) trend = 'up';
      else if (newPos > oldPos) trend = 'down';

      const { error } = await supabase
        .from('keywords')
        .update({ 
          current_pos: newPos,
          trend,
          last_checked: new Date().toISOString().split('T')[0]
        })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_keywords'] });
      toast.success("Rank synchronized! 🛰️");
    },
    onError: (err: any) => toast.error(`Refresh failed: ${err.message}`)
  });

  const addTaskMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('tasks')
        .insert({
          ...newTask,
          module: 'seo',
          status: 'todo'
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_seo_tasks'] });
      toast.success("SEO task created! 📋");
      setIsAddTaskOpen(false);
      setNewTask({ client_id: "", title: "", priority: "medium" });
    },
    onError: (err: any) => toast.error(`Action failed: ${err.message}`)
  });

  const updateTaskStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string, status: string }) => {
      const { error } = await supabase.from('tasks').update({ status }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_seo_tasks'] });
      toast.success("Task status updated.");
    }
  });

  const isLoading = isKeywordsLoading || isClientsLoading || isTasksLoading;

  if (isLoading) return (
    <AppShell title="SEO Operations Panel" subtitle="Synchronizing search analytics...">
        <div className="flex flex-col items-center justify-center py-32 gap-4">
            <Loader2 className="animate-spin text-accent" size={40} />
            <span className="text-sm text-muted-foreground">Retrieving keyword metrics...</span>
        </div>
    </AppShell>
  );
  return (
    <AppShell title="SEO Operations Panel" subtitle="Agency-wide keyword tracking and monthly checklists">
      <div className="fade-up">
        {/* Toolbar */}
        <div className="flex items-center justify-between mb-8 pb-6 border-b border-white/5">
           <div className="flex items-center gap-4">
              <h1 className="text-2xl font-bold text-white tracking-tight">Search Operations</h1>
              <div className="h-6 w-[1px] bg-white/10 mx-2" />
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#0a0f1d]/60 border border-white/10">
                <Search size={13} className="text-slate-500" />
                <select
                  className="bg-transparent text-[11px] font-bold uppercase tracking-wider text-slate-400 outline-none w-32 cursor-pointer"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                >
                  <option value="all">All Global Nodes</option>
                  {clients.map((c: any) => (
                    <option key={c.id} value={c.id}>{c.firm_name}</option>
                  ))}
                </select>
              </div>
           </div>

           <div className="flex items-center gap-3">
              <Dialog open={isAddKeywordOpen} onOpenChange={setIsAddKeywordOpen}>
                <DialogTrigger asChild>
                  <button className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-[11px] font-black uppercase tracking-[0.15em] transition-all shadow-lg shadow-blue-900/20 flex items-center gap-2">
                    <Target size={14} /> Add Keyword
                  </button>
                </DialogTrigger>
                <DialogContent className="bg-[#0a0f1d] border-white/10 text-white rounded-[32px] sm:max-w-md p-8 backdrop-blur-2xl">
                  <DialogHeader className="mb-8">
                    <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mb-4">
                      <Target className="text-blue-400" size={24} />
                    </div>
                    <DialogTitle className="text-2xl font-bold tracking-tight">Keyword Tracking Node</DialogTitle>
                    <p className="text-sm text-slate-400 mt-2 leading-relaxed">Initialize a new search analysis node for your client campaign.</p>
                  </DialogHeader>

                  <div className="space-y-6">
                    <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Client Firm</label>
                        <Select onValueChange={v => setNewKeyword({...newKeyword, client_id: v})} value={newKeyword.client_id}>
                          <SelectTrigger className="bg-white/5 border-white/10 h-12 rounded-xl text-xs">
                            <SelectValue placeholder="Select Client" />
                          </SelectTrigger>
                          <SelectContent className="bg-[#0f172a] border-white/10 text-white">
                            {clients.map((c: any) => (
                              <SelectItem key={c.id} value={c.id}>{c.firm_name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Search Phrase</label>
                        <Input 
                          placeholder="e.g. Best SEO Agency Delhi"
                          className="bg-white/5 border-white/10 h-12 rounded-xl text-xs"
                          value={newKeyword.keyword}
                          onChange={e => setNewKeyword({...newKeyword, keyword: e.target.value})}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Goal Position</label>
                          <Input 
                            type="number"
                            min="1"
                            className="bg-white/5 border-white/10 h-12 rounded-xl text-xs"
                            value={newKeyword.target_pos}
                            onChange={e => setNewKeyword({...newKeyword, target_pos: parseInt(e.target.value)})}
                          />
                      </div>
                      <div className="space-y-2">
                          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Start Position</label>
                          <Input 
                            type="number"
                            min="1"
                            className="bg-white/5 border-white/10 h-12 rounded-xl text-xs"
                            value={newKeyword.current_pos}
                            onChange={e => setNewKeyword({...newKeyword, current_pos: parseInt(e.target.value)})}
                          />
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-3 mt-10">
                    <button className="flex-1 px-6 py-3 bg-white/5 hover:bg-white/10 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all" onClick={() => setIsAddKeywordOpen(false)}>Abort</button>
                    <button 
                      className="flex-1 px-6 py-3 bg-blue-600 hover:bg-blue-500 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all"
                      disabled={addKeywordMutation.isPending || !newKeyword.client_id || !newKeyword.keyword}
                      onClick={() => addKeywordMutation.mutate()}
                    >
                      {addKeywordMutation.isPending ? "Syncing..." : "Initialize"}
                    </button>
                  </div>
                </DialogContent>
              </Dialog>

              <Dialog open={isAddTaskOpen} onOpenChange={setIsAddTaskOpen}>
                <DialogTrigger asChild>
                  <button className="px-5 py-2.5 bg-white/5 hover:bg-white/10 text-white border border-white/10 rounded-xl text-[11px] font-black uppercase tracking-[0.15em] transition-all flex items-center gap-2">
                    <ClipboardCheck size={14} /> New SEO Task
                  </button>
                </DialogTrigger>
                <DialogContent className="bg-[#0a0f1d] border-white/10 text-white rounded-[32px] sm:max-w-md p-8 backdrop-blur-2xl">
                   <DialogHeader className="mb-8">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-4">
                      <ClipboardCheck className="text-emerald-400" size={24} />
                    </div>
                    <DialogTitle className="text-2xl font-bold tracking-tight">Checklist Deployment</DialogTitle>
                    <p className="text-sm text-slate-400 mt-2 leading-relaxed">Add a specific optimization task to the client's monthly SEO cycle.</p>
                  </DialogHeader>

                  <div className="space-y-6">
                    <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Target Firm</label>
                        <Select onValueChange={v => setNewTask({...newTask, client_id: v})} value={newTask.client_id}>
                          <SelectTrigger className="bg-white/5 border-white/10 h-12 rounded-xl text-xs">
                            <SelectValue placeholder="Select Client" />
                          </SelectTrigger>
                          <SelectContent className="bg-[#0f172a] border-white/10 text-white">
                            {clients.map((c: any) => (
                              <SelectItem key={c.id} value={c.id}>{c.firm_name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Task Definition</label>
                        <Input 
                          placeholder="e.g. Meta Tag Optimization"
                          className="bg-white/5 border-white/10 h-12 rounded-xl text-xs"
                          value={newTask.title}
                          onChange={e => setNewTask({...newTask, title: e.target.value})}
                        />
                    </div>
                  </div>

                  <div className="flex gap-3 mt-10">
                    <button className="flex-1 px-6 py-3 bg-white/5 hover:bg-white/10 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all" onClick={() => setIsAddTaskOpen(false)}>Cancel</button>
                    <button 
                      className="flex-1 px-6 py-3 bg-emerald-600 hover:bg-emerald-500 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all"
                      disabled={addTaskMutation.isPending || !newTask.client_id || !newTask.title}
                      onClick={() => addTaskMutation.mutate()}
                    >
                      {addTaskMutation.isPending ? "Deploying..." : "Assign Task"}
                    </button>
                  </div>
                </DialogContent>
              </Dialog>
           </div>
        </div>
        {/* Top metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="glass-card p-5">
            <p className="text-sm font-semibold text-white mb-1">Total Keywords Tracked</p>
            <p className="text-2xl font-bold text-blue-400">{keywords.length}</p>
          </div>
          <div className="glass-card p-5">
            <p className="text-sm font-semibold text-white mb-1">Keywords Improving</p>
            <p className="text-2xl font-bold text-emerald-400">
              {keywords.filter((k: any) => k.trend === "up").length}
            </p>
          </div>
          <div className="glass-card p-5">
            <p className="text-sm font-semibold text-white mb-1">Keywords Declining</p>
            <p className="text-2xl font-bold text-red-400">
              {keywords.filter((k: any) => k.trend === "down").length}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_350px] gap-6 items-start">
          {/* Keywords List */}
          <div className="glass-card px-1 py-1">
            <div className="flex items-center justify-between p-4" style={{ borderBottom: "1px solid rgba(99,128,191,0.08)" }}>
              <h3 className="text-sm font-semibold text-white">All Keywords</h3>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg" style={{ background: "rgba(15,22,41,0.8)", border: "1px solid rgba(99,128,191,0.15)" }}>
                <Search size={13} style={{ color: "#475569" }} />
                <select
                  className="bg-transparent text-xs outline-none w-32"
                  style={{ color: "#94a3b8" }}
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                >
                  <option value="all">All Clients</option>
                  {clients.map((c: any) => (
                    <option key={c.id} value={c.id}>{c.firm_name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid text-[10px] font-black uppercase tracking-[0.15em] px-8 py-4 bg-white/[0.02]" style={{ color: "#475569", gridTemplateColumns: "1.5fr 1fr 100px 100px 100px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
              <span>Search Node (Keyword)</span>
              <span>Client Firm</span>
              <span className="text-center">Target (Node)</span>
              <span className="text-center">Current (Live)</span>
              <span className="text-center">Trend (Status)</span>
            </div>

            <div className="max-h-[500px] overflow-y-auto divide-y divide-white/[0.02]">
              {keywords
                .filter((k: any) => filter === "all" || k.client_id === filter)
                .map((kw: any) => (
                    <div key={kw.id} className="grid px-8 py-5 items-center group/row hover:bg-white/[0.02] transition-all duration-300" style={{ gridTemplateColumns: "1.5fr 1fr 100px 100px 100px" }}>
                      <div className="flex flex-col pr-4 overflow-hidden">
                        <span className="text-sm font-bold text-white tracking-tight truncate group-hover/row:text-blue-400 transition-colors uppercase">{kw.keyword}</span>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">Protocol Sync:</span>
                          <span className="text-[9px] text-slate-400 font-mono">{new Date(kw.last_checked).toLocaleDateString()}</span>
                        </div>
                      </div>
                      
                      <Link to={`/clients/${kw.client_id}`} className="text-xs hover:text-blue-300 truncate pr-6 text-slate-500 transition-all font-medium flex items-center gap-1.5 group/link">
                        <div className="w-1.5 h-1.5 rounded-full bg-blue-500/30 group-hover/link:bg-blue-400 transition-colors" />
                        {kw.client_name}
                      </Link>

                      <div className="flex justify-center">
                        <span className="px-2.5 py-1 rounded-lg bg-slate-500/5 border border-white/5 text-[10px] font-bold font-mono text-slate-500 uppercase tracking-tighter">
                          #{kw.target_pos}
                        </span>
                      </div>

                      <div className="flex justify-center">
                        <button 
                          onClick={() => {
                            const val = prompt("Enter live rank for this node:", kw.current_pos.toString());
                            if (val && !isNaN(parseInt(val))) {
                                updateKeywordMutation.mutate({ 
                                    id: kw.id, 
                                    newPos: parseInt(val), 
                                    oldPos: kw.current_pos 
                                });
                            }
                          }}
                          className={cn(
                            "px-2.5 py-1 rounded-lg border font-bold font-mono text-[10px] shadow-lg transition-all active:scale-90",
                            kw.current_pos <= kw.target_pos 
                                ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400 shadow-emerald-500/5 rotate-[2deg] hover:bg-emerald-500 hover:text-white" 
                                : "bg-amber-500/10 border-amber-500/20 text-amber-400 shadow-amber-500/5 rotate-[-1deg] hover:bg-amber-500 hover:text-white"
                          )}
                        >
                          #{kw.current_pos}
                        </button>
                      </div>

                      <div className="relative flex items-center justify-center">
                        {/* Trend Icon Holder */}
                        <div className="flex items-center gap-2 pr-8">
                          {kw.trend === "up" && <TrendingUp size={16} className="text-emerald-400 drop-shadow-[0_0_8px_#10b98144]" />}
                          {kw.trend === "down" && <TrendingDown size={16} className="text-red-400 drop-shadow-[0_0_8px_#f43f5e44]" />}
                          {kw.trend === "stable" && <Minus size={16} className="text-slate-500 opacity-30" />}
                        </div>

                        {/* Actions Overlay (only visible on hover or end of row) */}
                        <div className="absolute right-0 opacity-0 group-hover/row:opacity-100 transition-opacity flex items-center gap-1">
                           <button 
                            onClick={() => { if(confirm("Terminate search node tracking?")) deleteKeywordMutation.mutate(kw.id) }}
                            className="p-2 rounded-xl bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500 hover:text-white transition-all shadow-lg shadow-red-900/10 active:scale-95"
                            title="Purge Node"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    </div>
                ))}
                {keywords.length === 0 && (
                   <div className="py-20 text-center">
                      <Target size={32} className="mx-auto text-slate-800 mb-3" />
                      <p className="text-sm text-slate-500">No keyword nodes deployed.</p>
                   </div>
                )}
            </div>
          </div>

          {/* Checklist & Task Details */}
          <div className="space-y-6">
            {/* Progress Overview */}
            <div className="glass-card p-5">
              <h3 className="text-sm font-semibold text-white mb-4">Monthly Checklist Progress</h3>
              <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2">
                {clients
                  .filter((c: any) => filter === "all" || c.id === filter)
                  .map((c: any) => {
                    const clientTasks = seoTasks.filter((t: any) => t.client_id === c.id);
                    const doneTasks = clientTasks.filter((i: any) => i.status === 'done').length;
                    const taskPct = clientTasks.length > 0 ? (doneTasks / clientTasks.length) * 100 : 100;

                    const clientKeywords = keywords.filter((k: any) => k.client_id === c.id);
                    const syncedKeywords = clientKeywords.filter((k: any) => {
                       if (!k.last_checked) return false;
                       const last = new Date(k.last_checked);
                       const now = new Date();
                       const diff = (now.getTime() - last.getTime()) / (1000 * 3600 * 24);
                       return diff <= 30; // Checked within 30 days
                    }).length;
                    const kwPct = clientKeywords.length > 0 ? (syncedKeywords / clientKeywords.length) * 100 : 100;

                    // If both are empty, it's 0% or 100%? Let's say 100% (nothing to do). 
                    // But if user expects 0% until they add something, let's stick to 0 if BOTH are empty.
                    const isFullyEmpty = clientTasks.length === 0 && clientKeywords.length === 0;
                    const finalPct = isFullyEmpty ? 0 : Math.round((taskPct + kwPct) / 2);

                    return (
                      <div key={c.id} className={cn(
                        "block group px-4 py-3 rounded-2xl transition-all border border-transparent",
                        filter === c.id ? "bg-blue-500/5 border-blue-500/20 shadow-lg shadow-blue-900/10" : "hover:bg-white/[0.02]"
                      )}>
                        <div className="flex justify-between items-center mb-2">
                          <div>
                            <p className={cn("text-xs font-bold transition-colors uppercase tracking-wider", filter === c.id ? "text-blue-400" : "text-slate-400")}>
                                {c.firm_name}
                            </p>
                            <div className="flex items-center gap-2 mt-0.5 opacity-50 group-hover:opacity-100 transition-opacity">
                                <span className={cn("text-[8px] font-black uppercase", taskPct === 100 ? "text-emerald-500" : "text-slate-500")}>
                                    Tasks: {doneTasks}/{clientTasks.length}
                                </span>
                                <span className="text-[8px] text-slate-700">•</span>
                                <span className={cn("text-[8px] font-black uppercase", kwPct === 100 ? "text-emerald-500" : "text-slate-500")}>
                                    Sync: {syncedKeywords}/{clientKeywords.length}
                                </span>
                            </div>
                          </div>
                          <span className={cn("text-[10px] font-black font-mono", finalPct === 100 ? "text-emerald-400" : finalPct >= 50 ? "text-amber-400" : "text-slate-500")}>
                            {finalPct}% CYCLE
                          </span>
                        </div>
                        <div className="relative h-1.5 rounded-full bg-white/5 overflow-hidden">
                          <div
                            className={cn(
                                "h-full rounded-full transition-all duration-700 ease-out",
                                finalPct === 100 ? "bg-gradient-to-r from-emerald-600 to-emerald-400" : "bg-gradient-to-r from-blue-600 to-blue-400"
                            )}
                            style={{ width: `${finalPct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>

            {/* Detailed Tasks for selected client */}
            {filter !== "all" && (
                <div className="glass-card p-6 border-blue-500/10 bg-blue-500/[0.01]">
                   <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                            <ClipboardCheck className="text-blue-400" size={16} />
                        </div>
                        <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-white">Active Directives</h3>
                      </div>
                      <button 
                        onClick={() => setIsAddTaskOpen(true)}
                        className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-white border border-white/10 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all active:scale-95"
                      >
                         + New Mandate
                      </button>
                   </div>
                   <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
                      {seoTasks
                        .filter((t: any) => t.client_id === filter)
                        .map((task: any) => (
                           <div key={task.id} className="p-4 bg-white/[0.01] border border-white/[0.03] rounded-2xl group/task hover:border-white/10 transition-all">
                              <div className="flex items-start justify-between gap-4 mb-3">
                                 <h4 className="text-xs font-bold text-white leading-relaxed group-hover/task:text-blue-400 transition-colors uppercase tracking-tight">{task.title}</h4>
                                 <button 
                                    onClick={() => updateTaskStatusMutation.mutate({ 
                                        id: task.id, 
                                        status: task.status === 'done' ? 'todo' : 'done' 
                                    })}
                                    className={cn(
                                        "w-6 h-6 rounded-lg border flex items-center justify-center transition-all flex-shrink-0",
                                        task.status === 'done' 
                                            ? "bg-emerald-500 border-emerald-400 shadow-lg shadow-emerald-500/20" 
                                            : "bg-white/5 border-white/10 hover:border-blue-500/50"
                                    )}
                                 >
                                    {task.status === 'done' && <ClipboardCheck size={14} className="text-white" />}
                                 </button>
                              </div>
                              <div className="flex items-center justify-between pt-3 border-t border-white/[0.02]">
                                 <div className="flex items-center gap-2">
                                     <span className={cn(
                                        "text-[8px] font-black uppercase tracking-[0.15em] px-2 py-0.5 rounded-full border",
                                        task.priority === 'high' ? "bg-red-500/5 border-red-500/20 text-red-500" : "bg-white/5 border-white/10 text-slate-500"
                                     )}>
                                        {task.priority === 'high' ? 'Priority: Critical' : 'Standard Ops'}
                                     </span>
                                 </div>
                                 <span className="text-[8px] text-slate-600 font-bold uppercase tracking-widest">
                                    {task.status === 'done' ? 'Cycle Terminated' : 'Active Channel'}
                                 </span>
                              </div>
                           </div>
                        ))}
                      {seoTasks.filter((t: any) => t.client_id === filter).length === 0 && (
                          <div className="py-10 text-center opacity-30">
                             <AlertCircle className="mx-auto mb-2" size={20} />
                             <p className="text-[10px] uppercase font-bold tracking-widest">No Active mandatories</p>
                          </div>
                      )}
                   </div>
                </div>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
