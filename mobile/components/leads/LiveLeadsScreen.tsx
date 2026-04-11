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
  Users, 
  Search, 
  Filter, 
  ChevronRight, 
  Mail, 
  Phone, 
  Bot, 
  Globe, 
  Clock,
  MoreVertical,
  CheckCircle2,
  Trash2,
  TrendingUp,
  Briefcase
} from 'lucide-react-native';
import { supabase } from '../../lib/supabase';
import { Colors, Fonts } from '../../lib/theme';
import { GlassCard } from '../ui/GlassCard';
import { useMobileSession } from '../../context/MobileSessionContext';

type LeadStatus = 'new' | 'contacted' | 'qualified' | 'converted' | 'lost';

interface Lead {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  source: string;
  status: LeadStatus;
  industry: string | null;
  budget: string | null;
  notes: string | null;
  assigned_to: string | null;
  linked_client_id: string | null;
  created_at: string;
}

const STATUS_CONFIG: Record<LeadStatus, { label: string, color: string, bg: string }> = {
  new: { label: 'New', color: '#60a5fa', bg: 'rgba(96,165,250,0.1)' },
  contacted: { label: 'Contacted', color: '#fbbf24', bg: 'rgba(251,191,36,0.1)' },
  qualified: { label: 'Qualified', color: '#34d399', bg: 'rgba(52,211,153,0.1)' },
  converted: { label: 'Converted', color: '#a78bfa', bg: 'rgba(167,139,250,0.1)' },
  lost: { label: 'Lost', color: '#94a3b8', bg: 'rgba(148,163,184,0.1)' },
};

const SOURCE_ICONS: Record<string, any> = {
  website_bot: Bot,
  contact_page: Globe,
  homepage: TrendingUp,
  manual: Briefcase,
};

