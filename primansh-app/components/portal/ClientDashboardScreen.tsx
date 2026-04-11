import React, { useMemo } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  Bell,
  CalendarDays,
  CheckCircle2,
  CreditCard,
  FileText,
  FolderOpen,
  MessageSquare,
  TrendingUp,
  UserCircle2,
} from 'lucide-react-native';

import { useClientPortalData } from '../../hooks/useClientPortalData';
import { supabase } from '../../lib/supabase';
import { Colors, Fonts } from '../../lib/theme';

const DOCUMENT_BUCKET = 'client-documents';

function formatRelativeDate(value?: string | null) {
  if (!value) return 'Just now';

  const date = new Date(value);
  const diff = Date.now() - date.getTime();
  const minute = 60_000;
  const hour = minute * 60;
  const day = hour * 24;

  if (diff < minute) return 'Just now';
  if (diff < hour) return `${Math.max(1, Math.floor(diff / minute))}m ago`;
  if (diff < day) return `${Math.max(1, Math.floor(diff / hour))}h ago`;
  if (diff < day * 7) return `${Math.max(1, Math.floor(diff / day))}d ago`;

  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function formatMeetingTime(value?: string | null) {
  if (!value) return 'Meeting time pending';
  const date = new Date(value);
  return `${date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} • ${date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })}`;
}

function buildTrafficSeries(events: any[]) {
  return Array.from({ length: 7 }).map((_, index) => {
    const day = new Date();
    day.setDate(day.getDate() - (6 - index));
    const key = day.toISOString().slice(0, 10);
    const total = events.filter((item) => String(item.timestamp || '').startsWith(key)).length;
    return {
      label: day.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
      value: total,
    };
  });
}

export default function ClientDashboardScreen() {
  const router = useRouter();
  const {
    detail,
    documents,
    meetings,
    loading,
    refreshing,
    summary,
    notifications,
    unreadNotifications,
    markNotificationRead,
    markAllNotificationsRead,
    refresh,
  } = useClientPortalData();

  const trafficSeries = useMemo(
    () => buildTrafficSeries(detail?.siteAnalytics || []),
    [detail?.siteAnalytics]
  );
  const maxTraffic = Math.max(...trafficSeries.map((item) => item.value), 1);
  const quickDocs = documents.slice(0, 3);
  const recentUpdates = (detail?.updates || []).slice(0, 5);
  const activeMeetings = meetings.filter((meeting) => meeting.status === 'active');
  const upcomingMeetings = meetings
    .filter((meeting) => meeting.status !== 'ended')
    .sort((left, right) => new Date(left.start_time || left.created_at).getTime() - new Date(right.start_time || right.created_at).getTime())
    .slice(0, 3);
  const projectManager = detail?.teamMembers?.[0] || null;
  const overdueInvoices = (detail?.invoices || []).filter((invoice: any) => invoice.status === 'overdue').length;

  const openQuickDocument = async (documentId: string) => {
    const selected = quickDocs.find((item) => item.id === documentId);
    if (!selected) return;

    try {
      const { data, error } = await supabase.storage
        .from(DOCUMENT_BUCKET)
        .createSignedUrl(selected.file_path, 60 * 10);

      if (error || !data?.signedUrl) throw error || new Error('Could not open this file.');
      router.push('/docs');
    } catch (error) {
      console.error('[ClientDashboard] quick document open failed', error);
      router.push('/docs');
    }
  };

  if (loading && !detail) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={Colors.accent} />
          <Text style={styles.loadingText}>Loading your client portal...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={Colors.accent} />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={styles.headerCopy}>
            <Text style={styles.title}>
              Welcome back{detail?.client?.contact_name ? `, ${detail.client.contact_name}` : ''}
            </Text>
            <Text style={styles.subtitle}>
              {detail?.client?.firm_name || 'Your project portal'} • {detail?.client?.location || 'Primansh Agency OS'}
            </Text>
          </View>
          <TouchableOpacity activeOpacity={0.9} style={styles.notificationChip} onPress={() => void markAllNotificationsRead()}>
            <Bell color="#85adff" size={16} />
            <Text style={styles.notificationChipText}>{unreadNotifications} new</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.metricGrid}>
          <MetricCard
            label="Project"
            value={detail?.client?.status === 'active' ? 'Active' : detail?.client?.status || 'Live'}
            helper={`${detail?.client?.plan_type || 'basic'} plan`}
            icon={<TrendingUp color="#85adff" size={18} />}
          />
          <MetricCard
            label="Tasks"
            value={String(summary.activeTasks)}
            helper={`${summary.completedTasks} completed`}
            icon={<CheckCircle2 color="#34d399" size={18} />}
          />
          <MetricCard
            label="Invoices"
            value={String(summary.pendingInvoices)}
            helper={overdueInvoices > 0 ? `${overdueInvoices} overdue` : 'No overdue bills'}
            icon={<CreditCard color="#f59e0b" size={18} />}
          />
          <MetricCard
            label="Meetings"
            value={String(summary.upcomingMeetings)}
            helper={activeMeetings.length > 0 ? `${activeMeetings.length} live now` : 'Upcoming only'}
            icon={<CalendarDays color="#9093ff" size={18} />}
          />
        </View>

        <View style={styles.actionRow}>
          <QuickAction label="Tasks" onPress={() => router.push('/tasks')} />
          <QuickAction label="Messages" onPress={() => router.push('/messages')} />
          <QuickAction label="Docs" onPress={() => router.push('/docs')} />
          <QuickAction label="Billing" onPress={() => router.push('/portal/billing')} />
          <QuickAction label="Reports" onPress={() => router.push('/portal/analytics')} />
          <QuickAction label="Settings" onPress={() => router.push('/profile')} />
        </View>

        <Card title="Project Performance" actionLabel="Reports" onPress={() => router.push('/portal/analytics')}>
          <Text style={styles.cardNote}>Website traffic from your synced client site analytics.</Text>
          <View style={styles.chartWrap}>
            {trafficSeries.map((point) => (
              <View key={point.label} style={styles.chartColumn}>
                <View style={styles.chartBarTrack}>
                  <View
                    style={[
                      styles.chartBarFill,
                      { height: `${Math.max(0.08, point.value / maxTraffic) * 100}%` },
                    ]}
                  />
                </View>
                <Text style={styles.chartLabel}>{point.label}</Text>
              </View>
            ))}
          </View>
          <Text style={styles.chartSummary}>
            {summary.last30DayViews} tracked events loaded from the latest synced report window.
          </Text>
        </Card>

        <Card title="Project Manager">
          <View style={styles.managerRow}>
            <View style={styles.managerAvatar}>
              <Text style={styles.managerAvatarText}>
                {(projectManager?.full_name || 'A').charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={styles.managerCopy}>
              <Text style={styles.managerName}>{projectManager?.full_name || 'Account Manager'}</Text>
              <Text style={styles.managerRole}>{projectManager?.role || 'Growth Specialist'}</Text>
            </View>
            <TouchableOpacity style={styles.managerButton} onPress={() => router.push('/messages')}>
              <MessageSquare color="#020617" size={14} />
              <Text style={styles.managerButtonText}>Message</Text>
            </TouchableOpacity>
          </View>
        </Card>

        <Card title="Recent Updates" actionLabel="Tasks" onPress={() => router.push('/tasks')}>
          {recentUpdates.length > 0 ? (
            recentUpdates.map((item) => (
              <View key={item.id} style={styles.listRow}>
                <View style={styles.listCopy}>
                  <Text style={styles.listTitle}>{item.title}</Text>
                  <Text style={styles.listSubtitle}>{item.description || item.type}</Text>
                </View>
                <Text style={styles.listMeta}>{formatRelativeDate(item.created_at)}</Text>
              </View>
            ))
          ) : (
            <EmptyCopy text="Fresh progress updates will show here as the team moves your project forward." />
          )}
        </Card>

        <Card title="Upcoming Meetings" actionLabel="Meetings" onPress={() => router.push('/meetings')}>
          {upcomingMeetings.length > 0 ? (
            upcomingMeetings.map((meeting) => (
              <TouchableOpacity
                key={meeting.id}
                activeOpacity={0.88}
                style={styles.listRow}
                onPress={() => router.push(`/portal/meetings/room?id=${meeting.id}&audioOnly=${meeting.is_audio_only ? 'true' : 'false'}`)}
              >
                <View style={styles.listCopy}>
                  <Text style={styles.listTitle}>{meeting.conversation?.title || 'Project meeting'}</Text>
                  <Text style={styles.listSubtitle}>
                    {meeting.is_audio_only ? 'Audio room' : 'Video call'} • {formatMeetingTime(meeting.start_time)}
                  </Text>
                </View>
                <Text style={[styles.listMeta, meeting.status === 'active' && styles.liveMeta]}>
                  {meeting.status === 'active' ? 'Live' : 'Join'}
                </Text>
              </TouchableOpacity>
            ))
          ) : (
            <EmptyCopy text="No upcoming calls are scheduled right now." />
          )}
        </Card>

        <Card title="Quick Documents" actionLabel="Docs" onPress={() => router.push('/docs')}>
          {quickDocs.length > 0 ? (
            quickDocs.map((document) => (
              <TouchableOpacity
                key={document.id}
                activeOpacity={0.88}
                style={styles.listRow}
                onPress={() => void openQuickDocument(document.id)}
              >
                <View style={styles.listCopy}>
                  <Text style={styles.listTitle}>{document.name}</Text>
                  <Text style={styles.listSubtitle}>
                    {document.type} • {formatRelativeDate(document.created_at)}
                  </Text>
                </View>
                <FolderOpen color="#85adff" size={16} />
              </TouchableOpacity>
            ))
          ) : (
            <EmptyCopy text="Documents shared by the agency will appear here automatically." />
          )}
        </Card>

        <Card title="Notifications" actionLabel="Mark all read" onPress={() => void markAllNotificationsRead()}>
          {notifications.length > 0 ? (
            notifications.slice(0, 5).map((item) => (
              <TouchableOpacity
                key={item.id}
                activeOpacity={0.88}
                style={[styles.listRow, !item.read && styles.unreadRow]}
                onPress={() => void markNotificationRead(item.id)}
              >
                <View style={styles.listCopy}>
                  <Text style={styles.listTitle}>{item.title}</Text>
                  <Text style={styles.listSubtitle}>{item.message}</Text>
                </View>
                <Text style={styles.listMeta}>{formatRelativeDate(item.created_at)}</Text>
              </TouchableOpacity>
            ))
          ) : (
            <EmptyCopy text="You’re all caught up." />
          )}
        </Card>

        <Card title="Monthly Snapshot">
          <View style={styles.snapshotGrid}>
            <SnapshotStat label="Documents" value={String(summary.documentCount)} icon={<FileText color="#85adff" size={16} />} />
            <SnapshotStat label="Messages" value={String(detail?.metrics.messages || 0)} icon={<MessageSquare color="#34d399" size={16} />} />
            <SnapshotStat label="Leads" value={String(detail?.metrics.leads || 0)} icon={<TrendingUp color="#f59e0b" size={16} />} />
            <SnapshotStat label="Team" value={String(detail?.teamMembers.length || 0)} icon={<UserCircle2 color="#9093ff" size={16} />} />
          </View>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

function MetricCard({
  label,
  value,
  helper,
  icon,
}: {
  label: string;
  value: string;
  helper: string;
  icon: React.ReactNode;
}) {
  return (
    <View style={styles.metricCard}>
      <View style={styles.metricIcon}>{icon}</View>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricHelper}>{helper}</Text>
    </View>
  );
}

function Card({
  title,
  actionLabel,
  onPress,
  children,
}: {
  title: string;
  actionLabel?: string;
  onPress?: () => void;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>{title}</Text>
        {actionLabel && onPress ? (
          <TouchableOpacity activeOpacity={0.88} onPress={onPress}>
            <Text style={styles.cardAction}>{actionLabel}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
      {children}
    </View>
  );
}

function QuickAction({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <TouchableOpacity activeOpacity={0.88} style={styles.actionChip} onPress={onPress}>
      <Text style={styles.actionChipText}>{label}</Text>
    </TouchableOpacity>
  );
}

function EmptyCopy({ text }: { text: string }) {
  return <Text style={styles.emptyText}>{text}</Text>;
}

function SnapshotStat({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <View style={styles.snapshotCard}>
      <View style={styles.snapshotIcon}>{icon}</View>
      <Text style={styles.snapshotLabel}>{label}</Text>
      <Text style={styles.snapshotValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#090e1b',
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontFamily: Fonts.Outfit_500Medium,
    fontSize: 14,
    color: Colors.slate500,
  },
  content: {
    padding: 20,
    paddingBottom: 120,
    gap: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    alignItems: 'flex-start',
  },
  headerCopy: {
    flex: 1,
    gap: 6,
  },
  title: {
    fontFamily: Fonts.Outfit_700Bold,
    fontSize: 28,
    color: '#fff',
    letterSpacing: -0.6,
  },
  subtitle: {
    fontFamily: Fonts.Outfit_400Regular,
    fontSize: 13,
    lineHeight: 20,
    color: Colors.slate500,
  },
  notificationChip: {
    minHeight: 40,
    borderRadius: 999,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(133, 173, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(133, 173, 255, 0.16)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  notificationChipText: {
    fontFamily: Fonts.Outfit_700Bold,
    fontSize: 11,
    color: '#85adff',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  metricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  metricCard: {
    width: '48.2%',
    minHeight: 124,
    borderRadius: 22,
    padding: 16,
    backgroundColor: '#121a2b',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  metricIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  metricLabel: {
    fontFamily: Fonts.SpaceMono_400Regular,
    fontSize: 9,
    color: Colors.slate500,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  metricValue: {
    marginTop: 8,
    fontFamily: Fonts.Outfit_700Bold,
    fontSize: 26,
    color: '#fff',
  },
  metricHelper: {
    marginTop: 4,
    fontFamily: Fonts.Outfit_400Regular,
    fontSize: 12,
    color: '#a6aabc',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
  },
  actionChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: '#141d2f',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  actionChipText: {
    fontFamily: Fonts.Outfit_700Bold,
    fontSize: 12,
    color: '#dbe4ff',
  },
  card: {
    borderRadius: 24,
    padding: 18,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    gap: 14,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    alignItems: 'center',
  },
  cardTitle: {
    fontFamily: Fonts.Outfit_700Bold,
    fontSize: 18,
    color: '#fff',
  },
  cardAction: {
    fontFamily: Fonts.Outfit_700Bold,
    fontSize: 11,
    color: '#85adff',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  cardNote: {
    fontFamily: Fonts.Outfit_400Regular,
    fontSize: 12,
    color: Colors.slate500,
  },
  chartWrap: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    height: 180,
  },
  chartColumn: {
    flex: 1,
    alignItems: 'center',
    gap: 8,
  },
  chartBarTrack: {
    width: '100%',
    flex: 1,
    borderRadius: 999,
    backgroundColor: '#0d1321',
    justifyContent: 'flex-end',
    padding: 4,
  },
  chartBarFill: {
    width: '100%',
    borderRadius: 999,
    backgroundColor: '#85adff',
    minHeight: 12,
  },
  chartLabel: {
    fontFamily: Fonts.SpaceMono_400Regular,
    fontSize: 8,
    color: Colors.slate500,
  },
  chartSummary: {
    fontFamily: Fonts.Outfit_400Regular,
    fontSize: 12,
    color: '#a6aabc',
  },
  managerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  managerAvatar: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: 'rgba(133, 173, 255, 0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  managerAvatarText: {
    fontFamily: Fonts.Outfit_700Bold,
    fontSize: 18,
    color: '#85adff',
  },
  managerCopy: {
    flex: 1,
    gap: 2,
  },
  managerName: {
    fontFamily: Fonts.Outfit_700Bold,
    fontSize: 16,
    color: '#fff',
  },
  managerRole: {
    fontFamily: Fonts.Outfit_400Regular,
    fontSize: 12,
    color: Colors.slate500,
    textTransform: 'capitalize',
  },
  managerButton: {
    minHeight: 38,
    borderRadius: 12,
    paddingHorizontal: 14,
    backgroundColor: '#85adff',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  managerButtonText: {
    fontFamily: Fonts.Outfit_700Bold,
    fontSize: 12,
    color: '#020617',
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  unreadRow: {
    backgroundColor: 'rgba(133, 173, 255, 0.04)',
    borderRadius: 14,
    paddingHorizontal: 10,
  },
  listCopy: {
    flex: 1,
    gap: 4,
  },
  listTitle: {
    fontFamily: Fonts.Outfit_600SemiBold,
    fontSize: 14,
    color: '#fff',
  },
  listSubtitle: {
    fontFamily: Fonts.Outfit_400Regular,
    fontSize: 12,
    color: Colors.slate500,
  },
  listMeta: {
    fontFamily: Fonts.SpaceMono_400Regular,
    fontSize: 10,
    color: '#85adff',
  },
  liveMeta: {
    color: '#34d399',
  },
  emptyText: {
    fontFamily: Fonts.Outfit_400Regular,
    fontSize: 13,
    lineHeight: 20,
    color: Colors.slate500,
  },
  snapshotGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  snapshotCard: {
    width: '48.2%',
    minHeight: 96,
    borderRadius: 18,
    padding: 14,
    backgroundColor: '#0d1321',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
  },
  snapshotIcon: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  snapshotLabel: {
    fontFamily: Fonts.SpaceMono_400Regular,
    fontSize: 9,
    color: Colors.slate500,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  snapshotValue: {
    marginTop: 6,
    fontFamily: Fonts.Outfit_700Bold,
    fontSize: 22,
    color: '#fff',
  },
});
