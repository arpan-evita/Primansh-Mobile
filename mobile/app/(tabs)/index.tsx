import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, RefreshControl, Dimensions, TouchableOpacity } from 'react-native';
import { supabase } from '../../lib/supabase';
import { 
  Menu, Sparkles, Plus, Bell, PenTool, FileText, Star, Users, ArrowDownRight, TrendingUp 
} from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GlassCard } from '../../components/ui/GlassCard';
import { Colors, Fonts } from '../../lib/theme';
import { useRouter } from 'expo-router';

export default function DashboardScreen() {
  const [profile, setProfile] = useState<any>(null);
  const [metrics, setMetrics] = useState({ clients: 0, traffic: 0 });
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();

  async function fetchData() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profileData } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();
    
    setProfile(profileData);

    // Fetch Client Metric Data (assuming 'clients' table exists per web schema)
    try {
      const { count } = await supabase.from('clients').select('*', { count: 'exact', head: true });
      setMetrics(prev => ({ ...prev, clients: count || 0 }));
    } catch(e) {
      // Ignore if table access restricted 
    }
    
    setRefreshing(false);
  }

  useEffect(() => {
    fetchData();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* TOP HEADER MENU */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity style={styles.iconButton}>
            <Menu color={Colors.slate500} size={24} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Dashboard</Text>
        </View>

        <View style={styles.headerRight}>
          <TouchableOpacity style={[styles.actionButton, { backgroundColor: '#F8FAFC' }]}>
            <Sparkles color={Colors.slate500} size={18} />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionButton, { backgroundColor: Colors.accent }]}>
            <Plus color="#fff" size={18} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconButton}>
            <Bell color={Colors.slate500} size={20} />
          </TouchableOpacity>
          <View style={styles.avatar}>
             <Text style={styles.avatarText}>{profile?.full_name?.[0]?.toUpperCase() || 'U'}</Text>
          </View>
        </View>
      </View>

      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.accent} />}
      >
        
        {/* QUICK ACTION NAVIGATION STACK */}
        <View style={styles.actionsStack}>
          
          <ActionCard 
            title="New Article" 
            subtitle="ADVANCED EDITOR" 
            icon={PenTool} 
            color="#3b82f6" 
            onPress={() => router.push('/portal/articles/editor')} 
          />
          
          <ActionCard 
            title="Article Master" 
            subtitle="MANAGE CONTENT" 
            icon={FileText} 
            color="#3b82f6" 
            onPress={() => router.push('/portal/articles')} 
          />
          
          <ActionCard 
            title="Testimonials" 
            subtitle="SOCIAL PROOF" 
            icon={Star} 
            color="#10b981" 
            onPress={() => router.push('/portal/testimonials')} 
          />
          
          <ActionCard 
            title="Team Hub" 
            subtitle="MANAGE RANKS" 
            icon={Users} 
            color="#eab308" 
            onPress={() => router.push('/portal/team')} 
          />
        </View>

        {/* METRICS ROW */}
        <View style={styles.metricsGrid}>
          {/* Total Clients Card */}
          <GlassCard style={styles.metricCard} intensity={25}>
            <View style={styles.metricHeader}>
              <View style={[styles.metricIconBox, { backgroundColor: 'rgba(59, 130, 246, 0.1)' }]}>
                <Users color="#3b82f6" size={18} />
              </View>
              <View style={styles.metricBadgeDrop}>
                 <ArrowDownRight color="#f97316" size={12} />
                 <Text style={styles.metricBadgeTextDrop}>67%</Text>
              </View>
            </View>
            <View style={styles.metricContent}>
              <Text style={styles.metricLargeValue}>{metrics.clients}</Text>
              <Text style={styles.metricLabel}>TOTAL CLIENTS</Text>
            </View>
          </GlassCard>

          {/* Agency Traffic Card */}
          <GlassCard style={styles.metricCard} intensity={25}>
            <View style={styles.metricHeader}>
              <View style={[styles.metricIconBox, { backgroundColor: 'rgba(59, 130, 246, 0.1)' }]}>
                <TrendingUp color="#3b82f6" size={18} />
              </View>
              <View style={styles.metricBadgeStable}>
                 <Text style={styles.metricBadgeTextStable}>STABLE</Text>
              </View>
            </View>
            <View style={styles.metricContent}>
               <Text style={styles.metricLargeValue}>{metrics.traffic}</Text>
               <Text style={styles.metricLabel}>AGENCY TRAFFIC</Text>
            </View>
          </GlassCard>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

function ActionCard({ title, subtitle, icon: Icon, color, onPress }: any) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8}>
      <GlassCard style={styles.actionCard} intensity={15}>
        <View style={[styles.actionIconContainer, { backgroundColor: color + '1A' }]}>
           <Icon color={color} size={20} />
        </View>
        <View style={styles.actionTextContainer}>
          <Text style={styles.actionTitle}>{title}</Text>
          <Text style={styles.actionSubtitle}>{subtitle}</Text>
        </View>
      </GlassCard>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 100,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerTitle: {
    fontFamily: Fonts.Outfit_700Bold,
    fontSize: 18,
    color: '#fff',
    marginLeft: 16,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionButton: {
    width: 46,
    height: 38,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.surfaceElevated,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    overflow: 'hidden',
  },
  avatarText: {
    fontFamily: Fonts.Outfit_700Bold,
    color: '#fff',
    fontSize: 14,
  },
  actionsStack: {
    gap: 16,
    marginTop: 10,
  },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderRadius: 24,
  },
  actionIconContainer: {
    width: 52,
    height: 52,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  actionTextContainer: {
    flex: 1,
  },
  actionTitle: {
    fontFamily: Fonts.Outfit_700Bold,
    fontSize: 16,
    color: '#fff',
    marginBottom: 4,
  },
  actionSubtitle: {
    fontFamily: Fonts.SpaceMono_400Regular,
    fontSize: 10,
    color: Colors.slate500,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  metricsGrid: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 24,
  },
  metricCard: {
    flex: 1,
    padding: 20,
    borderRadius: 24,
  },
  metricHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  metricIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  metricBadgeDrop: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(249, 115, 22, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  metricBadgeTextDrop: {
    fontFamily: Fonts.SpaceMono_700Bold,
    color: '#f97316',
    fontSize: 10,
    marginLeft: 4,
  },
  metricBadgeStable: {
    backgroundColor: 'rgba(71, 85, 105, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  metricBadgeTextStable: {
    fontFamily: Fonts.SpaceMono_700Bold,
    color: Colors.slate500,
    fontSize: 9,
    letterSpacing: 0.5,
  },
  metricContent: {
    marginTop: 'auto',
  },
  metricLargeValue: {
    fontFamily: Fonts.Outfit_700Bold,
    fontSize: 32,
    color: '#fff',
    marginBottom: 8,
  },
  metricLabel: {
    fontFamily: Fonts.SpaceMono_400Regular,
    fontSize: 10,
    color: Colors.slate500,
    letterSpacing: 1,
  },
});
