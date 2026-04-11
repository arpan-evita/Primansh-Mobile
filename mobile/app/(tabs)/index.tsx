import React, { useEffect, useMemo, useState } from 'react';
import {
  type DimensionValue,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import {
  ArrowRight,
  BarChart3,
  Bell,
  Eye,
  Gauge,
  Menu,
  PenTool,
  Plus,
  Search,
  Sparkles,
  Star,
  TrendingDown,
  TrendingUp,
  Users,
  FileText,
} from 'lucide-react-native';
import { supabase } from '../../lib/supabase';
import { Colors, Fonts } from '../../lib/theme';
import { useMobileSession } from '../../context/MobileSessionContext';
import ClientDashboardScreen from '../../components/portal/ClientDashboardScreen';

type MetricState = {
  monthlyRevenue: number;
  monthlyRevenueChange: number;
  totalImpressions: number;
  totalImpressionsChange: number;
  avgEngagement: number;
  avgEngagementChange: number;
};

type MetricBarsState = {
  monthlyRevenue: number[];
  totalImpressions: number[];
  avgEngagement: number[];
};

type ProfileState = {
  full_name?: string | null;
  avatar_url?: string | null;
};

type ActivityRow = {
  id: string;
  title: string;
  subtitle: string;
  label: string;
  accent: string;
  icon: any;
};

const EMPTY_METRICS: MetricState = {
  monthlyRevenue: 0,
  monthlyRevenueChange: 0,
  totalImpressions: 0,
  totalImpressionsChange: 0,
  avgEngagement: 0,
  avgEngagementChange: 0,
};

const EMPTY_BARS: MetricBarsState = {
  monthlyRevenue: [0, 0, 0, 0, 0, 0, 0],
  totalImpressions: [0, 0, 0, 0, 0, 0, 0],
  avgEngagement: [0, 0, 0, 0, 0, 0, 0],
};

export default function DashboardScreen() {
  const { profile: sessionProfile } = useMobileSession();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [profile, setProfile] = useState<ProfileState | null>(null);
  const [metrics, setMetrics] = useState<MetricState>(EMPTY_METRICS);
  const [metricBars, setMetricBars] = useState<MetricBarsState>(EMPTY_BARS);
  const [activityRows, setActivityRows] = useState<ActivityRow[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const metricCardWidth: DimensionValue = width >= 1100 ? '31.8%' : width >= 720 ? '48.5%' : '100%';
  const actionCardWidth: DimensionValue = width >= 1100 ? '31.8%' : width >= 720 ? '48.5%' : '100%';

  if (sessionProfile?.normalizedRole === 'client') {
    return <ClientDashboardScreen />;
  }

  const quickActions = useMemo(
    () => [
      {
        title: 'New Article',
        description: 'Draft professional content with our AI-powered editor.',
        cta: 'Launch Editor',
        icon: PenTool,
        accent: '#85adff',
        glow: 'rgba(133, 173, 255, 0.12)',
        route: '/portal/articles/editor',
      },
      {
        title: 'Article Master',
        description: 'Manage and organize your entire publication library.',
        cta: 'View Library',
        icon: FileText,
        accent: '#9093ff',
        glow: 'rgba(144, 147, 255, 0.12)',
        route: '/portal/articles',
      },
      {
        title: 'Testimonials',
        description: 'Curate and publish client success stories and feedback.',
        cta: 'Manage Reviews',
        icon: Star,
        accent: '#85ffb0',
        glow: 'rgba(133, 255, 176, 0.12)',
        route: '/portal/testimonials',
      },
      {
        title: 'Team Hub',
        description: 'Collaborate with your team and manage roles effectively.',
        cta: 'Open Hub',
        icon: Users,
        accent: '#ff8585',
        glow: 'rgba(255, 133, 133, 0.12)',
        route: '/portal/team',
      },
      {
        title: 'Analytics',
        description: 'Deep dive into performance data and conversion metrics.',
        cta: 'Full Report',
        icon: BarChart3,
        accent: '#85adff',
        glow: 'rgba(133, 173, 255, 0.12)',
        route: '/portal/analytics',
      },
      {
        title: 'SEO Panel',
        description: 'Optimize your site for search engines and track ranking.',
        cta: 'View Stats',
        icon: Search,
        accent: '#9093ff',
        glow: 'rgba(144, 147, 255, 0.12)',
        route: '/portal/seo',
      },
    ],
    []
  );

  const metricCards = useMemo(
    () => [
      {
        label: 'Monthly Revenue',
        value: formatCurrency(metrics.monthlyRevenue),
        icon: TrendingUp,
        accent: '#85adff',
        change: metrics.monthlyRevenueChange,
        bars: metricBars.monthlyRevenue,
      },
      {
        label: 'Total Impressions',
        value: formatCompactNumber(metrics.totalImpressions),
        icon: Eye,
        accent: '#9093ff',
        change: metrics.totalImpressionsChange,
        bars: metricBars.totalImpressions,
      },
      {
        label: 'Avg. Engagement',
        value: `${metrics.avgEngagement.toFixed(1)}%`,
        icon: Gauge,
        accent: '#eef0ff',
        change: metrics.avgEngagementChange,
        bars: metricBars.avgEngagement,
      },
    ],
    [metricBars, metrics]
  );

  useEffect(() => {
    fetchDashboard();
  }, []);

  async function fetchDashboard() {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setMetrics(EMPTY_METRICS);
        setMetricBars(EMPTY_BARS);
        setActivityRows([]);
        setRefreshing(false);
        return;
      }

      const [profileRes, invoicesRes, analyticsRes, blogsRes, leadsRes, meetingsRes, tasksRes] = await Promise.all([
        supabase.from('profiles').select('full_name, avatar_url').eq('id', user.id).single(),
        supabase.from('invoices').select('amount, issued_date, created_at'),
        supabase.from('agency_analytics').select('traffic, leads, sort_order, month'),
        supabase.from('blogs').select('id, title, author, published, created_at').order('created_at', { ascending: false }).limit(5),
        supabase.from('leads').select('id, name, source, status, created_at').order('created_at', { ascending: false }).limit(5),
        supabase.from('meetings').select('id, status, start_time, created_at').order('created_at', { ascending: false }).limit(5),
        supabase.from('tasks').select('id, title, status, priority, created_at').order('created_at', { ascending: false }).limit(5),
      ]);

      if (profileRes.error) throw profileRes.error;
      if (invoicesRes.error) throw invoicesRes.error;
      if (analyticsRes.error) throw analyticsRes.error;
      if (blogsRes.error) throw blogsRes.error;
      if (leadsRes.error) throw leadsRes.error;
      if (meetingsRes.error) throw meetingsRes.error;
      if (tasksRes.error) throw tasksRes.error;

      if (profileRes.data) {
        setProfile(profileRes.data);
      }

      const invoices = invoicesRes.data || [];
      const analytics = [...(analyticsRes.data || [])].sort(
        (left, right) => (left.sort_order || 0) - (right.sort_order || 0)
      );
      const monthlyRevenue = sumForMonth(invoices, 0);
      const previousRevenue = sumForMonth(invoices, 1);
      const monthlyRevenueChange = calculateDelta(monthlyRevenue, previousRevenue);

      const totalImpressions = analytics.reduce((sum, row) => sum + (row.traffic || 0), 0);
      const latestTraffic = analytics.at(-1)?.traffic || 0;
      const previousTraffic = analytics.at(-2)?.traffic || 0;
      const totalImpressionsChange = calculateDelta(latestTraffic, previousTraffic);

      const totalLeads = analytics.reduce((sum, row) => sum + (row.leads || 0), 0);
      const avgEngagement = totalImpressions
        ? Number(((totalLeads / totalImpressions) * 100).toFixed(1))
        : 0;

      const latestEngagement = analytics.length
        ? ((analytics.at(-1)?.leads || 0) / Math.max(1, analytics.at(-1)?.traffic || 1)) * 100
        : 0;
      const previousEngagement = analytics.length > 1
        ? ((analytics.at(-2)?.leads || 0) / Math.max(1, analytics.at(-2)?.traffic || 1)) * 100
        : latestEngagement;

      setMetrics({
        monthlyRevenue,
        monthlyRevenueChange,
        totalImpressions,
        totalImpressionsChange,
        avgEngagement,
        avgEngagementChange: calculateDelta(latestEngagement, previousEngagement),
      });

      setMetricBars({
        monthlyRevenue: normalizeSeries(buildMonthlyRevenueSeries(invoices)),
        totalImpressions: normalizeSeries(analytics.map((row) => row.traffic || 0)),
        avgEngagement: normalizeSeries(
          analytics.map((row) => ((row.leads || 0) / Math.max(1, row.traffic || 1)) * 100)
        ),
      });

      const nextActivity = [
        ...(blogsRes.data || []).map((blog) => ({
          id: `blog-${blog.id}`,
          title: `${blog.title || 'Untitled article'}${blog.published ? ' published' : ' saved as draft'}`,
          subtitle: `${blog.author || 'Content team'} • ${formatRelativeTime(blog.created_at)}`,
          label: blog.published ? 'BLOG' : 'DRAFT',
          accent: blog.published ? '#85adff' : '#9093ff',
          icon: FileText,
          createdAt: blog.created_at,
        })),
        ...(leadsRes.data || []).map((lead) => ({
          id: `lead-${lead.id}`,
          title: `${lead.name || 'Lead'} captured from ${lead.source || 'website'}`,
          subtitle: `${lead.status?.toUpperCase() || 'NEW'} • ${formatRelativeTime(lead.created_at)}`,
          label: 'LEAD',
          accent: '#85ffb0',
          icon: Users,
          createdAt: lead.created_at,
        })),
        ...(meetingsRes.data || []).map((meeting) => ({
          id: `meeting-${meeting.id}`,
          title: `Meeting room ${meeting.status === 'active' ? 'is live' : 'updated'}`,
          subtitle: `${meeting.status?.toUpperCase() || 'MEETING'} • ${formatRelativeTime(meeting.start_time || meeting.created_at)}`,
          label: 'CALL',
          accent: '#ff8585',
          icon: BarChart3,
          createdAt: meeting.start_time || meeting.created_at,
        })),
        ...(tasksRes.data || []).map((task) => ({
          id: `task-${task.id}`,
          title: `${task.title || 'Task'} ${task.status === 'done' ? 'completed' : 'updated'}`,
          subtitle: `${(task.priority || 'medium').toUpperCase()} PRIORITY • ${formatRelativeTime(task.created_at)}`,
          label: 'TASK',
          accent: task.status === 'done' ? '#85ffb0' : '#eef0ff',
          icon: PenTool,
          createdAt: task.created_at,
        })),
      ]
        .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
        .slice(0, 5)
        .map(({ createdAt, ...item }) => item);

      setActivityRows(nextActivity);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      setMetrics(EMPTY_METRICS);
      setMetricBars(EMPTY_BARS);
      setActivityRows([]);
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <View pointerEvents="none" style={styles.backgroundOrbPrimary} />
      <View pointerEvents="none" style={styles.backgroundOrbSecondary} />

      <View style={styles.headerShell}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => router.push('/more')}
              style={styles.headerIconButton}
            >
              <Menu color="#85adff" size={20} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Dashboard</Text>
          </View>

          <View style={styles.headerRight}>
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => router.push('/portal/articles/editor')}
              style={styles.copilotWrapper}
            >
              <LinearGradient
                colors={['#85adff', '#9093ff']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.copilotButton}
              >
                <Sparkles color="#00132d" size={16} />
                <Text style={styles.copilotText}>AI COPILOT</Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => router.push('/portal/articles/editor')}
              style={styles.secondaryHeaderButton}
            >
              <Plus color={Colors.slate500} size={18} />
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => router.push('/messages')}
              style={styles.secondaryHeaderButton}
            >
              <Bell color={Colors.slate500} size={18} />
              <View style={styles.notificationDot} />
            </TouchableOpacity>

            <View style={styles.avatarShell}>
              {profile?.avatar_url ? (
                <Image source={{ uri: profile.avatar_url }} style={styles.avatarImage} />
              ) : (
                <Text style={styles.avatarText}>{getInitial(profile?.full_name)}</Text>
              )}
            </View>
          </View>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              fetchDashboard();
            }}
            tintColor={Colors.accent}
            progressViewOffset={90}
          />
        }
      >
        <View style={styles.section}>
          <View style={styles.grid}>
            {metricCards.map((card) => (
              <MetricPanel key={card.label} card={card} width={metricCardWidth} />
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.grid}>
            {quickActions.map((action) => (
              <QuickActionCard
                key={action.title}
                action={action}
                width={actionCardWidth}
                onPress={() => router.push(action.route as any)}
              />
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Activity</Text>
          <View style={styles.activityPanel}>
            {activityRows.length > 0 ? (
              activityRows.map((item, index) => (
                <ActivityItemRow
                  key={item.id}
                  item={item}
                  isLast={index === activityRows.length - 1}
                />
              ))
            ) : (
              <View style={styles.activityEmptyState}>
                <Text style={styles.activityEmptyTitle}>No recent activity yet</Text>
                <Text style={styles.activityEmptySubtitle}>New leads, articles, tasks, and meetings will appear here.</Text>
              </View>
            )}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function MetricPanel({
  card,
  width,
}: {
  card: {
    label: string;
    value: string;
    icon: any;
    accent: string;
    change: number;
    bars: number[];
  };
  width: DimensionValue;
}) {
  const Icon = card.icon;
  const isPositive = card.change >= 0;
  const TrendIcon = isPositive ? TrendingUp : TrendingDown;

  return (
    <View style={[styles.metricCard, { width }]}>
      <View style={[styles.metricGlow, { backgroundColor: card.accent, opacity: 0.08 }]} />

      <View style={styles.metricTop}>
        <View style={[styles.metricIconWrap, { backgroundColor: `${card.accent}1A` }]}> 
          <Icon color={card.accent} size={18} />
        </View>

        <View
          style={[
            styles.metricTrendBadge,
            {
              backgroundColor: isPositive ? 'rgba(16, 185, 129, 0.1)' : 'rgba(255, 113, 108, 0.1)',
            },
          ]}
        >
          <Text style={[styles.metricTrendText, { color: isPositive ? '#34d399' : '#ff716c' }]}> 
            {isPositive ? '+' : ''}
            {card.change.toFixed(1)}%
          </Text>
          <TrendIcon color={isPositive ? '#34d399' : '#ff716c'} size={12} />
        </View>
      </View>

      <Text style={styles.metricLabel}>{card.label}</Text>
      <Text style={styles.metricValue}>{card.value}</Text>

      <View style={styles.metricBars}>
        {card.bars.map((height, index) => (
          <View key={`${card.label}-${index}`} style={styles.metricBarTrack}>
            <View
              style={[
                styles.metricBarFill,
                {
                  backgroundColor: index === card.bars.length - 1 ? card.accent : `${card.accent}55`,
                  height: `${height * 100}%`,
                },
              ]}
            />
          </View>
        ))}
      </View>
    </View>
  );
}

function QuickActionCard({
  action,
  width,
  onPress,
}: {
  action: {
    title: string;
    description: string;
    cta: string;
    icon: any;
    accent: string;
    glow: string;
  };
  width: DimensionValue;
  onPress: () => void;
}) {
  const Icon = action.icon;

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={onPress}
      style={[styles.quickActionCard, { width }]}
    >
      <View style={[styles.quickActionGlow, { backgroundColor: action.glow }]} />
      <View style={[styles.quickActionIconWrap, { backgroundColor: `${action.accent}1A` }]}> 
        <Icon color={action.accent} size={28} />
      </View>
      <Text style={styles.quickActionTitle}>{action.title}</Text>
      <Text style={styles.quickActionDescription}>{action.description}</Text>
      <View style={styles.quickActionFooter}>
        <Text style={[styles.quickActionCta, { color: action.accent }]}>{action.cta}</Text>
        <ArrowRight color={action.accent} size={14} />
      </View>
    </TouchableOpacity>
  );
}

function ActivityItemRow({
  item,
  isLast,
}: {
  item: ActivityRow;
  isLast: boolean;
}) {
  const Icon = item.icon;

  return (
    <View style={[styles.activityRow, !isLast && styles.activityRowBorder]}>
      <View style={[styles.activityIconWrap, { backgroundColor: `${item.accent}20` }]}> 
        <Icon color={item.accent} size={18} />
      </View>

      <View style={styles.activityTextWrap}>
        <Text style={styles.activityTitle}>{item.title}</Text>
        <Text style={styles.activitySubtitle}>{item.subtitle}</Text>
      </View>

      <Text style={styles.activityLabel}>{item.label}</Text>
    </View>
  );
}

function sumForMonth(
  invoices: Array<{ amount: number | string; issued_date?: string | null; created_at?: string | null }>,
  monthOffset: number
) {
  const target = new Date();
  target.setMonth(target.getMonth() - monthOffset);

  return invoices
    .filter((invoice) => {
      const rawDate = invoice.issued_date || invoice.created_at;
      if (!rawDate) return false;
      const date = new Date(rawDate);
      return date.getMonth() === target.getMonth() && date.getFullYear() === target.getFullYear();
    })
    .reduce((sum, invoice) => sum + (Number(invoice.amount) || 0), 0);
}

function calculateDelta(current: number, previous: number) {
  if (!previous) return current > 0 ? 100 : 0;
  return Number((((current - previous) / previous) * 100).toFixed(1));
}

function buildMonthlyRevenueSeries(
  invoices: Array<{ amount: number | string; issued_date?: string | null; created_at?: string | null }>,
  months = 7
) {
  const buckets: number[] = [];

  for (let offset = months - 1; offset >= 0; offset -= 1) {
    buckets.push(sumForMonth(invoices, offset));
  }

  return buckets;
}

function normalizeSeries(values: number[], targetLength = 7) {
  const trimmed = values.slice(-targetLength);
  const padded = [...Array(Math.max(0, targetLength - trimmed.length)).fill(0), ...trimmed];
  const max = Math.max(...padded, 0);

  if (max <= 0) {
    return padded.map(() => 0);
  }

  return padded.map((value) => Number((value / max).toFixed(3)));
}

function formatRelativeTime(value?: string | null) {
  if (!value) return 'Just now';

  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) return 'Just now';

  const diff = Date.now() - timestamp;
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diff < minute) return 'Just now';
  if (diff < hour) return `${Math.max(1, Math.floor(diff / minute))}m ago`;
  if (diff < day) return `${Math.max(1, Math.floor(diff / hour))}h ago`;
  if (diff < 7 * day) return `${Math.max(1, Math.floor(diff / day))}d ago`;

  return new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value);
}

function formatCompactNumber(value: number) {
  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: value >= 1000000 ? 1 : 0,
  }).format(value);
}

