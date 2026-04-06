import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Switch, ActivityIndicator } from 'react-native';
import { supabase } from '../../lib/supabase';
import { SafeAreaView } from 'react-native-safe-area-context';
import { User, LogOut, Shield, Bell, HardDrive, Cpu, Terminal } from 'lucide-react-native';

export default function ProfileScreen() {
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState(true);

  useEffect(() => {
    async function fetchProfile() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
        setProfile(data);
      }
      setLoading(false);
    }
    fetchProfile();
  }, []);

  async function handleSignOut() {
    await supabase.auth.signOut();
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color="#3b82f6" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>OPERATOR PROFILE</Text>
        <Text style={styles.headerSubtitle}>// IDENTITY & SYSTEM CONFIG</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{profile?.full_name?.[0] || 'U'}</Text>
          </View>
          <Text style={styles.nameText}>{profile?.full_name || 'System User'}</Text>
          <Text style={styles.roleText}>{profile?.role?.toUpperCase() || 'OPERATOR'} LEVEL</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>SYSTEM SETTINGS</Text>
          <View style={styles.settingsCard}>
            <View style={styles.settingItem}>
              <View style={styles.settingLabel}>
                <Bell size={18} color="#64748b" />
                <Text style={styles.settingText}>TELEMETRY PUSH</Text>
              </View>
              <Switch 
                value={notifications} 
                onValueChange={setNotifications}
                trackColor={{ false: '#1e293b', true: '#3b82f6' }}
                thumbColor="#fff"
              />
            </View>
            <View style={styles.divider} />
            <TouchableOpacity style={styles.settingItem}>
              <View style={styles.settingLabel}>
                <Shield size={18} color="#64748b" />
                <Text style={styles.settingText}>SECURITY CLEARANCE</Text>
              </View>
              <Text style={styles.settingValue}>ALPHA-01</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>TERMINAL INFO</Text>
          <View style={styles.infoGrid}>
             <InfoCard icon={Cpu} label="PROCESSOR" value="DASH-v4" />
             <InfoCard icon={HardDrive} label="STORAGE" value="LOCAL-NODE" />
          </View>
        </View>

        <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
          <LogOut size={20} color="#ef4444" />
          <Text style={styles.signOutText}>TERMINATE SESSION</Text>
        </TouchableOpacity>

        <View style={styles.footer}>
           <Terminal size={12} color="#475569" />
           <Text style={styles.footerText}>PRIMANSH AGENCY OS // SECURE PROTOCOL 2026</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function InfoCard({ icon: Icon, label, value }: any) {
  return (
    <View style={styles.infoCard}>
      <Icon size={16} color="#3b82f6" />
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
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
  header: {
    padding: 20,
    backgroundColor: 'rgba(7, 11, 20, 0.8)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: '#fff',
    letterSpacing: 2,
  },
  headerSubtitle: {
    fontSize: 8,
    color: '#3b82f6',
    fontWeight: 'bold',
    letterSpacing: 1,
    marginTop: 4,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 100,
  },
  profileCard: {
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
    padding: 32,
    borderRadius: 32,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    marginBottom: 32,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#3b82f6',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 4,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  avatarText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
  },
  nameText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 4,
  },
  roleText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#64748b',
    letterSpacing: 2,
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
  settingsCard: {
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    padding: 8,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  settingLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  settingText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#e2e8f0',
    letterSpacing: 1,
  },
  settingValue: {
    fontSize: 11,
    fontWeight: '900',
    color: '#3b82f6',
    letterSpacing: 0.5,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    marginHorizontal: 16,
  },
  infoGrid: {
    flexDirection: 'row',
    gap: 16,
  },
  infoCard: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    alignItems: 'center',
  },
  infoLabel: {
    fontSize: 8,
    fontWeight: '900',
    color: '#475569',
    letterSpacing: 1,
    marginTop: 8,
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 20,
    borderRadius: 20,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.2)',
    marginTop: 16,
  },
  signOutText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#ef4444',
    letterSpacing: 1,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 48,
    opacity: 0.5,
  },
  footerText: {
    fontSize: 8,
    fontWeight: '700',
    color: '#475569',
    letterSpacing: 0.5,
  },
});
