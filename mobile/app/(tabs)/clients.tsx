import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, RefreshControl, TouchableOpacity, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { GlassCard } from '../../components/ui/GlassCard';
import { Colors, Fonts } from '../../lib/theme';
import { Search, Building, MapPin, Activity } from 'lucide-react-native';

export default function ClientsScreen() {
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  async function fetchClients() {
    setLoading(true);
    // Standard query. Role-based filtering can be added via profile if needed
    const { data: clientData, error } = await supabase
      .from('clients')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (clientData) setClients(clientData);
    setLoading(false);
  }

  useEffect(() => {
    fetchClients();
  }, []);

  const filteredClients = clients.filter(c => 
    c.firm_name?.toLowerCase().includes(search.toLowerCase()) || 
    c.location?.toLowerCase().includes(search.toLowerCase())
  );

  const getPlanColor = (plan: string) => {
    if (plan === 'premium') return '#a78bfa'; // Purple
    if (plan === 'growth') return '#3b82f6'; // Blue
    return '#64748b'; // Basic/Slate
  };

  const getHealthColor = (score: number) => {
    if (score >= 75) return '#10b981';
    if (score >= 50) return '#f59e0b';
    return '#ef4444';
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Network</Text>
        <Text style={styles.headerSubtitle}>Managing {clients.length} premium client entities</Text>
      </View>

      <View style={styles.searchContainer}>
        <Search color={Colors.slate500} size={18} />
        <TextInput 
          style={styles.searchInput}
          placeholder="Search entities..."
          placeholderTextColor={Colors.slate500}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      <FlatList
        data={filteredClients}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={fetchClients} tintColor={Colors.accent} />}
        renderItem={({ item }) => (
          <GlassCard style={styles.card} intensity={15}>
            <View style={styles.cardHeader}>
              <View style={styles.firmIdentity}>
                <View style={styles.avatar}>
                  <Building color={Colors.accent} size={20} />
                </View>
                <View>
                  <Text style={styles.firmName}>{item.firm_name}</Text>
                  <View style={styles.locationRow}>
                    <MapPin color={Colors.slate500} size={10} />
                    <Text style={styles.locationText}>{item.location || 'Unknown'}</Text>
                  </View>
                </View>
              </View>
              
              <View style={[styles.planBadge, { backgroundColor: getPlanColor(item.plan_type) + '22', borderColor: getPlanColor(item.plan_type) + '44' }]}>
                <Text style={[styles.planText, { color: getPlanColor(item.plan_type) }]}>{item.plan_type || 'basic'}</Text>
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.statsRow}>
              <View style={styles.statBox}>
                <Text style={styles.statLabel}>STATUS</Text>
                <Text style={[styles.statValue, { color: item.status === 'active' ? '#10b981' : Colors.slate500 }]}>
                  {item.status?.toUpperCase() || 'UNKNOWN'}
                </Text>
              </View>

              <View style={styles.statBox}>
                <Text style={styles.statLabel}>MRR</Text>
                <Text style={[styles.statValue, { color: '#fff' }]}>
                  ${item.monthly_revenue || '0'}
                </Text>
              </View>

              <View style={[styles.statBox, { alignItems: 'flex-end' }]}>
                <Text style={styles.statLabel}>HEALTH</Text>
                <View style={styles.healthRow}>
                  <Activity size={12} color={getHealthColor(item.health_score || item.total_health_score || 50)} />
                  <Text style={[styles.statValue, { color: getHealthColor(item.health_score || item.total_health_score || 50), marginLeft: 4 }]}>
                    {item.health_score || item.total_health_score || 50}
                  </Text>
                </View>
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
    paddingTop: 20,
    paddingBottom: 10,
  },
  headerTitle: {
    fontFamily: Fonts.Outfit_700Bold,
    fontSize: 28,
    color: '#fff',
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontFamily: Fonts.SpaceMono_400Regular,
    fontSize: 12,
    color: Colors.slate500,
    marginTop: 4,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    marginHorizontal: 20,
    marginBottom: 16,
    paddingHorizontal: 12,
    height: 48,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontFamily: Fonts.SpaceMono_400Regular,
    color: '#fff',
    fontSize: 12,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 40, // Avoid bottom tab overlap
  },
  card: {
    padding: 16,
    borderRadius: 20,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  firmIdentity: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.2)',
  },
  firmName: {
    fontFamily: Fonts.Outfit_700Bold,
    fontSize: 16,
    color: '#fff',
    marginBottom: 2,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  locationText: {
    fontFamily: Fonts.SpaceMono_400Regular,
    fontSize: 10,
    color: Colors.slate500,
    marginLeft: 4,
  },
  planBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  planText: {
    fontFamily: Fonts.Outfit_700Bold,
    fontSize: 9,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
    marginVertical: 16,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statBox: {
    flex: 1,
  },
  statLabel: {
    fontFamily: Fonts.SpaceMono_700Bold,
    fontSize: 9,
    color: Colors.slate500,
    marginBottom: 4,
    letterSpacing: 1,
  },
  statValue: {
    fontFamily: Fonts.Outfit_700Bold,
    fontSize: 14,
  },
  healthRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  emptyText: {
    fontFamily: Fonts.SpaceMono_400Regular,
    color: Colors.slate500,
    textAlign: 'center',
    marginTop: 40,
  }
});
