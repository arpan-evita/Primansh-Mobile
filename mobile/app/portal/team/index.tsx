import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Users, Shield, Clock } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../../../lib/supabase';
import { GlassCard } from '../../../components/ui/GlassCard';
import { Colors, Fonts } from '../../../lib/theme';

export default function TeamHubScreen() {
  const router = useRouter();
  const [team, setTeam] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  async function fetchTeam() {
    setLoading(true);
    // Fetch users with 'team' or 'admin' role
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .in('role', ['team', 'admin', 'seo', 'content', 'developer'])
      .order('created_at', { ascending: false });
    
    if (data) setTeam(data);
    setLoading(false);
  }

  useEffect(() => {
    fetchTeam();
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconButton}>
          <ArrowLeft color="#fff" size={24} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Team Hub</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={fetchTeam} tintColor={Colors.accent} />}
      >
        <Text style={styles.sectionTitle}>ACTIVE OPERATORS</Text>
        
        {team.map((member) => (
          <GlassCard key={member.id} style={styles.memberCard} intensity={15}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{member.full_name?.[0]?.toUpperCase() || 'U'}</Text>
            </View>
            <View style={styles.memberInfo}>
              <Text style={styles.memberName}>{member.full_name || 'Unnamed Operator'}</Text>
              <Text style={styles.memberRole}>{member.role?.toUpperCase() || 'TEAM'}</Text>
            </View>
            <View style={styles.statusBadge}>
              <Text style={styles.statusText}>ONLINE</Text>
            </View>
          </GlassCard>
        ))}

        {team.length === 0 && !loading && (
          <Text style={styles.emptyText}>No team members found.</Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  headerTitle: {
    fontFamily: Fonts.Outfit_700Bold,
    fontSize: 18,
    color: '#fff',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 100,
  },
  sectionTitle: {
    fontFamily: Fonts.SpaceMono_700Bold,
    fontSize: 10,
    color: Colors.slate500,
    letterSpacing: 2,
    marginBottom: 16,
  },
  memberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 20,
    marginBottom: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#3b82f61A',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  avatarText: {
    fontFamily: Fonts.Outfit_700Bold,
    fontSize: 18,
    color: '#3b82f6',
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontFamily: Fonts.Outfit_700Bold,
    fontSize: 16,
    color: '#fff',
    marginBottom: 4,
  },
  memberRole: {
    fontFamily: Fonts.SpaceMono_400Regular,
    fontSize: 10,
    color: Colors.slate500,
    letterSpacing: 1,
  },
  statusBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusText: {
    fontFamily: Fonts.SpaceMono_700Bold,
    fontSize: 9,
    color: '#10b981',
    letterSpacing: 0.5,
  },
  emptyText: {
    fontFamily: Fonts.SpaceMono_400Regular,
    color: Colors.slate500,
    textAlign: 'center',
    marginTop: 40,
  }
});
