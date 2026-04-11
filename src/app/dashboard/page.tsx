import { AppShell } from "@/components/layout/AppShell";
import { Loader2, TrendingUp, CreditCard, Video, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { AdminDashboard } from "./AdminDashboard";
import { TeamDashboard } from "./TeamDashboard";
import { formatCurrency } from "@/lib/utils";

export default function DashboardPage() {
  const { profile, loading: authLoading } = useAuth();
  const usesPersonalDashboard = !!profile && ['team', 'seo', 'content', 'developer'].includes(profile.role);

  // ── ADMIN DATA QUERIES ──
  const { data: clients = [], isLoading: isClientsLoading } = useQuery({
    queryKey: ['admin_dashboard_clients'],
    queryFn: async () => {
      const { data, error } = await supabase.from('clients').select('*');
      if (error) throw error;
      const { data: taskStats, error: taskStatsError } = await supabase.from('tasks').select('client_id, status');
      if (taskStatsError) throw taskStatsError;
      const scoreMap: Record<string, number> = {};
      if (taskStats) {
        const grouped: Record<string, { total: number; done: number }> = {};
        taskStats.forEach((t: any) => {
          if (!t.client_id) return;
          if (!grouped[t.client_id]) grouped[t.client_id] = { total: 0, done: 0 };
          grouped[t.client_id].total++;
          if (t.status === 'done') grouped[t.client_id].done++;
        });
        Object.entries(grouped).forEach(([id, s]) => {
          scoreMap[id] = Math.round((s.done / s.total) * 100);
        });
      }
      return (data || []).map((c: any) => ({ ...c, total_health_score: scoreMap[c.id] ?? c.health_score ?? 50 }));
    },
    enabled: !authLoading && !usesPersonalDashboard
  });

  const { data: allInvoices = [], isLoading: isInvoicesLoading } = useQuery({
    queryKey: ['admin_invoices_all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invoices')
        .select('amount, issued_date, created_at')
        .order('issued_date', { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !authLoading && !usesPersonalDashboard
  });

  const { data: leads = [], isLoading: isLeadsLoading } = useQuery({
    queryKey: ['admin_leads_all'],
    queryFn: async () => {
      const { data, error } = await supabase.from('leads').select('*').order('created_at', { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !authLoading && !usesPersonalDashboard
  });

  const { data: allTasks = [], isLoading: isTasksLoading } = useQuery({
    queryKey: ['admin_tasks_all'],
    queryFn: async () => {
      const { data, error } = await supabase.from('tasks').select('*').order('created_at', { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !authLoading && !usesPersonalDashboard
  });

  const { data: siteAnalytics = [], isLoading: isSiteAnalyticsLoading } = useQuery({
    queryKey: ['admin_site_analytics_all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('site_analytics')
        .select('timestamp')
        .order('timestamp', { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !authLoading && !usesPersonalDashboard
  });

  const { data: allMeetings = [], isLoading: isMeetingsLoading } = useQuery({
    queryKey: ['admin_meetings_all'],
    queryFn: async () => {
      const { data, error } = await supabase.from('meetings').select('*');
      if (error) throw error;
      return data || [];
    },
    enabled: !authLoading && !usesPersonalDashboard
  });

  // ── TREND & CHART LOGIC ───────────────────────────────────────
  
  const calculateMoM = (items: any[]) => {
    const now = new Date();
    const currMonth = now.getMonth();
    const currYear = now.getFullYear();
    const prevMonth = currMonth === 0 ? 11 : currMonth - 1;
    const prevYear = currMonth === 0 ? currYear - 1 : currYear;

    const countCurr = items.filter(i => {
      const d = new Date(i.created_at || i.timestamp || i.start_time);
      return d.getMonth() === currMonth && d.getFullYear() === currYear;
    }).length;
    
    const countPrev = items.filter(i => {
      const d = new Date(i.created_at || i.timestamp || i.start_time);
      return d.getMonth() === prevMonth && d.getFullYear() === prevYear;
    }).length;

    if (countPrev === 0) return countCurr > 0 ? 100 : 0;
    return Math.round(((countCurr - countPrev) / countPrev) * 100);
  };

  const generateAgencyTrend = () => {
    // Generate last 6 months
    const months: any[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      months.push({
        month: d.toLocaleString('default', { month: 'short' }),
        m: d.getMonth(),
        y: d.getFullYear(),
        traffic: 0,
        leads: 0
      });
    }

    // Map real leads to months
    leads.forEach(l => {
      const ld = new Date(l.created_at);
      const m = months.find(mo => mo.m === ld.getMonth() && mo.y === ld.getFullYear());
      if (m) m.leads++;
    });

    // Map real site analytics (traffic) to months
    siteAnalytics.forEach((a: any) => {
      const ad = new Date(a.timestamp);
      const m = months.find(mo => mo.m === ad.getMonth() && mo.y === ad.getFullYear());
      if (m) m.traffic++;
    });

    return months;
  };

  const adminRecentActivity = [
    ...(leads || []).slice(-3).map(l => ({ text: `New lead: ${l.name}`, time: l.created_at, dot: "#10b981" })),
    ...(allTasks || []).filter(t => t.status !== 'todo').slice(-3).map(t => ({ text: `Task ${t.status}: ${t.title}`, time: t.created_at, dot: t.status === 'done' ? "#10b981" : "#3b82f6" }))
  ].sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()).slice(0, 4);

  // ── TEAM DATA QUERIES ──
  const { data: teamStats, isLoading: isTeamLoading } = useQuery({
    queryKey: ["team_report_stats", profile?.id, profile?.full_name, profile?.role],
    queryFn: async () => {
      if (!profile?.id) return null;

      const [tasksRes, blogsRes, messagesRes] = await Promise.all([
        supabase.from("tasks").select("id, title, status, created_at, due_date, assigned_to"),
        supabase.from("blogs").select("id, title, author, published, created_at"),
        supabase.from("messages").select("id, created_at").eq("sender_id", profile.id),
      ]);

      if (tasksRes.error) throw tasksRes.error;
      if (blogsRes.error) throw blogsRes.error;
      if (messagesRes.error) throw messagesRes.error;

      const tasks = (tasksRes.data || []).filter((task: any) =>
        matchesProfileIdentity(task.assigned_to, profile)
      );
      const blogs = (blogsRes.data || []).filter((blog: any) =>
        matchesProfileIdentity(blog.author, profile)
      );
      const tasksDone = tasks.filter((task: any) => task.status === "done").length;
      const now = new Date().toISOString().slice(0, 10);

      return {
        tasks,
        tasksDone,
        tasksByStatus: {
          todo: tasks.filter((task: any) => task.status === "todo").length,
          in_progress: tasks.filter((task: any) => task.status === "in_progress").length,
          done: tasksDone,
        },
        overdue: tasks.filter((task: any) => task.due_date && task.due_date < now && task.status !== "done").length,
        blogsCount: blogs.length,
        blogsPublished: blogs.filter((blog: any) => blog.published).length,
        messagesCount: messagesRes.data?.length || 0,
        recentActivity: [
          ...tasks
            .sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime())
            .slice(0, 5)
            .map((task: any) => ({ type: "task", label: task.title, status: task.status, date: task.created_at })),
          ...blogs
            .sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime())
            .slice(0, 3)
            .map((blog: any) => ({
              type: "blog",
              label: blog.title,
              status: blog.published ? "published" : "draft",
              date: blog.created_at,
            })),
        ].sort((left, right) => new Date(right.date).getTime() - new Date(left.date).getTime()).slice(0, 8)
      };
    },
    enabled: !authLoading && usesPersonalDashboard && !!profile?.id
  });

  const isLoading = authLoading || (
    usesPersonalDashboard
      ? isTeamLoading
      : (
          isClientsLoading ||
          isInvoicesLoading ||
          isLeadsLoading ||
          isTasksLoading ||
          isSiteAnalyticsLoading ||
          isMeetingsLoading
        )
  );

  if (isLoading) return (
    <AppShell title="Dashboard" subtitle="Synchronizing agency intelligence...">
      <div className="flex flex-col items-center justify-center py-32 gap-4">
        <Loader2 className="animate-spin text-accent" size={40} />
        <span className="text-sm text-muted-foreground">Retrieving command center telemetry...</span>
      </div>
    </AppShell>
  );

  if (usesPersonalDashboard) {
    return (
      <AppShell title="Team Dashboard" subtitle={`Welcome back, ${profile?.full_name || 'Team member'} — here is your performance overview`}>
        <TeamDashboard profile={profile} stats={teamStats} />
      </AppShell>
    );
  }

  // ── ADMIN RENDER PREP ──
  const totalRevenue = clients.reduce((s, c) => s + (Number(c.monthly_revenue) || 0), 0);
  const activeClientsCount = clients.filter((c) => c.status === "active").length;
  const topClients = [...clients].filter((c) => c.status === "active").sort((a, b) => (b.total_health_score || 0) - (a.total_health_score || 0)).slice(0, 5);
  const atRiskClients = clients.filter((c) => (c.total_health_score || 0) < 50).sort((a, b) => (a.total_health_score || 0) - (b.total_health_score || 0));

  const portfolioHealth = clients.length
    ? Number(
        (
          clients.reduce((sum, client) => sum + (Number(client.total_health_score) || 0), 0) / clients.length
        ).toFixed(1)
      )
    : 0;
  const revenueTrend = calculateAmountMoM(allInvoices);
  const activeMeetingsCount = allMeetings.filter((m: any) => m.status === 'active').length;
  const leadConversionRate = siteAnalytics.length > 0 ? Math.round((leads.length / siteAnalytics.length) * 100) : 0;

  const stats = [
    { label: "Total Revenue", value: formatCurrency(totalRevenue), sub: `${activeClientsCount} active clients`, icon: CreditCard, color: "#a78bfa", bg: "rgba(167,139,250,0.12)", trend: revenueTrend },
    { label: "Agency Traffic", value: siteAnalytics.length, sub: "Real-time visitors", icon: TrendingUp, color: "#3b82f6", bg: "rgba(59,130,246,0.12)", trend: calculateMoM(siteAnalytics) },
    { label: "Active Meetings", value: activeMeetingsCount, sub: "Live sessions running", icon: Video, color: "#f59e0b", bg: "rgba(245,158,11,0.12)", trend: calculateMoM(allMeetings) },
    { label: "Lead Conversion", value: `${leadConversionRate}%`, sub: "Traffic to lead ratio", icon: Zap, color: "#10b981", bg: "rgba(16,185,129,0.12)", trend: 0 },
  ];

  return (
    <AppShell title="Dashboard" subtitle="Welcome back, Primansh — here's your agency overview">
      <AdminDashboard 
        stats={stats} 
        agencyTrend={generateAgencyTrend()} 
        clients={clients} 
        recentActivity={adminRecentActivity}
        topClients={topClients}
        atRiskClients={atRiskClients}
        totalRevenue={totalRevenue}
        activeClients={activeClientsCount}
        portfolioHealth={portfolioHealth}
        revenueTrend={revenueTrend}
      />
    </AppShell>
  );
}

function normalizeComparable(value?: string | null) {
  return (value || "").toLowerCase().trim().replace(/\s+/g, " ");
}

function matchesProfileIdentity(
  candidateValue: string | null | undefined,
  profile: { id: string; full_name: string | null }
) {
  const candidate = normalizeComparable(candidateValue);
  if (!candidate) return false;

  const fullName = normalizeComparable(profile.full_name);
  const firstName = normalizeComparable(profile.full_name?.split(" ")[0] || "");
  const lastName = normalizeComparable(profile.full_name?.split(" ").slice(1).join(" ") || "");

  return [profile.id.toLowerCase(), fullName, firstName, lastName].filter(Boolean).includes(candidate);
}

function sumAmountForMonth(
  rows: Array<{ amount: number | string; issued_date?: string | null; created_at?: string | null }>,
  monthOffset: number
) {
  const target = new Date();
  target.setMonth(target.getMonth() - monthOffset);

  return rows
    .filter((row) => {
      const rawDate = row.issued_date || row.created_at;
      if (!rawDate) return false;
      const date = new Date(rawDate);
      return date.getMonth() === target.getMonth() && date.getFullYear() === target.getFullYear();
    })
    .reduce((sum, row) => sum + (Number(row.amount) || 0), 0);
}

function calculateAmountMoM(
  rows: Array<{ amount: number | string; issued_date?: string | null; created_at?: string | null }>
) {
  const current = sumAmountForMonth(rows, 0);
  const previous = sumAmountForMonth(rows, 1);

  if (!previous) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
}
