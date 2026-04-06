import { AppShell } from "@/components/layout/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from '@supabase/supabase-js';
import { motion } from "framer-motion";
import { 
  ArrowLeft, Save, Globe, Image as ImageIcon, Search, 
  Settings, HelpCircle, Layout, Chrome, Hash, 
  CheckCircle2, Loader2, PlayCircle, Plus, Trash2,
  Table as TableIcon, MoveRight, Link as LinkIcon,
  Heading1, Heading2, Heading3, Type, Eye, Edit3, Upload,
  MoreVertical, ChevronUp, ChevronDown, PlusCircle, AlignLeft, AlignCenter, AlignRight,
  Maximize2, List, Quote, Minus, Square,
} from "lucide-react";
import * as React from "react";
import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { 
  Popover, PopoverContent, PopoverTrigger 
} from "@/components/ui/popover";
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, 
  DialogFooter, DialogTrigger, DialogDescription 
} from "@/components/ui/dialog";
import TiptapEditor from "@/components/blog/TiptapEditor";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import ReactMarkdown from "react-markdown";

export default function BlogEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isNew = id === 'new';
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [activeTab, setActiveTab] = useState<'content' | 'seo' | 'faqs'>('content');
  const [formData, setFormData] = useState<any>({
    title: '',
    slug: '',
    category: 'SEO Tips',
    author: 'Primansh Team',
    excerpt: '',
    content: '',
    featured_image: '',
    meta_title: '',
    meta_description: '',
    keywords: [],
    faqs: [],
    content_blocks: [],
    published: false
  });

  const [newKeyword, setNewKeyword] = useState("");
  const [editorMode, setEditorMode] = useState<'write' | 'preview'>('write');
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inlineFileInputRef = useRef<HTMLInputElement>(null);

  // Fetch Existing Blog
  const { data: blog, isLoading } = useQuery({
    queryKey: ['blog', id],
    queryFn: async () => {
      if (isNew) return null;
      const { data, error } = await supabase
        .from('blogs')
        .select('*')
        .eq('id', id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !isNew
  });

  useEffect(() => {
    if (blog) setFormData(blog);
  }, [blog]);

  // Save Mutation
  const saveBlog = useMutation({
    mutationFn: async (data: any) => {
      const { error } = await supabase
        .from('blogs')
        .upsert(data);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blogs'] });
      toast.success(isNew ? "Article launched! 🚀" : "Article updated. ✨");
      navigate('/blogs');
    },
    onError: (error: any) => {
      toast.error(`Save failed: ${error.message}`);
    }
  });

  const handleSave = () => {
    if (!formData.title || !formData.slug) {
      toast.error("Title and Slug are mandatory.");
      return;
    }
    saveBlog.mutate(formData);
  };

  const addFAQ = () => {
    setFormData({
      ...formData,
      faqs: [...formData.faqs, { question: '', answer: '' }]
    });
  };

  const updateFAQ = (index: number, field: string, value: string) => {
    const freshFAQs = [...formData.faqs];
    freshFAQs[index][field] = value;
    setFormData({...formData, faqs: freshFAQs});
  };

  const removeFAQ = (index: number) => {
    setFormData({
      ...formData,
      faqs: formData.faqs.filter((_: any, i: number) => i !== index)
    });
  };

  const addKeyword = () => {
    if (newKeyword && !formData.keywords.includes(newKeyword)) {
      setFormData({
        ...formData,
        keywords: [...formData.keywords, newKeyword]
      });
      setNewKeyword("");
    }
  };

  const removeKeyword = (kw: string) => {
    setFormData({
      ...formData,
      keywords: formData.keywords.filter((k: string) => k !== kw)
    });
  };

  const insertText = (before: string, after: string = '') => {
    if (!textareaRef.current) return;
    const textarea = textareaRef.current;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    const selection = text.substring(start, end);
    
    const newText = text.substring(0, start) + before + selection + after + text.substring(end);
    setFormData({ ...formData, content: newText });
    
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + before.length, end + before.length);
    }, 0);
  };

  const uploadImage = async (file: File) => {
    try {
      setIsUploading(true);
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `blog-assets/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('blog-images')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('blog-images')
        .getPublicUrl(filePath);

      return publicUrl;
    } catch (error: any) {
      toast.error(`Upload failed: ${error.message}`);
      return null;
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>, target: 'featured' | 'inline') => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setIsUploading(true);
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `blog-assets/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('blog-images')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('blog-images')
        .getPublicUrl(filePath);

      if (target === 'featured') {
        setFormData({ ...formData, featured_image: publicUrl });
        toast.success("Featured image uploaded! 🖼️");
      } else {
        insertText(`![${file.name}](${publicUrl})`, '');
        toast.success("Image inserted into article! 📝");
      }
    } catch (error: any) {
      toast.error(`Upload failed: ${error.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  const addBlock = (type: string, index: number = formData.content_blocks.length) => {
    const newBlock: any = {
      id: Math.random().toString(36).substring(2),
      type,
      content: '',
      fontSize: type === 'heading' ? '2.5rem' : '1.125rem',
      textAlign: 'left',
      fontWeight: type === 'heading' ? '700' : '400',
      textTransform: 'none',
      lineHeight: '1.4',
      letterSpacing: '0',
      color: 'inherit'
    };
    
    if (type === 'heading') newBlock.level = 2; // Default to H2 for SEO
    if (type === 'image') { newBlock.url = ''; newBlock.caption = ''; }
    if (type === 'spacer') newBlock.height = '40px';
    if (type === 'button') { newBlock.text = 'Click Me'; newBlock.url = '#'; newBlock.variant = 'accent'; }
    if (type === 'quote') { newBlock.content = 'Inspirational quote...'; newBlock.fontSize = '1.5rem'; }
    if (type === 'divider') { newBlock.height = '1px'; newBlock.color = 'rgba(255,255,255,0.1)'; }

    const newBlocks = [...formData.content_blocks];
    newBlocks.splice(index, 0, newBlock);
    setFormData({ ...formData, content_blocks: newBlocks });
    toast.success(`${type.charAt(0).toUpperCase() + type.slice(1)} block added!`);
  };

  const removeBlock = (id: string) => {
    setFormData({
      ...formData,
      content_blocks: formData.content_blocks.filter((b: any) => b.id !== id)
    });
  };

  const moveBlock = (index: number, direction: 'up' | 'down') => {
    const newBlocks = [...formData.content_blocks];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newBlocks.length) return;
    
    [newBlocks[index], newBlocks[targetIndex]] = [newBlocks[targetIndex], newBlocks[index]];
    setFormData({ ...formData, content_blocks: newBlocks });
  };

  const updateBlock = (id: string, updates: any) => {
    setFormData({
      ...formData,
      content_blocks: formData.content_blocks.map((b: any) => 
        b.id === id ? { ...b, ...updates } : b
      )
    });
  };

  if (isLoading && !isNew) return <div className="h-screen flex items-center justify-center bg-slate-950"><Loader2 className="animate-spin text-accent" size={32} /></div>;

  return (
    <AppShell title={isNew ? "Draft New Insight" : "Refine Insight"} subtitle="Advanced Blog CMS & SEO Engine">
      <div className="fade-up h-full flex flex-col">
        {/* Header Actions */}
        <div className="flex items-center justify-between mb-8">
          <Link to="/blogs">
            <Button variant="ghost" size="sm" className="text-slate-500 hover:text-white">
              <ArrowLeft size={16} className="mr-2" /> Back to List
            </Button>
          </Link>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 mr-6 px-4 py-2 rounded-xl bg-white/5 border border-white/5">
              <Label className="text-xs text-slate-400">Live Status</Label>
              <Switch 
                checked={formData.published} 
                onCheckedChange={(val) => setFormData({...formData, published: val})} 
              />
              <span className={`text-[10px] font-bold uppercase tracking-widest ${formData.published ? 'text-green-400' : 'text-slate-600'}`}>
                {formData.published ? 'Public' : 'Hidden'}
              </span>
            </div>
            <Button variant="accent" size="lg" className="rounded-xl px-8 shadow-glow" onClick={handleSave} disabled={saveBlog.isPending}>
              {saveBlog.isPending ? <Loader2 className="animate-spin mr-2" size={18} /> : <Save size={18} className="mr-2" />}
              Publish Updates
            </Button>
          </div>
        </div>

        <div className="flex gap-8 flex-1">
          {/* Main Form Area */}
          <div className="flex-1 space-y-8">
            {/* Navigation Tabs */}
            <div className="flex gap-2 p-1 bg-white/5 rounded-2xl w-fit border border-white/5">
              {[
                { id: 'content', label: 'Rich Content', icon: Layout },
                { id: 'seo', label: 'SEO Engine', icon: Search },
                { id: 'faqs', label: 'FAQ Builder', icon: HelpCircle }
              ].map((tab: any) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${activeTab === tab.id ? 'bg-accent text-white shadow-lg' : 'text-slate-500 hover:text-white hover:bg-white/5'}`}
                >
                  <tab.icon size={14} />
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="glass-card p-10 space-y-8">
              {activeTab === 'content' && (
                <>
                  <div className="grid grid-cols-2 gap-8">
                    <div className="space-y-2">
                       <label className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest ml-1">Article Title</label>
                       <Input 
                         value={formData.title}
                         onChange={(e) => setFormData({...formData, title: e.target.value})}
                         className="h-14 bg-white/5 border-white/10 rounded-2xl focus:border-accent text-lg font-bold"
                         placeholder="e.g. How to scale your CA practice..." 
                       />
                    </div>
                    <div className="space-y-2">
                       <label className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest ml-1">URL Slug</label>
                       <div className="relative group">
                          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 text-sm">/blog/</span>
                          <Input 
                            value={formData.slug}
                            onChange={(e) => setFormData({...formData, slug: e.target.value})}
                            className="h-14 bg-white/5 border-white/10 rounded-2xl pl-16 focus:border-accent text-sm"
                            placeholder="url-friendly-slug" 
                          />
                       </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-8">
                     <div className="space-y-2">
                        <label className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest ml-1">Category</label>
                        <Input 
                          value={formData.category}
                          onChange={(e) => setFormData({...formData, category: e.target.value})}
                          className="h-12 bg-white/5 border-white/10 rounded-xl focus:border-accent text-sm"
                        />
                     </div>
                     <div className="space-y-2">
                        <label className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest ml-1">Author</label>
                        <Input 
                          value={formData.author}
                          onChange={(e) => setFormData({...formData, author: e.target.value})}
                          className="h-12 bg-white/5 border-white/10 rounded-xl focus:border-accent text-sm"
                        />
                     </div>
                      <div className="space-y-2">
                        <label className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest ml-1">Featured Image</label>
                        <div className="flex gap-4">
                          <div className="relative group flex-1">
                            <ImageIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600" size={16} />
                            <Input 
                              value={formData.featured_image}
                              onChange={(e) => setFormData({...formData, featured_image: e.target.value})}
                              className="h-12 bg-white/5 border-white/10 rounded-xl pl-12 focus:border-accent text-xs"
                              placeholder="Upload or paste image URL..." 
                            />
                          </div>
                          <input 
                            type="file" 
                            ref={fileInputRef} 
                            className="hidden" 
                            accept="image/*" 
                            onChange={(e) => handleFileUpload(e, 'featured')} 
                          />
                          <Button 
                            variant="secondary" 
                            className="h-12 rounded-xl px-6 bg-white/5 hover:bg-white/10 border border-white/10"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isUploading}
                          >
                            {isUploading ? <Loader2 className="animate-spin" size={16} /> : <Upload size={16} className="mr-2" />}
                            Upload
                          </Button>
                        </div>
                      </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest ml-1">Excerpt (Snippet)</label>
                    <Textarea 
                      value={formData.excerpt}
                      onChange={(e) => setFormData({...formData, excerpt: e.target.value})}
                      className="h-24 bg-white/5 border-white/10 rounded-2xl focus:border-accent text-sm p-4"
                      placeholder="Brief summary for social and list views..."
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between ml-1 mb-8">
                      <div className="flex items-center gap-6">
                        <label className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">Modular Content Blocks</label>
                        <div className="flex p-0.5 bg-white/5 rounded-lg border border-white/5">
                          <button 
                            onClick={() => setEditorMode('write')}
                            className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all ${editorMode === 'write' ? 'bg-accent text-white' : 'text-slate-500 hover:text-white'}`}
                          >
                            <Edit3 size={12} /> Design
                          </button>
                          <button 
                            onClick={() => setEditorMode('preview')}
                            className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all ${editorMode === 'preview' ? 'bg-accent text-white' : 'text-slate-500 hover:text-white'}`}
                          >
                            <Eye size={12} /> Preview
                          </button>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                         <span className="text-[10px] text-slate-600 font-bold uppercase tracking-tighter mr-2">Quick Insert:</span>
                         <Button variant="ghost" size="sm" onClick={() => addBlock('heading')} className="h-8 w-8 p-0 rounded-lg hover:bg-white/10 text-slate-400" title="Add Heading"><Heading1 size={14} /></Button>
                         <Button variant="ghost" size="sm" onClick={() => addBlock('text')} className="h-8 w-8 p-0 rounded-lg hover:bg-white/10 text-slate-400" title="Add Text"><Type size={14} /></Button>
                         <Button variant="ghost" size="sm" onClick={() => addBlock('image')} className="h-8 w-8 p-0 rounded-lg hover:bg-white/10 text-slate-400" title="Add Image"><ImageIcon size={14} /></Button>
                         <Button variant="ghost" size="sm" onClick={() => addBlock('button')} className="h-8 w-8 p-0 rounded-lg hover:bg-white/10 text-slate-400" title="Add Button"><Square size={14} /></Button>
                         <Button variant="ghost" size="sm" onClick={() => addBlock('quote')} className="h-8 w-8 p-0 rounded-lg hover:bg-white/10 text-slate-400" title="Add Quote"><Quote size={14} /></Button>
                         <Button variant="ghost" size="sm" onClick={() => addBlock('divider')} className="h-8 w-8 p-0 rounded-lg hover:bg-white/10 text-slate-400" title="Add Divider"><Minus size={14} /></Button>
                      </div>
                    </div>

                    {editorMode === 'write' ? (
                      <div className="space-y-6">
                        {formData.content_blocks.map((block: any, index: number) => (
                          <div key={block.id} className="group relative">
                            {/* Block Controls */}
                            <div className="absolute -left-12 top-0 bottom-0 flex flex-col items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity pt-2">
                               <button onClick={() => moveBlock(index, 'up')} className="p-1 text-slate-600 hover:text-white bg-white/5 rounded"><ChevronUp size={14}/></button>
                               <button onClick={() => moveBlock(index, 'down')} className="p-1 text-slate-600 hover:text-white bg-white/5 rounded"><ChevronDown size={14}/></button>
                               <button onClick={() => removeBlock(block.id)} className="p-1 text-slate-600 hover:text-destructive bg-white/5 rounded mt-auto mb-2"><Trash2 size={14}/></button>
                            </div>

                            <div className="glass-card p-6 border-white/5 hover:border-accent/30 transition-all bg-white/[0.01]">
                               <div className="flex items-center justify-between mb-4 pb-2 border-b border-white/5">
                                  <span className="text-[10px] font-bold text-slate-600 uppercase tracking-[0.2em]">{block.type}</span>
                                  
                                  <div className="flex items-center gap-4">
                                     {block.type === 'heading' && (
                                       <select 
                                         value={block.level} 
                                         onChange={(e) => updateBlock(block.id, { level: parseInt(e.target.value) })}
                                         className="bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-[10px] font-bold text-accent uppercase tracking-tighter cursor-pointer hover:bg-white/10"
                                       >
                                         {[1,2,3,4,5,6].map(l => <option key={l} value={l}>H{l}</option>)}
                                       </select>
                                     )}
                                     
                                     {['text', 'heading', 'quote'].includes(block.type) && (
                                       <Input 
                                         value={block.fontSize} 
                                         onChange={(e) => updateBlock(block.id, { fontSize: e.target.value })}
                                         className="h-7 w-20 bg-white/5 border-white/10 text-[10px] text-center font-bold"
                                         placeholder="Size (2rem)"
                                       />
                                     )}

                                     <Popover>
                                        <PopoverTrigger asChild>
                                          <button className="text-slate-600 hover:text-white transition-colors p-1.5 hover:bg-white/5 rounded-lg">
                                            <Settings size={14}/>
                                          </button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-64 bg-slate-900 border-white/10 p-5 rounded-3xl shadow-2xl glass-premium">
                                           <div className="space-y-6">
                                              <div className="flex items-center justify-between border-b border-white/5 pb-2">
                                                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Typography Widget</p>
                                                <span className="text-[10px] text-accent font-bold uppercase">{block.type}</span>
                                              </div>
                                              
                                              <div className="space-y-4">
                                                <div className="space-y-2">
                                                  <label className="text-[9px] text-slate-500 uppercase font-bold">Alignment</label>
                                                  <div className="flex gap-1.5 p-1 bg-black/20 rounded-xl">
                                                    <button onClick={() => updateBlock(block.id, { textAlign: 'left' })} className={`flex-1 flex justify-center p-2 rounded-lg transition-all ${block.textAlign === 'left' ? 'bg-accent text-white shadow-glow' : 'text-slate-500 hover:text-white'}`}><AlignLeft size={12}/></button>
                                                    <button onClick={() => updateBlock(block.id, { textAlign: 'center' })} className={`flex-1 flex justify-center p-2 rounded-lg transition-all ${block.textAlign === 'center' ? 'bg-accent text-white shadow-glow' : 'text-slate-500 hover:text-white'}`}><AlignCenter size={12}/></button>
                                                    <button onClick={() => updateBlock(block.id, { textAlign: 'right' })} className={`flex-1 flex justify-center p-2 rounded-lg transition-all ${block.textAlign === 'right' ? 'bg-accent text-white shadow-glow' : 'text-slate-500 hover:text-white'}`}><AlignRight size={12}/></button>
                                                  </div>
                                                </div>

                                                <div className="grid grid-cols-2 gap-4">
                                                  <div className="space-y-1.5">
                                                    <label className="text-[9px] text-slate-500 uppercase font-bold">Weight</label>
                                                    <select 
                                                      value={block.fontWeight || '400'} 
                                                      onChange={(e) => updateBlock(block.id, { fontWeight: e.target.value })}
                                                      className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-[10px] text-white"
                                                    >
                                                      <option value="300">Light</option>
                                                      <option value="400">Normal</option>
                                                      <option value="500">Medium</option>
                                                      <option value="600">Semi Bold</option>
                                                      <option value="700">Bold</option>
                                                      <option value="800">Extra Bold</option>
                                                    </select>
                                                  </div>
                                                  <div className="space-y-1.5">
                                                    <label className="text-[9px] text-slate-500 uppercase font-bold">Transform</label>
                                                    <select 
                                                      value={block.textTransform || 'none'} 
                                                      onChange={(e) => updateBlock(block.id, { textTransform: e.target.value })}
                                                      className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-[10px] text-white"
                                                    >
                                                      <option value="none">None</option>
                                                      <option value="capitalize">Capitalize</option>
                                                      <option value="uppercase">Uppercase</option>
                                                      <option value="lowercase">Lowercase</option>
                                                    </select>
                                                  </div>
                                                </div>

                                                <div className="space-y-1.5">
                                                  <label className="text-[9px] text-slate-500 uppercase font-bold flex justify-between">
                                                    Line Height <span>{block.lineHeight || '1.4'}</span>
                                                  </label>
                                                  <Input 
                                                    type="range" min="0.8" max="2.5" step="0.1"
                                                    value={block.lineHeight || 1.4} 
                                                    onChange={(e) => updateBlock(block.id, { lineHeight: e.target.value })}
                                                    className="h-1.5 appearance-none bg-white/10 rounded-lg overflow-hidden accent-accent p-0 cursor-pointer"
                                                  />
                                                </div>

                                                <div className="space-y-1.5">
                                                  <label className="text-[9px] text-slate-500 uppercase font-bold flex justify-between">
                                                    Letter Spacing <span>{block.letterSpacing || '0'}px</span>
                                                  </label>
                                                  <Input 
                                                    type="range" min="-2" max="10" step="0.5"
                                                    value={block.letterSpacing || 0} 
                                                    onChange={(e) => updateBlock(block.id, { letterSpacing: e.target.value })}
                                                    className="h-1.5 appearance-none bg-white/10 rounded-lg overflow-hidden accent-accent p-0 cursor-pointer"
                                                  />
                                                </div>
                                              </div>
                                           </div>
                                        </PopoverContent>
                                     </Popover>
                                  </div>
                               </div>

                               {/* Block Editor UI */}
                               {block.type === 'heading' && (
                                 <textarea 
                                   value={block.content}
                                   onChange={(e) => updateBlock(block.id, { content: e.target.value })}
                                   placeholder="Widget Heading..."
                                   style={{ 
                                     fontSize: block.fontSize, 
                                     textAlign: block.textAlign as any,
                                     fontWeight: block.fontWeight as any,
                                     textTransform: block.textTransform as any,
                                     lineHeight: block.lineHeight,
                                     letterSpacing: `${block.letterSpacing}px`
                                   }}
                                   className="w-full bg-transparent border-none outline-none text-white transition-all resize-none min-h-[50px] custom-scrollbar focus:ring-0"
                                 />
                               )}

                               {block.type === 'text' && (
                                 <TiptapEditor 
                                   content={block.content}
                                   onChange={(html) => updateBlock(block.id, { content: html })}
                                   style={{ 
                                     fontSize: block.fontSize, 
                                     textAlign: block.textAlign as any,
                                     fontWeight: block.fontWeight as any,
                                     textTransform: block.textTransform as any,
                                     lineHeight: block.lineHeight,
                                     letterSpacing: `${block.letterSpacing}px`
                                   }}
                                 />
                               )}

                               {block.type === 'image' && (
                                 <div className="space-y-4">
                                    <div className="flex gap-4 items-end">
                                       <div className="flex-1 space-y-2">
                                          <label className="text-[10px] text-slate-600 font-bold uppercase tracking-widest">Image URL</label>
                                          <Input value={block.url} onChange={(e) => updateBlock(block.id, { url: e.target.value })} className="bg-white/5 border-white/5 text-xs h-10" />
                                       </div>
                                       <input type="file" ref={inlineFileInputRef} className="hidden" accept="image/*" onChangeCapture={async (e) => {
                                          const file = (e.currentTarget as HTMLInputElement).files?.[0];
                                          if (file) {
                                            const url = await uploadImage(file);
                                            if (url) updateBlock(block.id, { url });
                                          }
                                       }} />
                                       <Button size="sm" variant="secondary" onClick={() => inlineFileInputRef.current?.click()} className="bg-white/5 border-white/5 h-10 px-4">Upload</Button>
                                    </div>
                                    {block.url && <div className="rounded-2xl overflow-hidden border border-white/10 mt-4 max-h-[300px] flex items-center justify-center bg-black/50">
                                      <img src={block.url} className="w-full h-full object-cover" alt="Preview"/>
                                    </div>}
                                 </div>
                               )}

                               {block.type === 'button' && (
                                 <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                       <label className="text-[10px] text-slate-600 font-bold uppercase tracking-widest">Button Text</label>
                                       <Input value={block.text} onChange={(e) => updateBlock(block.id, { text: e.target.value })} className="bg-white/5 border-white/5 text-xs" />
                                    </div>
                                    <div className="space-y-2">
                                       <label className="text-[10px] text-slate-600 font-bold uppercase tracking-widest">Link (URL)</label>
                                       <Input value={block.url} onChange={(e) => updateBlock(block.id, { url: e.target.value })} className="bg-white/5 border-white/5 text-xs" />
                                    </div>
                                 </div>
                               )}

                               {block.type === 'quote' && (
                                 <div className="flex gap-4">
                                    <Quote className="text-accent shrink-0" size={24} />
                                    <textarea 
                                      value={block.content}
                                      onChange={(e) => updateBlock(block.id, { content: e.target.value })}
                                      style={{ fontSize: block.fontSize, textAlign: block.textAlign as any }}
                                      className="w-full bg-transparent border-none outline-none text-slate-300 italic leading-relaxed resize-none min-h-[60px] custom-scrollbar"
                                    />
                                 </div>
                               )}

                               {block.type === 'divider' && (
                                 <div className="py-4">
                                    <div className="h-px w-full bg-white/10" />
                                 </div>
                               )}
                            </div>
                            
                            {/* In-between Add Block Button */}
                            <div className="absolute -bottom-4 left-0 right-0 h-8 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity z-10">
                               <button 
                                 onClick={() => addBlock('text', index + 1)}
                                 className="w-8 h-8 rounded-full bg-accent text-white flex items-center justify-center shadow-lg hover:scale-110 transition-transform"
                               >
                                 <Plus size={16}/>
                               </button>
                            </div>
                          </div>
                        ))}

                        {formData.content_blocks.length === 0 && (
                          <div className="py-32 text-center border-2 border-dashed border-white/5 rounded-[3rem] flex flex-col items-center gap-6">
                             <div className="w-16 h-16 rounded-3xl bg-white/5 flex items-center justify-center text-slate-700">
                                <Layout size={32} />
                             </div>
                             <div className="max-w-xs">
                               <h4 className="text-sm font-bold text-slate-500 mb-2 uppercase tracking-widest">Workspace Empty</h4>
                               <p className="text-xs text-slate-600 leading-relaxed">Start build your flexible block article by adding your first element below.</p>
                             </div>
                             <div className="flex gap-4">
                                <Button variant="secondary" onClick={() => addBlock('heading')} className="rounded-xl border border-white/5 bg-white/5 hover:bg-white/10">Add Heading</Button>
                                <Button variant="accent" onClick={() => addBlock('text')} className="rounded-xl shadow-glow">Start Writing</Button>
                             </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="h-[700px] bg-black/40 border-white/10 rounded-[3rem] p-16 overflow-auto shadow-2xl custom-scrollbar space-y-12">
                         {formData.content_blocks.map((block: any) => (
                           <div key={block.id} style={{ textAlign: block.textAlign as any }}>
                             {block.type === 'heading' && React.createElement(`h${block.level || 2}`, {
                               style: { 
                                 fontSize: block.fontSize, 
                                 fontWeight: block.fontWeight,
                                 textTransform: block.textTransform,
                                 lineHeight: block.lineHeight,
                                 letterSpacing: `${block.letterSpacing}px`
                               },
                               className: "text-white tracking-tight"
                             }, block.content)}
                             
                             {block.type === 'text' && (
                               <div 
                                 style={{ 
                                   fontSize: block.fontSize,
                                   fontWeight: block.fontWeight,
                                   textTransform: block.textTransform,
                                   lineHeight: block.lineHeight,
                                   letterSpacing: `${block.letterSpacing}px`
                                 }} 
                                 className="text-slate-400 prose prose-invert prose-slate max-w-none"
                                 dangerouslySetInnerHTML={{ __html: block.content }}
                               />
                             )}
                             {block.type === 'image' && block.url && (
                               <div className="space-y-4">
                                  <img src={block.url} className="w-full rounded-[2rem] border border-white/10 shadow-2xl" alt={block.caption} />
                                  {block.caption && <p className="text-center text-xs text-slate-600 italic uppercase tracking-widest">{block.caption}</p>}
                               </div>
                             )}
                             {block.type === 'button' && (
                               <div className="flex" style={{ justifyContent: block.textAlign === 'center' ? 'center' : block.textAlign === 'right' ? 'flex-end' : 'flex-start' }}>
                                 <button className="px-10 py-5 rounded-2xl bg-accent text-white font-bold uppercase tracking-widest shadow-glow">
                                    {block.text}
                                 </button>
                               </div>
                             )}
                           </div>
                         ))}
                      </div>
                    )}
                  </div>
                </>
              )}

              {activeTab === 'seo' && (
                <div className="space-y-10">
                  <div className="grid md:grid-cols-2 gap-12">
                    <div className="space-y-6">
                      <div className="space-y-2">
                        <label className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest ml-1">Meta Title (SEO)</label>
                        <Input 
                          value={formData.meta_title}
                          onChange={(e) => setFormData({...formData, meta_title: e.target.value})}
                          className="h-12 bg-white/5 border-white/10 rounded-xl focus:border-accent text-sm"
                          placeholder="Maximum 60 characters..."
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest ml-1">Meta Description (SEO)</label>
                        <Textarea 
                          value={formData.meta_description}
                          onChange={(e) => setFormData({...formData, meta_description: e.target.value})}
                          className="h-32 bg-white/5 border-white/10 rounded-2xl focus:border-accent text-sm p-4"
                          placeholder="Maximum 160 characters..."
                        />
                      </div>
                    </div>

                    <div className="space-y-6">
                       <label className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest ml-1">Search Keywords Performance Tracker</label>
                       <div className="p-6 rounded-2xl bg-white/5 border border-white/5 space-y-4">
                          <div className="flex gap-2">
                            <Input 
                              value={newKeyword}
                              onChange={(e) => setNewKeyword(e.target.value)}
                              className="h-10 bg-black/30 border-white/5 text-xs" 
                              placeholder="Add keyword e.g. 'mumbai ca seo'..."
                              onKeyDown={(e) => e.key === 'Enter' && addKeyword()}
                            />
                            <Button size="sm" variant="accent" onClick={addKeyword}>Add</Button>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {formData.keywords.map((kw: string) => (
                              <span key={kw} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-500/10 text-blue-400 text-[10px] font-bold uppercase tracking-wider border border-blue-500/10 group">
                                <Chrome size={12} />
                                {kw}
                                <button onClick={() => removeKeyword(kw)} className="opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={12} /></button>
                              </span>
                            ))}
                          </div>
                       </div>
                       <p className="text-[10px] text-slate-500 leading-relaxed italic">
                         ✨ These keywords are used to generate deep meta tags and help our automated crawlers track your search engine rank.
                       </p>
                    </div>
                  </div>

                  {/* Google Preview */}
                  <div className="p-8 rounded-[2rem] bg-slate-900 border border-white/5">
                    <p className="text-xs text-slate-500 mb-6 uppercase tracking-[0.2em] font-bold">// Search Engine Result Preview</p>
                    <div className="space-y-1 max-w-xl">
                       <p className="text-[10px] text-slate-400 flex items-center gap-1">https://primansh.com <MoveRight size={10} /> blog <MoveRight size={10} /> {formData.slug || 'slug'}</p>
                       <h4 className="text-xl text-[#8ab4f8] hover:underline cursor-pointer font-medium font-sans">{formData.meta_title || formData.title || 'Page Title'}</h4>
                       <p className="text-sm text-slate-300 line-clamp-2 leading-relaxed">{formData.meta_description || formData.excerpt || 'Please provide a meta description for better search engine visibility.'}</p>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'faqs' && (
                <div className="space-y-8">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-lg font-bold text-white">Schema.org Accordion Builder</h3>
                    <Button size="sm" variant="accent" onClick={addFAQ}><Plus size={16} className="mr-2" /> Add FAQ</Button>
                  </div>
                  
                  <div className="space-y-6">
                    {formData.faqs.map((faq: any, index: number) => (
                      <motion.div 
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        key={index} 
                        className="p-6 rounded-2xl bg-white/5 border border-white/10 relative group"
                      >
                         <button 
                           onClick={() => removeFAQ(index)}
                           className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-destructive text-white items-center justify-center hidden group-hover:flex shadow-xl"
                         >
                           <Trash2 size={14} />
                         </button>
                         <div className="space-y-4">
                            <div className="space-y-1">
                              <label className="text-[10px] text-slate-500 uppercase font-bold tracking-widest ml-1">Question {index + 1}</label>
                              <Input 
                                value={faq.question}
                                onChange={(e) => updateFAQ(index, 'question', e.target.value)}
                                className="bg-black/30 border-white/5 text-sm"
                                placeholder="e.g. How much time does it take to rank?"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[10px] text-slate-500 uppercase font-bold tracking-widest ml-1">Answer</label>
                              <Textarea 
                                value={faq.answer}
                                onChange={(e) => updateFAQ(index, 'answer', e.target.value)}
                                className="bg-black/30 border-white/5 text-sm min-h-[100px]"
                                placeholder="Provide a helpful, detailed answer..."
                              />
                            </div>
                         </div>
                      </motion.div>
                    ))}

                    {formData.faqs.length === 0 && (
                      <div className="py-20 text-center border-2 border-dashed border-white/5 rounded-[2rem] flex flex-col items-center gap-4">
                         <HelpCircle size={40} className="text-slate-800" />
                         <div className="max-w-xs">
                           <h4 className="text-sm font-bold text-slate-400 mb-1 uppercase tracking-widest">No FAQ Schema Found</h4>
                           <p className="text-xs text-slate-600">Adding questions and answers directly into the blog schema boosts your 'People Also Ask' ranking on Google.</p>
                         </div>
                         <Button variant="ghost" className="mt-2 text-accent" onClick={addFAQ}>Initialize FAQ Engine</Button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Quick Toolbar (Right Sidebar) */}
          <div className="w-80 space-y-6">
             <div className="glass-card p-6 space-y-6">
                <h4 className="text-[10px] text-slate-500 uppercase tracking-[0.2em] font-bold">// Publishing Hub</h4>
                
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 rounded-xl bg-white/5">
                    <span className="text-xs text-slate-400">Word Count</span>
                    <span className="text-xs font-bold text-white">{formData.content.split(/\s+/).filter(Boolean).length} words</span>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-xl bg-white/5">
                     <span className="text-xs text-slate-400">SEO Score</span>
                     <span className="text-xs font-bold text-green-400">Optimizing...</span>
                  </div>
                </div>

                <div className="space-y-3 pt-4">
                  <Button className="w-full justify-between h-12 rounded-xl group" variant="ghost">
                    <span className="flex items-center gap-2"><Globe size={16} /> Public URL</span>
                    <ArrowLeft className="w-4 h-4 rotate-180 opacity-0 group-hover:opacity-100 transition-all" />
                  </Button>
                  <Button className="w-full justify-between h-12 rounded-xl group" variant="ghost">
                    <span className="flex items-center gap-2"><Settings size={16} /> CMS Config</span>
                    <ArrowLeft className="w-4 h-4 rotate-180 opacity-0 group-hover:opacity-100 transition-all" />
                  </Button>
                </div>
             </div>

             <div className="p-8 rounded-[2rem] bg-blue-500/10 border border-blue-500/20 text-center">
                <Layout className="mx-auto text-blue-400 mb-4" size={32} />
                <h5 className="text-sm font-bold text-white mb-2">Editor Tip</h5>
                <p className="text-[10px] text-slate-400 leading-relaxed">
                  Use the **Button Builder** tool to add high-converting "Call to Action" links inside your blog content. This drastically increases Lead Form submissions.
                </p>
             </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
