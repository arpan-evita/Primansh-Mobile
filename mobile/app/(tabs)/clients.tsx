import React, { useMemo, useState } from 'react';
import {
  type DimensionValue,
  Image,
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
import {
  ArrowRight,
  Bot,
  Menu,
  Plus,
  Search,
} from 'lucide-react-native';
import { Colors, Fonts } from '../../lib/theme';

type FilterKey = 'all' | 'premium' | 'growth' | 'basic';

type ClientCard = {
  id: string;
  company: string;
  owner: string;
  plan: Exclude<FilterKey, 'all'>;
  traffic: string;
  trafficChange: string;
  trafficPositive: boolean;
  taskCompleted: number;
  taskTotal: number;
  teamCount: number;
  online: 'online' | 'busy' | 'offline';
  image: string;
  featured?: boolean;
};

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'premium', label: 'Premium' },
  { key: 'growth', label: 'Growth' },
  { key: 'basic', label: 'Basic' },
];

const CLIENTS: ClientCard[] = [
  {
    id: 'nexgen-media',
    company: 'NexGen Media',
    owner: 'Arthur Sterling',
    plan: 'premium',
    traffic: '12.4k',
    trafficChange: '+12%',
    trafficPositive: true,
    taskCompleted: 4,
    taskTotal: 12,
    teamCount: 3,
    online: 'online',
    image:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuBxdpzsUHdzHN2LCG0gQB46_R2iZE1W9Go-gSkM8phUHbyuIIhlbAchMF_4DuHaFr4qHQfd4uB6J7NfM2VT4Xm4EAq8cnbRKG1l3NNCfH-vDYcqnN5uPRP2wgayJNmJXddXHuVfvW6_RLCQMMWqQH5vtuZdwLAkFufVflsxYfFCS5nSqGCauVT1FNETM0Wu2llZ2PRjMz3yH0pubW4h5Jd7A3VHf07PqLK-c4-i62b1RKTpnVtQAPZJhFMiLmaSVPJCkf3uAzMadGVg',
    featured: true,
  },
  {
    id: 'veloce-labs',
    company: 'Veloce Labs',
    owner: 'Elena Rossi',
    plan: 'growth',
    traffic: '8.2k',
    trafficChange: '+5%',
    trafficPositive: true,
    taskCompleted: 9,
    taskTotal: 15,
    teamCount: 1,
    online: 'busy',
    image:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuBvFGvoogLA7DPV5UVgrxqPewu4AS_RwAp0DpKe8wwb0_RzR4-MepmlVgeLR1BvPMJRwwAeyooIWlTxW2ajP6__vtKnxCxWiDNuX7EUVt_5RyKiUlHM8UIA1cEvFvQPi-AzQ3I1zRHkLkMTN5ODPK9EUzuwVWGyzQuuVRMbfZBe3Qkl4Ji-NZnljvcwtaEEBrKv_4V6D7C4vJ8NXKhGhTzw8crhjh2LPFPXOvZHMRhWsLiMB4cWOh1JlCNoJLt0jTo0atAvp-zywVEI',
  },
  {
    id: 'studio-bloom',
    company: 'Studio Bloom',
    owner: 'Marcus Chen',
    plan: 'premium',
    traffic: '22.1k',
    trafficChange: '+24%',
    trafficPositive: true,
    taskCompleted: 2,
    taskTotal: 8,
    teamCount: 5,
    online: 'online',
    image:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuDM35SK8RMUxmtoSGJYD0lEMlyTNEByiz0zgO6bb-uu8oKwAJwJU7nRQlm0eZ1skMacUuR0vtc86XzFygBveWEeIIwyRIUbBu4FxNDWftY8a5cO_PjblJVLUm17v20L_bPbb8BbYeQNWNRcbDKNG3xT-po2ufWCjz2-fCeWWtB7ZwtiGTfs22UnJETOuy81eQBWvcr8MynHax_xiRe4qm5DYEZ1AIDqmaEOZfu6JXn05qMo12y-OA4z-jCEhs4AuNBKnuwLUrwATuCx',
  },
  {
    id: 'aura-brands',
    company: 'Aura Brands',
    owner: 'Sarah Jenkins',
    plan: 'basic',
    traffic: '1.2k',
    trafficChange: '-2%',
    trafficPositive: false,
    taskCompleted: 11,
    taskTotal: 12,
    teamCount: 2,
    online: 'offline',
    image:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuAHfXjO93vhHasLPLc0-ztVU3R1upU6TMZGhRwuWj2K8eZpAW99jOazGhqk678xKfEpL9u6oah6r4LPlYXwarQmpqgUxeQuhMV3Ua2sYlFnFP5J2Sa5pv3b6sWJemFfXccoJSvYqb_c5z2d2A7OxAlyTnodLYjTQ0BPwiXBnFhPrgfnCzJrSojhxnlGsobXRUpf7Mab_LlM5fUUruQML-f7jj5CXZ6aTk_oDyy6VCqnjpav4DmrHo_t9xOsCCVDysDHR52g2lctitD5',
  },
];

