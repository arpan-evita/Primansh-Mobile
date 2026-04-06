import { AppShell } from "@/components/layout/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, FileText, Edit2, Loader2, Save } from "lucide-react";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function ContentPage() {
  const [filter, setFilter] = useState("");
  const [editingContent, setEditingContent] = useState<any>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const queryClient = useQueryClient();

  // Fetch Site Content
  const { data: content, isLoading } = useQuery({
    queryKey: ['site_content'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('site_content')
        .select('*')
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return data;
    }
  });

  // Update/Save Content Mutation
  const updateContent = useMutation({
    mutationFn: async (updatedRecord: any) => {
      const { error } = await supabase
        .from('site_content')
        .upsert({
          ...updatedRecord,
          updated_at: new Date().toISOString()
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['site_content'] });
      toast.success("Knowledge Synchronized! 🧠⚡");
      setIsDialogOpen(false);
    },
    onError: (error: any) => {
      toast.error(`Sync failed: ${error.message}`);
    }
  });

  // Delete Mutation
  const deleteContent = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('site_content')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['site_content'] });
      toast.success("Fact Purged from Memory. 🗑️");
    },
    onError: (error: any) => {
      toast.error(`Purge failed: ${error.message}`);
    }
  });

  const handleEdit = (item: any) => {
    setEditingContent(item);
    setIsDialogOpen(true);
  };

  const handleSave = () => {
    if (editingContent) {
      updateContent.mutate({
        ...editingContent,
        updated_at: new Date().toISOString()
      });
    }
  };

  return (
    <AppShell title="AI Knowledge Sync" subtitle="Manage your website data and teach the AI">
      <div className="fade-up h-full flex flex-col">
        {/* Toolbar */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: "rgba(15,22,41,0.8)", border: "1px solid rgba(99,128,191,0.15)" }}>
              <Search size={13} style={{ color: "#475569" }} />
              <input
                className="bg-transparent text-xs outline-none w-48"
                style={{ color: "#94a3b8" }}
                placeholder="Search pages or sections..."
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              />
            </div>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="accent" onClick={() => setEditingContent({ page_slug: '', section_name: '', content_text: '' })}>
                <Plus size={14} className="mr-1" /> New Fact
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-[#0b1120] border-white/10 text-white sm:max-w-[650px] overflow-hidden rounded-3xl p-0">
              <div className="bg-blue-500/5 px-8 py-6 border-b border-white/5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                    <Save className="text-blue-400" size={20} />
                  </div>
                  <div>
                    <DialogTitle className="text-lg font-black uppercase tracking-tight">Refine Knowledge Node</DialogTitle>
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">Direct AI Memory Injection Protocol</p>
                  </div>
                </div>
              </div>

              <div className="px-8 py-8 space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] text-slate-500 uppercase font-black tracking-[0.2em] ml-1">Target URI (Slug)</label>
                    <div className="relative group">
                      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-blue-400 transition-colors">
                        <span className="font-mono text-sm">/</span>
                      </div>
                      <Input 
                        value={editingContent?.page_slug} 
                        onChange={(e) => setEditingContent({...editingContent, page_slug: e.target.value})}
                        placeholder="e.g., services" 
                        className="bg-white/[0.03] border-white/10 focus:border-blue-500/50 pl-6 h-12 rounded-xl text-sm font-medium transition-all"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] text-slate-500 uppercase font-black tracking-[0.2em] ml-1">Logic Block (Section)</label>
                    <Input 
                      value={editingContent?.section_name} 
                      onChange={(e) => setEditingContent({...editingContent, section_name: e.target.value})}
                      placeholder="e.g., hero-heading" 
                      className="bg-white/[0.03] border-white/10 focus:border-blue-500/50 h-12 rounded-xl text-sm font-medium transition-all"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] text-slate-500 uppercase font-black tracking-[0.2em] ml-1">Fact Snippet (Source of Truth)</label>
                  <Textarea 
                    value={editingContent?.content_text} 
                    onChange={(e) => setEditingContent({...editingContent, content_text: e.target.value})}
                    placeholder="Enter the official text that the AI and website elements will consume..." 
                    className="h-40 bg-white/[0.03] border-white/10 focus:border-blue-500/50 rounded-xl text-sm font-medium leading-relaxed resize-none p-4 transition-all"
                  />
                  <div className="flex items-center gap-2 mt-3 px-3 py-2 rounded-xl bg-blue-500/5 border border-blue-500/20">
                    <Loader2 className={cn("text-blue-400 shrink-0", updateContent.isPending ? "animate-spin" : "")} size={14} />
                    <p className="text-[10px] text-blue-300/80 font-bold uppercase tracking-wider">Neural Sync Active: Saving will immediately re-train the edge models.</p>
                  </div>
                </div>
              </div>

              <div className="px-8 py-6 bg-white/[0.02] border-t border-white/5 flex justify-end gap-3">
                <Button variant="ghost" size="sm" onClick={() => setIsDialogOpen(false)} className="rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-white/5 transition-all">
                  Abort
                </Button>
                <Button 
                    size="sm" 
                    onClick={handleSave} 
                    disabled={updateContent.isPending}
                    className="bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest px-6 shadow-lg shadow-blue-900/40 transition-all active:scale-95"
                >
                  {updateContent.isPending ? "Syncing..." : "Sync AI Memory"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Knowledge Table */}
        <div className="glass-card overflow-hidden border-white/[0.05]">
          <div className="grid text-[10px] font-black uppercase tracking-[0.2em] px-8 py-4 bg-white/[0.02]" style={{ color: "#475569", gridTemplateColumns: "1fr 1.2fr 2fr 100px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
            <span>Target URI (Page)</span>
            <span>Logic Block (Section)</span>
            <span>Fact Snippet</span>
            <span className="text-right">Actions</span>
          </div>

          <div className="divide-y divide-white/[0.02] max-h-[600px] overflow-y-auto">
            {isLoading ? (
              <div className="py-20 text-center flex flex-col items-center gap-3">
                <Loader2 className="animate-spin text-accent" size={24} />
                <span className="text-xs text-muted-foreground">Loading deep knowledge base...</span>
              </div>
            ) : content
              ?.filter((c) => {
                if (filter === "") return true;
                const searchStr = filter.toLowerCase();
                return (
                  c.page_slug.toLowerCase().includes(searchStr) ||
                  c.section_name.toLowerCase().includes(searchStr) ||
                  c.content_text.toLowerCase().includes(searchStr)
                );
              })
              .map((c) => (
                <div key={c.id} className="grid items-center px-8 py-5 transition-all duration-300 hover:bg-white/[0.02] group/row" style={{ gridTemplateColumns: "1fr 1.2fr 2fr 100px" }}>
                  <div className="flex items-center gap-2 overflow-hidden">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500/30 group-hover/row:bg-blue-400 transition-colors" />
                    <span className="text-blue-400/80 font-mono text-[11px] truncate tracking-tight uppercase group-hover/row:text-blue-300 transition-colors">/{c.page_slug}</span>
                  </div>
                  
                  <div className="flex flex-col">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-0.5 group-hover/row:text-slate-400">Node:</span>
                    <span className="text-white font-bold text-xs tracking-tight">{c.section_name}</span>
                  </div>

                  <div className="pr-10 overflow-hidden">
                    <p className="text-slate-400 text-xs italic line-clamp-1 leading-relaxed border-l-2 border-white/5 pl-4 group-hover/row:text-slate-200 transition-colors">
                      {c.content_text}
                    </p>
                  </div>

                  <div className="flex justify-end gap-2 opacity-0 group-hover/row:opacity-100 transition-opacity">
                    <button 
                      onClick={() => handleEdit(c)}
                      className="p-2 rounded-xl bg-white/5 text-slate-400 border border-white/10 hover:bg-blue-500 hover:text-white transition-all active:scale-90"
                      title="Refine Fact"
                    >
                      <Edit2 size={13} />
                    </button>
                    <button 
                      onClick={() => { if(confirm("Purge this knowledge node?")) deleteContent.mutate(c.id) }}
                      className="p-2 rounded-xl bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500 hover:text-white transition-all active:scale-90"
                      title="Purge Node"
                    >
                      <Plus size={13} className="rotate-45" />
                    </button>
                  </div>
                </div>
              ))}
            {content?.length === 0 && !isLoading && (
              <div className="py-20 text-center flex flex-col items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-muted/10 flex items-center justify-center text-muted-foreground">
                    <FileText size={24} />
                </div>
                <div className="max-w-[300px]">
                    <h3 className="text-white text-sm font-medium mb-1">No Knowledge Found</h3>
                    <p className="text-xs text-muted-foreground">The AI hasn't learned any custom site content yet. Click "New Fact" to get started.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}

