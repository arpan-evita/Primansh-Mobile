import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { AdminClients } from "./AdminClients";
import { TeamClients } from "./TeamClients";
import { Loader2 } from "lucide-react";

export default function ClientsPage() {
  const { profile } = useAuth();
  const isTeam = profile?.role === 'team';
  const queryClient = useQueryClient();

  // Shared State
  const [query, setQuery] = useState("");
  const [planFilter, setPlanFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newClient, setNewClient] = useState<any>({
    firm_name: '', location: '', website_url: '',
    contact_name: '', contact_email: '', contact_phone: '',
    password: '',
    plan_type: 'basic', status: 'active', health_score: 50,
    assigned_team_member_id: null, services: []
  });
  const [serviceInput, setServiceInput] = useState("");

  // Fetch Team Members
  const { data: teamMembers = [] } = useQuery({
    queryKey: ['team_members_list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .in('role', ['team', 'seo', 'content', 'developer', 'general manager']);
      if (error) throw error;
      return data || [];
    },
    enabled: !isTeam
  });

  // Fetch Clients
  const { data: clients = [], isLoading } = useQuery({
    queryKey: ['admin_clients', profile?.id, isTeam],
    queryFn: async () => {
      let q = supabase.from('clients').select('*');
      if (isTeam && profile?.id) {
        q = q.eq('assigned_team_member_id', profile.id);
      }
      const { data, error } = await q.order('created_at', { ascending: false });
      if (error) throw error;

      const { data: taskStats } = await supabase.from('tasks').select('client_id, status');
      const scoreMap: Record<string, number> = {};
      if (taskStats) {
        const grouped: Record<string, { total: number; done: number }> = {};
        taskStats.forEach((t: any) => {
          if (!t.client_id) return;
          if (!grouped[t.client_id]) grouped[t.client_id] = { total: 0, done: 0 };
          grouped[t.client_id].total++;
          if (t.status === 'done') grouped[t.client_id].done++;
        });
        Object.entries(grouped).forEach(([id, s]) => {
          scoreMap[id] = Math.round((s.done / s.total) * 100);
        });
      }
      return (data || []).map((c: any) => ({ ...c, total_health_score: scoreMap[c.id] ?? c.health_score ?? 50 }));
    },
    enabled: !!profile?.id
  });

  // Mutation for Admin functions
  const addClientMutation = useMutation({
    mutationFn: async (record: any) => {
      const { error } = await supabase.from('clients').upsert(record);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_clients'] });
      toast.success("Client record synchronized! 🚀");
      setIsDialogOpen(false);
    }
  });

  const deleteClientMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('clients').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_clients'] });
      toast.success("Client removed.");
    }
  });

  const handleAddClient = async () => {
    const services = serviceInput.split(',').map(s => s.trim()).filter(s => s !== '');
    const slug = newClient.firm_name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    
    try {
      // 1. Synchronize Client Entity
      const { data: createdClients, error: clientErr } = await supabase
        .from('clients')
        .upsert({ 
          firm_name: newClient.firm_name,
          location: newClient.location,
          website_url: newClient.website_url,
          contact_name: newClient.contact_name,
          contact_email: newClient.contact_email,
          contact_phone: newClient.contact_phone,
          plan_type: newClient.plan_type,
          status: newClient.status,
          health_score: newClient.health_score,
          assigned_team_member_id: newClient.assigned_team_member_id,
          services, 
          slug 
        })
        .select();

      if (clientErr) throw clientErr;
      toast.success("Firm record synchronized! 🚀");
      
      const newClientId = createdClients?.[0]?.id;

      // 2. Initialize Portal Access if password provided
      if (newClient.password && newClient.contact_email && newClientId) {
        toast.info("Initializing secure portal access...");
        
        const { data: fnData, error: fnError } = await supabase.functions.invoke('create-user', {
          body: {
            email: newClient.contact_email,
            password: newClient.password,
            full_name: newClient.contact_name || newClient.firm_name,
            role: 'client',
            associated_client_id: newClientId
          }
        });

        if (fnError) throw fnError;
        if (fnData?.error) throw new Error(fnData.error);
        
        toast.success("Digital identity verified. Portal access granted!");
      }

      queryClient.invalidateQueries({ queryKey: ['admin_clients'] });
      setIsDialogOpen(false);
    } catch (err: any) {
      console.error("Client creation failed:", err);
      toast.error(err.message || "Operation failed.");
    }
  };

  const handleEdit = (e: any, client: any) => {
    e.preventDefault(); e.stopPropagation();
    setNewClient(client);
    setServiceInput((client.services || []).join(', '));
    setIsDialogOpen(true);
  };

  const handleDelete = (e: any, id: string) => {
    e.preventDefault(); e.stopPropagation();
    if (window.confirm("Remove this client entity?")) deleteClientMutation.mutate(id);
  };

  useEffect(() => {
    if (!profile?.id) return;

    const channel = supabase
      .channel(`web-clients-sync:${profile.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'clients' }, () => {
        queryClient.invalidateQueries({ queryKey: ['admin_clients'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'team_assigned_clients' }, () => {
        queryClient.invalidateQueries({ queryKey: ['admin_clients'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => {
        queryClient.invalidateQueries({ queryKey: ['admin_clients'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => {
        queryClient.invalidateQueries({ queryKey: ['team_members_list'] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.id, queryClient]);

  return (
    <AppShell title={isTeam ? "My Clients" : "Client Network"} subtitle={isTeam ? "Entities assigned to you" : `Managing ${clients.length} premium client entities`}>
      {isTeam ? (
        <TeamClients clients={clients} isLoading={isLoading} />
      ) : (
        <AdminClients
          clients={clients} isLoading={isLoading} query={query} setQuery={setQuery}
          planFilter={planFilter} setPlanFilter={setPlanFilter} statusFilter={statusFilter} setStatusFilter={setStatusFilter}
          isDialogOpen={isDialogOpen} setIsDialogOpen={setIsDialogOpen}
          newClient={newClient} setNewClient={setNewClient}
          serviceInput={serviceInput} setServiceInput={setServiceInput}
          teamMembers={teamMembers} handleAddClient={handleAddClient}
          handleEdit={handleEdit} handleDelete={handleDelete}
        />
      )}
    </AppShell>
  );
}
