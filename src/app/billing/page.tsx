import { AppShell } from "@/components/layout/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { formatCurrency, getStatusColor, cn } from "@/lib/utils";
import { Plus, Search, Loader2, Download, Trash2, FileText, MoreHorizontal, Edit, Send, CheckCircle2, Clock } from "lucide-react";
import { Link } from "react-router-dom";
import { useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { generateInvoicePDF } from "@/lib/invoice-pdf";

export default function BillingPage() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [isNewInvoiceOpen, setIsNewInvoiceOpen] = useState(false);
  const [editingInvoiceId, setEditingInvoiceId] = useState<string | null>(null);
  const [newInvoice, setNewInvoice] = useState({ client_id: "", due_date: "", tax_rate: 0, notes: "" });
  const [items, setItems] = useState([{ description: "", quantity: 1, rate: 0 }]);

  const subtotal = items.reduce((sum, item) => sum + (item.quantity * item.rate), 0);
  const tax = subtotal * (newInvoice.tax_rate / 100);
  const total = subtotal + tax;

  const { data: invoices = [], isLoading: isInvoicesLoading } = useQuery({
    queryKey: ['admin_invoices'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invoices')
        .select('*, clients(firm_name, contact_email, slug)')
        .order('issued_date', { ascending: false });
      if (error) throw error;
      return data.map(i => ({ 
        ...i, 
        client_name: i.clients?.firm_name, 
        client_email: i.clients?.contact_email,
        client_slug: i.clients?.slug
      }));
    }
  });

  const { data: clients = [], isLoading: isClientsLoading } = useQuery({
    queryKey: ['admin_clients_simple'],
    queryFn: async () => {
      const { data, error } = await supabase.from('clients').select('id, firm_name');
      if (error) throw error;
      return data;
    }
  });

  const saveInvoiceMutation = useMutation({
    mutationFn: async () => {
      const submission = {
        client_id: newInvoice.client_id,
        due_date: newInvoice.due_date || null,
        subtotal,
        tax_rate: newInvoice.tax_rate,
        amount: total,
        items,
        notes: newInvoice.notes,
      };
      
      if (editingInvoiceId) {
        const { error } = await supabase.from('invoices').update(submission).eq('id', editingInvoiceId);
        if (error) throw error;
      } else {
        const invNum = `INV-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
        const { error } = await supabase.from('invoices').insert({ ...submission, invoice_number: invNum, status: 'pending' });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_invoices'] });
      queryClient.invalidateQueries({ queryKey: ['admin_analytics_full'] });
      toast.success(editingInvoiceId ? "Invoice updated successfully! 📝" : "Invoice generated successfully! 🧾");
      closeDialog();
    },
    onError: (err: any) => toast.error(`Action failed: ${err.message}`)
  });

  const openNewDialog = () => {
    setEditingInvoiceId(null);
    setNewInvoice({ client_id: "", due_date: "", tax_rate: 0, notes: "" });
    setItems([{ description: "", quantity: 1, rate: 0 }]);
    setIsNewInvoiceOpen(true);
  };
  
  const openEditDialog = (inv: any) => {
    setEditingInvoiceId(inv.id);
    setNewInvoice({ 
      client_id: inv.client_id, 
      due_date: inv.due_date ? new Date(inv.due_date).toISOString().split('T')[0] : "", 
      tax_rate: inv.tax_rate || 0, 
      notes: inv.notes || "" 
    });
    setItems(inv.items && inv.items.length > 0 ? inv.items : [{ description: "", quantity: 1, rate: 0 }]);
    setIsNewInvoiceOpen(true);
  };

  const closeDialog = () => {
    setIsNewInvoiceOpen(false);
    setEditingInvoiceId(null);
  };

  const markAsSentMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('invoices')
        .update({ sent_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_invoices'] });
      toast.success("Invoice marked as sent! 📨");
    }
  });

  const markAsPaidMutation = useMutation({
    mutationFn: async ({ id, currentStatus }: { id: string; currentStatus: string }) => {
      const newStatus = currentStatus === 'paid' ? 'pending' : 'paid';
      const { error } = await supabase
        .from('invoices')
        .update({ status: newStatus })
        .eq('id', id);
      if (error) throw error;
      return newStatus;
    },
    onSuccess: (newStatus) => {
      queryClient.invalidateQueries({ queryKey: ['admin_invoices'] });
      queryClient.invalidateQueries({ queryKey: ['admin_analytics_full'] });
      // Also invalidate portal queries so client sees updated status immediately
      queryClient.invalidateQueries({ queryKey: ['portal_invoices'] });
      queryClient.invalidateQueries({ queryKey: ['portal_invoice_detail'] });
      toast.success(newStatus === 'paid' ? "Invoice marked as paid! ✅" : "Invoice marked as pending.");
    },
    onError: (err: any) => toast.error(`Update failed: ${err.message}`)
  });

  const sendEmailMutation = useMutation({
    mutationFn: async (inv: any) => {
      const { data, error } = await supabase.functions.invoke('send-invoice-email', {
        body: {
          invoiceId: inv.id,
          clientEmail: inv.client_email,
          invoiceNumber: inv.invoice_number,
          amount: inv.amount,
          clientName: inv.client_name,
          clientSlug: inv.client_slug
        }
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_invoices'] });
      toast.success("Invoice dispatched via Neural Edge! 🚀⚡");
    },
    onError: (err: any) => {
      console.error("Neural Dispatch failed, falling back to manual:", err);
      toast.info("Backend sync slow – Opening manual mailer...");
    }
  });

  const isLoading = isInvoicesLoading || isClientsLoading;

  const totalInvoices = invoices.reduce((sum: number, inv: any) => sum + Number(inv.amount), 0);
  const totalPaid = invoices.filter((i: any) => i.status === "paid").reduce((sum: number, inv: any) => sum + Number(inv.amount), 0);
  const totalPending = invoices.filter((i: any) => i.status === "pending").reduce((sum: number, inv: any) => sum + Number(inv.amount), 0);
  const totalOverdue = invoices.filter((i: any) => i.status === "overdue").reduce((sum: number, inv: any) => sum + Number(inv.amount), 0);

  const filteredInvoices = invoices.filter((inv: any) => 
    inv.client_name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    inv.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (isLoading) return (
    <AppShell title="Billing & Invoices" subtitle="Synchronizing financial operations...">
        <div className="flex flex-col items-center justify-center py-32 gap-4">
            <Loader2 className="animate-spin text-accent" size={40} />
            <span className="text-sm text-muted-foreground">Retrieving financial records...</span>
        </div>
    </AppShell>
  );

  return (
    <AppShell title="Billing & Invoices" subtitle="Agency financial overview">
      <div className="fade-up h-full flex flex-col">
        {/* Top metrics */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="glass-card p-5">
            <p className="text-sm font-semibold text-white mb-1">Total Invoiced (Last 6mo)</p>
            <p className="text-2xl font-bold" style={{ color: "#a78bfa" }}>{formatCurrency(totalInvoices)}</p>
          </div>
          <div className="glass-card p-5">
            <p className="text-sm font-semibold text-white mb-1">Paid</p>
            <p className="text-2xl font-bold text-emerald-400">{formatCurrency(totalPaid)}</p>
          </div>
          <div className="glass-card p-5">
            <p className="text-sm font-semibold text-white mb-1">Pending</p>
            <p className="text-2xl font-bold text-amber-400">{formatCurrency(totalPending)}</p>
          </div>
          <div className="glass-card p-5">
            <p className="text-sm font-semibold text-white mb-1">Overdue</p>
            <p className="text-2xl font-bold text-red-400">{formatCurrency(totalOverdue)}</p>
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: "rgba(15,22,41,0.8)", border: "1px solid rgba(99,128,191,0.15)" }}>
            <Search size={13} style={{ color: "#475569" }} />
            <input 
              className="bg-transparent text-xs outline-none w-48" 
              style={{ color: "#94a3b8" }} 
              placeholder="Search invoices..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Dialog open={isNewInvoiceOpen} onOpenChange={(open) => { if (!open) closeDialog(); else setIsNewInvoiceOpen(true); }}>
            <DialogTrigger asChild>
              <button className="btn-primary flex items-center gap-1.5 text-xs" onClick={openNewDialog}><Plus size={12} /> Create Invoice</button>
            </DialogTrigger>
            <DialogContent className="bg-[#0a0f1d] border-white/10 text-white max-w-3xl p-0 overflow-hidden">
              <div className="p-6 border-b border-white/5 bg-[#0f172a]/50">
                <DialogTitle className="text-xl font-bold tracking-tight flex items-center gap-2">
                  <FileText className="text-blue-400" size={20} /> {editingInvoiceId ? 'Edit Invoice' : 'Generate Invoice'}
                </DialogTitle>
                <p className="text-xs text-slate-400 mt-1">{editingInvoiceId ? 'Update billing details for this invoice.' : 'Draft a new billing statement for your clients.'}</p>
              </div>
              
              <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
                {/* Header Info */}
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase font-bold text-slate-500 tracking-widest">Client</label>
                    <Select onValueChange={v => setNewInvoice({...newInvoice, client_id: v})} value={newInvoice.client_id}>
                      <SelectTrigger className="bg-white/5 border-white/10 h-11">
                        <SelectValue placeholder="Select Firm" />
                      </SelectTrigger>
                      <SelectContent className="bg-[#0f172a] border-white/10 text-white">
                        {clients.map((c: any) => (
                          <SelectItem key={c.id} value={c.id}>{c.firm_name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase font-bold text-slate-500 tracking-widest">Due Date</label>
                    <Input 
                      type="date" 
                      className="bg-white/5 border-white/10 h-11 text-white [color-scheme:dark]"
                      value={newInvoice.due_date}
                      onChange={e => setNewInvoice({...newInvoice, due_date: e.target.value})}
                    />
                  </div>
                </div>

                {/* Line Items */}
                <div className="space-y-3">
                  <label className="text-[10px] uppercase font-bold text-slate-500 tracking-widest">Line Items</label>
                  <div className="space-y-2">
                    {items.map((item, index) => (
                      <div key={index} className="flex items-center gap-3">
                        <Input 
                          placeholder="Description" 
                          className="bg-white/5 border-white/10 flex-[2]"
                          value={item.description}
                          onChange={e => {
                            const newItems = [...items];
                            newItems[index].description = e.target.value;
                            setItems(newItems);
                          }}
                        />
                        <Input 
                          type="number" 
                          placeholder="Qty" 
                          className="bg-white/5 border-white/10 flex-[0.5]"
                          value={item.quantity}
                          min={1}
                          onChange={e => {
                            const newItems = [...items];
                            newItems[index].quantity = parseFloat(e.target.value) || 0;
                            setItems(newItems);
                          }}
                        />
                        <Input 
                          type="number" 
                          placeholder="Rate (₹)" 
                          className="bg-white/5 border-white/10 flex-1"
                          value={item.rate}
                          min={0}
                          onChange={e => {
                            const newItems = [...items];
                            newItems[index].rate = parseFloat(e.target.value) || 0;
                            setItems(newItems);
                          }}
                        />
                        <div className="flex-1 font-semibold text-right text-sm px-3">
                          {formatCurrency(item.quantity * item.rate)}
                        </div>
                        <button 
                          className="btn-ghost p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                          onClick={() => setItems(items.filter((_, i) => i !== index))}
                          disabled={items.length === 1}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                  <button 
                    className="text-xs text-blue-400 hover:text-blue-300 font-semibold mt-2"
                    onClick={() => setItems([...items, { description: "", quantity: 1, rate: 0 }])}
                  >
                    + Add Another Item
                  </button>
                </div>

                {/* Totals & Tax */}
                <div className="flex justify-end pt-4 border-t border-white/5">
                  <div className="w-64 space-y-3">
                    <div className="flex justify-between text-sm text-slate-400">
                      <span>Subtotal</span>
                      <span>{formatCurrency(subtotal)}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm text-slate-400">
                      <span>Tax Rate (%)</span>
                      <Input 
                        type="number" 
                        className="w-20 bg-white/5 border-white/10 text-right h-8" 
                        value={newInvoice.tax_rate}
                        min={0} max={100}
                        onChange={e => setNewInvoice({...newInvoice, tax_rate: parseFloat(e.target.value) || 0})}
                      />
                    </div>
                    {tax > 0 && (
                      <div className="flex justify-between text-sm text-slate-400">
                        <span>Tax Amount</span>
                        <span>{formatCurrency(tax)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-lg font-bold text-white pt-2 border-t border-white/5">
                      <span>Total</span>
                      <span>{formatCurrency(total)}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] uppercase font-bold text-slate-500 tracking-widest">Additional Notes</label>
                  <Textarea 
                    placeholder="Thank you for your business..." 
                    className="bg-white/5 border-white/10 min-h-[80px]"
                    value={newInvoice.notes}
                    onChange={e => setNewInvoice({...newInvoice, notes: e.target.value})}
                  />
                </div>
              </div>

              <div className="p-6 border-t border-white/5 bg-[#0f172a]/80 flex justify-end gap-3">
                <button className="btn-ghost" onClick={closeDialog}>Cancel</button>
                <button 
                  className="btn-primary" 
                  onClick={() => saveInvoiceMutation.mutate()}
                  disabled={saveInvoiceMutation.isPending || !newInvoice.client_id || items.some(i => !i.description)}
                >
                  {saveInvoiceMutation.isPending ? 'Saving...' : editingInvoiceId ? 'Save Changes' : 'Generate Invoice'}
                </button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Invoice Table */}
        <div className="glass-card overflow-hidden overflow-x-auto">
          <div className="grid text-xs font-semibold px-5 py-3" style={{ color: "#475569", gridTemplateColumns: "1fr 2fr 1fr 1fr 1fr 60px", borderBottom: "1px solid rgba(99,128,191,0.06)" }}>
            <span>INVOICE</span>
            <span>CLIENT</span>
            <span>AMOUNT</span>
            <span>DATE</span>
            <span>STATUS</span>
            <span/>
          </div>

          <div className="divide-y divide-[rgba(99,128,191,0.06)]">
            {filteredInvoices.map((inv: any) => (
                <div key={inv.id} className="grid items-center px-5 py-3.5 items-center text-sm" style={{ gridTemplateColumns: "1fr 2fr 1fr 1fr 1fr 60px", borderBottom: "1px solid rgba(99,128,191,0.06)" }}>
                  <span className="text-white font-medium uppercase min-w-0 pr-2">{inv.invoice_number || `#${inv.id.substring(0, 8)}`}</span>
                  <Link to={`/clients/${inv.client_id}`} className="text-xs hover:text-white truncate pr-4" style={{ color: "#94a3b8", transition: "color 0.2s" }}>
                    {inv.client_name}
                  </Link>
                  <span className="font-semibold" style={{ color: "#a78bfa" }}>{formatCurrency(inv.amount)}</span>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs" style={{ color: "#e2e8f0" }}>Issued: {new Date(inv.issued_date).toLocaleDateString()}</span>
                    {inv.due_date && <span className="text-[10px]" style={{ color: "#64748b" }}>Due: {new Date(inv.due_date).toLocaleDateString()}</span>}
                  </div>
                  <span className={`badge ${getStatusColor(inv.status)} w-fit`}>{inv.status}</span>
                  <div className="flex justify-end gap-2 pr-2">
                    <button 
                      onClick={() => openEditDialog(inv)}
                      className="p-2 rounded-lg bg-slate-800 text-slate-400 hover:text-white transition-colors"
                      title="Edit Invoice"
                    >
                      <Edit size={14} />
                    </button>
                    <button
                      onClick={() => markAsPaidMutation.mutate({ id: inv.id, currentStatus: inv.status })}
                      disabled={markAsPaidMutation.isPending}
                      className={cn(
                        "p-2 rounded-lg transition-all active:scale-95",
                        inv.status === 'paid'
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/20"
                          : "bg-slate-800 text-slate-400 hover:bg-emerald-500/10 hover:text-emerald-400 hover:border hover:border-emerald-500/20"
                      )}
                      title={inv.status === 'paid' ? 'Mark as Pending' : 'Mark as Paid'}
                    >
                      {markAsPaidMutation.isPending ? <Loader2 className="animate-spin" size={14} /> : inv.status === 'paid' ? <CheckCircle2 size={14} /> : <Clock size={14} />}
                    </button>
                    <button 
                      onClick={() => {
                        sendEmailMutation.mutate(inv);
                        // Fallback: Still allow manual mailto if they click again or if mutation is slow
                        const mailtoStr = `mailto:${inv.client_email || ''}?subject=Invoice ${inv.invoice_number || inv.id.substring(0,8)}&body=Hi ${inv.client_name},%0A%0AHere is your invoice ${inv.invoice_number || inv.id.substring(0,8)} for ${formatCurrency(inv.amount)}.%0A%0AYou can view and manage your billing history in your client portal: ${window.location.origin}/clientportal/${inv.client_slug}/invoice/${inv.id}%0A%0AThank you for your business!`;
                        if (sendEmailMutation.isError) window.location.href = mailtoStr;
                      }}
                      className={cn(
                        "p-2 rounded-lg transition-all active:scale-95",
                        inv.sent_at 
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" 
                          : "bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500 hover:text-white"
                      )}
                      title={inv.sent_at ? `Sent on ${new Date(inv.sent_at).toLocaleDateString()}` : "Dispatch to Client"}
                      disabled={sendEmailMutation.isPending}
                    >
                      {sendEmailMutation.isPending ? <Loader2 className="animate-spin" size={14} /> : <Send size={14} />}
                    </button>
                    <button 
                      onClick={() => generateInvoicePDF(inv)}
                      className="p-2 rounded-lg bg-slate-800 text-slate-400 hover:text-white transition-colors"
                      title="Download PDF"
                    >
                      <Download size={14} />
                    </button>
                  </div>
                </div>
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
