import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, RefreshControl, TouchableOpacity, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { GlassCard } from '../../components/ui/GlassCard';
import { Colors, Fonts } from '../../lib/theme';
import { 
  Search, Building, MapPin, Activity, Plus, Filter, Users, 
  Globe, Star, TrendingUp, MoreVertical, ShieldCheck 
} from 'lucide-react-native';
import { MetricCard } from '../../components/ui/MetricCard';

export default function ClientsScreen() {
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [metrics, setMetrics] = useState({
    total: 0,
    active: 0,
    premium: 0,
    health: 0
  });

  async function fetchClients() {
    // Fetch and calculate metrics
    const { data: clientData } = await supabase
      .from('clients')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (clientData) {
      setClients(clientData);
      
      const activeCount = clientData.filter(c => c.status === 'active').length;
      const premiumCount = clientData.filter(c => c.plan_type === 'premium').length;
      const avgHealth = Math.round(clientData.reduce((acc, c) => acc + (c.health_score || 50), 0) / (clientData.length || 1));
      
      setMetrics({
        total: clientData.length,
        active: activeCount,
        premium: premiumCount,
        health: avgHealth
      });
    }
    setLoading(false);
  }

  useEffect(() => {
    fetchClients();
  }, []);

  const filteredClients = clients.filter(c => {
    const matchesSearch = c.firm_name?.toLowerCase().includes(search.toLowerCase()) || 
                         c.location?.toLowerCase().includes(search.toLowerCase());
    const matchesFilter = filter === 'all' || c.plan_type === filter;
    return matchesSearch && matchesFilter;
  });

  const getPlanColor = (plan: string) => {
    if (plan === 'premium') return '#a78bfa'; // Purple
    if (plan === 'growth') return '#3b82f6'; // Blue
    return '#64748b'; // Basic/Slate
  };

  const getHealthColor = (score: number) => {
    if (score >= 75) return '#10b981';
    if (score >= 40) return '#f59e0b';
    return '#ef4444';
  };

  const categories = [
    { id: 'all', label: 'ALL' },
    { id: 'premium', label: 'PREMIUM' },
    { id: 'growth', label: 'GROWTH' },
    { id: 'basic', label: 'BASIC' },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.headerTitle}>Network</Text>
            <Text style={styles.headerSubtitle}>MANAGING {clients.length} ACCOUNTS</Text>
          </View>
          <TouchableOpacity style={styles.notificationButton}>
            <ShieldCheck color={Colors.accent} size={22} />
          </TouchableOpacity>
        </View>

        {/* METRICS GRID */}
        <View style={styles.metricsGrid}>
          <MetricCard 
            label="TOTAL FIRMS" 
            value={metrics.total} 
            icon={Users} 
            color="#3b82f6" 
            subtitle="+2 this month"
          />
          <MetricCard 
            label="ACTIVE CLIENTS" 
            value={metrics.active} 
            icon={Globe} 
            color="#10b981" 
          />
          <MetricCard 
            label="PREMIUM SUITE" 
            value={metrics.premium} 
            icon={Star} 
            color="#a78bfa" 
          />
          <MetricCard 
            label="AVG HEALTH" 
            value={metrics.health} 
            suffix="%"
            icon={TrendingUp} 
            color="#f97316" 
          />
        </View>

        {/* SEARCH & ADD BAR */}
        <View style={styles.searchBarRow}>
          <View style={styles.searchContainer}>
            <Search color={Colors.slate500} size={16} />
            <TextInput 
              style={styles.searchInput}
              placeholder="Search clients..."
              placeholderTextColor={Colors.slate500}
              value={search}
              onChangeText={setSearch}
            />
          </View>
          <TouchableOpacity style={styles.addButton}>
            <Plus color="#fff" size={16} />
            <Text style={styles.addButtonText}>Add</Text>
          </TouchableOpacity>
        </View>

        {/* FILTERS */}
        <View style={styles.filterRow}>
          {categories.map(cat => (
            <TouchableOpacity 
              key={cat.id} 
              onPress={() => setFilter(cat.id)}
              style={[
                styles.filterTab, 
                filter === cat.id && styles.filterTabActive
              ]}
            >
              <Text style={[
                styles.filterText, 
                filter === cat.id && styles.filterTextActive
              ]}>
                {cat.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <FlatList
        data={filteredClients}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={fetchClients} tintColor={Colors.accent} />}
        renderItem={({ item }) => (
          <GlassCard style={styles.card} intensity={10}>
            <View style={styles.cardMain}>
              <View style={styles.clientIdentity}>
                <View style={[styles.avatar, { backgroundColor: getPlanColor(item.plan_type) + '1A' }]}>
                  <Building color={getPlanColor(item.plan_type)} size={18} />
                </View>
                <View style={styles.identityText}>
                  <Text style={styles.firmName} numberOfLines={1}>{item.firm_name}</Text>
                  <Text style={styles.locationText}>{item.location || 'Distributed'}</Text>
                </View>
              </View>
              
              <TouchableOpacity style={styles.moreButton}>
                <MoreVertical color={Colors.slate500} size={18} />
              </TouchableOpacity>
            </View>

            <View style={styles.cardFooter}>
              <View style={styles.statusBadge}>
                <View style={[styles.statusDot, { backgroundColor: item.status === 'active' ? '#10b981' : Colors.slate500 }]} />
                <Text style={styles.statusLabel}>{item.status?.toUpperCase() || 'OFFLINE'}</Text>
              </View>

              <View style={styles.cardMeta}>
                <View style={styles.metaItem}>
                  <Activity size={12} color={getHealthColor(item.health_score || 50)} />
                  <Text style={[styles.metaValue, { color: getHealthColor(item.health_score || 50) }]}>
                    {item.health_score || 50}%
                  </Text>
                </View>
                <View style={styles.vDivider} />
                <Text style={styles.planLabel}>{item.plan_type?.toUpperCase() || 'BASIC'}</Text>
              </View>
            </View>
          </GlassCard>
        )}
        ListEmptyComponent={!loading ? (
          <Text style={styles.emptyText}>No clients found in the network.</Text>
        ) : null}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 16,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  headerTitle: {
    fontFamily: Fonts.Outfit_700Bold,
    fontSize: 22,
    color: '#fff',
  },
  headerSubtitle: {
    fontFamily: Fonts.SpaceMono_400Regular,
    fontSize: 10,
    color: Colors.slate500,
    letterSpacing: 1,
    marginTop: 2,
  },
  notificationButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.03)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  searchBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 14,
    paddingHorizontal: 16,
    height: 46,
  },
  searchInput: {
    flex: 1,
    marginLeft: 10,
    fontFamily: Fonts.Outfit_400Regular,
    color: '#fff',
    fontSize: 14,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.accent,
    borderRadius: 14,
    paddingHorizontal: 16,
    height: 46,
    gap: 6,
  },
  addButtonText: {
    fontFamily: Fonts.Outfit_600SemiBold,
    color: '#fff',
    fontSize: 14,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
  },
  filterTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  filterTabActive: {
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    borderColor: 'rgba(59, 130, 246, 0.3)',
  },
  filterText: {
    fontFamily: Fonts.SpaceMono_700Bold,
    fontSize: 9,
    color: Colors.slate500,
  },
  filterTextActive: {
    color: Colors.accent,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  card: {
    padding: 14,
    borderRadius: 18,
    marginBottom: 10,
  },
  cardMain: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  clientIdentity: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  identityText: {
    flex: 1,
  },
  firmName: {
    fontFamily: Fonts.Outfit_700Bold,
    fontSize: 15,
    color: '#fff',
  },
  locationText: {
    fontFamily: Fonts.SpaceMono_400Regular,
    fontSize: 10,
    color: Colors.slate500,
    marginTop: 2,
  },
  moreButton: {
    padding: 4,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 'auto',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.03)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  statusLabel: {
    fontFamily: Fonts.SpaceMono_700Bold,
    fontSize: 8,
    color: '#fff',
    letterSpacing: 0.5,
  },
  cardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaValue: {
    fontFamily: Fonts.SpaceMono_700Bold,
    fontSize: 10,
  },
  vDivider: {
    width: 1,
    height: 10,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  planLabel: {
    fontFamily: Fonts.SpaceMono_700Bold,
    fontSize: 9,
    color: Colors.slate500,
  },
  emptyText: {
    fontFamily: Fonts.SpaceMono_400Regular,
    color: Colors.slate500,
    textAlign: 'center',
    marginTop: 40,
  }
});
