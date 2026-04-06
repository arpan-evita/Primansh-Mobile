import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, RefreshControl, ActivityIndicator, Dimensions } from 'react-native';
import { supabase } from '../../lib/supabase';
import { LayoutDashboard, TrendingUp, CheckSquare, Zap, Activity, Clock, ShieldCheck, Star, Video, ArrowUpRight } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GlassCard } from '../../components/ui/GlassCard';
import { GlassButton } from '../../components/ui/GlassButton';
import * as WebBrowser from 'expo-web-browser';

const { width } = Dimensions.get('window');

export default function DashboardScreen() {
  const [profile, setProfile] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [nextMeeting, setNextMeeting] = useState<any>(null);

  async function fetchData() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // 1. Fetch Profile
    const { data: profileData } = await supabase
      .from('profiles')
      .select('*, associated_client_id')
      .eq('id', user.id)
      .single();
    
    setProfile(profileData);

    // 2. Fetch Role-Specific Stats
    if (profileData?.role === 'client') {
       const { data: clientData } = await supabase
         .from('clients')
         .select('*')
         .eq('id', profileData.associated_client_id)
         .single();
       
       setStats({ type: 'client', ...clientData });

       // Fetch next meeting for client
       const { data: meetings } = await supabase
         .from('meetings')
         .select('*')
         .eq('client_id', profileData.associated_client_id)
         .gte('start_time', new Date().toISOString())
         .order('start_time', { ascending: true })
         .limit(1);
       
       if (meetings && meetings.length > 0) {
         setNextMeeting(meetings[0]);
       }
    } else {
       const { data: tasks } = await supabase
         .from('tasks')
         .select('id, status')
         .eq('assigned_to', user.id);
       
       setStats({ 
         type: 'team', 
         tasks: tasks || [],
         totalTasks: tasks?.length || 0,
         doneTasks: tasks?.filter(t => t.status === 'done').length || 0
       });
    }
    setLoading(false);
    setRefreshing(false);
  }

  useEffect(() => {
    fetchData();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const handleJoinMeeting = async () => {
    if (nextMeeting?.room_url) {
      await WebBrowser.openBrowserAsync(nextMeeting.room_url);
    } else {
      // Fallback for demo
      await WebBrowser.openBrowserAsync('https://primansh.com/meeting/demo');
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color="#3b82f6" />
      </View>
    );
  }

  const isClient = profile?.role === 'client';

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3b82f6" />}
      >
        {/* HEADER */}
        <View style={styles.header}>
          <View>
            <View style={styles.statusBadge}>
              <View style={styles.statusDot} />
              <Text style={styles.statusText}>NODE ACTIVE</Text>
            </View>
            <Text style={styles.welcomeText}>Welcome, {profile?.full_name?.split(' ')[0] || 'Operator'}</Text>
          </View>
          <View style={styles.avatar}>
             <Text style={styles.avatarText}>{profile?.full_name?.[0] || 'U'}</Text>
          </View>
        </View>

        {/* PULSE DASHBOARD MAIN CARD (Client Only) */}
        {isClient && (
          <GlassCard style={styles.pulseCard} intensity={50}>
            <View style={styles.pulseHeader}>
              <Text style={styles.pulseTitle}>PULSE STATUS</Text>
              <View style={styles.liveBadge}>
                <Text style={styles.liveText}>LIVE</Text>
              </View>
            </View>
            <View style={styles.pulseValueContainer}>
              <Text style={styles.pulseValue}>{stats?.health_score || 94}%</Text>
              <View style={styles.pulseIndicator}>
                <TrendingUp size={16} color="#10b981" />
                <Text style={styles.pulseIndicatorText}>+2.4%</Text>
              </View>
            </View>
            <Text style={styles.pulseSub}>SYSTEM STABILITY: OPTIMAL</Text>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${stats?.health_score || 94}%` }]} />
            </View>
          </GlassCard>
        )}

        {/* METRICS GRID */}
        <View style={styles.grid}>
          {!isClient ? (
            <>
              <MetricCard 
                label="TOTAL WORKFLOW" 
                value={stats?.totalTasks || 0} 
                sub="ASSIGNED TASKS"
                icon={CheckSquare}
                color="#3b82f6"
              />
              <MetricCard 
                label="ACHIEVEMENT" 
                value={`${stats?.totalTasks ? Math.round((stats.doneTasks / stats.totalTasks) * 100) : 0}%`} 
                sub="COMPLETION RATE"
                icon={Star}
                color="#10b981"
              />
            </>
          ) : (
            <>
              <MetricCard 
                label="PLAN STATUS" 
                value={stats?.plan_type?.toUpperCase() || 'CORE'} 
                sub="ACTIVE NODE"
                icon={Zap}
                color="#a78bfa"
              />
              <MetricCard 
                label="NETWORK IPS" 
                value="2.4k" 
                sub="LIVE TRAFFIC"
                icon={Activity}
                color="#3b82f6"
              />
            </>
          )}
        </View>

        {/* NEXT MEETING SECTION */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>UPCOMING DEPLOYMENT</Text>
          <GlassCard style={styles.meetingCard} intensity={25}>
            <View style={styles.meetingInfo}>
              <View style={styles.meetingIcon}>
                <Video size={20} color="#3b82f6" />
              </View>
              <View>
                <Text style={styles.meetingTitle}>{nextMeeting?.title || 'Strategy Synchronization'}</Text>
                <Text style={styles.meetingTime}>
                  {nextMeeting ? new Date(nextMeeting.start_time).toLocaleString() : 'Scheduled: 2:00 PM EST'}
                </Text>
              </View>
            </View>
            <GlassButton 
              title="JOIN NODE" 
              onPress={handleJoinMeeting}
              icon={<ArrowUpRight size={18} color="#fff" />}
              style={styles.joinButton}
              variant="primary"
            />
          </GlassCard>
        </View>

        {/* INTELLIGENCE FEED */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>INTELLIGENCE FEED</Text>
          <GlassCard style={styles.feedCard} intensity={20}>
             <FeedItem icon={Activity} color="#3b82f6" text="Node authentication successful" time="Just now" />
             <FeedItem icon={Clock} color="#64748b" text="System telemetry synchronized" time="2 mins ago" />
             {isClient && (
               <FeedItem icon={TrendingUp} color="#10b981" text="Health score stabilized at 94%" time="1h ago" />
             )}
          </GlassCard>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

function MetricCard({ label, value, sub, icon: Icon, color }: any) {
  return (
    <GlassCard style={styles.card} intensity={25}>
      <View style={[styles.cardIcon, { backgroundColor: color + '1A' }]}>
        <Icon size={20} color={color} />
      </View>
      <Text style={styles.cardValue}>{value}</Text>
      <Text style={styles.cardLabel}>{label}</Text>
      <Text style={styles.cardSub}>{sub}</Text>
    </GlassCard>
  );
}

function FeedItem({ icon: Icon, color, text, time }: any) {
  return (
    <View style={styles.feedItem}>
      <View style={[styles.feedIcon, { borderColor: color + '33' }]}>
        <Icon size={14} color={color} />
      </View>
      <View style={styles.feedContent}>
        <Text style={styles.feedText}>{text}</Text>
        <Text style={styles.feedTime}>{time}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#070b14',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#070b14',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 100,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 32,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 100,
    marginBottom: 8,
    alignSelf: 'flex-start',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#3b82f6',
    marginRight: 6,
  },
  statusText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#3b82f6',
    letterSpacing: 1,
  },
  welcomeText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    letterSpacing: -0.5,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  pulseCard: {
    marginBottom: 24,
  },
  pulseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  pulseTitle: {
    fontSize: 12,
    fontWeight: '900',
    color: '#64748b',
    letterSpacing: 1,
  },
  liveBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.2)',
  },
  liveText: {
    fontSize: 8,
    fontWeight: 'bold',
    color: '#10b981',
  },
  pulseValueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  pulseValue: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#fff',
    marginRight: 12,
  },
  pulseIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  pulseIndicatorText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#10b981',
    marginLeft: 4,
  },
  pulseSub: {
    fontSize: 10,
    color: '#475569',
    fontWeight: '700',
    marginBottom: 16,
  },
  progressBar: {
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#10b981',
  },
  grid: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 32,
  },
  card: {
    flex: 1,
    padding: 20,
  },
  cardIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  cardLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#64748b',
    letterSpacing: 0.5,
  },
  cardSub: {
    fontSize: 8,
    color: '#475569',
    marginTop: 2,
    fontStyle: 'italic',
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: '900',
    color: '#475569',
    letterSpacing: 2,
    marginBottom: 16,
    marginLeft: 4,
  },
  meetingCard: {
    padding: 16,
  },
  meetingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  meetingIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  meetingTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 2,
  },
  meetingTime: {
    fontSize: 12,
    color: '#64748b',
  },
  joinButton: {
    height: 48,
  },
  feedCard: {
    padding: 8,
  },
  feedItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  feedIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  feedContent: {
    flex: 1,
  },
  feedText: {
    fontSize: 13,
    color: '#e2e8f0',
    fontWeight: '500',
  },
  feedTime: {
    fontSize: 10,
    color: '#475569',
    marginTop: 2,
  },
});