export default function LiveLeadsScreen() {
  const { profile } = useMobileSession();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | LeadStatus>('all');

  const loadLeads = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true);
    try {
      let query = supabase
        .from('leads')
        .select('*')
        .order('created_at', { ascending: false });

      // RBAC: Non-admins only see assigned leads
      if (profile?.normalizedRole !== 'admin') {
        query = query.eq('assigned_to', profile?.id);
      }

      const { data, error } = await query;
      if (error) throw error;
      setLeads(data || []);
    } catch (e) {
      console.error('[Leads] Load error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [profile]);

  useEffect(() => {
    loadLeads(true);
    
    // Real-time subscription
    const channel = supabase
      .channel('leads_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, () => {
        loadLeads(false);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadLeads]);

  const filteredLeads = useMemo(() => {
    return leads.filter(l => {
      const matchesSearch = !search || 
        l.name.toLowerCase().includes(search.toLowerCase()) ||
        l.email?.toLowerCase().includes(search.toLowerCase()) ||
        l.industry?.toLowerCase().includes(search.toLowerCase());
      const matchesStatus = statusFilter === 'all' || l.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [leads, search, statusFilter]);

  const handleUpdateStatus = async (leadId: string, status: LeadStatus) => {
    try {
      const { error } = await supabase
        .from('leads')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', leadId);
      
      if (error) throw error;
      Alert.alert('Success', `Lead marked as ${status}`);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  const handleConvertToClient = async (leadId: string) => {
    Alert.alert(
      'Convert Lead',
      'This will create a new Client record and set this lead to Converted. Proceed?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Convert', 
          style: 'default',
          onPress: async () => {
            try {
              const { data, error } = await supabase.rpc('convert_lead_to_client', {
                lead_id: leadId,
                admin_id: profile?.id
              });
              if (error) throw error;
              Alert.alert('Success', 'Lead successfully converted to Client!');
            } catch (e: any) {
              Alert.alert('Error', e.message);
            }
          }
        }
      ]
    );
  };

  const renderLeadCard = ({ item }: { item: Lead }) => {
    const config = STATUS_CONFIG[item.status] || STATUS_CONFIG.new;
    const SourceIcon = SOURCE_ICONS[item.source] || Users;

    return (
      <GlassCard style={styles.leadCard} intensity={15}>
        <View style={styles.cardHeader}>
          <View style={styles.headerLeft}>
            <View style={[styles.statusBadge, { backgroundColor: config.bg }]}>
              <Text style={[styles.statusText, { color: config.color }]}>{config.label.toUpperCase()}</Text>
            </View>
            <View style={styles.sourceTag}>
              <SourceIcon size={12} color={Colors.slate500} />
              <Text style={styles.sourceText}>{item.source.replace('_', ' ').toUpperCase()}</Text>
            </View>
          </View>
          <TouchableOpacity onPress={() => {
            Alert.alert(
              'Lead Actions',
              'Select an action for this lead',
              [
                { text: 'Mark as Contacted', onPress: () => handleUpdateStatus(item.id, 'contacted') },
                { text: 'Mark as Qualified', onPress: () => handleUpdateStatus(item.id, 'qualified') },
                { text: 'Mark as Lost', style: 'destructive', onPress: () => handleUpdateStatus(item.id, 'lost') },
                { text: 'Cancel', style: 'cancel' }
              ]
            );
          }}>
            <MoreVertical color={Colors.slate500} size={18} />
          </TouchableOpacity>
        </View>

        <View style={styles.cardBody}>
          <Text style={styles.leadName}>{item.name}</Text>
          {item.industry && <Text style={styles.leadIndustry}>{item.industry}</Text>}
          
          <View style={styles.infoRow}>
            <Mail size={14} color={Colors.slate500} />
            <Text style={styles.infoText}>{item.email || 'No email'}</Text>
          </View>
          
          {item.phone && (
            <View style={styles.infoRow}>
              <Phone size={14} color={Colors.slate500} />
              <Text style={styles.infoText}>{item.phone}</Text>
            </View>
          )}

          {item.budget && (
            <View style={styles.infoRow}>
              <TrendingUp size={14} color={Colors.slate500} />
              <Text style={styles.infoText}>Budget: {item.budget}</Text>
            </View>
          )}
        </View>

        <View style={styles.cardFooter}>
          <View style={styles.footerInfo}>
            <Clock size={12} color={Colors.slate600} />
            <Text style={styles.dateText}>{new Date(item.created_at).toLocaleDateString()}</Text>
          </View>
          
          {item.status === 'qualified' && profile?.normalizedRole === 'admin' && (
            <TouchableOpacity 
              style={styles.convertButton}
              onPress={() => handleConvertToClient(item.id)}
            >
              <CheckCircle2 size={14} color="#020617" />
              <Text style={styles.convertButtonText}>CONVERT</Text>
            </TouchableOpacity>
          )}
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
      <View style={styles.filterSection}>
        <View style={styles.searchBar}>
          <Search size={18} color={Colors.slate500} />
          <TextInput
            placeholder="Search leads..."
            placeholderTextColor={Colors.slate600}
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
          />
        </View>
        
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.statusFilters}>
          <TouchableOpacity 
            onPress={() => setStatusFilter('all')}
            style={[styles.filterChip, statusFilter === 'all' && styles.filterChipActive]}
          >
            <Text style={[styles.filterChipText, statusFilter === 'all' && styles.filterChipTextActive]}>ALL</Text>
          </TouchableOpacity>
          {(Object.keys(STATUS_CONFIG) as LeadStatus[]).map(s => (
            <TouchableOpacity 
              key={s}
              onPress={() => setStatusFilter(s)}
              style={[styles.filterChip, statusFilter === s && styles.filterChipActive]}
            >
              <Text style={[styles.filterChipText, statusFilter === s && styles.filterChipTextActive]}>
                {s.toUpperCase()}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <FlatList
        data={filteredLeads}
        renderItem={renderLeadCard}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => loadLeads(false)} tintColor={Colors.accent} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Users size={48} color={Colors.slate800} />
            <Text style={styles.emptyText}>No leads found in this channel.</Text>
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
  filterSection: {
    padding: 20,
    gap: 15,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    paddingHorizontal: 15,
    height: 50,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  searchInput: {
    flex: 1,
    marginLeft: 10,
    color: '#fff',
    fontFamily: Fonts.Outfit_400Regular,
    fontSize: 14,
  },
  statusFilters: {
    flexDirection: 'row',
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.05)',
    marginRight: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  filterChipActive: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  filterChipText: {
    fontFamily: Fonts.SpaceMono_700Bold,
    fontSize: 10,
    color: Colors.slate500,
  },
  filterChipTextActive: {
    color: '#020617',
  },
  list: {
    padding: 20,
    paddingTop: 0,
    paddingBottom: 40,
  },
  leadCard: {
    padding: 20,
    marginBottom: 16,
    borderRadius: 24,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  headerLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusText: {
    fontFamily: Fonts.SpaceMono_700Bold,
    fontSize: 9,
  },
  sourceTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  sourceText: {
    fontFamily: Fonts.SpaceMono_400Regular,
    fontSize: 8,
    color: Colors.slate500,
  },
  cardBody: {
    marginBottom: 15,
  },
  leadName: {
    fontFamily: Fonts.Outfit_700Bold,
    fontSize: 18,
    color: '#fff',
    marginBottom: 2,
  },
  leadIndustry: {
    fontFamily: Fonts.Outfit_400Regular,
    fontSize: 12,
    color: Colors.slate500,
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  infoText: {
    fontFamily: Fonts.Outfit_400Regular,
    fontSize: 13,
    color: Colors.slate500,
  },
  cardFooter: {
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
  dateText: {
    fontFamily: Fonts.SpaceMono_400Regular,
    fontSize: 10,
    color: Colors.slate600,
  },
  convertButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.accent,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  convertButtonText: {
    fontFamily: Fonts.SpaceMono_700Bold,
    fontSize: 10,
    color: '#020617',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontFamily: Fonts.Outfit_400Regular,
    fontSize: 14,
    color: Colors.slate600,
    marginTop: 15,
  }
});
