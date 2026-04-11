import { useState, useEffect } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { Plus, Search, Mail, ShieldAlert, Loader2, UserPlus, ShieldCheck, Trash2, ChevronDown, Edit, Camera, Check, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { motion, AnimatePresence } from "framer-motion";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { Copy, Link as LinkIcon } from "lucide-react";

interface Profile {
  id: string;
  email: string;
  role: 'admin' | 'seo' | 'content' | 'developer' | 'client' | 'team' | 'pending';
  full_name: string | null;
  avatar_url: string | null;
  associated_client_id?: string | null;
}

const ROLE_CONFIG = {
  admin: { label: "SUPER ADMIN", color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20" },
  seo: { label: "SEO SPECIALIST", color: "text-purple-400", bg: "bg-purple-500/10", border: "border-purple-500/20" },
  content: { label: "CONTENT HEAD", color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/20" },
  developer: { label: "SYSTEM DEV", color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20" },
  team: { label: "GENERAL TEAM", color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/20" },
  client: { label: "CLIENT PARTNER", color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/20" },
  pending: { label: "PENDING CLEARANCE", color: "text-slate-400", bg: "bg-slate-500/10", border: "border-slate-500/20" },
};

export default function TeamPage() {
  const { profile: currentUser } = useAuth();
  const isAdmin = currentUser?.role === 'admin';
  const [members, setMembers] = useState<Profile[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [clients, setClients] = useState<{id: string, firm_name: string}[]>([]);
  const [clientCounts, setClientCounts] = useState<Record<string, number>>({});
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<Profile | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [editingName, setEditingName] = useState("");
  const [editingEmail, setEditingEmail] = useState("");
  const [editingRole, setEditingRole] = useState<Profile['role']>('team');
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deletingMember, setDeletingMember] = useState<Profile | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isAssignmentModalOpen, setIsAssignmentModalOpen] = useState(false);
  const [assignmentTarget, setAssignmentTarget] = useState<Profile | null>(null);
  const [isAddMemberModalOpen, setIsAddMemberModalOpen] = useState(false);
  const [newMemberData, setNewMemberData] = useState({
    email: '',
    password: '',
    full_name: '',
    role: 'team' as Profile['role']
  });
  const [isAddingMember, setIsAddingMember] = useState(false);
  const [isAssigning, setIsAssigning] = useState(false);

  const signupLink = typeof window !== 'undefined' ? `${window.location.origin}/signup` : "";

  const copyToClipboard = () => {
    navigator.clipboard.writeText(signupLink);
    setIsCopied(true);
    toast.success("Invite link copied to clipboard");
    setTimeout(() => setIsCopied(false), 2000);
  };

  useEffect(() => {
    fetchTeamMembers();
    fetchClients();
  }, []);

  useEffect(() => {
    if (!currentUser?.id) return;

    const channel = supabase
      .channel(`team-admin-sync:${currentUser.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => {
        fetchTeamMembers();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'clients' }, () => {
        fetchClients();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'team_assigned_clients' }, () => {
        fetchClients();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUser?.id]);

  const fetchClients = async () => {
    try {
      const { data, error } = await supabase.from('clients').select('id, firm_name, assigned_team_member_id');
      if (error) {
        console.warn("Retrying client fetch without assigned_team_member_id (migration pending?):", error.message);
        const { data: fallbackData } = await supabase.from('clients').select('id, firm_name');
        setClients(fallbackData || []);
        return;
      }
      setClients(data || []);
      
      // Calculate counts
      const counts: Record<string, number> = {};
      data?.forEach(c => {
        if (c.assigned_team_member_id) {
          counts[c.assigned_team_member_id] = (counts[c.assigned_team_member_id] || 0) + 1;
        }
      });
      setClientCounts(counts);
    } catch (err) {
      console.error("Client fetch failure:", err);
    }
  };

  const fetchTeamMembers = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('role', { ascending: true });
      
      if (error) throw error;
      setMembers(data || []);
    } catch (error: any) {
      toast.error("Failed to fetch team members");
    } finally {
      setIsLoading(false);
    }
  };

  const updateRole = async (userId: string, newRole: Profile['role'], clientId?: string | null) => {
    try {
      const updateData: any = { role: newRole };
      if (typeof clientId !== 'undefined') {
        updateData.associated_client_id = clientId;
      }

      const { error } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', userId);
      
      if (error) throw error;
      
      toast.success(`Access updated successfully`);
      setMembers(prev => prev.map(m => m.id === userId ? { ...m, ...updateData } : m));
    } catch (error: any) {
      console.error("Access update error:", error);
      if (error.code === 'PGRST204' || error.message?.includes('associated_client_id')) {
        toast.error("Database Migration Required", {
          description: "Please apply the '20260325_add_associated_client.sql' migration to enable firm linking."
        });
      } else {
        toast.error("Failed to update access node");
      }
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>, profileId: string) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      toast.error("File excessively large. Limit: 2MB");
      return;
    }

    setIsUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${profileId}-${Date.now()}.${fileExt}`;
      const filePath = fileName;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', profileId);

      if (updateError) throw updateError;

      if (editingMember && editingMember.id === profileId) {
        setEditingMember({ ...editingMember, avatar_url: publicUrl });
      }
      
      toast.success("Avatar synchronization complete");
      fetchTeamMembers();
    } catch (error: any) {
      console.error(error);
      toast.error("Synchronization failure");
    } finally {
      setIsUploading(false);
    }
  };

  const handleUpdateProfile = async () => {
    if (!editingMember) return;
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ full_name: editingName, role: editingRole })
        .eq('id', editingMember.id);

      if (error) throw error;

      toast.success("Profile updated successfully");
      setIsEditModalOpen(false);
      fetchTeamMembers();
    } catch (error: any) {
      toast.error("Update failed: " + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteMember = async () => {
    if (!deletingMember) return;
    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .delete()
        .eq('id', deletingMember.id);

      if (error) throw error;

      toast.success(`${deletingMember.full_name || deletingMember.email} removed from team`);
      setIsDeleteDialogOpen(false);
      setDeletingMember(null);
      fetchTeamMembers();
    } catch (error: any) {
      toast.error("Deletion failed: " + error.message);
    } finally {
      setIsDeleting(false);
    }
  };

  const toggleClientAssignment = async (clientId: string, teamMemberId: string | null) => {
    setIsAssigning(true);
    try {
      const { error } = await supabase
        .from('clients')
        .update({ assigned_team_member_id: teamMemberId })
        .eq('id', clientId);

      if (error) throw error;
      
      toast.success(teamMemberId ? "Client assigned" : "Client unassigned");
      fetchClients();
    } catch (error: any) {
      toast.error("Assignment update failed: " + error.message);
    } finally {
      setIsAssigning(false);
    }
  };

  const handleAddMember = async () => {
    if (!newMemberData.email || !newMemberData.password || !newMemberData.full_name) {
      toast.error("Please fill all required fields");
      return;
    }

    setIsAddingMember(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-user', {
        body: newMemberData
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success(`${newMemberData.full_name} added successfully!`);
      setIsAddMemberModalOpen(false);
      setNewMemberData({ email: '', password: '', full_name: '', role: 'team' });
      fetchTeamMembers(); // Refresh list
    } catch (error: any) {
      toast.error(error.message || "Failed to create user");
      console.error("Add member error:", error);
    } finally {
      setIsAddingMember(false);
    }
  };

  const openEditModal = (member: Profile) => {
    setEditingMember(member);
    setEditingName(member.full_name || "");
    setEditingEmail(member.email);
    setEditingRole(member.role);
    setIsEditModalOpen(true);
  };

  const openDeleteDialog = (member: Profile) => {
    setDeletingMember(member);
    setIsDeleteDialogOpen(true);
  };

  const filteredMembers = members.filter(m => 
    m.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.full_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <AppShell title={isAdmin ? "Team Management" : "Team"} subtitle={isAdmin ? "Manage agency staff access and roles" : "Your team members"}>
      <div className="fade-up h-full flex flex-col max-w-6xl mx-auto px-4 sm:px-6">
        
        {/* Superior Header / Toolbar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-8">
          <div className="relative w-full sm:w-96 group">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-blue-400 transition-colors">
              <Search size={16} />
            </div>
            <input 
              className="w-full bg-[#0a0f1d]/60 border border-white/10 rounded-2xl py-3.5 pl-12 pr-4 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition-all backdrop-blur-md"
              placeholder="Search by name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          
          {/* Invite button — admin only */}
          {isAdmin && (
            <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto ml-auto">
              <Dialog open={isInviteModalOpen} onOpenChange={setIsInviteModalOpen}>
                <DialogTrigger asChild>
                  <button className="flex-1 sm:flex-none px-6 py-3.5 bg-white/5 hover:bg-white/10 text-white rounded-2xl font-bold text-sm tracking-wide transition-all border border-white/10 flex items-center justify-center gap-2 group">
                    <LinkIcon size={18} className="text-slate-400 group-hover:text-white transition-colors" />
                    <span>Invite Link</span>
                  </button>
                </DialogTrigger>
                {/* ... existing DialogContent ... */}
            <DialogContent className="bg-[#0a0f1d] border-white/10 text-slate-200 rounded-[32px] sm:max-w-[480px] p-0 overflow-hidden backdrop-blur-2xl">
              <div className="p-8">
                <DialogHeader className="mb-6">
                  <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mb-4">
                    <UserPlus className="text-blue-400" size={24} />
                  </div>
                  <DialogTitle className="text-2xl font-bold text-white tracking-tight">Onboard New Operator</DialogTitle>
                  <DialogDescription className="text-slate-400 text-sm leading-relaxed mt-2">
                    Share this secure onboarding link with your team member. Once they sign up, they will appear in your "Pending Clearance" list for final authorization.
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-6">
                  <div className="space-y-3">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] ml-1">Secure Onboarding Link</label>
                    <div className="relative group">
                      <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">
                        <LinkIcon size={14} />
                      </div>
                      <input 
                        readOnly
                        value={signupLink}
                        className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-10 pr-12 text-xs text-slate-300 font-mono focus:outline-none"
                      />
                      <button 
                        onClick={copyToClipboard}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-all border border-blue-500/20"
                      >
                        {isCopied ? <Check size={14} /> : <Copy size={14} />}
                      </button>
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-amber-500/5 border border-amber-500/10 flex gap-3">
                    <ShieldAlert size={18} className="text-amber-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-[11px] font-bold text-amber-500 uppercase tracking-wider mb-1">Security Note</p>
                      <p className="text-[11px] text-slate-400 leading-relaxed">
                        New nodes are restricted by default. You MUST manually authorize them from the Team Management dashboard before they can access agency data.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="px-8 py-6 bg-white/[0.02] border-t border-white/5 flex justify-end">
                <button 
                  onClick={() => setIsInviteModalOpen(false)}
                  className="px-6 py-2.5 bg-white/5 hover:bg-white/10 text-white rounded-xl text-xs font-bold transition-all border border-white/10"
                >
                  Close Protocol
                </button>
              </div>
            </DialogContent>
          </Dialog>

              <Dialog open={isAddMemberModalOpen} onOpenChange={setIsAddMemberModalOpen}>
                <DialogTrigger asChild>
                  <button className="flex-1 sm:flex-none px-6 py-3.5 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-bold text-sm tracking-wide transition-all shadow-lg shadow-blue-900/20 flex items-center justify-center gap-2 group">
                    <UserPlus size={18} className="group-hover:scale-110 transition-transform" />
                    <span>Add Member</span>
                  </button>
                </DialogTrigger>
                <DialogContent className="bg-[#0a0f1d] border-white/10 text-slate-200 rounded-[32px] sm:max-w-[480px] p-0 overflow-hidden backdrop-blur-2xl">
                  <div className="p-8">
                    <DialogHeader className="mb-6">
                      <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mb-4">
                        <UserPlus className="text-blue-400" size={24} />
                      </div>
                      <DialogTitle className="text-2xl font-bold text-white tracking-tight">Direct Onboarding</DialogTitle>
                      <DialogDescription className="text-slate-400 text-sm leading-relaxed mt-2">
                        Instantly initialize a new operator node by providing credentials. No email confirmation required.
                      </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] ml-1">Full Name</label>
                        <input 
                          type="text"
                          value={newMemberData.full_name}
                          onChange={(e) => setNewMemberData(prev => ({ ...prev, full_name: e.target.value }))}
                          placeholder="e.g. John Doe"
                          className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-sm text-white focus:outline-none focus:border-blue-500/50"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] ml-1">Email Identifier</label>
                        <input 
                          type="email"
                          value={newMemberData.email}
                          onChange={(e) => setNewMemberData(prev => ({ ...prev, email: e.target.value }))}
                          placeholder="operator@agency.com"
                          className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-sm text-white focus:outline-none focus:border-blue-500/50"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] ml-1">Secure Password</label>
                        <input 
                          type="password"
                          value={newMemberData.password}
                          onChange={(e) => setNewMemberData(prev => ({ ...prev, password: e.target.value }))}
                          placeholder="••••••••"
                          className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-sm text-white focus:outline-none focus:border-blue-500/50"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] ml-1">Role Permission</label>
                        <Select value={newMemberData.role} onValueChange={(v) => setNewMemberData(prev => ({ ...prev, role: v as Profile['role'] }))}>
                          <SelectTrigger className="w-full bg-white/5 border-white/10 text-white h-11 rounded-xl">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-[#0a0f1d] border-white/10 text-slate-300 rounded-xl">
                            {Object.entries(ROLE_CONFIG).map(([roleKey, config]) => (
                              <SelectItem key={roleKey} value={roleKey} className="text-xs font-bold">
                                <span className={config.color}>{config.label}</span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                  
                  <div className="px-8 py-6 bg-white/[0.02] border-t border-white/5 flex gap-3">
                    <button 
                      onClick={() => setIsAddMemberModalOpen(false)}
                      className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-white rounded-xl text-xs font-bold transition-all border border-white/10"
                    >
                      Abort
                    </button>
                    <button 
                      onClick={handleAddMember}
                      disabled={isAddingMember}
                      className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all shadow-xl shadow-blue-500/20 flex items-center justify-center gap-2 group"
                    >
                      {isAddingMember ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} className="group-hover:scale-110 transition-transform" />}
                      {isAddingMember ? 'Initializing...' : 'Add Operator'}
                    </button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          )}
        </div>

        {/* Dynamic Team Grid */}
        <div className="glass-premium rounded-[32px] overflow-hidden border border-white/5 bg-[#0a0f1d]/40 backdrop-blur-xl group relative glow-electric">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-purple-500/5 pointer-events-none" />
          <div className="hidden sm:grid grid-cols-[2fr,1.5fr,2fr,120px] items-center px-8 py-5 border-b border-white/5 bg-white/[0.02] relative z-10">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">Team Operator</span>
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">Assignment & Node</span>
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">Communication</span>
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] text-right">Control</span>
          </div>

          <div className="divide-y divide-white/5">
            {isLoading ? (
              <div className="py-20 flex flex-col items-center justify-center gap-4">
                <Loader2 className="animate-spin text-blue-500" size={32} />
                <p className="text-xs font-mono text-slate-500">// Synchronizing with Node Database</p>
              </div>
            ) : filteredMembers.length === 0 ? (
              <div className="py-20 text-center">
                <p className="text-slate-500 font-medium">No team members found matching your search.</p>
              </div>
            ) : (
              filteredMembers.map((member) => (
                <motion.div 
                  layout
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  key={member.id} 
                  className="grid grid-cols-1 sm:grid-cols-[2fr,1.5fr,2fr,120px] items-center px-8 py-6 hover:bg-white/[0.02] transition-colors group/row"
                >
                  {/* Member Identity */}
                  <div className="flex items-center gap-4 mb-4 sm:mb-0">
                    <div className="relative">
                      <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-sm font-bold shadow-2xl relative overflow-hidden group-hover/row:scale-105 transition-transform"
                        style={{ background: "linear-gradient(135deg, #1e293b, #0f172a)", border: "1px solid rgba(255,255,255,0.05)" }}>
                        <div className="absolute inset-0 bg-blue-500/10 opacity-0 group-hover/row:opacity-100 transition-opacity" />
                        {member.avatar_url ? (
                          <img src={member.avatar_url} alt="" className="w-full h-full object-cover relative z-10" />
                        ) : (
                          <span className="text-white relative z-10">{member.full_name?.[0] || member.email[0].toUpperCase()}</span>
                        )}
                      </div>
                      <div className={cn("absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-[#030712] flex items-center justify-center", 
                        member.role !== 'client' ? "bg-emerald-500" : "bg-slate-500")}>
                        {member.role !== 'client' && <ShieldCheck size={8} className="text-white" />}
                      </div>
                    </div>
                    <div>
                      <span className="text-sm font-bold text-white block tracking-tight group-hover/row:text-blue-400 transition-colors">
                        {member.full_name || "Uninitialized Operator"}
                      </span>
                      <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                        {member.role === 'client' ? 'Awaiting Clearance' : 'Active Personnel'}
                      </span>
                    </div>
                  </div>

                  {/* Role Selection & Assignments */}
                  <div className="mb-4 sm:mb-0 relative z-10">
                    <div className="flex flex-col gap-2">
                      {isAdmin ? (
                      <DropdownMenu>
                        <DropdownMenuTrigger className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-white/5 bg-white/5 hover:bg-white/10 transition-all group/btn outline-none w-fit">
                          <span className={cn("text-[10px] font-bold uppercase tracking-widest", ROLE_CONFIG[member.role].color)}>
                            {ROLE_CONFIG[member.role].label}
                          </span>
                          <ChevronDown size={12} className="text-slate-500 group-hover/btn:text-white transition-colors" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="bg-[#0a0f1d] border-white/10 text-slate-300 rounded-2xl overflow-hidden p-1 min-w-[180px]">
                          {Object.entries(ROLE_CONFIG).map(([roleKey, config]) => (
                            <DropdownMenuItem 
                              key={roleKey}
                              onClick={() => updateRole(member.id, roleKey as Profile['role'])}
                              className="flex items-center justify-between px-4 py-2.5 hover:bg-white/5 focus:bg-white/5 cursor-pointer rounded-xl transition-colors group/item"
                            >
                              <span className={cn("text-[10px] font-bold uppercase tracking-widest", config.label === "GEN TEAM" ? "text-blue-400" : config.color)}>
                                {config.label}
                              </span>
                              {member.role === roleKey && <ShieldCheck size={14} className="text-blue-400" />}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                      ) : (
                        <span className={cn("text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-xl border border-white/5 bg-white/5 w-fit", ROLE_CONFIG[member.role]?.color)}>
                          {ROLE_CONFIG[member.role]?.label}
                        </span>
                      )}

                      {/* Display Assignment Metrics for Team Members */}
                      {member.role !== 'client' && (
                        <div className="flex items-center gap-2 mt-1">
                          <div className="h-1 w-12 rounded-full bg-white/5 overflow-hidden">
                            <motion.div 
                              initial={{ width: 0 }}
                              animate={{ width: `${Math.min((clientCounts[member.id] || 0) * 20, 100)}%` }}
                              className="h-full bg-blue-500/50"
                            />
                          </div>
                          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter">
                            {clientCounts[member.id] || 0} Firms Managed
                          </span>
                          {isAdmin && (
                            <button 
                              onClick={() => {
                                setAssignmentTarget(member);
                                setIsAssignmentModalOpen(true);
                              }}
                              className="text-[9px] font-black text-blue-400 hover:text-blue-300 uppercase tracking-widest px-2 py-0.5 rounded-md bg-blue-500/10 border border-blue-500/20 transition-all ml-1"
                            >
                              Manage
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Associated Client Selector for Clients */}
                    {member.role === 'client' && (
                      <div className="mt-2 group">
                        <Select 
                          value={member.associated_client_id || "none"} 
                          onValueChange={(val: string) => updateRole(member.id, 'client', val === "none" ? null : val)}
                        >
                          <SelectTrigger className="h-8 bg-white/5 border-white/5 text-[10px] font-bold text-slate-400 rounded-lg outline-none max-w-[160px]">
                            <SelectValue placeholder="Associate Firm..." />
                          </SelectTrigger>
                          <SelectContent className="bg-[#0a0f1d] border-white/10 text-slate-300 rounded-xl">
                            <SelectItem value="none" className="text-[10px] uppercase font-bold tracking-widest">No Firm Linked</SelectItem>
                            {clients.map(c => (
                              <SelectItem key={c.id} value={c.id} className="text-[10px] uppercase font-bold tracking-widest">{c.firm_name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>

                  {/* Contact Info */}
                  <div className="flex items-center gap-3 text-slate-400 mb-4 sm:mb-0">
                    <div className="p-2 rounded-lg bg-white/5 border border-white/5">
                      <Mail size={14} className="text-slate-500" />
                    </div>
                    <span className="text-xs font-medium truncate max-w-[180px]">{member.email}</span>
                  </div>

                  {/* Actions — edit own OR admin full controls */}
                  <div className="flex justify-end gap-2">
                    {(isAdmin || member.id === currentUser?.id) && (
                    <button 
                      onClick={() => openEditModal(member)}
                      className="p-2.5 rounded-xl border border-white/5 bg-white/5 text-slate-400 hover:text-blue-400 transition-all opacity-0 group-hover/row:opacity-100"
                      title="Edit Profile"
                    >
                      <Edit size={16} />
                    </button>
                    )}
                    {isAdmin && (
                    <button 
                      onClick={() => openDeleteDialog(member)}
                      className="p-2.5 rounded-xl border border-red-500/10 text-red-400 hover:bg-red-500/10 hover:border-red-500/30 transition-all group/revoke opacity-0 group-hover/row:opacity-100"
                      title="Delete User"
                    >
                      <Trash2 size={16} className="group-hover/revoke:scale-110 transition-transform" />
                    </button>
                    )}
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </div>

        {/* Edit Profile Modal */}
        <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
          <DialogContent className="bg-[#0a0f1d] border-white/10 text-slate-200 rounded-[32px] sm:max-w-[480px] p-0 overflow-hidden backdrop-blur-2xl">
            <div className="p-8">
              <DialogHeader className="mb-6">
                <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mb-4">
                  <Edit className="text-blue-400" size={24} />
                </div>
                <DialogTitle className="text-2xl font-bold text-white tracking-tight">Edit Profile</DialogTitle>
                <DialogDescription className="text-slate-400 text-sm leading-relaxed mt-2">
                  Update name, role, and profile photo for this team member.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-6">
                {/* Avatar Section */}
                <div className="flex flex-col items-center">
                  <div className="relative group/avatar">
                    <div className="w-24 h-24 rounded-[2rem] bg-slate-800 border-2 border-white/5 flex items-center justify-center text-2xl font-bold text-white uppercase overflow-hidden shadow-2xl transition-all group-hover/avatar:border-blue-500/50">
                      {editingMember?.avatar_url ? (
                        <img src={editingMember.avatar_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        editingMember?.full_name?.[0] || 'U'
                      )}
                      {isUploading && (
                        <div className="absolute inset-0 bg-slate-900/80 flex items-center justify-center backdrop-blur-sm">
                          <Loader2 className="animate-spin text-blue-500" size={24} />
                        </div>
                      )}
                    </div>
                    <label className="absolute -bottom-2 -right-2 p-2.5 rounded-2xl bg-blue-600 text-white shadow-xl hover:bg-blue-500 cursor-pointer transition-all border-4 border-[#0a0f1d] group-hover/avatar:scale-110">
                      <Camera size={16} />
                      <input 
                        type="file" 
                        className="hidden" 
                        accept="image/*"
                        onChange={(e) => editingMember && handleAvatarUpload(e, editingMember.id)}
                      />
                    </label>
                  </div>
                  <p className="mt-4 text-[10px] font-bold text-slate-600 uppercase tracking-[0.2em]">Profile Photo</p>
                </div>

                {/* Form Fields */}
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] ml-1">Full Name</label>
                    <input 
                      type="text"
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      placeholder="Enter full name..."
                      className="w-full bg-white/5 border border-white/10 rounded-xl py-3.5 px-5 text-sm text-white focus:outline-none focus:border-blue-500/50 transition-all placeholder:text-slate-700 font-medium"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] ml-1">Email</label>
                    <input 
                      type="email"
                      value={editingEmail}
                      disabled
                      className="w-full bg-white/[0.03] border border-white/5 rounded-xl py-3.5 px-5 text-sm text-slate-500 font-medium cursor-not-allowed"
                      title="Email cannot be changed here — managed by Supabase Auth"
                    />
                    <p className="text-[10px] text-slate-600 ml-1">Email is managed by Supabase Auth and cannot be changed here.</p>
                  </div>
                  {/* Role field — admin only */}
                  {isAdmin && (
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] ml-1">Role</label>
                    <Select value={editingRole} onValueChange={(v) => setEditingRole(v as Profile['role'])}>
                      <SelectTrigger className="w-full bg-white/5 border-white/10 text-white h-12 rounded-xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-[#0a0f1d] border-white/10 text-slate-300 rounded-xl">
                        {Object.entries(ROLE_CONFIG).map(([roleKey, config]) => (
                          <SelectItem key={roleKey} value={roleKey} className="text-xs font-bold">
                            <span className={config.color}>{config.label}</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  )}
                </div>
              </div>
            </div>

            <div className="px-8 py-6 bg-white/[0.02] border-t border-white/5 flex gap-3">
              <button 
                onClick={() => setIsEditModalOpen(false)}
                className="flex-1 py-4 bg-white/5 hover:bg-white/10 text-white rounded-2xl text-xs font-bold transition-all border border-white/10"
              >
                Cancel
              </button>
              <button 
                onClick={handleUpdateProfile}
                disabled={isSaving}
                className="flex-1 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl text-xs font-bold transition-all shadow-xl shadow-blue-500/20 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isSaving ? <Loader2 size={14} className="animate-spin" /> : null}
                {isSaving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <DialogContent className="bg-[#0a0f1d] border-red-500/20 text-slate-200 rounded-[32px] sm:max-w-[420px] p-0 overflow-hidden backdrop-blur-2xl">
            <div className="p-8">
              <DialogHeader className="mb-6">
                <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-4">
                  <Trash2 className="text-red-400" size={24} />
                </div>
                <DialogTitle className="text-2xl font-bold text-white tracking-tight">Delete User</DialogTitle>
                <DialogDescription className="text-slate-400 text-sm leading-relaxed mt-2">
                  Are you sure you want to permanently delete{" "}
                  <span className="text-white font-bold">{deletingMember?.full_name || deletingMember?.email}</span>?
                  This action cannot be undone.
                </DialogDescription>
              </DialogHeader>
              <div className="p-4 rounded-2xl bg-red-500/5 border border-red-500/10 text-xs text-red-300 leading-relaxed">
                This will remove their profile from the team. Their Supabase Auth account will remain — you can manage authentication accounts from the Supabase dashboard.
              </div>
            </div>
            <div className="px-8 py-6 bg-white/[0.02] border-t border-white/5 flex gap-3">
              <button 
                onClick={() => setIsDeleteDialogOpen(false)}
                className="flex-1 py-4 bg-white/5 hover:bg-white/10 text-white rounded-2xl text-xs font-bold transition-all border border-white/10"
              >
                Cancel
              </button>
              <button 
                onClick={handleDeleteMember}
                disabled={isDeleting}
                className="flex-1 py-4 bg-red-600 hover:bg-red-500 text-white rounded-2xl text-xs font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isDeleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                {isDeleting ? 'Deleting...' : 'Confirm Delete'}
              </button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Roles & Permissions Info */}
        <div className="mt-8 transition-all hover:translate-y-[-4px]">
          <div className="glass-card p-8 rounded-[32px] border border-white/5 bg-gradient-to-br from-[#0a0f1d]/60 to-transparent backdrop-blur-2xl">
            <div className="flex items-center gap-3 mb-8">
              <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/20">
                <ShieldAlert size={20} className="text-blue-400" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white tracking-tight">Agency RBAC Protocol</h3>
                <p className="text-xs text-slate-500 font-medium">Standardized Authorization Guide</p>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              {Object.entries(ROLE_CONFIG).map(([key, config]) => (
                <div key={key} className="space-y-3 p-4 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-white/10 transition-colors">
                  <div className={cn("text-[10px] font-black uppercase tracking-[0.2em]", config.color)}>
                    {config.label}
                  </div>
                  <p className="text-[11px] leading-relaxed text-slate-400 font-medium">
                    {key === 'admin' && "Full access to all modules, including billing, team management, and secure credentials vault."}
                    {key === 'seo' && "Access to SEO Panel, client read-only view, and tasks assigned to SEO module."}
                    {key === 'content' && "Access to Content CMS, drafts, and tasks assigned to Content module."}
                    {key === 'developer' && "Access to Website framework, API keys, and technical implementation tasks."}
                    {key === 'team' && "General operational access to shared project tasks and client communication modules."}
                    {key === 'client' && "Strictly restricted to the Client Portal. Users can only view their firm's specific metrics, tasks, and invoices."}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
        {/* Client Assignment Manager Modal */}
        <Dialog open={isAssignmentModalOpen} onOpenChange={setIsAssignmentModalOpen}>
          <DialogContent className="bg-[#0a0f1d] border-white/10 text-slate-200 rounded-[32px] sm:max-w-[540px] p-0 overflow-hidden backdrop-blur-2xl">
            <div className="p-8">
              <DialogHeader className="mb-6">
                <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mb-4">
                  <LinkIcon className="text-blue-400" size={24} />
                </div>
                <DialogTitle className="text-2xl font-bold text-white tracking-tight">Assignment Manager</DialogTitle>
                <DialogDescription className="text-slate-400 text-sm leading-relaxed mt-2">
                  Associate specific client firms with <span className="text-white font-bold">{assignmentTarget?.full_name || assignmentTarget?.email}</span>. 
                  Assigned members will have exclusive access to these nodes if RLS protocols are active.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 max-h-[350px] overflow-y-auto pr-2 custom-scrollbar">
                {clients.length === 0 ? (
                  <p className="text-center py-10 text-slate-500 text-xs font-mono">// No client nodes detected in network</p>
                ) : (
                  clients.map(client => {
                    const isAssigned = (client as any).assigned_team_member_id === assignmentTarget?.id;
                    const isAssignedToOther = (client as any).assigned_team_member_id && (client as any).assigned_team_member_id !== assignmentTarget?.id;
                    
                    return (
                      <div 
                        key={client.id}
                        className={cn(
                          "flex items-center justify-between p-4 rounded-2xl border transition-all",
                          isAssigned ? "bg-blue-500/10 border-blue-500/30" : "bg-white/[0.02] border-white/5 hover:border-white/10"
                        )}
                      >
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-white tracking-tight">{client.firm_name}</span>
                          {isAssignedToOther && (
                            <span className="text-[9px] text-amber-500 font-bold uppercase tracking-widest mt-0.5">
                              Assigned elsewhere
                            </span>
                          )}
                        </div>
                        <button
                          disabled={isAssigning}
                          onClick={() => toggleClientAssignment(client.id, isAssigned ? null : assignmentTarget!.id)}
                          className={cn(
                            "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                            isAssigned 
                              ? "bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20" 
                              : "bg-blue-600 text-white hover:bg-blue-500 shadow-lg shadow-blue-500/20"
                          )}
                        >
                          {isAssigning ? "..." : isAssigned ? "Unassign" : "Assign Node"}
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div className="px-8 py-6 bg-white/[0.02] border-t border-white/5 flex justify-between items-center">
              <p className="text-[10px] text-slate-600 font-mono uppercase tracking-tighter">
                {clients.filter(c => (c as any).assigned_team_member_id === assignmentTarget?.id).length} Active Assignments
              </p>
              <button 
                onClick={() => setIsAssignmentModalOpen(false)}
                className="px-6 py-2.5 bg-white/5 hover:bg-white/10 text-white rounded-xl text-xs font-bold transition-all border border-white/10"
              >
                Close Manager
              </button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AppShell>
  );
}
