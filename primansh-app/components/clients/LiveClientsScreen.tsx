import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  type DimensionValue,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import {
  ArrowRight,
  Bot,
  Menu,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Users,
} from 'lucide-react-native';

import { ClientEditorModal } from './ClientEditorModal';
import { useMobileClients, defaultClientForm } from '../../hooks/useMobileClients';
import {
  buildClientSearchValue,
  getClientDisplayName,
  getClientPlanTone,
  getClientStatusTone,
  type ClientFormInput,
  type MobileClient,
} from '../../lib/clients';
import { Colors, Fonts } from '../../lib/theme';

type PlanFilter = 'all' | 'premium' | 'growth' | 'basic';
type StatusFilter = 'all' | 'active' | 'inactive';

const PLAN_FILTERS: { key: PlanFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'premium', label: 'Premium' },
  { key: 'growth', label: 'Growth' },
  { key: 'basic', label: 'Basic' },
];

const STATUS_FILTERS: { key: StatusFilter; label: string }[] = [
  { key: 'all', label: 'All Statuses' },
  { key: 'active', label: 'Active' },
  { key: 'inactive', label: 'Inactive' },
];

export default function LiveClientsScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const {
    clients,
    teamMembers,
    loading,
    refreshing,
    loadingMore,
    hasMore,
    flushingQueue,
    pendingQueueCount,
    realtimeState,
    refresh,
    loadMore,
    createClient,
    permissions,
  } = useMobileClients();

  const [search, setSearch] = useState('');
  const [planFilter, setPlanFilter] = useState<PlanFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<ClientFormInput>(defaultClientForm());

  const cardWidth: DimensionValue = width >= 1100 ? '31.8%' : width >= 720 ? '48.5%' : '100%';

  const filteredClients = useMemo(() => {
    const term = search.trim().toLowerCase();

    return clients.filter((client) => {
      if (!permissions.canViewClient(client)) return false;

      const matchesPlan = planFilter === 'all' || client.plan_type === planFilter;
      const matchesStatus =
        statusFilter === 'all'
          ? true
          : statusFilter === 'active'
            ? client.status !== 'inactive'
            : client.status === 'inactive';
      const matchesSearch = !term || buildClientSearchValue(client).includes(term);
      return matchesPlan && matchesStatus && matchesSearch;
    });
  }, [clients, permissions, planFilter, search, statusFilter]);

  const openCreateClient = () => {
    if (!permissions.canCreateClient) {
      Alert.alert('Admin Access Required', 'Only admins can create new clients.');
      return;
    }

    setForm(defaultClientForm());
    setIsEditorOpen(true);
  };

  const handleCreateClient = async () => {
    setSaving(true);
    try {
      const result = await createClient(form);
      if (result.ok) {
        setIsEditorOpen(false);
        setForm(defaultClientForm());
        return;
      }

      Alert.alert('Create Failed', 'This client could not be created right now.');
    } finally {
      setSaving(false);
    }
  };

  const isConnected = realtimeState === 'SUBSCRIBED' || realtimeState === 'CONNECTED';

  return (
    <SafeAreaView style={styles.container}>
      <View pointerEvents="none" style={styles.topGlow} />

      <View style={styles.headerShell}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Menu color="#85adff" size={20} />
            <LinearGradient colors={['#85adff', '#9093ff']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
              <Text style={styles.headerBrand}>Agency OS</Text>
            </LinearGradient>
          </View>

          <View style={styles.headerActions}>
            <View style={styles.syncBadge}>
              <View style={[styles.syncDot, { backgroundColor: isConnected ? '#22c55e' : '#f59e0b' }]} />
              <Text style={styles.syncBadgeText}>
                {flushingQueue
                  ? 'Syncing'
                  : pendingQueueCount > 0
                    ? `${pendingQueueCount} pending`
                    : isConnected
                      ? 'Live'
                      : 'Offline'}
              </Text>
            </View>
            <TouchableOpacity activeOpacity={0.85} style={styles.headerActionButton} onPress={() => void refresh()}>
              <RefreshCw color="#94a3b8" size={18} />
            </TouchableOpacity>
            <TouchableOpacity activeOpacity={0.85} style={styles.headerActionButton}>
              <Bot color="#85adff" size={18} />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={Colors.accent} />}
      >
        <View style={styles.searchActionSection}>
          <View style={styles.searchWrap}>
            <Search color="#a6aabc" size={18} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search by name, firm, email..."
              placeholderTextColor="rgba(166, 170, 188, 0.55)"
              style={styles.searchInput}
            />
          </View>

          <TouchableOpacity
            activeOpacity={0.9}
            style={[styles.addButtonWrap, !permissions.canCreateClient && styles.addButtonWrapDisabled]}
            disabled={!permissions.canCreateClient}
            onPress={openCreateClient}
          >
            <LinearGradient
              colors={['#85adff', '#9093ff']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.addButton}
            >
              {permissions.canCreateClient ? <Plus color="#000" size={18} /> : <ShieldCheck color="#000" size={18} />}
              <Text style={styles.addButtonText}>Add Client</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
          style={styles.filterScroll}
        >
          {PLAN_FILTERS.map((filter) => {
            const active = filter.key === planFilter;
            return (
              <TouchableOpacity
                key={filter.key}
                activeOpacity={0.9}
                onPress={() => setPlanFilter(filter.key)}
                style={[styles.filterPill, active && styles.filterPillActive]}
              >
                <Text style={[styles.filterPillText, active && styles.filterPillTextActive]}>{filter.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.statusRow}
          style={styles.statusScroll}
        >
          {STATUS_FILTERS.map((filter) => {
            const active = filter.key === statusFilter;
            return (
              <TouchableOpacity
                key={filter.key}
                activeOpacity={0.9}
                onPress={() => setStatusFilter(filter.key)}
                style={[styles.statusPill, active && styles.statusPillActive]}
              >
                <Text style={[styles.statusPillText, active && styles.statusPillTextActive]}>{filter.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <View style={styles.grid}>
          {filteredClients.map((client) => (
            <ClientCard
              key={client.id}
              client={client}
              width={cardWidth}
              onPress={() => router.push(`/clients/${client.id}`)}
            />
          ))}
        </View>

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color="#85adff" size="large" />
          </View>
        ) : null}

        {loadingMore ? (
          <View style={styles.moreWrap}>
            <ActivityIndicator color="#85adff" />
          </View>
        ) : null}

        {!loading && filteredClients.length === 0 ? (
          <View style={styles.emptyState}>
            <Users size={36} color="#64748b" />
            <Text style={styles.emptyTitle}>No clients found</Text>
            <Text style={styles.emptyText}>
              {clients.length === 0
                ? 'Client records will appear here once they are synced from the web admin panel.'
                : 'Try adjusting your search or filters.'}
            </Text>
          </View>
        ) : null}

        {hasMore && !loading ? (
          <TouchableOpacity activeOpacity={0.85} style={styles.loadMoreButton} onPress={() => void loadMore()}>
            <Text style={styles.loadMoreText}>Load more clients</Text>
          </TouchableOpacity>
        ) : null}
      </ScrollView>

      <ClientEditorModal
        visible={isEditorOpen}
        mode="create"
        form={form}
        teamMembers={teamMembers}
        saving={saving}
        canEditCore={permissions.canCreateClient}
        canEditNotes={permissions.canCreateClient}
        canEditStatus={permissions.canCreateClient}
        onClose={() => setIsEditorOpen(false)}
        onChange={setForm}
        onSubmit={() => void handleCreateClient()}
      />
    </SafeAreaView>
  );
}

function ClientCard({
  client,
  width,
  onPress,
}: {
  client: MobileClient;
  width: DimensionValue;
  onPress: () => void;
}) {
  const planTheme = getClientPlanTone(client.plan_type);
  const statusTheme = getClientStatusTone(client.status);
  const health = Math.round(client.total_health_score || client.health_score || 50);
  const teamCount = client.assigned_team_members?.length || 0;
  const initials = (client.firm_name || client.name || 'C')
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <TouchableOpacity activeOpacity={0.92} onPress={onPress} style={[styles.card, { width }, client.plan_type === 'premium' && styles.cardFeatured]}>
      {client.plan_type === 'premium' ? <View style={styles.activeStripe} /> : null}

      <View style={styles.cardHeader}>
        <View style={styles.identityWrap}>
          <View style={styles.avatarWrap}>
            <LinearGradient colors={['#85adff', '#9093ff']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.avatarImage}>
              <Text style={styles.avatarInitials}>{initials}</Text>
            </LinearGradient>
            <View style={[styles.statusDot, { backgroundColor: statusTheme.color }]} />
          </View>

          <View style={styles.identityText}>
            <Text style={styles.clientName} numberOfLines={1}>
              {getClientDisplayName(client)}
            </Text>
            <Text style={styles.clientOwner} numberOfLines={1}>
              {client.firm_name}
            </Text>
            <View style={[styles.statusBadge, { backgroundColor: statusTheme.background, borderColor: statusTheme.border }]}>
              <Text style={[styles.statusBadgeText, { color: statusTheme.color }]}>{client.status}</Text>
            </View>
          </View>
        </View>

        <View style={[styles.planBadge, { backgroundColor: planTheme.background, borderColor: planTheme.border }]}>
          <Text style={[styles.planBadgeText, { color: planTheme.color }]}>{client.plan_type}</Text>
        </View>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statBlock}>
          <Text style={styles.statLabel}>Health</Text>
          <Text style={styles.statValue}>
            {health}
            <Text style={styles.statMuted}>%</Text>
          </Text>
        </View>

        <View style={styles.statBlock}>
          <Text style={styles.statLabel}>Tasks</Text>
          <Text style={styles.statValue}>
            {String(client.keyMetrics?.tasks ?? 0).padStart(2, '0')}
            <Text style={styles.statMuted}> / {String(client.keyMetrics?.leads ?? 0).padStart(2, '0')}</Text>
          </Text>
        </View>
      </View>

      <View style={styles.cardFooter}>
        <View style={styles.teamBubble}>
          <Text style={styles.teamBubbleText}>+{teamCount}</Text>
        </View>

        <TouchableOpacity activeOpacity={0.85} style={styles.viewButton} onPress={onPress}>
          <Text style={styles.viewButtonText}>View Dashboard</Text>
          <ArrowRight color="#85adff" size={14} />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#090e1b',
  },
  topGlow: {
    position: 'absolute',
    top: -60,
    right: -40,
    width: 220,
    height: 220,
    borderRadius: 999,
    backgroundColor: 'rgba(133, 173, 255, 0.08)',
  },
  headerShell: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    backgroundColor: 'rgba(9, 14, 27, 0.72)',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.10)',
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
    gap: 12,
  },
  headerBrand: {
    fontFamily: Fonts.Outfit_700Bold,
    fontSize: 22,
    color: 'transparent',
    letterSpacing: -0.6,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  syncBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    height: 38,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  syncDot: {
    width: 8,
    height: 8,
    borderRadius: 99,
  },
  syncBadgeText: {
    fontFamily: Fonts.SpaceMono_700Bold,
    fontSize: 10,
    color: '#a6aabc',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  headerActionButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  scrollContent: {
    paddingTop: 96,
    paddingHorizontal: 20,
    paddingBottom: 140,
  },
  searchActionSection: {
    marginBottom: 18,
    gap: 14,
  },
  searchWrap: {
    height: 54,
    borderRadius: 18,
    backgroundColor: '#0d1321',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 12,
  },
  searchInput: {
    flex: 1,
    color: '#e4e7fb',
    fontFamily: Fonts.Outfit_400Regular,
    fontSize: 15,
  },
  addButtonWrap: {
    borderRadius: 18,
    overflow: 'hidden',
    shadowColor: '#85adff',
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 0 },
    elevation: 2,
  },
  addButtonWrapDisabled: {
    opacity: 0.45,
  },
  addButton: {
    height: 54,
    borderRadius: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  addButtonText: {
    fontFamily: Fonts.Outfit_700Bold,
    color: '#000000',
    fontSize: 15,
  },
  filterScroll: {
    marginBottom: 14,
  },
  filterRow: {
    gap: 10,
    paddingRight: 12,
  },
  filterPill: {
    paddingHorizontal: 22,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: '#131929',
  },
  filterPillActive: {
    backgroundColor: '#6e9fff',
  },
  filterPillText: {
    fontFamily: Fonts.Outfit_600SemiBold,
    fontSize: 14,
    color: '#a6aabc',
  },
  filterPillTextActive: {
    color: '#000000',
  },
  statusScroll: {
    marginBottom: 22,
  },
  statusRow: {
    gap: 10,
    paddingRight: 12,
  },
  statusPill: {
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: '#131929',
  },
  statusPillActive: {
    backgroundColor: 'rgba(133, 173, 255, 0.24)',
  },
  statusPillText: {
    fontFamily: Fonts.Outfit_600SemiBold,
    fontSize: 12,
    color: '#a6aabc',
    textTransform: 'uppercase',
  },
  statusPillTextActive: {
    color: '#85adff',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
  },
  card: {
    position: 'relative',
    backgroundColor: '#131929',
    borderRadius: 18,
    padding: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
  },
  cardFeatured: {
    backgroundColor: '#191f31',
  },
  activeStripe: {
    position: 'absolute',
    left: 0,
    top: '15%',
    bottom: '15%',
    width: 3,
    borderRadius: 999,
    backgroundColor: '#85adff',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 18,
    gap: 12,
  },
  identityWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 14,
  },
  avatarWrap: {
    position: 'relative',
  },
  avatarImage: {
    width: 56,
    height: 56,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1e2538',
  },
  avatarInitials: {
    fontFamily: Fonts.Outfit_700Bold,
    fontSize: 18,
    color: '#000000',
  },
  statusDot: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 14,
    height: 14,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: '#131929',
  },
  identityText: {
    flex: 1,
  },
  clientName: {
    fontFamily: Fonts.Outfit_700Bold,
    fontSize: 20,
    color: '#e4e7fb',
    marginBottom: 2,
  },
  clientOwner: {
    fontFamily: Fonts.Outfit_500Medium,
    fontSize: 14,
    color: '#a6aabc',
    marginBottom: 8,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  statusBadgeText: {
    fontFamily: Fonts.Outfit_700Bold,
    fontSize: 9,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  planBadge: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  planBadgeText: {
    fontFamily: Fonts.Outfit_700Bold,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 18,
  },
  statBlock: {
    flex: 1,
    gap: 4,
  },
  statLabel: {
    fontFamily: Fonts.SpaceMono_700Bold,
    fontSize: 9,
    color: '#64748b',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  statValue: {
    fontFamily: Fonts.Outfit_700Bold,
    fontSize: 20,
    color: '#e4e7fb',
  },
  statMuted: {
    fontFamily: Fonts.Outfit_500Medium,
    fontSize: 14,
    color: '#a6aabc',
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  teamBubble: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  teamBubbleText: {
    fontFamily: Fonts.Outfit_700Bold,
    fontSize: 12,
    color: '#85adff',
  },
  viewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 16,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(133, 173, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(133, 173, 255, 0.15)',
  },
  viewButtonText: {
    fontFamily: Fonts.Outfit_700Bold,
    fontSize: 11,
    color: '#85adff',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  loadingWrap: {
    paddingVertical: 28,
    alignItems: 'center',
  },
  moreWrap: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  emptyState: {
    paddingVertical: 28,
    alignItems: 'center',
    gap: 10,
  },
  emptyTitle: {
    fontFamily: Fonts.Outfit_700Bold,
    fontSize: 18,
    color: Colors.foreground,
  },
  emptyText: {
    fontFamily: Fonts.Outfit_400Regular,
    fontSize: 13,
    color: Colors.slate500,
    textAlign: 'center',
    maxWidth: 320,
    lineHeight: 20,
  },
  loadMoreButton: {
    marginTop: 16,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  loadMoreText: {
    fontFamily: Fonts.Outfit_700Bold,
    fontSize: 13,
    color: '#a6aabc',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
});
