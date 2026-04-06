import { AppShell } from "@/components/layout/AppShell";
import { analyticsData, clients, invoices } from "@/lib/mockData";
import { formatCurrency } from "@/lib/utils";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip, ResponsiveContainer, AreaChart, Area } from "recharts";
import { Download, Calendar, ArrowUpRight, Loader2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { format, subMonths, startOfMonth } from "date-fns";

export default function AnalyticsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin_analytics_full'],
    queryFn: async () => {
      const { data: invoices } = await supabase.from('invoices').select('amount, issued_date, status');
      const { data: leads } = await supabase.from('leads').select('source');
      const { data: clients } = await supabase.from('clients').select('status, monthly_revenue');

      // 1. Revenue Growth (Last 6 Months)
      const last6Months = Array.from({ length: 6 }).map((_, i) => subMonths(new Date(), 5 - i));
      const revenueData = last6Months.map(date => {
        const monthStart = startOfMonth(date);
        const nextMonth = startOfMonth(subMonths(date, -1));
        const monthSum = (invoices || [])
          .filter(inv => inv.status === 'paid' && inv.issued_date && new Date(inv.issued_date) >= monthStart && new Date(inv.issued_date) < nextMonth)
          .reduce((sum, inv) => sum + Number(inv.amount), 0);
        return { month: format(date, 'MMM'), amount: monthSum };
      });

      const currentMonthRev = revenueData[5].amount;
      const lastMonthRev = revenueData[4].amount;
      const revGrowth = lastMonthRev === 0 ? (currentMonthRev > 0 ? 100 : 0) : ((currentMonthRev - lastMonthRev) / lastMonthRev) * 100;

      // 2. Client Acquisition
      const sourceMap: Record<string, number> = {};
      let totalLeads = 0;
      (leads || []).forEach(l => {
        const src = (l.source || 'other').toLowerCase();
        sourceMap[src] = (sourceMap[src] || 0) + 1;
        totalLeads++;
      });
      
      const colors = ["#10b981", "#3b82f6", "#a78bfa", "#f59e0b"];
      const rawAcquisition = Object.entries(sourceMap)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 4)
        .map(([slug, count], i) => {
          let sourceLabel = slug;
          if (slug === 'google' || slug === 'seo') sourceLabel = 'Google Organic';
          if (slug === 'referral') sourceLabel = 'Referrals';
          if (slug === 'social' || slug === 'social media') sourceLabel = 'Social Media';
          if (slug === 'website') sourceLabel = 'Direct Sales';
          return {
            source: sourceLabel,
            count,
            pct: totalLeads > 0 ? Math.round((count / totalLeads) * 100) : 0,
            color: colors[i % colors.length]
          };
        });
      const acquisitionData = rawAcquisition.length > 0 ? rawAcquisition : [{ source: 'No Data', count: 0, pct: 0, color: '#475569' }];

      // 3. LTV & Churn Rate
      const totalClients = clients?.length || 0;
      const inactiveClients = (clients || []).filter(c => c.status === 'inactive').length;
      const churnRate = totalClients > 0 ? (inactiveClients / totalClients) * 100 : 0;
      
      const totalMonthlyRev = (clients || []).reduce((sum, c) => sum + (Number(c.monthly_revenue) || 0), 0);
      const activeClients = totalClients - inactiveClients;
      const arpu = activeClients > 0 ? totalMonthlyRev / activeClients : 0;
      const ltv = arpu * 12; // 12-month expected lifespan metric

      return { revenueData, currentMonthRev, revGrowth, acquisitionData, ltv, churnRate };
    }
  });

  if (isLoading || !data) return (
    <AppShell title="Analytics Overview" subtitle="Agency performance and financial metrics">
      <div className="flex flex-col items-center justify-center py-32 gap-4">
        <Loader2 className="animate-spin text-accent" size={40} />
        <span className="text-sm text-muted-foreground">Aggregating intelligence metrics...</span>
      </div>
    </AppShell>
  );

  return (
    <AppShell title="Analytics Overview" subtitle="Agency performance and financial metrics">
      <div className="fade-up space-y-6">
        {/* Top bar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg" style={{ background: "rgba(15,22,41,0.8)", border: "1px solid rgba(99,128,191,0.15)" }}>
            <Calendar size={13} style={{ color: "#475569" }} />
            <span className="text-xs" style={{ color: "#94a3b8" }}>Last 6 Months</span>
          </div>
          <button className="btn-ghost flex items-center gap-1.5 text-xs">
            <Download size={13} /> Export PDF
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-6">
          {/* Revenue Chart */}
          <div className="glass-card p-5">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="text-sm font-semibold text-white">Revenue Growth</h3>
                <p className="text-xs mt-1" style={{ color: "#475569" }}>Monthly billed amount</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-white">{formatCurrency(data.currentMonthRev)}</p>
                <p className={`text-xs ${data.revGrowth >= 0 ? 'text-emerald-400' : 'text-red-400'} flex items-center justify-end gap-1 mt-1`}>
                  <ArrowUpRight size={12} className={data.revGrowth < 0 ? "rotate-180" : ""} /> {data.revGrowth > 0 ? '+' : ''}{data.revGrowth.toFixed(1)}% vs last month
                </p>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={data.revenueData} barSize={32}>
                <CartesianGrid stroke="rgba(99,128,191,0.08)" vertical={false} />
                <XAxis dataKey="month" tick={{ fill: "#475569", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#475569", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `₹${v/1000}k`} />
                <ReTooltip
                  cursor={{ fill: "rgba(99,128,191,0.05)" }}
                  contentStyle={{ background: "#0f1629", border: "1px solid rgba(99,128,191,0.2)", borderRadius: 8, fontSize: 12 }}
                  formatter={(v: any) => formatCurrency(v as number)}
                />
                <Bar dataKey="amount" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Client Acquisition Matrix */}
          <div className="glass-card p-5">
            <h3 className="text-sm font-semibold text-white mb-4">Client Acquisition</h3>
            <div className="space-y-4">
              {data.acquisitionData.map((src) => (
                <div key={src.source}>
                  <div className="flex justify-between text-xs mb-1.5">
                    <span style={{ color: "#94a3b8" }}>{src.source}</span>
                    <span className="font-semibold text-white">{src.count} <span style={{ color: "#475569", fontWeight: "normal" }}>({src.pct}%)</span></span>
                  </div>
                  <div className="h-1.5 rounded-full" style={{ background: "rgba(99,128,191,0.1)" }}>
                    <div className="h-1.5 rounded-full" style={{ width: `${src.pct}%`, background: src.color }} />
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 pt-5" style={{ borderTop: "1px solid rgba(99,128,191,0.08)" }}>
              <div className="flex justify-between items-center bg-[rgba(99,128,191,0.04)] p-3 rounded-lg border border-[rgba(99,128,191,0.08)]">
                <div>
                  <p className="text-xs" style={{ color: "#475569" }}>Lifetime Value (LTV)</p>
                  <p className="text-sm font-bold text-white mt-0.5">{formatCurrency(data.ltv)}</p>
                </div>
                <div>
                  <p className="text-xs" style={{ color: "#475569" }}>Churn Rate</p>
                  <p className="text-sm font-bold text-white mt-0.5 text-right">{data.churnRate.toFixed(1)}%</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
