import { useState, useEffect } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { 
  Plus, Search, Edit2, Trash2, Globe, TrendingUp, 
  Users, CheckCircle2, XCircle, AlertCircle,
  Type, AlignLeft, Image, Youtube, FileText, Layout
} from "lucide-react";
import { toast } from "sonner";

interface CaseStudy {
  id: string;
  slug: string;
  client: string;
  location: string;
  service: string;
  challenge: string;
  solution: string;
  results: any[];
  testimonial: string;
  color: string;
  is_published: boolean;
  content: any[];
  featured_image?: string;
}

const CaseStudiesAdmin = () => {
  const [activeTab, setActiveTab] = useState("essentials");
  const [studies, setStudies] = useState<CaseStudy[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<CaseStudy>>({
    client: "",
    slug: "",
    location: "",
    service: "",
    challenge: "",
    solution: "",
    testimonial: "",
    color: "accent",
    is_published: true,
    results: [],
    content: [],
    featured_image: "",
  });

  useEffect(() => {
    fetchStudies();
  }, []);

  const fetchStudies = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("case_studies")
      .select("*")
      .order("created_at", { ascending: false });

    if (data) setStudies(data);
    setLoading(false);
  };

  const handleSave = async () => {
    if (!formData.client || !formData.slug) {
      toast.error("Please fill in Client Name and Slug");
      return;
    }

    try {
      console.log("Attempting to save case study:", formData);
      if (editingId) {
        const { error } = await supabase
          .from("case_studies")
          .update(formData)
          .eq("id", editingId);
        if (error) throw error;
        toast.success("Case study updated");
      } else {
        const { error } = await supabase
          .from("case_studies")
          .insert([formData]);
        if (error) throw error;
        toast.success("Case study created");
      }
      setShowForm(false);
      setEditingId(null);
      fetchStudies();
    } catch (error: any) {
      console.error("Critical Save Error Detail:", {
        message: error.message,
        stack: error.stack,
        hint: error.hint,
        details: error.details,
        code: error.code,
        fullError: error
      });
      toast.error(error.message || "An unexpected connection error occurred");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure?")) return;
    const { error } = await supabase.from("case_studies").delete().eq("id", id);
    if (!error) {
      toast.success("Deleted successfully");
      fetchStudies();
    }
  };

  return (
    <AppShell title="Case Studies" subtitle="Manage your agency success stories">
      <div className="fade-up">
        {!showForm ? (
          <>
            <div className="flex justify-between items-center mb-6">
              <div className="relative w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4" />
                <input 
                  type="text" 
                  placeholder="Search case studies..." 
                  className="w-full bg-slate-900/50 border border-slate-800 rounded-xl py-2 pl-10 pr-4 text-sm focus:outline-none focus:border-accent"
                />
              </div>
              <Button onClick={() => {
                setFormData({ client: "", slug: "", location: "", service: "", challenge: "", solution: "", testimonial: "", color: "accent", is_published: true, results: [], content: [], featured_image: "" });
                setShowForm(true);
                setEditingId(null);
              }} variant="accent" className="gap-2">
                <Plus size={16} /> New Case Study
              </Button>
            </div>

            <div className="glass-card overflow-hidden">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-900/50">
                    <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Client</th>
                    <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Service</th>
                    <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {studies.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-800/30 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-white">{s.client}</div>
                        <div className="text-xs text-slate-500">{s.location}</div>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-400">{s.service}</td>
                      <td className="px-6 py-4">
                        {s.is_published ? (
                          <span className="flex items-center gap-1.5 text-xs text-emerald-400">
                            <CheckCircle2 size={14} /> Published
                          </span>
                        ) : (
                          <span className="flex items-center gap-1.5 text-xs text-slate-500">
                            <AlertCircle size={14} /> Draft
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <button 
                            onClick={() => {
                              setFormData(s);
                              setEditingId(s.id);
                              setShowForm(true);
                            }}
                            className="p-2 rounded-lg bg-slate-800 text-slate-400 hover:text-white transition-colors"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button 
                            onClick={() => handleDelete(s.id)}
                            className="p-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white transition-colors"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {studies.length === 0 && !loading && (
                    <tr>
                      <td colSpan={4} className="px-6 py-12 text-center text-slate-500">
                        No case studies found. Create your first one!
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl max-w-6xl mx-auto">
            <div className="flex flex-col md:flex-row min-h-[700px]">
              {/* Admin Sidebar Navigation */}
              <div className="w-full md:w-72 bg-slate-950 border-r border-slate-800 p-8 space-y-2">
                <div className="flex items-center gap-3 mb-10 pb-6 border-b border-slate-800/50">
                  <div className="w-10 h-10 rounded-xl bg-accent/20 flex items-center justify-center text-accent">
                    <Edit2 size={20} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white leading-none">Studio Editor</h3>
                    <p className="text-[10px] text-slate-500 mt-1 uppercase tracking-tighter">Primansh Case Studies</p>
                  </div>
                </div>

                {[
                  { id: 'essentials', label: 'Project Essentials', icon: Globe },
                  { id: 'narrative', label: 'The Narrative', icon: Type },
                  { id: 'results', label: 'Performance Metrics', icon: TrendingUp },
                  { id: 'testimonial', label: 'Client Validation', icon: Users }
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`w-full flex items-center gap-4 px-5 py-4 rounded-2xl text-sm font-medium transition-all duration-300 ${
                      activeTab === tab.id 
                      ? "bg-accent text-white shadow-xl shadow-accent/20 translate-x-1" 
                      : "text-slate-500 hover:bg-slate-900 hover:text-white"
                    }`}
                  >
                    <tab.icon size={18} />
                    {tab.label}
                  </button>
                ))}
                
                <div className="pt-12 space-y-4">
                  <Button 
                    onClick={handleSave} 
                    className="w-full h-14 rounded-2xl flex items-center justify-center gap-3 shadow-lg shadow-accent/20 group"
                    variant="accent"
                  >
                    <CheckCircle2 size={20} className="group-hover:scale-110 transition-transform" />
                    Publish Changes
                  </Button>
                  <Button 
                    onClick={() => setShowForm(false)} 
                    variant="outline" 
                    className="w-full h-14 rounded-2xl border-slate-800 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/50 transition-all font-bold uppercase tracking-widest text-[10px]"
                  >
                    Discard Draft
                  </Button>
                </div>
              </div>

              {/* Main Content Area */}
              <div className="flex-1 p-10 md:p-16 overflow-y-auto max-h-[85vh] custom-scrollbar bg-slate-900/50">

                {activeTab === 'essentials' && (
                  <div className="max-w-3xl space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <header>
                      <h2 className="text-3xl font-bold text-white mb-2">Project Essentials</h2>
                      <p className="text-slate-500">Define the core identity and brand presence for this success story.</p>
                    </header>
                    
                    <div className="grid md:grid-cols-2 gap-8">
                      <div className="space-y-3">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Client Name</label>
                        <input 
                          type="text" 
                          value={formData.client}
                          onChange={(e) => setFormData({...formData, client: e.target.value})}
                          className="w-full bg-slate-950/50 border border-slate-800 rounded-2xl p-4 text-sm focus:border-accent ring-accent/10 focus:ring-4 outline-none transition-all"
                          placeholder="e.g. Sharma & Associates"
                        />
                      </div>
                      <div className="space-y-3">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Target URL Slug</label>
                        <input 
                          type="text" 
                          value={formData.slug}
                          onChange={(e) => setFormData({...formData, slug: e.target.value.toLowerCase().replace(/ /g, "-")})}
                          className="w-full bg-slate-950/50 border border-slate-800 rounded-2xl p-4 text-sm focus:border-accent ring-accent/10 focus:ring-4 outline-none"
                          placeholder="sharma-associates"
                        />
                      </div>
                      <div className="space-y-3">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Project Location</label>
                        <input 
                          type="text" 
                          value={formData.location}
                          onChange={(e) => setFormData({...formData, location: e.target.value})}
                          className="w-full bg-slate-950/50 border border-slate-800 rounded-2xl p-4 text-sm focus:border-accent ring-accent/10 focus:ring-4 outline-none"
                          placeholder="Mumbai, Maharashtra"
                        />
                      </div>
                      <div className="space-y-3">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Service Vertical</label>
                        <input 
                          type="text" 
                          value={formData.service}
                          onChange={(e) => setFormData({...formData, service: e.target.value})}
                          className="w-full bg-slate-950/50 border border-slate-800 rounded-2xl p-4 text-sm focus:border-accent ring-accent/10 focus:ring-4 outline-none"
                          placeholder="e.g. Local SEO Growth"
                        />
                      </div>
                    </div>

                    <div className="space-y-4 pt-4">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Featured Cinematic Image URL</label>
                      <div className="relative group">
                        <input 
                          type="text" 
                          value={formData.featured_image}
                          onChange={(e) => setFormData({...formData, featured_image: e.target.value})}
                          className="w-full bg-slate-950/50 border border-slate-800 rounded-2xl p-4 text-sm focus:border-accent ring-accent/10 focus:ring-4 outline-none"
                          placeholder="https://images.unsplash.com/..."
                        />
                        {formData.featured_image && (
                          <div className="mt-6 rounded-3xl overflow-hidden border border-slate-800 h-64 bg-slate-950 relative group/preview shadow-2xl">
                            <img src={formData.featured_image} className="w-full h-full object-cover opacity-60 group-hover/preview:opacity-100 transition-opacity duration-700" alt="Preview" />
                            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 to-transparent opacity-60" />
                            <span className="absolute bottom-4 left-6 text-[10px] font-bold text-white uppercase tracking-widest">Hero Preview</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'narrative' && (
                  <div className="max-w-4xl space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <header>
                      <h2 className="text-3xl font-bold text-white mb-2">The Narrative Story</h2>
                      <p className="text-slate-500">Craft the story of your client's transformation.</p>
                    </header>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                      <div className="space-y-3">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center text-red-500 text-xs font-bold font-mono">01</div>
                          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">The Challenge</label>
                        </div>
                        <textarea 
                          rows={6}
                          value={formData.challenge}
                          onChange={(e) => setFormData({...formData, challenge: e.target.value})}
                          className="w-full bg-slate-950/50 border border-slate-800 rounded-2xl p-6 text-sm focus:border-red-500/50 ring-red-500/5 focus:ring-4 outline-none leading-relaxed"
                          placeholder="What was holding them back?"
                        />
                      </div>
                      <div className="space-y-3">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center text-accent text-xs font-bold font-mono">02</div>
                          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Our Strategic Solution</label>
                        </div>
                        <textarea 
                          rows={6}
                          value={formData.solution}
                          onChange={(e) => setFormData({...formData, solution: e.target.value})}
                          className="w-full bg-slate-950/50 border border-slate-800 rounded-2xl p-6 text-sm focus:border-accent/50 ring-accent/5 focus:ring-4 outline-none leading-relaxed"
                          placeholder="How did Primansh deliver the breakthrough?"
                        />
                      </div>
                    </div>

                    <div className="pt-12 border-t border-slate-800">
                      <div className="flex items-center justify-between mb-10">
                        <div>
                          <h3 className="text-xl font-bold text-white mb-1">Storyboard Additions</h3>
                          <p className="text-xs text-slate-500 uppercase tracking-wider font-mono">// Enhance the narrative with media blocks</p>
                        </div>
                        <div className="flex flex-wrap gap-2 p-2 bg-slate-950/50 rounded-2xl border border-slate-800/50">
                          {[
                            { type: 'heading', label: 'Section', icon: Type },
                            { type: 'image', label: 'Shoot', icon: Image },
                            { type: 'gallery', label: 'Showcase', icon: Layout },
                            { type: 'video', label: 'Cinema', icon: Youtube }
                          ].map((btn) => (
                            <Button 
                              key={btn.type}
                              onClick={() => setFormData({
                                ...formData,
                                content: [...(formData.content || []), { 
                                  type: btn.type, 
                                  data: btn.type === 'heading' ? { text: "", level: 2 } 
                                        : btn.type === 'gallery' ? { images: [""] }
                                        : { url: "", caption: "", title: "" } 
                                }]
                              })}
                              variant="outline" 
                              size="sm" 
                              className="h-10 px-4 rounded-xl bg-slate-900 border-slate-800 hover:border-accent hover:text-accent font-bold uppercase tracking-tighter text-[10px] gap-2"
                            >
                              <btn.icon size={14} />
                              {btn.label}
                            </Button>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-6">
                        {(formData.content || []).map((block, idx) => (
                          <div key={idx} className="group relative p-8 bg-slate-950 border border-slate-800 rounded-3xl transition-all hover:border-accent/30 hover:bg-slate-950/80">
                            <div className="absolute -right-4 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 flex flex-col gap-2 transition-all z-20">
                              <button 
                                onClick={() => {
                                  if (idx === 0) return;
                                  const newContent = [...(formData.content || [])];
                                  [newContent[idx], newContent[idx-1]] = [newContent[idx-1], newContent[idx]];
                                  setFormData({...formData, content: newContent});
                                }}
                                className="bg-slate-800 w-10 h-10 flex items-center justify-center rounded-xl hover:bg-accent text-white shadow-xl"
                              >
                                <Plus className="rotate-45" size={16} />
                              </button>
                              <button 
                                onClick={() => {
                                  const newContent = (formData.content || []).filter((_, i) => i !== idx);
                                  setFormData({...formData, content: newContent});
                                }}
                                className="bg-red-500/20 w-10 h-10 flex items-center justify-center rounded-xl hover:bg-red-500 text-white shadow-xl"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>

                            <div className="flex items-center gap-3 mb-6">
                              <div className="w-2 h-2 rounded-full bg-accent animate-pulse" />
                              <span className="text-[10px] font-bold text-accent uppercase tracking-[0.2em]">{block.type}</span>
                            </div>

                            {block.type === 'heading' && (
                              <input 
                                type="text"
                                value={block.data.text}
                                onChange={(e) => {
                                  const newContent = [...(formData.content || [])];
                                  newContent[idx].data.text = e.target.value;
                                  setFormData({...formData, content: newContent});
                                }}
                                placeholder="Sub-section heading..."
                                className="w-full bg-slate-900 border border-slate-800 rounded-2xl p-5 text-lg font-bold outline-none border-none ring-accent/10 focus:ring-4"
                              />
                            )}

                            {block.type === 'image' && (
                              <div className="space-y-4">
                                <input 
                                  type="text"
                                  value={block.data.url}
                                  onChange={(e) => {
                                    const newContent = [...(formData.content || [])];
                                    newContent[idx].data.url = e.target.value;
                                    setFormData({...formData, content: newContent});
                                  }}
                                  placeholder="Full-width shoot URL..."
                                  className="w-full bg-slate-900 border border-slate-800 rounded-2xl p-5 text-xs font-mono"
                                />
                                {block.data.url && (
                                  <div className="rounded-2xl overflow-hidden h-32 opacity-40 hover:opacity-100 transition-opacity">
                                    <img src={block.data.url} className="w-full h-full object-cover" alt="" />
                                  </div>
                                )}
                              </div>
                            )}

                            {block.type === 'gallery' && (
                              <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-3">
                                  {(block.data.images || []).map((imgUrl: string, imgIdx: number) => (
                                    <div key={imgIdx} className="relative group/img">
                                      <input 
                                        type="text"
                                        value={imgUrl}
                                        onChange={(e) => {
                                          const newContent = [...(formData.content || [])];
                                          newContent[idx].data.images[imgIdx] = e.target.value;
                                          setFormData({...formData, content: newContent});
                                        }}
                                        placeholder="Image URL..."
                                        className="w-full bg-slate-900 border border-slate-800 rounded-xl p-4 text-[10px] font-mono"
                                      />
                                      <button 
                                        onClick={() => {
                                          const newContent = [...(formData.content || [])];
                                          newContent[idx].data.images = newContent[idx].data.images.filter((_: any, i: number) => i !== imgIdx);
                                          setFormData({...formData, content: newContent});
                                        }}
                                        className="absolute -right-2 -top-2 bg-red-500 w-5 h-5 rounded-full flex items-center justify-center text-white text-[8px] opacity-0 group-hover/img:opacity-100 transition-all shadow-lg"
                                      >
                                        <Plus className="rotate-45" size={10} />
                                      </button>
                                    </div>
                                  ))}
                                  <button 
                                    onClick={() => {
                                      const newContent = [...(formData.content || [])];
                                      newContent[idx].data.images.push("");
                                      setFormData({...formData, content: newContent});
                                    }}
                                    className="h-12 border-2 border-dashed border-slate-800 rounded-xl flex items-center justify-center text-[10px] font-bold text-slate-500 hover:border-accent hover:text-accent hover:bg-accent/5 transition-all uppercase tracking-widest"
                                  >
                                    + Insert Frame
                                  </button>
                                </div>
                              </div>
                            )}

                            {block.type === 'video' && (
                               <input 
                               type="text"
                               value={block.data.url}
                               onChange={(e) => {
                                 const newContent = [...(formData.content || [])];
                                 newContent[idx].data.url = e.target.value;
                                 setFormData({...formData, content: newContent});
                               }}
                               placeholder="YouTube / Vimeo URL..."
                               className="w-full bg-slate-900 border border-slate-800 rounded-2xl p-5 text-sm font-mono"
                             />
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
                {(!formData.content || formData.content.length === 0) && (
                  <div className="border-2 border-dashed border-slate-800 rounded-3xl py-12 text-center">
                    <p className="text-slate-500 text-sm">No blocks added yet. Use the storyboard buttons above to start building the story.</p>
                  </div>
                )}
                {activeTab === 'results' && (
                  <div className="max-w-4xl space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <header>
                      <h2 className="text-3xl font-bold text-white mb-2">Performance & Impact</h2>
                      <p className="text-slate-500">Document the statistical data that defines the project's success.</p>
                    </header>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {formData.results.map((result: any, idx: number) => (
                        <div key={idx} className="p-8 bg-slate-950 border border-slate-800 rounded-3xl relative group shadow-lg">
                          <button 
                            onClick={() => {
                              const newResults = formData.results.filter((_: any, i: number) => i !== idx);
                              setFormData({...formData, results: newResults});
                            }}
                            className="absolute -right-3 -top-3 bg-red-500 text-white w-8 h-8 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all shadow-xl z-10"
                          >
                            <Trash2 size={14} />
                          </button>
                          
                          <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-6 ${formData.color === 'accent' ? 'bg-accent/10 text-accent' : 'bg-hot/10 text-hot'}`}>
                            {result.icon === 'trending-up' ? <TrendingUp size={24} /> : 
                             result.icon === 'users' ? <Users size={24} /> : 
                             result.icon === 'globe' ? <Globe size={24} /> : <Search size={24} />}
                          </div>

                          <div className="space-y-4">
                            <input 
                              value={result.value}
                              onChange={(e) => {
                                const newResults = [...formData.results];
                                newResults[idx].value = e.target.value;
                                setFormData({...formData, results: newResults});
                              }}
                              placeholder="Value (+300%)"
                              className="w-full bg-transparent border-none text-3xl font-bold text-white outline-none"
                            />
                            <input 
                              value={result.metric}
                              onChange={(e) => {
                                const newResults = [...formData.results];
                                newResults[idx].metric = e.target.value;
                                setFormData({...formData, results: newResults});
                              }}
                              placeholder="Metric Type"
                              className="w-full bg-transparent border-none text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] outline-none"
                            />
                          </div>

                          <select 
                            value={result.icon}
                            onChange={(e) => {
                              const newResults = [...formData.results];
                              newResults[idx].icon = e.target.value;
                              setFormData({...formData, results: newResults});
                            }}
                            className="w-full mt-6 bg-slate-900 border border-slate-800 rounded-xl p-3 text-[10px] font-bold uppercase text-slate-400"
                          >
                            <option value="trending-up">Growth Icon</option>
                            <option value="users">People Icon</option>
                            <option value="globe">Global Icon</option>
                            <option value="search">Search Icon</option>
                          </select>
                        </div>
                      ))}
                      <button 
                        onClick={() => setFormData({...formData, results: [...formData.results, { metric: "", value: "", icon: "trending-up" }]})}
                        className="h-full min-h-[220px] border-2 border-dashed border-slate-800 rounded-3xl flex flex-col items-center justify-center text-slate-500 hover:border-accent hover:text-accent hover:bg-accent/5 transition-all gap-4 group"
                      >
                        <div className="w-14 h-14 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center group-hover:scale-110 transition-transform">
                          <Plus size={32} />
                        </div>
                        <span className="text-[10px] font-bold uppercase tracking-widest">Append Metric</span>
                      </button>
                    </div>
                  </div>
                )}

                {activeTab === 'testimonial' && (
                  <div className="max-w-4xl space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <header>
                      <h2 className="text-3xl font-bold text-white mb-2">Social Validation</h2>
                      <p className="text-slate-500">Add the authoritative endorsement from your client.</p>
                    </header>

                    <div className="space-y-10">
                      <div className="space-y-4">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">The Statement</label>
                        <div className="relative">
                          <textarea 
                            rows={8}
                            value={formData.testimonial}
                            onChange={(e) => setFormData({...formData, testimonial: e.target.value})}
                            className="w-full bg-slate-950/50 border border-slate-800 rounded-3xl p-10 text-xl italic font-serif text-slate-300 focus:border-accent ring-accent/5 focus:ring-4 outline-none leading-relaxed shadow-inner"
                            placeholder="What did they say about the results?"
                          />
                          <div className="absolute top-8 left-4 text-accent/20 font-serif text-6xl">"</div>
                        </div>
                      </div>
                      
                      <div className="p-8 bg-slate-950/30 border border-slate-800 rounded-3xl border-dashed">
                        <div className="flex items-center gap-4 mb-8">
                          <div className="w-1 h-8 bg-accent rounded-full" />
                          <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">Visual Brand Experience</h4>
                        </div>
                        <div className="grid grid-cols-2 gap-6">
                          <button 
                            type="button"
                            onClick={() => setFormData({...formData, color: 'accent'})}
                            className={`p-6 rounded-2xl flex flex-col items-center justify-center gap-3 transition-all duration-500 ${formData.color === 'accent' ? 'bg-accent/10 border-accent/40 border-2 text-accent shadow-xl shadow-accent/10' : 'bg-slate-950/50 text-slate-500 border border-slate-800 hover:border-slate-700'}`}
                          >
                            <div className="w-10 h-10 rounded-full bg-accent shadow-lg shadow-accent/30" />
                            <span className="text-[10px] font-bold uppercase tracking-widest">Primansh Blue</span>
                          </button>
                          <button 
                            type="button"
                            onClick={() => setFormData({...formData, color: 'hot'})}
                            className={`p-6 rounded-2xl flex flex-col items-center justify-center gap-3 transition-all duration-500 ${formData.color === 'hot' ? 'bg-hot/10 border-hot/40 border-2 text-hot shadow-xl shadow-hot/10' : 'bg-slate-950/50 text-slate-500 border border-slate-800 hover:border-slate-700'}`}
                          >
                            <div className="w-10 h-10 rounded-full bg-hot shadow-lg shadow-hot/30" />
                            <span className="text-[10px] font-bold uppercase tracking-widest">Lava Glow</span>
                          </button>
                        </div>

                        <div className="mt-10 flex items-center justify-between p-6 bg-slate-950 rounded-2xl border border-slate-800">
                          <div className="flex items-center gap-3">
                            <input 
                              type="checkbox" 
                              checked={formData.is_published}
                              onChange={(e) => setFormData({...formData, is_published: e.target.checked})}
                              className="w-5 h-5 rounded-lg bg-slate-900 border-slate-800 text-accent transition-all ring-accent/10 focus:ring-4"
                            />
                            <span className="text-xs font-bold text-white uppercase tracking-widest">Live Status</span>
                          </div>
                          <p className="text-[10px] text-slate-500 uppercase tracking-tighter">Setting this to 'Live' makes the case study public instantly.</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
};

export default CaseStudiesAdmin;
