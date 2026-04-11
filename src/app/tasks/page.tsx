import { AppShell } from "@/components/layout/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getStatusColor, cn } from "@/lib/utils";
import { Plus, Filter, Loader2, Calendar, User, MoreVertical, ExternalLink } from "lucide-react";
import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  DndContext,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  defaultDropAnimationSideEffects,
  useDroppable,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { createPortal } from "react-dom";

const COLUMNS = [
  { id: "todo", label: "To Do", color: "#64748b" },
  { id: "in_progress", label: "In Progress", color: "#3b82f6" },
  { id: "done", label: "Done", color: "#10b981" },
] as const;

type TaskStatus = typeof COLUMNS[number]['id'];

interface DroppableColumnProps {
  id: string;
  label: string;
  color: string;
  taskCount: number;
  children: React.ReactNode;
}

function DroppableColumn({ id, label, color, taskCount, children }: DroppableColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex flex-col rounded-xl overflow-hidden w-[85vw] sm:w-auto flex-none snap-center transition-all duration-200",
        isOver ? "bg-white/[0.04] ring-2 ring-blue-500/20 scale-[1.01]" : "bg-rgba(15,22,41,0.4)"
      )}
      style={{ 
        background: isOver ? "rgba(255,255,255,0.05)" : "rgba(15,22,41,0.4)", 
        border: isOver ? "1px solid rgba(59,130,246,0.3)" : "1px solid rgba(99,128,191,0.08)", 
        minHeight: "75vh" 
      }}
    >
      {/* Header */}
      <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: "1px solid rgba(99,128,191,0.08)", background: "rgba(15,22,41,0.6)" }}>
        <div className="flex items-center gap-2.5">
          <span className="w-2 h-2 rounded-full shadow-[0_0_8px_currentColor]" style={{ background: color, color: color }} />
          <h3 className="text-sm font-semibold text-white">{label}</h3>
        </div>
        <span className="text-xs px-2.5 py-0.5 rounded-full font-bold" style={{ background: "rgba(99,128,191,0.1)", color: "#94a3b8" }}>
          {taskCount}
        </span>
      </div>
      <div className="p-3 space-y-3 flex-1 overflow-y-auto min-h-[150px]">
        {children}
      </div>
    </div>
  );
}

interface SortableTaskCardProps {
  task: any;
  deleteTask: (id: string) => void;
  updateStatus: (id: string, status: string) => void;
}

