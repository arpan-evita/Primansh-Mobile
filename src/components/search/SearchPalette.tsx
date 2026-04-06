import React, { useState, useEffect } from 'react';
import { Command } from 'cmdk';
import { Search, User, Briefcase, CheckSquare, MessageSquare, LayoutDashboard, FileText, Settings, X, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useGlobalUI } from '@/contexts/GlobalUIContext';
import { motion, AnimatePresence } from 'framer-motion';

export function SearchPalette() {
  const { isSearchPaletteOpen, setIsSearchPaletteOpen } = useGlobalUI();
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<{ clients: any[], tasks: any[], invoices: any[], docs: any[], messages: any[] }>({ 
    clients: [], tasks: [], invoices: [], docs: [], messages: [] 
  });
  const navigate = useNavigate();

  useEffect(() => {
    if (!search || search.length < 2) {
      setResults({ clients: [], tasks: [], invoices: [], docs: [], messages: [] });
      return;
    }

    const fetchResults = async () => {
      const [{ data: clients }, { data: tasks }, { data: invoices }, { data: docs }, { data: messages }] = await Promise.all([
        supabase.from('clients').select('id, firm_name').ilike('firm_name', `%${search}%`).limit(5),
        supabase.from('tasks').select('id, title').ilike('title', `%${search}%`).limit(5),
        supabase.from('invoices').select('id, invoice_number, subtotal').ilike('invoice_number', `%${search}%`).limit(5),
        supabase.from('client_documents').select('id, name, file_path').ilike('name', `%${search}%`).limit(5),
        supabase.from('messages').select('id, content, conversation_id').ilike('content', `%${search}%`).limit(5)
      ]);

      setResults({ 
        clients: clients || [], 
        tasks: tasks || [],
        invoices: invoices || [],
        docs: docs || [],
        messages: messages || []
      });
    };

    const timer = setTimeout(fetchResults, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const onSelect = (path: string) => {
    navigate(path);
    setIsSearchPaletteOpen(false);
    setSearch('');
  };

  return (
    <AnimatePresence>
      {isSearchPaletteOpen && (
        <div className="fixed inset-0 z-[200] flex items-start justify-center pt-[15vh] px-4 pointer-events-none">
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-slate-950/80 backdrop-blur-xl pointer-events-auto"
            onClick={() => setIsSearchPaletteOpen(false)}
          />
          
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            className="relative w-full max-w-xl pointer-events-auto overflow-hidden"
          >
            <Command 
              label="Global Search"
              className="w-full bg-[#0b0f1a] border border-white/10 rounded-3xl shadow-2xl shadow-black/80 flex flex-col overflow-hidden"
            >
              <div className="flex items-center px-6 py-5 border-b border-white/5 gap-3">
                <Search className="text-blue-500 animate-pulse" size={18} />
                <Command.Input 
                  value={search}
                  onValueChange={setSearch}
                  placeholder="Search clients, tasks, or navigation..."
                  className="w-full bg-transparent border-none outline-none text-white text-base placeholder:text-slate-600 font-medium"
                />
                <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-white/5 border border-white/5 text-[10px] text-slate-500 font-bold">
                  ESC
                </div>
              </div>

              <Command.List className="max-h-[400px] overflow-y-auto p-4 custom-scrollbar">
                <Command.Empty className="py-12 text-center">
                  <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center mx-auto mb-4 text-slate-700">
                    <Search size={20} />
                  </div>
                  <p className="text-sm font-bold text-slate-600">No results found for "{search}"</p>
                </Command.Empty>

                <Command.Group heading="Navigation" className="mb-4">
                  <NavItem icon={LayoutDashboard} label="Dashboard" onSelect={() => onSelect('/dashboard')} />
                  <NavItem icon={MessageSquare} label="Messages" onSelect={() => onSelect('/messages')} />
                  <NavItem icon={Briefcase} label="Client Network" onSelect={() => onSelect('/clients')} />
                  <NavItem icon={CheckSquare} label="Task Board" onSelect={() => onSelect('/tasks')} />
                  <NavItem icon={FileText} label="Article Master" onSelect={() => onSelect('/articles')} />
                  <NavItem icon={User} label="My Profile" onSelect={() => onSelect('/profile')} />
                </Command.Group>

                {results.clients.length > 0 && (
                  <Command.Group heading="Client Entities" className="mb-4">
                    {results.clients.map(c => (
                      <SearchResultItem 
                        key={c.id} 
                        icon={Briefcase} 
                        label={c.firm_name} 
                        onSelect={() => onSelect(`/clients/${c.id}`)} 
                      />
                    ))}
                  </Command.Group>
                )}

                {results.tasks.length > 0 && (
                   <Command.Group heading="Strategic Tasks" className="mb-4">
                     {results.tasks.map(t => (
                       <SearchResultItem 
                         key={t.id} 
                         icon={CheckSquare} 
                         label={t.title} 
                         onSelect={() => onSelect('/tasks')} 
                       />
                     ))}
                   </Command.Group>
                 )}

                {results.invoices.length > 0 && (
                  <Command.Group heading="Financial Records" className="mb-4">
                    {results.invoices.map(i => (
                      <SearchResultItem 
                        key={i.id} 
                        icon={FileText} 
                        label={`Invoice ${i.invoice_number} - $${i.subtotal}`} 
                        onSelect={() => onSelect('/billing')} 
                      />
                    ))}
                  </Command.Group>
                )}

                {results.docs.length > 0 && (
                  <Command.Group heading="Digital Assets" className="mb-4">
                    {results.docs.map(d => (
                      <SearchResultItem 
                        key={d.id} 
                        icon={FileText} 
                        label={d.name} 
                        onSelect={() => onSelect('/documents')} 
                      />
                    ))}
                  </Command.Group>
                )}

                {results.messages.length > 0 && (
                  <Command.Group heading="Communications" className="mb-4">
                    {results.messages.map(m => (
                      <SearchResultItem 
                        key={m.id} 
                        icon={MessageSquare} 
                        label={m.content} 
                        onSelect={() => onSelect('/messages')} 
                      />
                    ))}
                  </Command.Group>
                )}

                <div className="pt-4 border-t border-white/5 flex items-center justify-between px-2 opacity-50">
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Primansh Neural Search v1.0</p>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1 text-[10px] text-slate-500">
                      <ChevronRight size={10} /> Navigate
                    </div>
                  </div>
                </div>
              </Command.List>
            </Command>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

function NavItem({ icon: Icon, label, onSelect }: any) {
  return (
    <Command.Item
      onSelect={onSelect}
      className="flex items-center gap-4 px-4 py-3.5 rounded-2xl cursor-pointer hover:bg-white/5 aria-selected:bg-blue-600 transition-all group"
    >
      <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center group-hover:bg-blue-500 group-aria-selected:bg-blue-500/20 transition-all border border-white/5">
        <Icon size={18} className="text-slate-400 group-hover:text-white group-aria-selected:text-white transition-colors" />
      </div>
      <div className="flex-1 min-w-0">
        <span className="text-sm font-bold text-slate-300 group-hover:text-white group-aria-selected:text-white transition-colors capitalize tracking-tight">{label}</span>
      </div>
      <ChevronRight size={14} className="text-slate-800 group-hover:text-slate-300 group-aria-selected:text-white transition-colors" />
    </Command.Item>
  );
}

function SearchResultItem({ icon: Icon, label, onSelect }: any) {
  return (
    <Command.Item
      onSelect={onSelect}
      className="flex items-center gap-4 px-4 py-3 rounded-2xl cursor-pointer hover:bg-white/5 aria-selected:bg-blue-600 transition-all group"
    >
      <Icon size={14} className="text-slate-600 group-hover:text-blue-400 group-aria-selected:text-white transition-colors" />
      <span className="text-sm font-medium text-slate-400 group-hover:text-white group-aria-selected:text-white transition-colors truncate flex-1">{label}</span>
      <div className="text-[10px] font-bold text-slate-700 uppercase tracking-tighter hidden group-hover:block transition-all text-white">Select Entity</div>
    </Command.Item>
  );
}
