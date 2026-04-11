import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  ActivityIndicator,
  Linking,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import {
  ArrowLeft,
  Edit2,
  MessageSquare,
  Trash2,
  TrendingUp,
  Users,
  CheckSquare,
  DollarSign,
  Search,
} from 'lucide-react-native';

import { ClientEditorModal } from './ClientEditorModal';
import { useMobileClients, defaultClientForm } from '../../hooks/useMobileClients';
import {
  type ClientFormInput,
  type ClientUpdateItem,
  type ClientDetailSnapshot,
  getClientDisplayName,
  getClientPlanTone,
  getClientStatusTone,
} from '../../lib/clients';
import { Colors, Fonts } from '../../lib/theme';
import { GlassCard } from '../ui/GlassCard';
import { MetricCard } from '../ui/MetricCard';

type ClientDetailScreenProps = {
  clientId: string;
};

export default function ClientDetailScreen({ clientId }: ClientDetailScreenProps) {
  const router = useRouter();
  const { getClientDetails, updateClient, deleteClient, permissions, teamMembers } = useMobileClients();
  const [snapshot, setSnapshot] = useState<ClientDetailSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [form, setForm] = useState<ClientFormInput>(defaultClientForm());

  const client = snapshot?.client || null;
  const canEditCore = permissions.canEditClientCore(client);
  const canEditNotes = permissions.canEditClientNotes(client);
  const canEditStatus = permissions.canEditClientStatus(client);
  const canDelete = permissions.canDeleteClient;

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      const nextSnapshot = await getClientDetails(clientId).catch(() => null);
      if (!cancelled) {
        setSnapshot(nextSnapshot);
        setLoading(false);
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [clientId, getClientDetails]);

  useEffect(() => {
    if (!client) return;

    setForm({
      firm_name: client.firm_name || '',
      location: client.location || '',
      website_url: client.website_url || '',
      contact_name: client.contact_name || '',
      contact_email: client.contact_email || '',
      contact_phone: client.contact_phone || '',
      plan_type: client.plan_type,
      status: client.status,
      health_score: client.health_score,
      assigned_team_member_id: client.assigned_team_member_id || client.assigned_team_members?.[0]?.id || null,
      assigned_team_member_ids: (client.assigned_team_members || []).map((member) => member.id),
      onboarding_date: client.onboarding_date || new Date().toISOString().slice(0, 10),
      notes: client.notes || '',
      services: client.services || [],
      password: '',
    });
  }, [client]);

  const metrics = useMemo(() => {
    if (!snapshot) return [];
    const clientHealth = Math.round(snapshot.client.total_health_score || snapshot.client.health_score || 50);
    return [
      { label: 'Health', value: clientHealth, icon: TrendingUp, color: '#85adff' },
      { label: 'Tasks', value: snapshot.metrics.tasks, icon: CheckSquare, color: '#4ade80' },
      { label: 'Leads', value: snapshot.metrics.leads, icon: Users, color: '#9093ff' },
      { label: 'Invoices', value: snapshot.metrics.invoices, icon: DollarSign, color: '#f59e0b' },
    ];
  }, [snapshot]);

  const handleRefresh = async () => {
    setRefreshing(true);
    const nextSnapshot = await getClientDetails(clientId, true).catch(() => null);
    if (nextSnapshot) {
      setSnapshot(nextSnapshot);
    }
    setRefreshing(false);
  };

  const handleSave = async () => {
    if (!client) return;

    setSaving(true);
    try {
      const result = await updateClient(clientId, form);
      if (!result.ok) {
        Alert.alert('Save Failed', 'This client could not be updated right now.');
        return;
      }

      const nextSnapshot = await getClientDetails(clientId, true).catch(() => null);
      if (nextSnapshot) {
        setSnapshot(nextSnapshot);
      }
      setIsEditorOpen(false);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    if (!client || !canDelete) return;

    Alert.alert('Delete Client', 'This will permanently remove the client record.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const result = await deleteClient(clientId);
          if (result.ok) {
            router.back();
          } else {
            Alert.alert('Delete Failed', 'This client could not be removed right now.');
          }
        },
      },
    ]);
  };

  const openContact = (value?: string | null, scheme?: string) => {
    if (!value) return;
    const target = scheme === 'https' ? `https://${value.replace(/^https?:\/\//, '')}` : scheme ? `${scheme}:${value}` : value;
    void Linking.openURL(target);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={Colors.accent} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  if (!snapshot || !client) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.iconButton}>
            <ArrowLeft color="#fff" size={22} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Client Detail</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyTitle}>Client not available</Text>
          <Text style={styles.emptyText}>This client may not be accessible from your role or it has been removed.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const planTone = getClientPlanTone(client.plan_type);
  const statusTone = getClientStatusTone(client.status);
  const teamCount = client.assigned_team_members?.length || 0;
  const initials = (client.firm_name || client.name || 'C')
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <SafeAreaView style={styles.container}>
      <View pointerEvents="none" style={styles.topGlow} />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconButton}>
          <ArrowLeft color="#fff" size={22} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {client.firm_name}
          </Text>
          <Text style={styles.headerSubtitle}>CLIENT CONTROL CENTER</Text>
        </View>
        <View style={styles.headerActions}>
          {canEditCore || canEditNotes || canEditStatus ? (
            <TouchableOpacity
              onPress={() => setIsEditorOpen(true)}
              style={styles.iconButton}
            >
              <Edit2 color="#85adff" size={18} />
            </TouchableOpacity>
          ) : null}
          {canDelete ? (
            <TouchableOpacity onPress={handleDelete} style={styles.iconButton}>
              <Trash2 color="#ff716c" size={18} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void handleRefresh()} tintColor={Colors.accent} />}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <GlassCard style={styles.heroCard} intensity={18} noPadding>
          <View style={styles.heroRow}>
            <LinearGradient colors={['#85adff', '#9093ff']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.avatar}>
              <Text style={styles.avatarText}>{initials}</Text>
            </LinearGradient>

            <View style={styles.heroMeta}>
              <Text style={styles.clientName}>{getClientDisplayName(client)}</Text>
              <Text style={styles.clientFirm}>{client.firm_name}</Text>
              <Text style={styles.clientContact}>{client.contact_name || 'No contact added'}</Text>
            </View>
          </View>

          <View style={styles.badgeRow}>
            <View style={[styles.planBadge, { backgroundColor: planTone.background, borderColor: planTone.border }]}>
              <Text style={[styles.planBadgeText, { color: planTone.color }]}>{client.plan_type}</Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: statusTone.background, borderColor: statusTone.border }]}>
              <Text style={[styles.statusBadgeText, { color: statusTone.color }]}>{client.status}</Text>
            </View>
          </View>

          <View style={styles.metaGrid}>
            <MetaLink label="Email" value={client.contact_email || 'No email'} onPress={() => openContact(client.contact_email, 'mailto')} />
            <MetaLink label="Phone" value={client.contact_phone || 'No phone'} onPress={() => openContact(client.contact_phone, 'tel')} />
            <MetaLink label="Website" value={client.website_url || 'No website'} onPress={() => openContact(client.website_url, client.website_url?.startsWith('http') ? undefined : 'https')} />
            <MetaStatic label="Onboarding" value={client.onboarding_date || 'Pending'} />
          </View>

          <View style={styles.teamWrap}>
            <Text style={styles.sectionLabel}>Assigned Team</Text>
            <View style={styles.teamChipRow}>
              {(client.assigned_team_members || []).length > 0 ? (
                client.assigned_team_members?.map((member) => (
                  <View key={member.id} style={styles.teamChip}>
                    <Text style={styles.teamChipText}>{member.full_name || member.email || 'Member'}</Text>
                  </View>
                ))
              ) : (
                <View style={styles.teamChip}>
                  <Text style={styles.teamChipText}>No team assigned</Text>
                </View>
              )}
              {teamCount > 0 ? (
                <View style={styles.teamCountBubble}>
                  <Text style={styles.teamCountText}>+{teamCount}</Text>
                </View>
              ) : null}
            </View>
          </View>
        </GlassCard>

        <View style={styles.metricGrid}>
          {metrics.map((metric) => (
            <MetricCard
              key={metric.label}
              label={metric.label}
              value={metric.value}
              icon={metric.icon}
              color={metric.color}
            />
          ))}
        </View>

        <SectionCard title="Overview" icon={Users}>
          <Text style={styles.bodyText}>{client.notes || 'No client notes have been added yet.'}</Text>
        </SectionCard>

        <SectionCard title="SEO" icon={Search}>
          <Text style={styles.bodyText}>
            SEO score: {client.seo_score ?? 'N/A'}
          </Text>
          <View style={styles.listWrap}>
            {(snapshot.keywords || []).slice(0, 4).map((keyword: any) => (
              <DetailRow
                key={keyword.id}
                title={keyword.keyword || 'Keyword'}
                subtitle={keyword.current_pos ? `Current position #${keyword.current_pos}` : keyword.trend || 'SEO update'}
                trailing={keyword.seo_score ? `${keyword.seo_score}%` : undefined}
              />
            ))}
          </View>
        </SectionCard>

        <SectionCard title="Tasks" icon={CheckSquare}>
          <View style={styles.listWrap}>
            {(snapshot.tasks || []).slice(0, 6).map((task: any) => (
              <DetailRow
                key={task.id}
                title={task.title || 'Task'}
                subtitle={task.description || task.module || 'Task update'}
                trailing={task.status || undefined}
              />
            ))}
          </View>
        </SectionCard>

        <SectionCard title="Updates" icon={TrendingUp}>
          <View style={styles.listWrap}>
            {(snapshot.updates || []).slice(0, 8).map((item: ClientUpdateItem) => (
              <DetailRow
                key={item.id}
                title={item.title}
                subtitle={item.description || item.type}
                trailing={formatTime(item.created_at)}
              />
            ))}
          </View>
        </SectionCard>

        <SectionCard title="Billing" icon={DollarSign}>
          <View style={styles.listWrap}>
            {(snapshot.invoices || []).slice(0, 5).map((invoice: any) => (
              <DetailRow
                key={invoice.id}
                title={invoice.invoice_number ? `Invoice ${invoice.invoice_number}` : 'Invoice'}
                subtitle={invoice.status || 'pending'}
                trailing={formatMoney(invoice.amount)}
              />
            ))}
          </View>
        </SectionCard>

        <SectionCard title="Messages" icon={MessageSquare}>
          <View style={styles.listWrap}>
            {(snapshot.messages || []).slice(0, 5).map((message: any) => (
              <DetailRow
                key={message.id}
                title={message.sender?.full_name || 'Message'}
                subtitle={message.content || message.message_type || 'Message'}
                trailing={formatTime(message.created_at)}
              />
            ))}
          </View>
        </SectionCard>
      </ScrollView>

      <ClientEditorModal
        visible={isEditorOpen}
        mode="edit"
        form={form}
        teamMembers={teamMembers}
        currentClient={client}
        saving={saving}
        canEditCore={canEditCore}
        canEditNotes={canEditNotes}
        canEditStatus={canEditStatus}
        onClose={() => setIsEditorOpen(false)}
        onChange={setForm}
        onSubmit={() => void handleSave()}
      />
    </SafeAreaView>
  );
}

