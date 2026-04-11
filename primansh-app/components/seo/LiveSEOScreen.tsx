import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  TextInput,
  Alert,
  ScrollView,
} from 'react-native';
import { 
  Target, 
  Search, 
  TrendingUp, 
  TrendingDown, 
  Minus,
  AlertCircle,
  RefreshCw,
  Globe,
  ExternalLink,
  ChevronRight,
  Target as TargetIcon
} from 'lucide-react-native';
import { supabase } from '../../lib/supabase';
import { Colors, Fonts } from '../../lib/theme';
import { GlassCard } from '../ui/GlassCard';
import { useMobileSession } from '../../context/MobileSessionContext';

interface KeywordNode {
  id: string;
  client_id: string;
  keyword: string;
  target_pos: number;
  current_pos: number;
  trend: 'up' | 'down' | 'stable';
  traffic_estimate: number;
  page_score: number;
  last_checked: string;
  client?: { firm_name: string };
}

export default function LiveSEOScreen() {
  const { profile } = useMobileSession();
  const [nodes, setNodes] = useState<KeywordNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [clientFilter, setClientFilter] = useState<'all' | string>('all');
  const [clients, setClients] = useState<{id: string, name: string}[]>([]);

  const loadData = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true);
    try {
      // 1. Fetch Clients for filter
      const { data: clientsData } = await supabase
        .from('clients')
        .select('id, firm_name')
        .order('firm_name');
      
      if (clientsData) {
        setClients(clientsData.map(c => ({ id: c.id, name: c.firm_name })));
      }

      // 2. Fetch Keywords
      let query = supabase
        .from('keywords')
        .select('*, client:clients(firm_name)')
        .order('keyword');

      if (profile?.normalizedRole === 'client' && profile?.associated_client_id) {
        query = query.eq('client_id', profile.associated_client_id);
      }

      const { data, error } = await query;
      if (error) throw error;
      setNodes(data || []);
    } catch (e) {
      console.error('[SEO] Load error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [profile?.associated_client_id, profile?.id, profile?.normalizedRole]);

  useEffect(() => {
    loadData(true);

    const channel = supabase
      .channel('seo_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'keywords' }, () => {
        loadData(false);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadData]);

  const filteredNodes = useMemo(() => {
    return nodes.filter(n => {
      const matchesSearch = !search || n.keyword.toLowerCase().includes(search.toLowerCase());
      const matchesClient = clientFilter === 'all' || n.client_id === clientFilter;
      return matchesSearch && matchesClient;
    });
  }, [nodes, search, clientFilter]);

  const handleUpdateRank = async (nodeId: string, currentPos: number) => {
    if (profile?.normalizedRole === 'client') {
      return;
    }

    Alert.prompt(
      'Update Ranking',
      'Enter the live Google position for this keyword:',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Sync', 
          onPress: async (val) => {
            const newPos = parseInt(val || '');
            if (isNaN(newPos)) return;

            let trend: 'up' | 'down' | 'stable' = 'stable';
            if (newPos < currentPos) trend = 'up';
            else if (newPos > currentPos) trend = 'down';

            try {
              const { error } = await supabase
                .from('keywords')
                .update({ 
                  current_pos: newPos, 
                  trend, 
                  last_checked: new Date().toISOString() 
                })
                .eq('id', nodeId);
              
              if (error) throw error;
              Alert.alert('Success', 'Search node synchronized! 🛰️');
            } catch (e: any) {
              Alert.alert('Error', e.message);
            }
          }
        }
      ],
      'plain-text',
      currentPos.toString()
    );
  };

  const renderNode = ({ item }: { item: KeywordNode }) => {
    const isGoalAchieved = item.current_pos <= item.target_pos;

    return (
      <GlassCard style={styles.nodeCard} intensity={12}>
        <View style={styles.nodeHeader}>
          <View style={styles.nodeInfo}>
            <Text style={styles.keywordTitle} numberOfLines={1}>{item.keyword.toUpperCase()}</Text>
            <Text style={styles.clientLabel}>{item.client?.firm_name || 'System Node'}</Text>
          </View>
          <View style={styles.trendIconBox}>
            {item.trend === 'up' && <TrendingUp color="#34d399" size={20} />}
            {item.trend === 'down' && <TrendingDown color="#f87171" size={20} />}
            {item.trend === 'stable' && <Minus color={Colors.slate500} size={18} />}
          </View>
        </View>

        <View style={styles.statsContainer}>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>TARGET</Text>
            <Text style={styles.statValue}>#{item.target_pos}</Text>
          </View>
          <View style={[styles.statBox, styles.statBoxCenter, isGoalAchieved && styles.statBoxGoal]}>
            <Text style={styles.statLabel}>LIVE</Text>
            <TouchableOpacity onPress={() => handleUpdateRank(item.id, item.current_pos)}>
               <Text style={[styles.statValue, styles.liveValue]}>#{item.current_pos}</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>TRAFFIC</Text>
            <Text style={styles.statValue}>{item.traffic_estimate || '—'}</Text>
          </View>
        </View>

        <View style={styles.nodeFooter}>
          <View style={styles.footerInfo}>
             <RefreshCw size={10} color={Colors.slate600} />
             <Text style={styles.syncText}>SYNCED: {new Date(item.last_checked).toLocaleDateString()}</Text>
          </View>
          <View style={[styles.badge, isGoalAchieved ? styles.badgeSuccess : styles.badgePending]}>
            <Text style={[styles.badgeText, isGoalAchieved ? styles.badgeTextSuccess : styles.badgeTextPending]}>
              {isGoalAchieved ? 'GOAL ACHIEVED' : 'OPTIMIZING'}
            </Text>
          </View>
        </View>
      </GlassCard>
    );
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#3b82f6" size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.trackerHeader}>
        <View style={styles.searchBar}>
          <Search size={16} color={Colors.slate500} />
          <TextInput
            placeholder="Search keywords..."
            placeholderTextColor={Colors.slate600}
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
          />
        </View>

        {profile?.normalizedRole !== 'client' ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.clientRow}>
            <TouchableOpacity 
              onPress={() => setClientFilter('all')}
              style={[styles.clientChip, clientFilter === 'all' && styles.clientChipActive]}
            >
              <Text style={[styles.clientChipText, clientFilter === 'all' && styles.clientChipTextActive]}>GLOBAL</Text>
            </TouchableOpacity>
            {clients.map(c => (
              <TouchableOpacity 
                key={c.id}
                onPress={() => setClientFilter(c.id)}
                style={[styles.clientChip, clientFilter === c.id && styles.clientChipActive]}
              >
                <Text style={[styles.clientChipText, clientFilter === c.id && styles.clientChipTextActive]}>
                  {c.name.split(' ')[0].toUpperCase()}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        ) : null}
      </View>

      <FlatList
        data={filteredNodes}
        renderItem={renderNode}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => loadData(false)} tintColor="#3b82f6" />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <TargetIcon size={48} color={Colors.slate800} />
            <Text style={styles.emptyText}>No active search nodes are visible for this client yet.</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  trackerHeader: {
    padding: 20,
    gap: 15,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    paddingHorizontal: 15,
    height: 46,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  searchInput: {
    flex: 1,
    marginLeft: 10,
    color: '#fff',
    fontFamily: Fonts.Outfit_400Regular,
    fontSize: 13,
  },
  clientRow: {
    flexDirection: 'row',
  },
  clientChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    marginRight: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  clientChipActive: {
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    borderColor: '#3b82f6',
  },
  clientChipText: {
    fontFamily: Fonts.SpaceMono_700Bold,
    fontSize: 9,
    color: Colors.slate500,
  },
  clientChipTextActive: {
    color: '#3b82f6',
  },
  list: {
    padding: 20,
    paddingTop: 0,
    paddingBottom: 40,
  },
  nodeCard: {
    padding: 20,
    marginBottom: 16,
    borderRadius: 24,
  },
  nodeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  nodeInfo: {
    flex: 1,
    paddingRight: 10,
  },
  keywordTitle: {
    fontFamily: Fonts.Outfit_700Bold,
    fontSize: 16,
    color: '#fff',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  clientLabel: {
    fontFamily: Fonts.Outfit_400Regular,
    fontSize: 11,
    color: Colors.slate500,
  },
  trendIconBox: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.03)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 20,
  },
  statBox: {
    flex: 1,
    padding: 12,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 16,
    alignItems: 'center',
  },
  statBoxCenter: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  statBoxGoal: {
    borderColor: 'rgba(52, 211, 153, 0.2)',
    backgroundColor: 'rgba(52, 211, 153, 0.05)',
  },
  statLabel: {
    fontFamily: Fonts.SpaceMono_700Bold,
    fontSize: 8,
    color: Colors.slate500,
    marginBottom: 4,
  },
  statValue: {
    fontFamily: Fonts.SpaceMono_700Bold,
    fontSize: 15,
    color: '#fff',
  },
  liveValue: {
    color: '#3b82f6',
    textDecorationLine: 'underline',
  },
  nodeFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
  },
  footerInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  syncText: {
    fontFamily: Fonts.SpaceMono_400Regular,
    fontSize: 9,
    color: Colors.slate600,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeSuccess: {
    backgroundColor: 'rgba(52, 211, 153, 0.1)',
  },
  badgePending: {
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  badgeText: {
    fontFamily: Fonts.SpaceMono_700Bold,
    fontSize: 9,
  },
  badgeTextSuccess: {
    color: '#34d399',
  },
  badgeTextPending: {
    color: Colors.slate500,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
  },
  emptyText: {
    fontFamily: Fonts.Outfit_400Regular,
    fontSize: 14,
    color: Colors.slate600,
    marginTop: 20,
    textAlign: 'center',
  }
});