function SortableTaskCard({ task, deleteTask, updateStatus }: SortableTaskCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id, data: { task, type: 'task' } });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const navigate = useNavigate();
  return (
    <div 
      ref={setNodeRef} 
      style={style} 
      {...attributes} 
      {...listeners}
      className={cn(
        "kanban-card group relative cursor-grab active:cursor-grabbing hover:border-blue-500/30 transition-all",
        isDragging && "z-50 ring-2 ring-blue-500/50 shadow-2xl"
      )}
    >
      <div className="flex items-start justify-between mb-1.5 pointer-events-none">
        <span className={`badge text-[9px] px-1.5 py-0 ${task.module === "seo" ? "bg-purple-500/20 text-purple-400" : task.module === "content" ? "bg-blue-500/20 text-blue-400" : "bg-emerald-500/20 text-emerald-400"}`}>
          {task.module}
        </span>
        
        <div className="flex items-center gap-2">
           <span className={`text-[10px] font-bold uppercase tracking-wider ${task.priority === "high" ? "text-red-400" : task.priority === "medium" ? "text-amber-400" : "text-slate-400"}`}>
            {task.priority}
          </span>
        </div>
      </div>
      <p className="text-sm font-semibold text-white mb-1 leading-tight pointer-events-none">{task.title}</p>
      
      <div className="pointer-events-none">
        <div 
          className="text-[11px] mb-3 flex items-center gap-1" 
          style={{ color: "#64748b" }}
        >
          {task.client_name}
        </div>

        <div className="flex items-center justify-between pt-2 mt-2 border-t border-white/5">
          <div className="flex items-center gap-1.5">
            <div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold" style={{ background: "rgba(59,130,246,0.15)", color: "#60a5fa" }}>
              {task.assigned_name ? task.assigned_name[0] : 'U'}
            </div>
            <span className="text-[10px]" style={{ color: "#94a3b8" }}>{task.assigned_name ? task.assigned_name.split(" ")[0] : 'Unassigned'}</span>
          </div>
          <div className="flex items-center gap-1 text-[#475569]">
             <Calendar size={10} />
             <span className="text-[10px] font-semibold">
              {task.due_date ? new Date(task.due_date).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : 'ASAP'}
            </span>
          </div>
        </div>
      </div>

      {/* Manual Actions - Stop propagation to allow clicking while sortable */}
      <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity z-20" onPointerDown={(e) => e.stopPropagation()}>
         <Select onValueChange={(v) => {
            if (v === 'delete') deleteTask(task.id);
            else if (v === 'discuss' || v === 'call') {
              // We need to resolve name to ID. In a real app we'd have the ID in the task object.
              // For now we'll use a hack or navigate to a special search.
              navigate(`/messages?search=${task.assigned_name}&contextId=${task.id}&contextType=task${v === 'call' ? '&startMeeting=true' : ''}`);
            }
            else updateStatus(task.id, v);
          }}>
          <SelectTrigger className="w-6 h-6 p-0 border-none bg-slate-900/80 hover:bg-slate-800 rounded-full flex items-center justify-center backdrop-blur-sm shadow-xl">
             <MoreVertical size={14} className="text-slate-200" />
          </SelectTrigger>
          <SelectContent className="bg-[#0f172a] border-white/10 text-white min-w-[100px] z-50">
            <SelectItem value="discuss" className="text-blue-400 focus:text-blue-400 focus:bg-blue-500/10">Discuss Task</SelectItem>
            <SelectItem value="call" className="text-emerald-400 focus:text-emerald-400 focus:bg-emerald-500/10">Start Call</SelectItem>
            <div className="h-px bg-white/10 my-1 mx-1" />
            {COLUMNS.map(c => (
              <SelectItem key={c.id} value={c.id} disabled={c.id === task.status}>{c.label}</SelectItem>
            ))}
            <div className="h-px bg-white/10 my-1 mx-1" />
            <SelectItem value="delete" className="text-red-400 focus:text-red-400 focus:bg-red-500/10 data-[highlighted]:text-red-400 data-[highlighted]:bg-red-500/10">Delete Task</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

export default function TasksPage() {
  const [filter, setFilter] = useState("all"); // Member filter
  const [clientFilter, setClientFilter] = useState("all");
  const [isNewTaskOpen, setIsNewTaskOpen] = useState(false);
  const [newTask, setNewTask] = useState({
    title: '',
    client_id: '',
    assigned_to_user_id: '',
    priority: 'medium',
    module: 'seo',
    status: 'todo',
    due_date: ''
  });

  const queryClient = useQueryClient();

  // Local state for seamless dragging (improves smoothness)
  const [activeTask, setActiveTask] = useState<any>(null);
  const [localTasks, setLocalTasks] = useState<any[]>([]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Queries
  const { data: remoteTasks = [], isLoading: isTasksLoading } = useQuery({
    queryKey: ['admin_tasks'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tasks')
        .select('*, clients(firm_name), assigned_profile:profiles!tasks_assigned_to_user_id_fkey(id, full_name)')
        .order('updated_at', { ascending: false });
      
      if (error) throw error;
      const mapped = (data || []).map(t => ({
          ...t,
          client_name: (t as any).clients?.firm_name || 'Individual Protocol',
          assigned_name: (t as any).assigned_profile?.full_name || (t as any).assigned_to || 'Unassigned'
      }));
      return mapped;
    }
  });

  useEffect(() => {
    setLocalTasks(remoteTasks || []);
  }, [remoteTasks]);

  useEffect(() => {
    const channel = supabase
      .channel('web-task-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => {
        queryClient.invalidateQueries({ queryKey: ['admin_tasks'] });
        queryClient.invalidateQueries({ queryKey: ['admin_clients'] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const { data: clients = [] } = useQuery({
    queryKey: ['admin_clients_simple'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('id, firm_name');
      if (error) throw error;
      return data;
    }
  });

  const { data: teamMembers = [] } = useQuery({
    queryKey: ['admin_team_members'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, role');
      if (error) throw error;
      return (data || []).filter((p: any) => p.role !== 'client').map((p: any) => ({
        ...p,
        display_name: p.full_name || `Member (${p.role})`
      }));
    }
  });

  // Mutations
  const addTaskMutation = useMutation({
    mutationFn: async (record: any) => {
      if (!record.client_id) throw new Error("Please select a target firm for this mandate.");
      const selectedMember = teamMembers.find((member: any) => member.id === record.assigned_to_user_id) || null;
      const submission = {
        ...record,
        assigned_to_user_id: record.assigned_to_user_id || null,
        assigned_to: selectedMember?.display_name || null,
      };
      const { error } = await supabase.from('tasks').insert(submission);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_tasks'] });
      toast.success("Task synchronized for agency operations! 🚀");
      setIsNewTaskOpen(false);
      setNewTask({ title: '', client_id: '', assigned_to_user_id: '', priority: 'medium', module: 'seo', status: 'todo', due_date: '' });
    },
    onError: (err: any) => toast.error(`Sync failed: ${err.message}`)
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string, status: string }) => {
      const { error } = await supabase.from('tasks').update({ status }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_tasks'] });
      queryClient.invalidateQueries({ queryKey: ['admin_clients'] }); 
      toast.success("Operational pipeline updated.");
    }
  });

  const deleteTaskMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('tasks').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_tasks'] });
      queryClient.invalidateQueries({ queryKey: ['admin_clients'] }); 
      toast.success("Task permanently removed.");
    }
  });

  // Drag Handlers
  const handleDragStart = (event: any) => {
    const { active } = event;
    setActiveTask(active.data.current.task);
  };

  const handleDragOver = (event: any) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id;
    const overId = over.id;

    if (activeId === overId) return;

    const activeTask = localTasks.find(t => t.id === activeId);
    if (!activeTask) return;

    // Is it hovering over a column?
    const isOverAColumn = COLUMNS.some(c => c.id === overId);
    
    if (isOverAColumn) {
      if (activeTask.status !== overId) {
        setLocalTasks(prev => prev.map(t => t.id === activeId ? { ...t, status: overId } : t));
      }
      return;
    }

    // Is it hovering over another task?
    const overTask = localTasks.find(t => t.id === overId);
    if (overTask && activeTask.status !== overTask.status) {
      setLocalTasks(prev => prev.map(t => t.id === activeId ? { ...t, status: overTask.status } : t));
    }
  };

  const handleDragEnd = async (event: any) => {
    const { active, over } = event;
    setActiveTask(null);

    if (!over) return;

    const activeId = active.id;
    const overId = over.id;

    // Final task record
    const finalTask = localTasks.find(t => t.id === activeId);
    if (!finalTask) return;

    // Check against original remote baseline
    const originalTask = remoteTasks.find((t:any) => t.id === activeId);
    if (originalTask && originalTask.status !== finalTask.status) {
      updateStatusMutation.mutate({ id: activeId, status: finalTask.status });
    }
  };

  const filteredTasks = localTasks.filter((t: any) => {
    const matchesMember = filter === "all" || (t.assigned_name || '').toLowerCase().includes(filter.toLowerCase());
    const matchesClient = clientFilter === "all" || t.client_id === clientFilter;
    return matchesMember && matchesClient;
  });

  if (isTasksLoading && localTasks.length === 0) return (
    <AppShell title="Tasks Board" subtitle="Synchronizing agency operations...">
        <div className="flex flex-col items-center justify-center py-32 gap-4">
            <Loader2 className="animate-spin text-accent" size={40} />
            <span className="text-sm text-muted-foreground">Retrieving tasks...</span>
        </div>
    </AppShell>
  );

  return (
    <AppShell title="Tasks Board" subtitle="Agency-wide task overview">
      <div className="fade-up h-full flex flex-col">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-8 pb-6 border-b border-white/5 gap-4 md:gap-0">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 w-full md:w-auto">
            <h1 className="text-2xl font-bold text-white tracking-tight">Task Board</h1>
            <div className="hidden sm:block h-6 w-[1px] bg-white/10 mx-2" />
            
            <div className="flex items-center gap-3 w-full sm:w-auto overflow-x-auto pb-2 sm:pb-0 hide-scrollbar">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#0a0f1d]/60 border border-white/10 flex-shrink-0">
                <User size={13} className="text-slate-500 flex-shrink-0" />
                <select
                  className="bg-transparent text-[11px] font-bold uppercase tracking-wider text-slate-400 outline-none w-28 sm:w-32 cursor-pointer"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                >
                  <option value="all">All Partners</option>
                  {teamMembers.map((m: any) => (
                    <option key={m.id} value={m.display_name}>{m.display_name}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#0a0f1d]/60 border border-white/10 flex-shrink-0">
                <Filter size={13} className="text-slate-500 flex-shrink-0" />
                <select
                  className="bg-transparent text-[11px] font-bold uppercase tracking-wider text-slate-400 outline-none w-28 sm:w-32 cursor-pointer"
                  value={clientFilter}
                  onChange={(e) => setClientFilter(e.target.value)}
                >
                  <option value="all">All Clients</option>
                  {clients.map((c: any) => (
                    <option key={c.id} value={c.id}>{c.firm_name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <Dialog open={isNewTaskOpen} onOpenChange={setIsNewTaskOpen}>
            <DialogTrigger asChild>
              <button className="btn-primary flex items-center justify-center gap-1.5 text-xs w-full md:w-auto shrink-0 py-2.5 md:py-2">
                <Plus size={12} /> New Task
              </button>
            </DialogTrigger>
            <DialogContent className="bg-[#0a0f1d] border-white/10 text-white sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle className="text-xl font-bold tracking-tight">Synchronize Task</DialogTitle>
                <p className="text-xs text-slate-500">Deploy a new operational mandate to the agency network.</p>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <label className="text-[10px] uppercase font-bold text-slate-500 tracking-widest">Task Title</label>
                  <Input 
                    placeholder="e.g., Optimize H1 Structures" 
                    className="bg-white/5 border-white/10" 
                    value={newTask.title}
                    onChange={e => setNewTask({...newTask, title: e.target.value})}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase font-bold text-slate-500 tracking-widest">Client / Firm</label>
                    <Select onValueChange={v => setNewTask({...newTask, client_id: v})}>
                      <SelectTrigger className="bg-white/5 border-white/10">
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
                    <label className="text-[10px] uppercase font-bold text-slate-500 tracking-widest">Assign Partner</label>
                    <Select value={newTask.assigned_to_user_id} onValueChange={v => setNewTask({...newTask, assigned_to_user_id: v})}>
                      <SelectTrigger className="bg-white/5 border-white/10">
                        <SelectValue placeholder="Select Partner" />
                      </SelectTrigger>
                      <SelectContent className="bg-[#0f172a] border-white/10 text-white">
                        {teamMembers.map((m: any) => (
                          <SelectItem key={m.id} value={m.id}>{m.display_name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase font-bold text-slate-500 tracking-widest">Module</label>
                    <Select onValueChange={v => setNewTask({...newTask, module: v})}>
                      <SelectTrigger className="bg-white/5 border-white/10">
                        <SelectValue placeholder="Task Pillar" />
                      </SelectTrigger>
                      <SelectContent className="bg-[#0f172a] border-white/10 text-white">
                        <SelectItem value="seo">SEO</SelectItem>
                        <SelectItem value="content">Content</SelectItem>
                        <SelectItem value="development">Dev</SelectItem>
                        <SelectItem value="ops">Ops</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase font-bold text-slate-500 tracking-widest">Priority</label>
                    <Select onValueChange={v => setNewTask({...newTask, priority: v})}>
                      <SelectTrigger className="bg-white/5 border-white/10">
                        <SelectValue placeholder="Level" />
                      </SelectTrigger>
                      <SelectContent className="bg-[#0f172a] border-white/10 text-white">
                        <SelectItem value="high" className="text-red-400">High</SelectItem>
                        <SelectItem value="medium" className="text-amber-400">Medium</SelectItem>
                        <SelectItem value="low" className="text-emerald-400">Low</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] uppercase font-bold text-slate-500 tracking-widest">Due Date</label>
                  <Input 
                    type="date" 
                    className="bg-white/5 border-white/10"
                    onChange={e => setNewTask({...newTask, due_date: e.target.value})}
                  />
                </div>
                <button 
                  className="w-full btn-primary py-3 rounded-xl font-bold text-sm mt-4 shadow-xl shadow-accent/20 disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={() => addTaskMutation.mutate(newTask)}
                  disabled={addTaskMutation.isPending || !newTask.title || !newTask.client_id}
                >
                  {addTaskMutation.isPending ? 'Synchronizing...' : 'Deploy Mandate'}
                </button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <DndContext 
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <div className="flex sm:grid sm:grid-cols-3 gap-6 flex-1 items-start overflow-x-auto pb-6 snap-x snap-mandatory hide-scrollbar">
            {COLUMNS.map((col) => {
              const colTasks = filteredTasks.filter((t: any) => (t.status || '').toLowerCase() === col.id.toLowerCase());
              return (
                <DroppableColumn 
                  key={col.id}
                  id={col.id}
                  label={col.label}
                  color={col.color}
                  taskCount={colTasks.length}
                >
                  <SortableContext 
                    id={col.id}
                    items={colTasks.map(t => t.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    {colTasks.map((t: any) => (
                      <SortableTaskCard 
                        key={t.id} 
                        task={t} 
                        deleteTask={(id) => deleteTaskMutation.mutate(id)}
                        updateStatus={(id, status) => updateStatusMutation.mutate({ id, status })}
                      />
                    ))}
                    {colTasks.length === 0 && (
                      <div className="h-full min-h-[150px] flex flex-col items-center justify-center py-12 opacity-30 pointer-events-none">
                        <Loader2 className="animate-spin mb-2" size={16} />
                        <p className="text-[10px] uppercase font-bold tracking-widest">Standby Ops</p>
                      </div>
                    )}
                  </SortableContext>
                </DroppableColumn>
              );
            })}
          </div>

          {createPortal(
            <DragOverlay dropAnimation={{
              sideEffects: defaultDropAnimationSideEffects({
                styles: {
                  active: {
                    opacity: '0.4',
                  },
                },
              }),
            }}>
              {activeTask ? (
                <div className="kanban-card opacity-90 scale-105 shadow-2xl border-blue-500/50 bg-[#0f172a] z-[100]">
                  <div className="flex items-start justify-between mb-1.5 ">
                    <span className={`badge text-[9px] px-1.5 py-0 ${activeTask.module === "seo" ? "bg-purple-500/20 text-purple-400" : activeTask.module === "content" ? "bg-blue-500/20 text-blue-400" : "bg-emerald-500/20 text-emerald-400"}`}>
                      {activeTask.module}
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-white mb-1 leading-tight">{activeTask.title}</p>
                  <p className="text-[11px] mb-3" style={{ color: "#64748b" }}>{activeTask.client_name}</p>
                </div>
              ) : null}
            </DragOverlay>,
            document.body
          )}
        </DndContext>
      </div>
    </AppShell>
  );
}