function getInitial(name?: string | null) {
  return name?.trim()?.[0]?.toUpperCase() || 'U';
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#090e1b',
  },
  backgroundOrbPrimary: {
    position: 'absolute',
    top: -40,
    right: -50,
    width: 220,
    height: 220,
    borderRadius: 999,
    backgroundColor: 'rgba(133, 173, 255, 0.12)',
  },
  backgroundOrbSecondary: {
    position: 'absolute',
    top: 280,
    left: -80,
    width: 200,
    height: 200,
    borderRadius: 999,
    backgroundColor: 'rgba(144, 147, 255, 0.08)',
  },
  headerShell: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    backgroundColor: 'rgba(9, 14, 27, 0.82)',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.12)',
  },
  header: {
    height: 72,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerIconButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  headerTitle: {
    fontFamily: Fonts.Outfit_700Bold,
    fontSize: 20,
    color: '#85adff',
    letterSpacing: -0.4,
  },
  copilotWrapper: {
    borderRadius: 999,
    overflow: 'hidden',
    shadowColor: '#85adff',
    shadowOpacity: 0.25,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 },
    elevation: 3,
  },
  copilotButton: {
    height: 36,
    paddingHorizontal: 14,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  copilotText: {
    fontFamily: Fonts.Outfit_700Bold,
    fontSize: 11,
    color: '#00132d',
    letterSpacing: 0.8,
  },
  secondaryHeaderButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  notificationDot: {
    position: 'absolute',
    top: 9,
    right: 10,
    width: 7,
    height: 7,
    borderRadius: 99,
    backgroundColor: '#9093ff',
  },
  avatarShell: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#1e2538',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarText: {
    fontFamily: Fonts.Outfit_700Bold,
    color: '#e4e7fb',
    fontSize: 16,
  },
  scrollContent: {
    paddingTop: 96,
    paddingHorizontal: 20,
    paddingBottom: 128,
  },
  section: {
    marginBottom: 28,
  },
  sectionTitle: {
    fontFamily: Fonts.Outfit_700Bold,
    fontSize: 22,
    color: '#e4e7fb',
    marginBottom: 16,
    paddingHorizontal: 2,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
  },
  metricCard: {
    minHeight: 204,
    borderRadius: 24,
    backgroundColor: '#131929',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    padding: 20,
    overflow: 'hidden',
  },
  metricGlow: {
    position: 'absolute',
    top: -70,
    right: -50,
    width: 170,
    height: 170,
    borderRadius: 999,
  },
  metricTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  metricIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricTrendBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  metricTrendText: {
    fontFamily: Fonts.Outfit_700Bold,
    fontSize: 11,
  },
  metricLabel: {
    fontFamily: Fonts.Outfit_500Medium,
    fontSize: 14,
    color: '#a6aabc',
  },
  metricValue: {
    marginTop: 4,
    fontFamily: Fonts.Outfit_700Bold,
    fontSize: 34,
    color: '#e4e7fb',
    letterSpacing: -0.8,
  },
  metricBars: {
    marginTop: 22,
    height: 50,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
  },
  metricBarTrack: {
    flex: 1,
    height: '100%',
    justifyContent: 'flex-end',
  },
  metricBarFill: {
    width: '100%',
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
    minHeight: 8,
  },
  quickActionCard: {
    minHeight: 228,
    borderRadius: 28,
    backgroundColor: '#131929',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    padding: 24,
    overflow: 'hidden',
  },
  quickActionGlow: {
    ...StyleSheet.absoluteFillObject,
  },
  quickActionIconWrap: {
    width: 60,
    height: 60,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  quickActionTitle: {
    fontFamily: Fonts.Outfit_700Bold,
    fontSize: 22,
    color: '#e4e7fb',
    marginBottom: 8,
  },
  quickActionDescription: {
    fontFamily: Fonts.Outfit_400Regular,
    fontSize: 14,
    lineHeight: 22,
    color: '#a6aabc',
  },
  quickActionFooter: {
    marginTop: 22,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  quickActionCta: {
    fontFamily: Fonts.Outfit_700Bold,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  activityPanel: {
    borderRadius: 28,
    overflow: 'hidden',
    backgroundColor: '#0d1321',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  activityEmptyState: {
    paddingHorizontal: 20,
    paddingVertical: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityEmptyTitle: {
    fontFamily: Fonts.Outfit_700Bold,
    fontSize: 16,
    color: '#e4e7fb',
    textAlign: 'center',
  },
  activityEmptySubtitle: {
    marginTop: 6,
    fontFamily: Fonts.Outfit_400Regular,
    fontSize: 12,
    color: '#a6aabc',
    textAlign: 'center',
    lineHeight: 18,
  },
  activityRow: {
    paddingHorizontal: 20,
    paddingVertical: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  activityRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  activityIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityTextWrap: {
    flex: 1,
  },
  activityTitle: {
    fontFamily: Fonts.Outfit_600SemiBold,
    fontSize: 15,
    color: '#e4e7fb',
    marginBottom: 2,
  },
  activitySubtitle: {
    fontFamily: Fonts.Outfit_400Regular,
    fontSize: 12,
    color: '#a6aabc',
  },
  activityLabel: {
    fontFamily: Fonts.Outfit_700Bold,
    fontSize: 11,
    color: '#a6aabc',
    letterSpacing: 0.7,
  },
});


