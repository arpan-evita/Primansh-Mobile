import { useState } from "react";
import { Link } from "react-router-dom";
import { 
  Plus, Filter, Search, MapPin, Globe, 
  TrendingUp, Users, ChevronRight, Loader2, Save, X, Edit2, Trash2, Star, ShieldCheck
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
  } from "@/components/ui/select";
import { motion } from "framer-motion";
import { cn, getStatusColor, formatCurrency } from "@/lib/utils";

interface AdminClientsProps {
  clients: any[];
  isLoading: boolean;
  query: string;
  setQuery: (q: string) => void;
  planFilter: string;
  setPlanFilter: (p: string) => void;
  statusFilter: string;
  setStatusFilter: (s: string) => void;
  isDialogOpen: boolean;
  setIsDialogOpen: (o: boolean) => void;
  newClient: any;
  setNewClient: (c: any) => void;
  serviceInput: string;
  setServiceInput: (s: string) => void;
  teamMembers: any[];
  handleAddClient: () => void;
  handleEdit: (e: any, c: any) => void;
  handleDelete: (e: any, id: string) => void;
}

export function AdminClients({
  clients, isLoading, query, setQuery, planFilter, setPlanFilter, statusFilter, setStatusFilter,
  isDialogOpen, setIsDialogOpen, newClient, setNewClient, serviceInput, setServiceInput,
  teamMembers, handleAddClient, handleEdit, handleDelete
}: AdminClientsProps) {
  
  const filtered = clients.filter((c: any) => {
    const q = query.toLowerCase();
    const firmName = (c.firm_name || "").toLowerCase();
    const location = (c.location || "").toLowerCase();
    const matchesQ = !q || firmName.includes(q) || location.includes(q);
    const matchesPlan = planFilter === "all" || c.plan_type === planFilter;
    const matchesStatus = statusFilter === "all" || c.status === statusFilter;
    return matchesQ && matchesPlan && matchesStatus;
  });

  const planFilters = ["all", "premium", "growth", "basic"];
  const statusFilters = ["all", "active", "inactive", "trial"];

  return (
    <div className="fade-up space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatsCard 
              label="Total Firms" 
              value={clients.length} 
              icon={Users} 
              color="#3b82f6" 
              trend="+2 this month" 
              onClick={() => { setPlanFilter('all'); setStatusFilter('all'); }}
              isActive={planFilter === 'all' && statusFilter === 'all'}
            />
            <StatsCard 
              label="Active Clients" 
              value={clients.filter((c: any) => c.status === 'active').length} 
              icon={Globe} 
              color="#10b981" 
              onClick={() => { setPlanFilter('all'); setStatusFilter('active'); }}
              isActive={statusFilter === 'active'}
            />
            <StatsCard 
              label="Premium Suite" 
              value={clients.filter((c: any) => c.plan_type === 'premium').length} 
              icon={Star} 
              color="#a78bfa" 
              onClick={() => { setPlanFilter('premium'); setStatusFilter('all'); }}
              isActive={planFilter === 'premium'}
            />
            <StatsCard 
              label="Avg Network Health" 
              value={`${Math.round(clients.reduce((acc: number, c: any) => acc + (c.total_health_score || 0), 0) / (Math.max(1, clients.length)))}%`} 
              icon={TrendingUp} 
              color="#f59e0b" 
            />
        </div>

        {/* Toolbar */}
        <div className="flex flex-col gap-4 mb-6">
          <div className="flex items-center justify-between gap-3 w-full">
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg flex-1 md:max-w-xs" style={{ background: "rgba(15,22,41,0.8)", border: "1px solid rgba(99,128,191,0.15)" }}>
              <Search size={13} style={{ color: "#475569" }} />
              <input
                className="bg-transparent text-xs outline-none flex-1 min-w-0"
                style={{ color: "#94a3b8" }}
                placeholder="Search clients..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <button 
                  onClick={() => {
                      setNewClient({
                          firm_name: '', location: '', website_url: '',
                          contact_name: '', contact_email: '', contact_phone: '',
                          password: '',
                          plan_type: 'basic', status: 'active', health_score: 50,
                          assigned_team_member_id: null, services: []
                      });
                      setServiceInput("");
                  }}
                  className="btn-primary flex items-center justify-center gap-2 text-xs shrink-0 px-4 py-2.5"
                >
                  <Plus size={13} />
                  <span className="hidden sm:inline">Add Client</span>
                  <span className="sm:hidden">Add</span>
                </button>
              </DialogTrigger>
              <DialogContent 
                className="bg-[#0b0f1a] border-white/5 text-white sm:max-w-[640px] shadow-[0_0_50px_rgba(0,0,0,0.5)] p-0 overflow-y-auto max-h-[90vh] font-sans"
              >
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-accent via-purple-500 to-accent opacity-50" />
              <DialogHeader className="px-8 pt-8 pb-4">
                <DialogTitle className="text-2xl font-black text-white tracking-tighter uppercase italic">
                    {newClient.firm_name ? 'Modify Firm Record' : 'Register New Entity'}
                </DialogTitle>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                    Secure business intelligence synchronization protocol
                </p>
              </DialogHeader>
              <div className="px-8 py-4 space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-1.5">
                    <label className="text-[9px] text-slate-500 uppercase font-black tracking-widest ml-1">Firm Designation</label>
                    <Input 
                      value={newClient.firm_name} 
                      onChange={(e) => setNewClient({...newClient, firm_name: e.target.value})}
                      placeholder="e.g., Sharma & Associates" 
                      className="bg-white/[0.03] border-white/5 text-sm font-bold text-white h-11 rounded-xl transition-all"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[9px] text-slate-500 uppercase font-black tracking-widest ml-1">Regional Location</label>
                    <Input 
                      value={newClient.location} 
                      onChange={(e) => setNewClient({...newClient, location: e.target.value})}
                      placeholder="e.g., New Delhi" 
                      className="bg-white/[0.03] border-white/5 text-sm font-bold text-white h-11 rounded-xl transition-all"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-1.5">
                    <label className="text-[9px] text-slate-500 uppercase font-black tracking-widest ml-1">Liaison Name</label>
                    <Input value={newClient.contact_name} onChange={(e) => setNewClient({...newClient, contact_name: e.target.value})} placeholder="e.g., Rakesh Sharma" className="bg-white/[0.03] border-white/5 text-sm font-bold text-white h-11 rounded-xl transition-all"/>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[9px] text-slate-500 uppercase font-black tracking-widest ml-1">Liaison Email</label>
                    <Input value={newClient.contact_email} onChange={(e) => setNewClient({...newClient, contact_email: e.target.value})} placeholder="rakesh@sharma.in" className="bg-white/[0.03] border-white/5 text-sm font-bold text-white h-11 rounded-xl transition-all" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-1.5">
                    <label className="text-[9px] text-slate-500 uppercase font-black tracking-widest ml-1">Service Tier</label>
                    <Select onValueChange={(val) => setNewClient({...newClient, plan_type: val as any})} value={newClient.plan_type}>
                        <SelectTrigger className="bg-white/[0.03] border-white/5 text-sm font-bold text-white h-11 rounded-xl"><SelectValue /></SelectTrigger>
                        <SelectContent className="bg-[#0b0f1a] border-white/10 text-white"><SelectItem value="basic">Basic</SelectItem><SelectItem value="growth">Growth</SelectItem><SelectItem value="premium">Premium</SelectItem></SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[9px] text-slate-500 uppercase font-black tracking-widest ml-1">Assigned Team</label>
                    <Select onValueChange={(val) => setNewClient({...newClient, assigned_team_member_id: val === 'none' ? null : val})} value={newClient.assigned_team_member_id || 'none'}>
                        <SelectTrigger className="bg-white/[0.03] border-white/5 text-sm font-bold text-white h-11 rounded-xl"><SelectValue /></SelectTrigger>
                        <SelectContent className="bg-[#0b0f1a] border-white/10 text-white"><SelectItem value="none">Unassigned</SelectItem>{teamMembers.map(tm=>(<SelectItem key={tm.id} value={tm.id}>{tm.full_name || tm.email}</SelectItem>))}</SelectContent>
                    </Select>
                  </div>
                </div>
                {!newClient.id && (
                  <div className="p-6 rounded-2xl bg-blue-500/5 border border-blue-500/10 space-y-4">
                    <div className="flex items-center gap-2">
                       <ShieldCheck className="text-blue-400" size={14} />
                       <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">Portal Access Credentials</span>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[9px] text-slate-500 uppercase font-black tracking-widest ml-1">Initial Password</label>
                      <Input 
                        type="password"
                        value={newClient.password || ''} 
                        onChange={(e) => setNewClient({...newClient, password: e.target.value})} 
                        placeholder="••••••••" 
                        className="bg-white/[0.03] border-white/5 text-sm font-bold text-white h-11 rounded-xl transition-all" 
                      />
                      <p className="text-[9px] text-slate-500 italic ml-1">If provided, an auth account will be created automatically.</p>
                    </div>
                  </div>
                )}
              </div>
              <DialogFooter className="bg-white/[0.02] px-8 py-6 mt-4"><Button variant="ghost" size="sm" onClick={() => setIsDialogOpen(false)}>ABORT</Button><Button size="sm" variant="accent" onClick={handleAddClient}>SAVE CHANGES</Button></DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
          <div className="flex items-center gap-3 overflow-x-auto pb-2 hide-scrollbar w-full">
            <div className="flex items-center gap-1 rounded-lg p-1" style={{ background: "rgba(15,22,41,0.8)", border: "1px solid rgba(99,128,191,0.15)" }}>
              {planFilters.map(p => (<button key={p} onClick={() => setPlanFilter(p)} className={cn("px-3 py-1.5 rounded-md text-xs", planFilter === p ? "text-white bg-blue-500/20" : "text-slate-500")}>{p}</button>))}
            </div>
          </div>
        </div>

        {/* Table View */}
        <div className="glass-card overflow-hidden overflow-x-auto">
          <div className="grid text-[10px] uppercase font-bold tracking-widest px-6 py-4" style={{ color: "#475569", borderBottom: "1px solid rgba(255, 255, 255, 0.05)", gridTemplateColumns: "2.5fr 1.2fr 1.5fr 1fr 1fr 1.2fr 100px" }}>
            <span>Firm & Entity</span><span>Location</span><span>Active Services</span><span>Plan</span><span>Status</span><span>Health</span><span className="text-right">Actions</span>
          </div>
          <div className="divide-y divide-[rgba(99,128,191,0.06)] min-w-[800px]">
          {filtered.map((c: any) => (
            <Link key={c.id} to={`/clients/${c.id}`} className="grid items-center px-6 py-5 group transition-all hover:bg-white/[0.02]" style={{ gridTemplateColumns: "2.5fr 1.2fr 1.5fr 1fr 1fr 1.2fr 100px" }}>
              <div className="flex items-center gap-4">
                <div className="w-11 h-11 rounded-2xl flex items-center justify-center text-base font-black transition-transform group-hover:scale-110" style={{ background: "linear-gradient(135deg, rgba(59,130,246,0.2), rgba(99,102,241,0.2))", color: "#60a5fa", border: "1px solid rgba(59,130,246,0.1)" }}>{c.firm_name ? c.firm_name[0] : 'C'}</div>
                <div><p className="text-[15px] font-bold text-white group-hover:text-accent transition-colors">{c.firm_name}</p></div>
              </div>
              <div className="text-xs text-slate-500">{c.location}</div>
              <div className="flex gap-1.5 flex-wrap">{(c.services || []).slice(0, 2).map((s: any) => (<span key={s} className="px-2 py-0.5 rounded-full bg-white/5 border border-white/5 text-[10px] text-slate-400 font-bold uppercase tracking-tighter">{s}</span>))}</div>
              <div><span className={`badge ${c.plan_type === 'premium' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' : 'bg-blue-500/10 text-blue-400 border-blue-500/20'}`}>{c.plan_type}</span></div>
              <div><span className={`badge rounded-full ${getStatusColor(c.status)}`}>{c.status}</span></div>
              <div className="pr-6"><HealthBar score={c.total_health_score || 50} /></div>
              <div className="flex items-center justify-end gap-1"><button onClick={(e) => handleEdit(e, c)} className="p-2.5 rounded-xl hover:text-accent transition-all"><Edit2 size={14} /></button><button onClick={(e) => handleDelete(e, c.id)} className="p-2.5 rounded-xl hover:text-red-400 transition-all"><Trash2 size={14} /></button></div>
            </Link>
          ))}
          {isLoading && <div className="py-20 text-center"><Loader2 className="animate-spin text-accent" /></div>}
          </div>
        </div>
    </div>
  );
}

