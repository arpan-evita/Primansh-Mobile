import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  FolderPlus, File as FileIcon, Search, Lock, Download, Trash2, 
  ShieldCheck, Loader2, Plus, X, FileUp
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { formatBytes } from "@/lib/utils";
import { cn } from "@/lib/utils";

const DOCUMENT_TYPES = [
  { value: 'asset', label: 'Client Asset' },
  { value: 'credentials', label: 'Secure Credential' },
  { value: 'report', label: 'Report / Invoice' }
];

export default function DocumentsPage() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [uploadData, setUploadData] = useState({ client_id: "", type: "asset", secure: false });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // ── DATA FETCHING ──
  const { data: documents = [], isLoading: isDocsLoading } = useQuery({
    queryKey: ['admin_documents'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('client_documents' as any)
        .select('*, clients(firm_name)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
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

  // ── MUTATIONS ──
  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!selectedFile || !uploadData.client_id) return;
      
      const fileExt = selectedFile.name.split('.').pop();
      const filePath = `${uploadData.client_id}/${Math.random()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('client-documents')
        .upload(filePath, selectedFile);
      if (uploadError) throw uploadError;

      const { error: dbError } = await supabase
        .from('client_documents' as any)
        .insert({
          name: selectedFile.name,
          type: uploadData.type,
          client_id: uploadData.client_id,
          file_path: filePath,
          size: selectedFile.size,
          secure: uploadData.secure
        });
      if (dbError) throw dbError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_documents'] });
      toast.success("File uploaded to vault! 🛡️");
      setIsUploadOpen(false);
      setSelectedFile(null);
    },
    onError: (err: any) => toast.error(`Upload failed: ${err.message}`)
  });

  const deleteMutation = useMutation({
    mutationFn: async (doc: any) => {
      await supabase.storage.from('client-documents').remove([doc.file_path]);
      const { error } = await supabase.from('client_documents' as any).delete().eq('id', doc.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_documents'] });
      toast.success("Document removed.");
    }
  });

  const downloadFile = async (doc: any) => {
    const { data, error } = await supabase.storage
      .from('client-documents')
      .createSignedUrl(doc.file_path, 60); // 1 minute link
    if (error) return toast.error("Download link failed");
    window.open(data.signedUrl, '_blank');
  };

  const filteredDocs = documents.filter((doc: any) => {
    const matchesFilter = filter === "all" || doc.client_id === filter;
    const matchesSearch = doc.name.toLowerCase().includes(search.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const stats = {
    assets: documents.filter((d: any) => d.type === 'asset').length,
    credentials: documents.filter((d: any) => d.type === 'credentials').length,
    reports: documents.filter((d: any) => d.type === 'report').length,
    totalSize: formatBytes(documents.reduce((acc: number, d: any) => acc + (d.size || 0), 0))
  };

  if (isDocsLoading || isClientsLoading) return (
    <AppShell title="Document Vault" subtitle="Synchronizing encrypted storage...">
      <div className="flex flex-col items-center justify-center py-32 gap-4">
        <Loader2 className="animate-spin text-blue-500" size={40} />
        <span className="text-sm text-slate-500">Accessing remote nodes...</span>
      </div>
    </AppShell>
  );

  return (
    <AppShell title="Document Vault" subtitle="Secure agency and client file storage">
      <div className="fade-up h-full flex flex-col">
        {/* Toolbar */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center justify-between mb-6">
          <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto hide-scrollbar pb-1 sm:pb-0">
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg flex-1 min-w-[200px]" style={{ background: "rgba(15,22,41,0.8)", border: "1px solid rgba(99,128,191,0.15)" }}>
              <Search size={13} style={{ color: "#475569" }} />
              <input 
                className="bg-transparent text-xs outline-none flex-1 min-w-0" 
                style={{ color: "#94a3b8" }} 
                placeholder="Search files..." 
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <select
              className="bg-[rgba(15,22,41,0.8)] border border-[rgba(99,128,191,0.15)] rounded-lg px-3 py-2 text-xs outline-none flex-shrink-0 min-w-[130px]"
              style={{ color: "#94a3b8" }}
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            >
              <option value="all">All Clients</option>
              {clients.map((c: any) => <option key={c.id} value={c.id}>{c.firm_name}</option>)}
            </select>
          </div>
          
          {isAdmin && (
            <Dialog open={isUploadOpen} onOpenChange={setIsUploadOpen}>
              <DialogTrigger asChild>
                <button className="btn-primary flex items-center justify-center gap-1.5 text-xs w-full sm:w-auto shrink-0 py-2.5 sm:py-2"><FolderPlus size={12} /> Upload File</button>
              </DialogTrigger>
              <DialogContent className="bg-[#0a0f1d] border-white/10 text-white p-0 overflow-hidden">
                 <div className="p-6 border-b border-white/5 bg-[#0f172a]/50">
                  <DialogTitle className="text-xl font-bold tracking-tight flex items-center gap-2">
                    <FileUp className="text-blue-400" size={20} /> Secure Upload
                  </DialogTitle>
                  <p className="text-xs text-slate-400 mt-1">Upload client assets or secure credentials to the encrypted vault.</p>
                </div>
  
                <div className="p-6 space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] uppercase font-bold text-slate-500 tracking-widest">Client</label>
                      <Select onValueChange={v => setUploadData({...uploadData, client_id: v})} value={uploadData.client_id}>
                        <SelectTrigger className="bg-white/5 border-white/10 h-11 text-xs">
                          <SelectValue placeholder="Select Client" />
                        </SelectTrigger>
                        <SelectContent className="bg-[#0f172a] border-white/10 text-white">
                          {clients.map((c: any) => (
                            <SelectItem key={c.id} value={c.id} className="text-xs">{c.firm_name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] uppercase font-bold text-slate-500 tracking-widest">Type</label>
                      <Select onValueChange={v => setUploadData({...uploadData, type: v})} value={uploadData.type}>
                        <SelectTrigger className="bg-white/5 border-white/10 h-11 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-[#0f172a] border-white/10 text-white">
                          {DOCUMENT_TYPES.map(t => (
                            <SelectItem key={t.value} value={t.value} className="text-xs">{t.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
  
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase font-bold text-slate-500 tracking-widest">File Selection</label>
                    <div 
                      className={cn(
                        "border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center gap-3 transition-colors",
                        selectedFile ? "border-blue-500/50 bg-blue-500/5" : "border-white/10 bg-white/5 hover:border-white/20"
                      )}
                    >
                      <input 
                        type="file" 
                        id="file-upload" 
                        className="hidden" 
                        onChange={e => setSelectedFile(e.target.files?.[0] || null)}
                      />
                      <label htmlFor="file-upload" className="flex flex-col items-center cursor-pointer">
                        <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-400 mb-2">
                          <FileUp size={24} />
                        </div>
                        <span className="text-xs font-semibold text-white">
                          {selectedFile ? selectedFile.name : "Click to select file"}
                        </span>
                        <span className="text-[10px] text-slate-500 mt-1">
                          {selectedFile ? formatBytes(selectedFile.size) : "PDF, TXT, XLSX (Max 50MB)"}
                        </span>
                      </label>
                      {selectedFile && (
                        <button 
                          onClick={() => setSelectedFile(null)} 
                          className="text-[10px] text-red-400 hover:text-red-300 font-bold uppercase tracking-tighter"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
  
                  <div className="flex items-center gap-3 p-4 rounded-xl bg-purple-500/5 border border-purple-500/10">
                     <ShieldCheck size={20} className="text-purple-400" />
                     <div className="flex-1">
                        <p className="text-xs font-bold text-white">Encrypted Storage</p>
                        <p className="text-[10px] text-slate-400">This file will be stored with AES-256 encryption.</p>
                     </div>
                     <input 
                        type="checkbox" 
                        checked={uploadData.secure}
                        onChange={e => setUploadData({...uploadData, secure: e.target.checked})}
                        className="w-4 h-4 rounded bg-white/5 border-white/10"
                     />
                  </div>
                </div>
  
                <div className="p-6 border-t border-white/5 bg-[#0f172a]/80 flex justify-end gap-3">
                  <button className="btn-ghost" onClick={() => setIsUploadOpen(false)}>Cancel</button>
                  <button 
                    className="btn-primary"
                    disabled={uploadMutation.isPending || !selectedFile || !uploadData.client_id}
                    onClick={() => uploadMutation.mutate()}
                  >
                    {uploadMutation.isPending ? "Uploading..." : "Start Upload"}
                  </button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {/* Categories */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="glass-card p-5 group cursor-pointer hover:border-blue-500/30 transition-colors">
            <div className="flex items-center justify-between mb-2">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400">
                <FileIcon size={20} />
              </div>
              <span className="text-xl font-bold text-white">{stats.assets}</span>
            </div>
            <p className="text-sm font-semibold text-white">Client Assets</p>
            <p className="text-xs" style={{ color: "#475569" }}>{stats.totalSize} used</p>
          </div>
          <div className="glass-card p-5 group cursor-pointer hover:border-purple-500/30 transition-colors">
            <div className="flex items-center justify-between mb-2">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-400">
                <ShieldCheck size={20} />
              </div>
              <span className="text-xl font-bold text-white">{stats.credentials}</span>
            </div>
            <p className="text-sm font-semibold text-white">Secure Credentials</p>
            <p className="text-xs" style={{ color: "#475569" }}>Encrypted storage</p>
          </div>
          <div className="glass-card p-5 group cursor-pointer hover:border-amber-500/30 transition-colors">
            <div className="flex items-center justify-between mb-2">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-400">
                <FileIcon size={20} />
              </div>
              <span className="text-xl font-bold text-white">{stats.reports}</span>
            </div>
            <p className="text-sm font-semibold text-white">Reports & Invoices</p>
            <p className="text-xs" style={{ color: "#475569" }}>Auto-generated PDFs</p>
          </div>
        </div>

        {/* File List */}
        <div className="glass-card overflow-hidden overflow-x-auto flex-1">
          <div className="grid text-xs font-semibold px-5 py-3" style={{ color: "#475569", gridTemplateColumns: "2fr 1.5fr 1fr 1fr 100px", borderBottom: "1px solid rgba(99,128,191,0.06)" }}>
            <span>FILE NAME</span>
            <span>CLIENT</span>
            <span>DATE ADDED</span>
            <span>SIZE</span>
            <span/>
          </div>

          <div className="divide-y divide-[rgba(99,128,191,0.06)]">
            {filteredDocs.map((doc: any) => {
              return (
                <div key={doc.id} className="grid items-center px-5 py-3.5 table-row text-sm" style={{ gridTemplateColumns: "2fr 1.5fr 1fr 1fr 100px" }}>
                  <div className="flex items-center gap-3 pr-4">
                    {doc.secure ? <Lock size={14} className="text-purple-400 flex-shrink-0" /> : <FileIcon size={14} style={{ color: "#64748b" }} className="flex-shrink-0"/>}
                    <span className="text-white font-medium truncate">{doc.name}</span>
                  </div>
                  <span className="text-xs truncate pr-4" style={{ color: "#94a3b8" }}>{doc.clients?.firm_name}</span>
                  <span className="text-xs" style={{ color: "#64748b" }}>{new Date(doc.created_at).toLocaleDateString()}</span>
                  <span className="text-xs" style={{ color: "#64748b" }}>{formatBytes(doc.size)}</span>
                  <div className="flex items-center gap-1 justify-end">
                    <button 
                      className="btn-ghost p-1.5" 
                      title="Download"
                      onClick={() => downloadFile(doc)}
                    >
                      <Download size={14}/>
                    </button>
                    {isAdmin && (
                      <button 
                        className="btn-ghost p-1.5 hover:text-red-400 hover:bg-red-500/10" 
                        title="Delete"
                        onClick={() => {
                          if (confirm("Delete this document?")) deleteMutation.mutate(doc);
                        }}
                      >
                        <Trash2 size={14}/>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
            {filteredDocs.length === 0 && (
               <div className="py-20 text-center">
                  <FileIcon size={40} className="mx-auto text-slate-700 mb-4" />
                  <p className="text-sm text-slate-500">No documents found in this cycle.</p>
               </div>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
