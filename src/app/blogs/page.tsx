import { AppShell } from "@/components/layout/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, FileText, Edit2, Loader2, Trash2, Globe, Eye } from "lucide-react";
import { motion } from "framer-motion";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";

export default function BlogsPage() {
  const [filter, setFilter] = useState("");
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Fetch Blogs
  const { data: blogs, isLoading } = useQuery({
    queryKey: ['blogs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('blogs')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    }
  });

  // Delete Blog Mutation
  const deleteBlog = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('blogs')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blogs'] });
      toast.success("Article deleted successfully.");
    },
    onError: (error: any) => {
      toast.error(`Delete failed: ${error.message}`);
    }
  });

  return (
    <AppShell title="Article Master" subtitle="Create and manage your premium blog content">
      <div className="fade-up h-full flex flex-col">
        {/* Toolbar */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl glass-strong border border-white/5">
              <Search size={14} className="text-slate-500" />
              <input
                className="bg-transparent text-sm outline-none w-64 text-slate-300"
                placeholder="Search articles, categories..."
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              />
            </div>
          </div>
          <Link to="/blogs/editor/new">
            <Button variant="accent" size="lg" className="rounded-xl shadow-glow">
              <Plus size={18} className="mr-2" /> New Article
            </Button>
          </Link>
        </div>

        {/* Blogs Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {isLoading ? (
            Array(6).fill(0).map((_: any, i: number) => (
              <div key={i} className="glass-card h-64 animate-pulse bg-white/5 rounded-3xl" />
            ))
          ) : blogs?.filter((b: any) => !filter || b.title.toLowerCase().includes(filter.toLowerCase()) || b.category.toLowerCase().includes(filter.toLowerCase())).map((blog: any) => (
            <div key={blog.id} className="glass-card group overflow-hidden flex flex-col hover:border-accent/30 transition-all duration-500">
              {/* Image Preview */}
              <div className="aspect-video relative overflow-hidden h-40">
                <img 
                  src={blog.featured_image || "/images/blog/blog_ca_website_1774285736043.png"} 
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                  alt={blog.title} 
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 to-transparent opacity-60" />
                <div className="absolute bottom-4 left-4 flex gap-2">
                  <span className="px-2 py-0.5 rounded-md bg-accent text-[10px] font-bold uppercase tracking-widest text-white shadow-lg">
                    {blog.category}
                  </span>
                  <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-widest shadow-lg ${blog.published ? 'bg-green-500 text-white' : 'bg-slate-700 text-slate-300'}`}>
                    {blog.published ? 'Published' : 'Draft'}
                  </span>
                </div>
              </div>

              {/* Info */}
              <div className="p-6 flex-1 flex flex-col">
                <h3 className="text-lg font-bold text-white mb-2 line-clamp-2 leading-tight group-hover:text-accent transition-colors">
                  {blog.title}
                </h3>
                <p className="text-slate-500 text-xs mb-6 line-clamp-2 flex-1">
                  {blog.excerpt || "No summary provided."}
                </p>

                {/* Actions */}
                <div className="flex items-center justify-between pt-4 border-t border-white/5">
                  <div className="flex items-center gap-1">
                    <button 
                      onClick={() => navigate(`/blogs/editor/${blog.id}`)}
                      className="p-2 rounded-lg hover:bg-accent/20 hover:text-accent transition-all text-slate-500"
                    >
                      <Edit2 size={14} />
                    </button>
                    <button 
                      onClick={() => window.open(`/blog/${blog.slug}`, '_blank')}
                      className="p-2 rounded-lg hover:bg-blue-500/20 hover:text-blue-400 transition-all text-slate-500"
                    >
                      <Eye size={14} />
                    </button>
                    <button 
                      onClick={() => {
                        if(confirm('Are you sure?')) deleteBlog.mutate(blog.id);
                      }}
                      className="p-2 rounded-lg hover:bg-destructive/20 hover:text-destructive transition-all text-slate-500"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <span className="text-[10px] font-mono text-slate-600">
                    ID: {blog.id.substring(0, 8)}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Empty State */}
        {!isLoading && blogs?.length === 0 && (
          <div className="flex-1 flex flex-col items-center justify-center py-20 text-center">
            <div className="w-20 h-20 rounded-3xl bg-white/5 flex items-center justify-center text-slate-700 mb-6 border border-white/5">
              <Plus size={32} />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Build Your Blog Kingdom</h3>
            <p className="text-slate-500 max-w-sm mb-8">
              Start sharing insights and news with your readers. Every article you publish helps your SEO growth.
            </p>
            <Link to="/blogs/editor/new">
              <Button variant="accent" size="lg" className="rounded-xl px-12">
                Create First Article
              </Button>
            </Link>
          </div>
        )}
      </div>
    </AppShell>
  );
}