function StatsCard({ label, value, icon: Icon, color, trend, onClick, isActive }: any) {
    return (
        <div 
          onClick={onClick}
          className={cn(
            "glass-card p-5 relative overflow-hidden group cursor-pointer border-transparent transition-all",
            isActive && "border-white/20 bg-white/5 ring-1 ring-white/10"
          )}
        >
            <div className="absolute top-0 right-0 w-24 h-24 -mt-8 -mr-8 rounded-full blur-3xl opacity-10" style={{ background: color }} />
            <div className="flex items-start justify-between">
                <div>
                    <p className="text-[10px] uppercase font-bold text-slate-500 mb-1">{label}</p>
                    <h3 className="text-2xl font-bold text-white tracking-tight">{value}</h3>
                </div>
                <div className={cn("p-3 rounded-2xl bg-white/5 transition-all", isActive && "bg-white/10 scale-110")}>
                    <Icon size={20} style={{ color }} />
                </div>
            </div>
            {trend && <p className="text-[10px] text-slate-500 mt-2 font-medium">{trend}</p>}
        </div>
    );
}

function HealthBar({ score }: { score: number }) {
  const color = score >= 75 ? "#10b981" : score >= 50 ? "#f59e0b" : "#ef4444";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 rounded-full flex-1 relative overflow-hidden bg-white/5">
        <motion.div initial={{ width: 0 }} animate={{ width: `${score}%` }} transition={{ duration: 1 }} className="h-1.5 rounded-full" style={{ background: color }} />
      </div>
      <span className="text-[11px] font-bold" style={{ color }}>{score}%</span>
    </div>
  );
}
