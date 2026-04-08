import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, RefreshControl, Dimensions, TouchableOpacity } from 'react-native';
import { supabase } from '../../lib/supabase';
import { 
  Menu, Sparkles, Plus, Bell, PenTool, FileText, Star, Users, 
  CreditCard, CheckCircle, Clock, AlertCircle 
} from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GlassCard } from '../../components/ui/GlassCard';
import { Colors, Fonts } from '../../lib/theme';
import { useRouter } from 'expo-router';

export default function DashboardScreen() {
  const [profile, setProfile] = useState<any>(null);
  const [metrics, setMetrics] = useState({ 
    totalInvoiced: 0, 
    paid: 0, 
    pending: 0, 
    overdue: 0 
  });
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

    // Fetch Invoice Metrics
    try {
      const { data: invoices } = await supabase
        .from('invoices')
        .select('amount, status');

      if (invoices) {
        const stats = invoices.reduce((acc, inv) => {
          const amt = Number(inv.amount) || 0;
          acc.totalInvoiced += amt;
          if (inv.status === 'paid') acc.paid += amt;
          if (inv.status === 'pending') acc.pending += amt;
          if (inv.status === 'overdue') acc.overdue += amt;
          return acc;
        }, { totalInvoiced: 0, paid: 0, pending: 0, overdue: 0 });
        
        setMetrics(stats);
      }
    } catch(e) {
      console.error("Error fetching metrics:", e);
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

        {/* FINANCIAL METRICS GRID */}
        <View style={styles.metricsGrid}>
          {/* Total Invoiced */}
          <MetricCard 
            label="TOTAL INVOICED" 
            value={metrics.totalInvoiced} 
            icon={CreditCard} 
            color="#a78bfa" 
          />
          
          {/* Paid */}
          <MetricCard 
            label="PAID" 
            value={metrics.paid} 
            icon={CheckCircle} 
            color="#10b981" 
          />

          {/* Pending */}
          <MetricCard 
            label="PENDING" 
            value={metrics.pending} 
            icon={Clock} 
            color="#fbbf24" 
          />

          {/* Overdue */}
          <MetricCard 
            label="OVERDUE" 
            value={metrics.overdue} 
            icon={AlertCircle} 
            color="#ef4444" 
          />
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

function MetricCard({ label, value, icon: Icon, color }: any) {
  const formatCurrency = (val: number) => {
    return '₹' + val.toLocaleString('en-IN');
  };

  return (
    <GlassCard style={styles.metricCard} intensity={25}>
      <View style={styles.metricHeader}>
        <View style={[styles.metricIconBox, { backgroundColor: color + '1A' }]}>
          <Icon color={color} size={18} />
        </View>
      </View>
      <View style={styles.metricContent}>
        <Text style={[styles.metricLargeValue, { color }]}>{formatCurrency(value)}</Text>
        <Text style={styles.metricLabel}>{label}</Text>
      </View>
    </GlassCard>
  );
}

function ActionCard({ title, subtitle, icon: Icon, color, onPress }: any) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8} style={styles.actionCardWrapper}>
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
    gap: 8,
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
    width: 40,
    height: 34,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
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
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 10,
  },
  actionCardWrapper: {
    width: '48%',
  },
  actionCard: {
    padding: 16,
    borderRadius: 20,
    minHeight: 120,
    justifyContent: 'center',
  },
  actionIconContainer: {
    width: 42,
    height: 42,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
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
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 24,
  },
  metricCard: {
    width: '48%',
    padding: 16,
    borderRadius: 20,
  },
  metricHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
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
    fontSize: 20,
    color: '#fff',
    marginBottom: 4,
  },
  metricLabel: {
    fontFamily: Fonts.SpaceMono_400Regular,
    fontSize: 10,
    color: Colors.slate500,
    letterSpacing: 1,
  },
});