function SectionCard({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: React.ComponentType<any>;
  children: React.ReactNode;
}) {
  return (
    <GlassCard style={styles.sectionCard} intensity={14} noPadding>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionHeading}>
          <Icon color="#85adff" size={16} />
          <Text style={styles.sectionTitle}>{title}</Text>
        </View>
      </View>
      <View style={styles.sectionBody}>
        {children}
      </View>
    </GlassCard>
  );
}

function MetaLink({
  label,
  value,
  onPress,
}: {
  label: string;
  value: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity activeOpacity={0.85} onPress={onPress} style={styles.metaCard}>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={styles.metaValue} numberOfLines={1}>
        {value}
      </Text>
    </TouchableOpacity>
  );
}

function MetaStatic({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metaCard}>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={styles.metaValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

function DetailRow({
  title,
  subtitle,
  trailing,
}: {
  title: string;
  subtitle: string;
  trailing?: string | null;
}) {
  return (
    <View style={styles.detailRow}>
      <View style={styles.detailCopy}>
        <Text style={styles.detailTitle} numberOfLines={1}>
          {title}
        </Text>
        <Text style={styles.detailSubtitle} numberOfLines={1}>
          {subtitle}
        </Text>
      </View>
      {trailing ? <Text style={styles.detailTrailing}>{trailing}</Text> : null}
    </View>
  );
}

function formatTime(value: string) {
  try {
    return new Date(value).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return value;
  }
}

function formatMoney(value: any) {
  const amount = Number(value || 0);
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `₹${amount.toLocaleString()}`;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  topGlow: {
    position: 'absolute',
    top: -60,
    right: -40,
    width: 240,
    height: 240,
    borderRadius: 999,
    backgroundColor: 'rgba(133, 173, 255, 0.08)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  headerCenter: {
    flex: 1,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  headerTitle: {
    fontFamily: Fonts.Outfit_700Bold,
    fontSize: 18,
    color: '#fff',
  },
  headerSubtitle: {
    fontFamily: Fonts.SpaceMono_400Regular,
    fontSize: 10,
    color: Colors.slate500,
    letterSpacing: 2,
    marginTop: 4,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 10,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 140,
    gap: 12,
  },
  heroCard: {
    borderRadius: 24,
    padding: 16,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: Fonts.Outfit_700Bold,
    fontSize: 18,
    color: '#000000',
  },
  heroMeta: {
    flex: 1,
  },
  clientName: {
    fontFamily: Fonts.Outfit_700Bold,
    fontSize: 20,
    color: '#fff',
    marginBottom: 2,
  },
  clientFirm: {
    fontFamily: Fonts.Outfit_500Medium,
    fontSize: 13,
    color: Colors.slate500,
    marginBottom: 2,
  },
  clientContact: {
    fontFamily: Fonts.SpaceMono_400Regular,
    fontSize: 9,
    color: '#a6aabc',
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
    marginBottom: 14,
  },
  planBadge: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  planBadgeText: {
    fontFamily: Fonts.Outfit_700Bold,
    fontSize: 9,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statusBadge: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusBadgeText: {
    fontFamily: Fonts.Outfit_700Bold,
    fontSize: 9,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  metaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  metaCard: {
    width: '48.5%',
    borderRadius: 14,
    padding: 12,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    gap: 4,
  },
  metaLabel: {
    fontFamily: Fonts.SpaceMono_700Bold,
    fontSize: 8,
    color: Colors.slate500,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  metaValue: {
    fontFamily: Fonts.Outfit_500Medium,
    fontSize: 12,
    color: '#e4e7fb',
  },
  teamWrap: {
    marginTop: 16,
    gap: 8,
  },
  sectionLabel: {
    fontFamily: Fonts.SpaceMono_700Bold,
    fontSize: 9,
    color: Colors.slate500,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  teamChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    alignItems: 'center',
  },
  teamChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  teamChipText: {
    fontFamily: Fonts.Outfit_500Medium,
    fontSize: 11,
    color: '#a6aabc',
  },
  teamCountBubble: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(133, 173, 255, 0.10)',
  },
  teamCountText: {
    fontFamily: Fonts.Outfit_700Bold,
    fontSize: 11,
    color: '#85adff',
  },
  metricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 10,
  },
  sectionCard: {
    borderRadius: 20,
    padding: 0,
  },
  sectionHeader: {
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    fontFamily: Fonts.Outfit_700Bold,
    fontSize: 15,
    color: '#fff',
  },
  sectionBody: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    gap: 8,
  },
  bodyText: {
    fontFamily: Fonts.Outfit_400Regular,
    fontSize: 13,
    lineHeight: 18,
    color: '#cbd5e1',
  },
  listWrap: {
    gap: 4,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  detailCopy: {
    flex: 1,
    gap: 3,
  },
  detailTitle: {
    fontFamily: Fonts.Outfit_700Bold,
    fontSize: 14,
    color: '#fff',
  },
  detailSubtitle: {
    fontFamily: Fonts.Outfit_400Regular,
    fontSize: 12,
    color: Colors.slate500,
  },
  detailTrailing: {
    fontFamily: Fonts.SpaceMono_700Bold,
    fontSize: 10,
    color: '#85adff',
    textTransform: 'uppercase',
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 10,
  },
  emptyTitle: {
    fontFamily: Fonts.Outfit_700Bold,
    fontSize: 18,
    color: '#fff',
  },
  emptyText: {
    fontFamily: Fonts.Outfit_400Regular,
    fontSize: 13,
    color: Colors.slate500,
    textAlign: 'center',
    lineHeight: 20,
  },
});
