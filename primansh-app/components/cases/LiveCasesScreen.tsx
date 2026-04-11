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
  Image,
  ScrollView,
} from 'react-native';
import { 
  Database, 
  Search, 
  TrendingUp, 
  Users, 
  Globe, 
  ExternalLink,
  ChevronRight,
  Zap,
  Layout,
  Award,
  BarChart3
} from 'lucide-react-native';
import { supabase } from '../../lib/supabase';
import { Colors, Fonts } from '../../lib/theme';
import { GlassCard } from '../ui/GlassCard';
import { useMobileSession } from '../../context/MobileSessionContext';

interface CaseStudy {
  id: string;
  slug: string;
  client: string;
  location: string | null;
  service: string | null;
  challenge: string | null;
  solution: string | null;
  results: any[];
  testimonial: string | null;
  color: string | null;
  is_published: boolean;
  service_type: string | null;
  images: string[];
  created_at: string;
}

const METRIC_ICONS: Record<string, any> = {
  'trending-up': TrendingUp,
  'users': Users,
  'globe': Globe,
  'search': Search,
  'zap': Zap,
};

export default function LiveCasesScreen() {
  const { profile } = useMobileSession();
  const [cases, setCases] = useState<CaseStudy[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [serviceFilter, setServiceFilter] = useState('all');

  const loadData = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true);
    try {
      let query = supabase
        .from('case_studies')
        .select('*')
        .order('created_at', { ascending: false });

      // Non-admins only see published leads
      if (profile?.normalizedRole !== 'admin') {
        query = query.eq('is_published', true);
      }

      const { data, error } = await query;
      if (error) throw error;
      setCases(data || []);
    } catch (e) {
      console.error('[Cases] Load error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [profile]);

  useEffect(() => {
    loadData(true);

    const channel = supabase
      .channel('cases_sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'case_studies' }, () => {
        loadData(false);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadData]);

  const filteredCases = useMemo(() => {
    return cases.filter(c => {
      const matchesSearch = !search || 
        c.client.toLowerCase().includes(search.toLowerCase()) ||
        c.service?.toLowerCase().includes(search.toLowerCase());
      const matchesService = serviceFilter === 'all' || c.service_type === serviceFilter;
      return matchesSearch && matchesService;
    });
  }, [cases, search, serviceFilter]);

  const serviceTypes = useMemo(() => {
    const types = new Set(cases.map(c => c.service_type).filter(Boolean));
    return Array.from(types) as string[];
  }, [cases]);

  const renderCase = ({ item }: { item: CaseStudy }) => {
    const results = Array.isArray(item.results) ? item.results : [];

    return (
      <GlassCard style={styles.caseCard} intensity={12}>
        <View style={styles.cardHeader}>
          <View style={styles.clientGroup}>
            <Text style={styles.clientTitle}>{item.client.toUpperCase()}</Text>
            <View style={styles.serviceTag}>
               <Layout size={10} color={Colors.slate500} />
               <Text style={styles.serviceText}>{item.service || 'FULL STACK GROWTH'}</Text>
            </View>
          </View>
          {!item.is_published && (
            <View style={styles.draftBadge}>
              <Text style={styles.draftText}>DRAFT</Text>
            </View>
          )}
        </View>

        <View style={styles.descriptionSection}>
           <Text style={styles.challengeText} numberOfLines={2}>{item.challenge}</Text>
        </View>

        <View style={styles.metricsGrid}>
          {results.slice(0, 3).map((res: any, idx: number) => {
            const Icon = METRIC_ICONS[res.icon] || BarChart3;
            return (
              <View key={idx} style={styles.metricBox}>
                <Icon size={14} color={Colors.accent} />
                <Text style={styles.metricValue}>{res.value}</Text>
                <Text style={styles.metricLabel}>{res.metric.toUpperCase()}</Text>
              </View>
            );
          })}
        </View>

        <View style={styles.cardFooter}>
           <View style={styles.authorInfo}>
              <Award size={12} color={Colors.slate600} />
              <Text style={styles.footerText}>AGENCY EXCELLENCE</Text>
           </View>
           <TouchableOpacity style={styles.readMore}>
              <Text style={styles.readMoreText}>VIEW CASE</Text>
              <ChevronRight size={12} color={Colors.accent} />
           </TouchableOpacity>
        </View>
      </GlassCard>
    );
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={Colors.accent} size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.topSection}>
        <View style={styles.searchBar}>
          <Search size={16} color={Colors.slate500} />
          <TextInput
            placeholder="Search transformations..."
            placeholderTextColor={Colors.slate600}
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
          />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
           <TouchableOpacity 
            onPress={() => setServiceFilter('all')}
            style={[styles.filterChip, serviceFilter === 'all' && styles.filterChipActive]}
           >
             <Text style={[styles.filterChipText, serviceFilter === 'all' && styles.filterChipTextActive]}>ALL STORIES</Text>
           </TouchableOpacity>
           {serviceTypes.map(type => (
             <TouchableOpacity 
              key={type}
              onPress={() => setServiceFilter(type)}
              style={[styles.filterChip, serviceFilter === type && styles.filterChipActive]}
             >
               <Text style={[styles.filterChipText, serviceFilter === type && styles.filterChipTextActive]}>
                 {type.toUpperCase()}
               </Text>
             </TouchableOpacity>
           ))}
        </ScrollView>
      </View>

      <FlatList
        data={filteredCases}
        renderItem={renderCase}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => loadData(false)} tintColor={Colors.accent} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Database size={48} color={Colors.slate800} />
            <Text style={styles.emptyText}>No success stories have been published yet.</Text>
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
  topSection: {
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
  filterRow: {
    flexDirection: 'row',
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    marginRight: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  filterChipActive: {
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
    borderColor: '#6366f1',
  },
  filterChipText: {
    fontFamily: Fonts.SpaceMono_700Bold,
    fontSize: 9,
    color: Colors.slate500,
  },
  filterChipTextActive: {
    color: '#6366f1',
  },
  list: {
    padding: 20,
    paddingTop: 0,
    paddingBottom: 40,
  },
  caseCard: {
    padding: 20,
    marginBottom: 16,
    borderRadius: 24,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 15,
  },
  clientGroup: {
    flex: 1,
  },
  clientTitle: {
    fontFamily: Fonts.Outfit_700Bold,
    fontSize: 18,
    color: '#fff',
    letterSpacing: 0.5,
  },
  serviceTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  serviceText: {
    fontFamily: Fonts.SpaceMono_400Regular,
    fontSize: 8,
    color: Colors.slate500,
    letterSpacing: 1,
  },
  draftBadge: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    backgroundColor: 'rgba(96,165,250,0.1)',
    borderRadius: 4,
  },
  draftText: {
    fontFamily: Fonts.SpaceMono_700Bold,
    fontSize: 8,
    color: '#60a5fa',
  },
  descriptionSection: {
    marginBottom: 20,
  },
  challengeText: {
    fontFamily: Fonts.Outfit_400Regular,
    fontSize: 13,
    color: Colors.slate500,
    lineHeight: 18,
  },
  metricsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 20,
  },
  metricBox: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 16,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.02)',
  },
  metricValue: {
    fontFamily: Fonts.SpaceMono_700Bold,
    fontSize: 14,
    color: '#fff',
    marginTop: 4,
  },
  metricLabel: {
    fontFamily: Fonts.SpaceMono_700Bold,
    fontSize: 7,
    color: Colors.slate600,
    marginTop: 2,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
  },
  authorInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  footerText: {
    fontFamily: Fonts.SpaceMono_400Regular,
    fontSize: 9,
    color: Colors.slate600,
  },
  readMore: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  readMoreText: {
    fontFamily: Fonts.SpaceMono_700Bold,
    fontSize: 9,
    color: Colors.accent,
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
  }
});
