import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { formatCurrency, getStatusColor, cn } from "@/lib/utils";
import { 
  FileText, 
  Download, 
  ArrowLeft, 
  Printer, 
  MessageSquare, 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  Loader2
} from "lucide-react";
import { generateInvoicePDF } from "@/lib/invoice-pdf";
import { PortalLayout } from "@/components/layout/PortalLayout";

export default function InvoiceDetail() {
  const { slug, invoiceId } = useParams<{ slug: string; invoiceId: string }>();
  const { profile } = useAuth();

  const { data: invoice, isLoading: isInvoiceLoading } = useQuery({
    queryKey: ['portal_invoice_detail', invoiceId],
    enabled: !!invoiceId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invoices')
        .select('*, clients(*)')
        .eq('id', invoiceId)
        .single();
      
      if (error) throw error;
      return data;
    }
  });

  const isLoading = isInvoiceLoading;
  const client = invoice?.clients;

  // Security check: If user is a client, they can only access their associated firm's invoices
  const isAuthorized = !profile || profile.role !== 'client' || (client?.id === profile.associated_client_id);

  if (isLoading) return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4 bg-[#020617]">
      <Loader2 className="animate-spin text-blue-500" size={40} />
      <span className="text-sm text-slate-500 font-mono tracking-tighter">Retrieving digital ledger...</span>
    </div>
  );

  if (!invoice || !isAuthorized) return (
    <div className="flex flex-col items-center justify-center min-h-screen text-center p-6 bg-[#020617]">
      <AlertCircle size={48} className="text-red-500 mb-4" />
      <h1 className="text-2xl font-bold text-white mb-2">Access Denied</h1>
      <p className="text-slate-400 mb-6">You are not authorized to view this specific billing record.</p>
      <Link to="/" className="btn-primary">Return to Home</Link>
    </div>
  );

  return (
    <PortalLayout 
      title={`Invoice ${invoice.invoice_number || invoice.id.substring(0, 8)}`}
      subtitle={`Billing detail for ${client.firm_name}`}
    >
      <div className="fade-up max-w-5xl mx-auto">
        {/* Navigation & Actions */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <Link 
            to={`/clientportal/${slug}/billing`}
            className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors py-2"
          >
            <ArrowLeft size={16} />
            <span className="text-sm font-medium">Back to History</span>
          </Link>
          
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button 
              onClick={() => window.print()}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-slate-800/50 border border-slate-700 rounded-xl text-slate-300 hover:text-white hover:bg-slate-700 transition-all font-semibold text-xs"
            >
              <Printer size={14} /> Print
            </button>
            <button 
              onClick={() => generateInvoicePDF({
                ...invoice,
                client_name: client.firm_name,
                client_address: client.location,
                client_email: client.contact_email
              })}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 border border-blue-500 rounded-xl text-white hover:bg-blue-500 shadow-lg shadow-blue-600/20 transition-all font-bold text-xs"
            >
              <Download size={14} /> Download PDF
            </button>
          </div>
        </div>

        {/* Main Invoice Card */}
        <div className="bg-[#0f172a] border border-slate-800 rounded-2xl md:rounded-3xl overflow-hidden shadow-2xl">
          {/* Header */}
          <div className="p-6 sm:p-12 border-b border-white/5 bg-gradient-to-br from-blue-500/5 to-transparent flex flex-col md:flex-row justify-between gap-8">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center shadow-inner">
                  <FileText className="text-white" size={24} />
                </div>
                <div>
                  <h2 className="text-2xl font-black text-white tracking-tight">PRIMANSH</h2>
                  <p className="text-[10px] font-bold text-blue-400 uppercase tracking-widest leading-none mt-1">Digital Growth Partner</p>
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-slate-400">New Delhi, India</p>
                <p className="text-xs text-slate-400">chat@primansh.com</p>
                <p className="text-xs text-slate-400">+91 6202490512</p>
              </div>
            </div>

            <div className="text-left md:text-right space-y-4">
              <span className={cn(
                "inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider",
                invoice.status === 'paid' ? "bg-emerald-500/10 text-emerald-400" : "bg-amber-500/10 text-amber-400"
              )}>
                {invoice.status === 'paid' ? <CheckCircle2 size={12} /> : <Clock size={12} />}
                {invoice.status}
              </span>
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Client Portal Invoice</p>
                <p className="text-2xl font-black text-white uppercase">{invoice.invoice_number || `#${invoice.id.substring(0, 8)}`}</p>
                <p className="text-xs text-slate-400">Issued: {new Date(invoice.issued_date).toLocaleDateString()}</p>
              </div>
            </div>
          </div>

          {/* Addresses */}
          <div className="p-6 sm:p-12 grid grid-cols-1 md:grid-cols-2 gap-12 border-b border-white/5 bg-slate-900/40">
            <div>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4">Billing To</p>
              <h3 className="text-lg font-bold text-white mb-2">{client?.firm_name || "Valued Partner"}</h3>
              <p className="text-sm text-slate-400 leading-relaxed max-w-xs">{client?.location || "India"}</p>
              <p className="text-sm text-slate-400 mt-2">{client?.contact_email}</p>
              <p className="text-sm text-slate-400">{client?.contact_phone}</p>
            </div>
            <div className="md:text-right flex flex-col md:items-end">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4">Invoice Information</p>
              <div className="space-y-3 w-full md:w-auto">
                <div className="flex justify-between md:gap-12">
                  <span className="text-xs text-slate-500">Invoice Date</span>
                  <span className="text-xs font-bold text-white">{new Date(invoice.issued_date).toLocaleDateString()}</span>
                </div>
                <div className="flex justify-between md:gap-12">
                  <span className="text-xs text-slate-500">Due Date</span>
                  <span className="text-xs font-bold text-white">{invoice.due_date ? new Date(invoice.due_date).toLocaleDateString() : '--'}</span>
                </div>
                <div className="flex justify-between md:gap-12">
                  <span className="text-xs text-slate-500">Payment Method</span>
                  <span className="text-xs font-bold text-white">Bank Transfer / UPI</span>
                </div>
              </div>
            </div>
          </div>

          {/* Items Table */}
          <div className="p-6 sm:p-12 overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="pb-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Description</th>
                  <th className="pb-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest text-center">Qty</th>
                  <th className="pb-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest text-right">Rate</th>
                  <th className="pb-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {(invoice.items || []).map((item: any, idx: number) => (
                  <tr key={idx} className="group">
                    <td className="py-6 pr-4">
                      <p className="text-sm font-bold text-white group-hover:text-blue-400 transition-colors uppercase">{item.description}</p>
                    </td>
                    <td className="py-6 text-center text-sm font-medium text-slate-400">{item.quantity}</td>
                    <td className="py-6 text-right text-sm font-medium text-slate-400">{formatCurrency(item.rate)}</td>
                    <td className="py-6 text-right text-sm font-bold text-white">{formatCurrency(item.quantity * item.rate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals Section */}
          <div className="p-6 sm:p-12 border-t border-white/5 bg-slate-900/60 flex flex-col md:flex-row justify-between gap-12">
            <div className="flex-1">
              <div className="bg-slate-800/40 border border-slate-700/50 p-6 rounded-2xl relative overflow-hidden group">
                <div className="absolute top-0 left-0 w-1 h-full bg-blue-600/50" />
                <h4 className="text-xs font-bold text-white mb-3 flex items-center gap-2">
                  <MessageSquare size={14} className="text-blue-400" /> Billing Notes
                </h4>
                <p className="text-xs text-slate-400 leading-relaxed italic">
                  {invoice.notes || "Thank you for your business. We appreciate the opportunity to scale your practice online. Please ensure payments are made within the due date to avoid service interruptions."}
                </p>
                <button 
                  onClick={() => window.open(`https://wa.me/916202490512?text=Hi, I have a query about Invoice ${invoice.invoice_number}`, '_blank')}
                  className="mt-4 text-[10px] font-bold text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1 uppercase tracking-widest"
                >
                  Contact Accounts on WhatsApp →
                </button>
              </div>
            </div>

            <div className="w-full md:w-80 space-y-4 pt-4 md:pt-0">
              <div className="flex justify-between text-sm text-slate-400">
                <span>Subtotal</span>
                <span className="font-medium text-slate-300">{formatCurrency(invoice.subtotal)}</span>
              </div>
              {invoice.tax_rate > 0 && (
                <div className="flex justify-between text-sm text-slate-400">
                  <span>GST ({invoice.tax_rate}%)</span>
                  <span className="font-medium text-slate-300">{formatCurrency(invoice.subtotal * (invoice.tax_rate / 100))}</span>
                </div>
              )}
              <div className="h-px bg-white/10 my-2" />
              <div className="flex justify-between items-center">
                <span className="text-base font-black text-white uppercase tracking-tighter">Total Amount</span>
                <span className="text-2xl font-black text-blue-400 tracking-tight">{formatCurrency(invoice.amount)}</span>
              </div>
              <div className="mt-4 p-4 rounded-xl bg-blue-600/10 border border-blue-500/20 text-center">
                <p className="text-[10px] font-bold text-white uppercase tracking-widest mb-1">Status</p>
                <p className={cn(
                  "text-lg font-black uppercase tracking-widest",
                   invoice.status === 'paid' ? "text-emerald-400" : "text-amber-400"
                )}>
                  {invoice.status}
                </p>
              </div>
            </div>
          </div>

          {/* Small Footer */}
          <div className="px-8 py-6 bg-slate-950 border-t border-white/5 text-center">
            <p className="text-[9px] font-medium text-slate-700 uppercase tracking-[0.2em]">
              Digitally Verified & Secured by Primansh Node · GST Registration Applied
            </p>
          </div>
        </div>
      </div>
    </PortalLayout>
  );
}
