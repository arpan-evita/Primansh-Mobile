import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter 
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue 
} from "@/components/ui/select";
import { useGlobalUI } from "@/contexts/GlobalUIContext";

export function AddClientGlobalModal() {
  const { isAddClientModalOpen, setIsAddClientModalOpen } = useGlobalUI();
  const queryClient = useQueryClient();
  
  const [newClient, setNewClient] = useState<any>({
    firm_name: '', location: '', website_url: '',
    contact_name: '', contact_email: '', contact_phone: '',
    plan_type: 'basic', status: 'active', health_score: 50,
    assigned_team_member_id: null, services: []
  });
  const [serviceInput, setServiceInput] = useState("");

  // Fetch Team Members for assignment
  const { data: teamMembers = [] } = useQuery({
    queryKey: ['team_members_list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('role', ['team', 'seo', 'content', 'developer']);
      if (error) throw error;
      return data || [];
    },
    enabled: isAddClientModalOpen
  });

  const addClientMutation = useMutation({
    mutationFn: async (record: any) => {
      const { error } = await supabase.from('clients').upsert(record);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_clients'] });
      queryClient.invalidateQueries({ queryKey: ['clients_list'] });
      queryClient.invalidateQueries({ queryKey: ['team_assigned_clients'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard_stats'] });
      toast.success("Client record synchronized! 🚀");
      setIsAddClientModalOpen(false);
      resetForm();
    },
    onError: (error) => {
      console.error("Error adding client:", error);
      toast.error("Failed to save client record.");
    }
  });

  const resetForm = () => {
    setNewClient({
      firm_name: '', location: '', website_url: '',
      contact_name: '', contact_email: '', contact_phone: '',
      plan_type: 'basic', status: 'active', health_score: 50,
      assigned_team_member_id: null, services: []
    });
    setServiceInput("");
  };

  const handleSave = () => {
    if (!newClient.firm_name) {
      toast.error("Firm designation is required.");
      return;
    }
    const services = serviceInput.split(',').map(s => s.trim()).filter(s => s !== '');
    const slug = newClient.firm_name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    addClientMutation.mutate({ ...newClient, services, slug });
  };

  return (
    <Dialog open={isAddClientModalOpen} onOpenChange={setIsAddClientModalOpen}>
      <DialogContent 
        className="bg-[#0b0f1a] border-white/5 text-white sm:max-w-[640px] shadow-[0_0_50px_rgba(0,0,0,0.5)] p-0 overflow-y-auto max-h-[90vh] font-sans z-[100]"
      >
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-blue-500 opacity-50" />
        <DialogHeader className="px-8 pt-8 pb-4 text-left">
          <DialogTitle className="text-2xl font-black text-white tracking-tighter uppercase italic">
              Register New Entity
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
              <Input 
                value={newClient.contact_name} 
                onChange={(e) => setNewClient({...newClient, contact_name: e.target.value})} 
                placeholder="e.g., Rakesh Sharma" 
                className="bg-white/[0.03] border-white/5 text-sm font-bold text-white h-11 rounded-xl transition-all"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[9px] text-slate-500 uppercase font-black tracking-widest ml-1">Liaison Email</label>
              <Input 
                value={newClient.contact_email} 
                onChange={(e) => setNewClient({...newClient, contact_email: e.target.value})} 
                placeholder="rakesh@sharma.in" 
                className="bg-white/[0.03] border-white/5 text-sm font-bold text-white h-11 rounded-xl transition-all" 
              />
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
                  <SelectContent className="bg-[#0b0f1a] border-white/10 text-white">
                    <SelectItem value="none">Unassigned</SelectItem>
                    {teamMembers.map(tm => (
                      <SelectItem key={tm.id} value={tm.id}>
                        {tm.full_name || tm.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[9px] text-slate-500 uppercase font-black tracking-widest ml-1 text-left">Active Services (comma separated)</label>
            <Input 
              value={serviceInput} 
              onChange={(e) => setServiceInput(e.target.value)}
              placeholder="SEO, Content Marketing, Web Development" 
              className="bg-white/[0.03] border-white/5 text-sm font-bold text-white h-11 rounded-xl transition-all"
            />
          </div>
        </div>

        <DialogFooter className="bg-white/[0.02] px-8 py-6 mt-4 flex items-center justify-end gap-3">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setIsAddClientModalOpen(false)}
            className="text-slate-500 hover:text-white"
          >
            ABORT
          </Button>
          <Button 
            size="sm" 
            onClick={handleSave}
            disabled={addClientMutation.isPending}
            className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-6 h-10 rounded-xl shadow-lg shadow-blue-500/20"
          >
            {addClientMutation.isPending ? "SAVING..." : "SAVE CHANGES"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
