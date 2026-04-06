"use client";

import { AppShell } from "@/components/layout/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, MessageSquare, Edit2, Loader2, Save, Trash2, Star } from "lucide-react";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export default function TestimonialsAdmin() {
  const [filter, setFilter] = useState("");
  const [editingItem, setEditingItem] = useState<any>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const queryClient = useQueryClient();

  // Fetch Testimonials
  const { data: testimonials, isLoading } = useQuery({
    queryKey: ['admin_testimonials'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('testimonials')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    }
  });

  // Save/Update Mutation
  const saveMutation = useMutation({
    mutationFn: async (record: any) => {
      const { error } = await supabase
        .from('testimonials')
        .upsert({
          ...record,
          updated_at: new Date().toISOString()
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_testimonials'] });
      toast.success(editingItem?.id ? "Testimonial updated! ✨" : "New testimonial added! ✨");
      setIsDialogOpen(false);
      setEditingItem(null);
    },
    onError: (error: any) => {
      toast.error(`Sync failed: ${error.message}`);
    }
  });

  // Delete Mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('testimonials')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_testimonials'] });
      toast.success("Testimonial removed.");
    },
    onError: (error: any) => {
      toast.error(`Delete failed: ${error.message}`);
    }
  });

  const handleEdit = (item: any) => {
    setEditingItem(item);
    setIsDialogOpen(true);
  };

  const handleSave = () => {
    if (editingItem) {
      saveMutation.mutate(editingItem);
    }
  };

  const handleDelete = (id: string) => {
    if (window.confirm("Are you sure you want to delete this testimonial?")) {
      deleteMutation.mutate(id);
    }
  };

  return (
    <AppShell title="Client Testimonials" subtitle="Manage your social proof and client success stories">
      <div className="fade-up h-full flex flex-col px-6 pb-20">
        {/* Toolbar */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900/50 border border-white/10">
              <Search size={14} className="text-slate-500" />
              <input
                className="bg-transparent text-sm outline-none w-64 text-slate-300"
                placeholder="Search testimonials..."
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              />
            </div>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="accent" onClick={() => setEditingItem({ quote: '', name: '', role: '', rating: 5 })}>
                <Plus size={16} className="mr-2" /> Add Testimonial
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-[#0f172a] border-white/10 text-white sm:max-w-[600px] shadow-2xl">
              <DialogHeader>
                <DialogTitle className="text-xl font-bold text-white">
                  {editingItem?.id ? 'Edit Testimonial' : 'New Testimonial'}
                </DialogTitle>
              </DialogHeader>
              <div className="grid gap-6 py-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Client Name</label>
                    <Input 
                      value={editingItem?.name} 
                      onChange={(e) => setEditingItem({...editingItem, name: e.target.value})}
                      placeholder="e.g., CA Rajesh Mehta" 
                      className="bg-slate-800/50 border-white/10 text-white placeholder:text-slate-600 focus:border-accent/50"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Role / Firm</label>
                    <Input 
                      value={editingItem?.role} 
                      onChange={(e) => setEditingItem({...editingItem, role: e.target.value})}
                      placeholder="e.g., Senior Partner, Mehta & Associates" 
                      className="bg-slate-800/50 border-white/10 text-white placeholder:text-slate-600 focus:border-accent/50"
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Rating (1-5)</label>
                    <div className="flex items-center gap-2">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          onClick={() => setEditingItem({...editingItem, rating: star})}
                          className={`p-1 transition-all ${editingItem?.rating >= star ? 'text-accent' : 'text-slate-700'}`}
                        >
                          <Star size={24} fill={editingItem?.rating >= star ? "currentColor" : "none"} />
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">The Quote</label>
                  <Textarea 
                    value={editingItem?.quote} 
                    onChange={(e) => setEditingItem({...editingItem, quote: e.target.value})}
                    placeholder="Enter the client's words..." 
                    className="h-32 bg-slate-800/50 border-white/10 text-white placeholder:text-slate-600 focus:border-accent/50 leading-relaxed"
                  />
                </div>
              </div>
              <DialogFooter className="border-t border-white/5 pt-4">
                <Button variant="ghost" size="sm" onClick={() => setIsDialogOpen(false)} className="text-white hover:bg-white/5">
                  Cancel
                </Button>
                <Button size="sm" variant="accent" onClick={handleSave} disabled={saveMutation.isPending}>
                  {saveMutation.isPending ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} className="mr-2" />}
                  Save Testimonial
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* List View */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {isLoading ? (
            <div className="col-span-full py-20 text-center flex flex-col items-center gap-4">
              <Loader2 className="animate-spin text-accent" size={32} />
              <span className="text-sm text-slate-400">Loading your social proof...</span>
            </div>
          ) : testimonials
            ?.filter((t) => filter === "" || t.name.toLowerCase().includes(filter.toLowerCase()) || t.quote.toLowerCase().includes(filter.toLowerCase()))
            .map((t) => (
              <div key={t.id} className="glass-card p-6 group transition-all duration-300 hover:border-accent/30">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex gap-1">
                    {[...Array(t.rating)].map((_, i) => (
                      <Star key={i} size={12} className="text-accent fill-accent" />
                    ))}
                  </div>
                  <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={() => handleEdit(t)}
                      className="p-2 rounded-lg bg-white/5 hover:bg-accent/20 hover:text-accent text-slate-400 transition-all"
                    >
                      <Edit2 size={14} />
                    </button>
                    <button 
                      onClick={() => handleDelete(t.id)}
                      className="p-2 rounded-lg bg-white/5 hover:bg-destructive/20 hover:text-destructive text-slate-400 transition-all"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                <p className="text-sm text-slate-300 italic mb-6 leading-relaxed line-clamp-3">
                  "{t.quote}"
                </p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-accent to-hot flex items-center justify-center text-accent-foreground font-bold">
                    {t.name.charAt(0)}
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">{t.name}</h4>
                    <p className="text-[10px] text-slate-500 font-mono tracking-wider">{t.role}</p>
                  </div>
                </div>
              </div>
            ))}

          {!isLoading && testimonials?.length === 0 && (
            <div className="col-span-full py-32 text-center flex flex-col items-center gap-6">
              <div className="w-16 h-16 rounded-3xl bg-slate-900/50 border border-white/10 flex items-center justify-center text-slate-500">
                <MessageSquare size={32} />
              </div>
              <div className="max-w-md">
                <h3 className="text-white font-medium mb-2">No Testimonials Yet</h3>
                <p className="text-sm text-slate-500 mb-8">Start adding client success stories to showcase trust on your website.</p>
                <Button variant="outline" size="sm" onClick={() => setIsDialogOpen(true)}>
                  <Plus size={14} className="mr-2" /> Add First Testimonial
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
