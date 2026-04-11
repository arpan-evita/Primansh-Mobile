import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Bell, ChevronRight, LogOut, Shield, User } from 'lucide-react-native';

import { useMobileSession } from '../../context/MobileSessionContext';
import {
  areMobilePushNotificationsEnabled,
  setMobilePushNotificationsEnabled,
} from '../../lib/pushNotifications';
import { supabase } from '../../lib/supabase';
import { Colors, Fonts } from '../../lib/theme';

export default function ProfileScreen() {
  const router = useRouter();
  const { profile, signOut, refreshProfile } = useMobileSession();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notifications, setNotifications] = useState(true);
  const [fullName, setFullName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');

  useEffect(() => {
    setFullName(profile?.full_name || '');
    setAvatarUrl(profile?.avatar_url || '');
  }, [profile?.avatar_url, profile?.full_name]);

  useEffect(() => {
    const bootstrap = async () => {
      const enabled = await areMobilePushNotificationsEnabled().catch(() => false);
      setNotifications(enabled);
      setLoading(false);
    };

    void bootstrap();
  }, []);

  const handleNotificationToggle = async (nextValue: boolean) => {
    setNotifications(nextValue);
    try {
      const enabled = await setMobilePushNotificationsEnabled(nextValue, profile?.id);
      setNotifications(enabled);
    } catch (error) {
      setNotifications((current) => !current);
    }
  };

  const handleSaveProfile = async () => {
    if (!profile?.id) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: fullName.trim() || profile.full_name,
          avatar_url: avatarUrl.trim() || null,
        })
        .eq('id', profile.id);

      if (error) throw error;

      await refreshProfile();
      Alert.alert('Profile Updated', 'Your account details were saved successfully.');
    } catch (error: any) {
      Alert.alert('Save Failed', error.message || 'Your profile could not be updated right now.');
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'You will need to log in again to access your client portal.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: () => {
          void signOut();
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={Colors.accent} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Profile & Settings</Text>
        <Text style={styles.headerSubtitle}>MANAGE YOUR CLIENT PORTAL ACCESS</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{(profile?.full_name || 'U').charAt(0).toUpperCase()}</Text>
          </View>
          <Text style={styles.nameText}>{profile?.full_name || 'Portal User'}</Text>
          <Text style={styles.roleText}>{profile?.normalizedRole?.toUpperCase() || 'CLIENT'} ACCESS</Text>
          <Text style={styles.emailText}>{profile?.email || 'No email available'}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ACCOUNT DETAILS</Text>
          <View style={styles.card}>
            <Text style={styles.fieldLabel}>Full Name</Text>
            <TextInput
              value={fullName}
              onChangeText={setFullName}
              placeholder="Your name"
              placeholderTextColor={Colors.slate600}
              style={styles.input}
            />

            <Text style={styles.fieldLabel}>Avatar URL</Text>
            <TextInput
              value={avatarUrl}
              onChangeText={setAvatarUrl}
              placeholder="https://..."
              placeholderTextColor={Colors.slate600}
              style={styles.input}
              autoCapitalize="none"
            />

            <TouchableOpacity
              style={[styles.primaryButton, saving && styles.primaryButtonDisabled]}
              onPress={() => void handleSaveProfile()}
              disabled={saving}
            >
              {saving ? <ActivityIndicator color="#020617" /> : <Text style={styles.primaryButtonText}>Save Profile</Text>}
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>PREFERENCES</Text>
          <View style={styles.card}>
            <View style={styles.settingRow}>
              <View style={styles.settingLabelWrap}>
                <Bell size={18} color={Colors.slate500} />
                <View>
                  <Text style={styles.settingTitle}>Push Notifications</Text>
                  <Text style={styles.settingSubtitle}>Messages, invoices, meetings, and task updates</Text>
                </View>
              </View>
              <Switch
                value={notifications}
                onValueChange={(value) => void handleNotificationToggle(value)}
                trackColor={{ false: '#1e293b', true: Colors.accent }}
                thumbColor="#fff"
              />
            </View>

            <TouchableOpacity style={styles.linkRow} onPress={() => router.push('/portal/security')}>
              <View style={styles.settingLabelWrap}>
                <Shield size={18} color={Colors.slate500} />
                <View>
                  <Text style={styles.settingTitle}>Security & Password</Text>
                  <Text style={styles.settingSubtitle}>Update password and review session security</Text>
                </View>
              </View>
              <ChevronRight color={Colors.slate500} size={18} />
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
          <LogOut size={20} color="#ef4444" />
          <Text style={styles.signOutText}>Secure Logout</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
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
    fontFamily: Fonts.Outfit_700Bold,
    fontSize: 24,
    color: '#fff',
  },
  headerSubtitle: {
    fontFamily: Fonts.SpaceMono_400Regular,
    fontSize: 10,
    color: Colors.slate500,
    letterSpacing: 1.5,
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
    fontFamily: Fonts.Outfit_700Bold,
    fontSize: 28,
    color: '#fff',
  },
  nameText: {
    fontFamily: Fonts.Outfit_700Bold,
    fontSize: 18,
    color: '#fff',
    marginBottom: 4,
  },
  roleText: {
    fontFamily: Fonts.SpaceMono_700Bold,
    fontSize: 10,
    color: '#64748b',
    letterSpacing: 2,
  },
  emailText: {
    marginTop: 6,
    fontFamily: Fonts.Outfit_400Regular,
    fontSize: 12,
    color: Colors.slate500,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontFamily: Fonts.SpaceMono_700Bold,
    fontSize: 10,
    color: '#475569',
    letterSpacing: 2,
    marginBottom: 16,
    marginLeft: 4,
  },
  card: {
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    padding: 16,
    gap: 12,
  },
  fieldLabel: {
    fontFamily: Fonts.SpaceMono_700Bold,
    fontSize: 10,
    color: Colors.slate500,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  input: {
    minHeight: 48,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 14,
    color: '#fff',
    fontFamily: Fonts.Outfit_500Medium,
    fontSize: 14,
  },
  primaryButton: {
    minHeight: 48,
    borderRadius: 16,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  primaryButtonDisabled: {
    opacity: 0.7,
  },
  primaryButtonText: {
    fontFamily: Fonts.Outfit_700Bold,
    fontSize: 13,
    color: '#020617',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 4,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
  },
  settingLabelWrap: {
    flex: 1,
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  settingTitle: {
    fontFamily: Fonts.Outfit_600SemiBold,
    fontSize: 14,
    color: '#e2e8f0',
  },
  settingSubtitle: {
    marginTop: 3,
    fontFamily: Fonts.Outfit_400Regular,
    fontSize: 12,
    color: Colors.slate500,
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
    fontFamily: Fonts.Outfit_700Bold,
    fontSize: 12,
    color: '#ef4444',
    letterSpacing: 1,
  },
});