export default function ClientsScreen() {
  const LiveClientsScreen = require('../../components/clients/LiveClientsScreen').default;
  return <LiveClientsScreen />;

  const { width } = useWindowDimensions();
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterKey>('all');

  const cardWidth: DimensionValue = width >= 1100 ? '31.8%' : width >= 720 ? '48.5%' : '100%';

  const filteredClients = useMemo(() => {
    return CLIENTS.filter((client) => {
      const matchesFilter = activeFilter === 'all' || client.plan === activeFilter;
      const term = search.trim().toLowerCase();
      const matchesSearch =
        !term ||
        client.company.toLowerCase().includes(term) ||
        client.owner.toLowerCase().includes(term) ||
        client.plan.toLowerCase().includes(term);

      return matchesFilter && matchesSearch;
    });
  }, [activeFilter, search]);

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
            <TouchableOpacity activeOpacity={0.85} style={styles.headerActionButton}>
              <Search color="#94a3b8" size={18} />
            </TouchableOpacity>
            <TouchableOpacity activeOpacity={0.85} style={styles.headerActionButton}>
              <Bot color="#85adff" size={18} />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.searchActionSection}>
          <View style={styles.searchWrap}>
            <Search color="#a6aabc" size={18} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search clients, projects, or tags..."
              placeholderTextColor="rgba(166, 170, 188, 0.55)"
              style={styles.searchInput}
            />
          </View>

          <TouchableOpacity activeOpacity={0.9} style={styles.addButtonWrap}>
            <LinearGradient
              colors={['#85adff', '#9093ff']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.addButton}
            >
              <Plus color="#000" size={18} />
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
          {FILTERS.map((filter) => {
            const active = filter.key === activeFilter;
            return (
              <TouchableOpacity
                key={filter.key}
                activeOpacity={0.9}
                onPress={() => setActiveFilter(filter.key)}
                style={[styles.filterPill, active && styles.filterPillActive]}
              >
                <Text style={[styles.filterPillText, active && styles.filterPillTextActive]}>{filter.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <View style={styles.grid}>
          {filteredClients.map((client) => (
            <ClientCard key={client.id} client={client} width={cardWidth} />
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function ClientCard({ client, width }: { client: ClientCard; width: DimensionValue }) {
  const planTheme = getPlanTheme(client.plan);
  const statusColor = getStatusColor(client.online);

  return (
    <View style={[styles.card, { width }, client.featured && styles.cardFeatured]}>
      {client.featured ? <View style={styles.activeStripe} /> : null}

      <View style={styles.cardHeader}>
        <View style={styles.identityWrap}>
          <View style={styles.avatarWrap}>
            <Image source={{ uri: client.image }} style={styles.avatarImage} />
            <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
          </View>

          <View style={styles.identityText}>
            <Text style={styles.clientName}>{client.company}</Text>
            <Text style={styles.clientOwner}>{client.owner}</Text>
          </View>
        </View>

        <View style={[styles.planBadge, { backgroundColor: planTheme.background, borderColor: planTheme.border }]}> 
          <Text style={[styles.planBadgeText, { color: planTheme.text }]}>{planTheme.label}</Text>
        </View>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statBlock}>
          <Text style={styles.statLabel}>Traffic</Text>
          <Text style={styles.statValue}>
            {client.traffic}{' '}
            <Text style={[styles.statDelta, { color: client.trafficPositive ? '#34d399' : '#ff716c' }]}>
              {client.trafficChange}
            </Text>
          </Text>
        </View>

        <View style={styles.statBlock}>
          <Text style={styles.statLabel}>Tasks</Text>
          <Text style={styles.statValue}>
            {String(client.taskCompleted).padStart(2, '0')}{' '}
            <Text style={styles.statMuted}>/ {String(client.taskTotal).padStart(2, '0')}</Text>
          </Text>
        </View>
      </View>

      <View style={styles.cardFooter}>
        <View style={styles.teamBubble}>
          <Text style={styles.teamBubbleText}>+{client.teamCount}</Text>
        </View>

        <TouchableOpacity activeOpacity={0.85} style={styles.viewButton}>
          <Text style={styles.viewButtonText}>View Dashboard</Text>
          <ArrowRight color="#85adff" size={14} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

function getPlanTheme(plan: ClientCard['plan']) {
  if (plan === 'premium') {
    return {
      label: 'Premium',
      background: 'rgba(133, 173, 255, 0.10)',
      border: 'rgba(133, 173, 255, 0.20)',
      text: '#85adff',
    };
  }

  if (plan === 'growth') {
    return {
      label: 'Growth',
      background: 'rgba(144, 147, 255, 0.10)',
      border: 'rgba(144, 147, 255, 0.20)',
      text: '#9093ff',
    };
  }

  return {
    label: 'Basic',
    background: '#1e2538',
    border: 'rgba(67, 72, 87, 0.30)',
    text: '#a6aabc',
  };
}

function getStatusColor(status: ClientCard['online']) {
  if (status === 'online') return '#22c55e';
  if (status === 'busy') return '#f59e0b';
  return '#64748b';
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
    paddingBottom: 120,
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
    marginBottom: 22,
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
    backgroundColor: '#1e2538',
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
    backgroundColor: '#0d1321',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  statLabel: {
    fontFamily: Fonts.Outfit_700Bold,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    color: '#a6aabc',
    marginBottom: 4,
  },
  statValue: {
    fontFamily: Fonts.Outfit_700Bold,
    fontSize: 22,
    color: '#e4e7fb',
  },
  statDelta: {
    fontSize: 12,
    fontFamily: Fonts.Outfit_600SemiBold,
  },
  statMuted: {
    color: 'rgba(166,170,188,0.45)',
    fontSize: 12,
    fontFamily: Fonts.Outfit_600SemiBold,
  },
  cardFooter: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.08)',
    paddingTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  teamBubble: {
    width: 32,
    height: 32,
    borderRadius: 999,
    backgroundColor: '#1e2538',
    borderWidth: 2,
    borderColor: '#131929',
    alignItems: 'center',
    justifyContent: 'center',
  },
  teamBubbleText: {
    fontFamily: Fonts.Outfit_700Bold,
    fontSize: 11,
    color: '#e4e7fb',
  },
  viewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  viewButtonText: {
    fontFamily: Fonts.Outfit_700Bold,
    fontSize: 14,
    color: '#85adff',
  },
});
