import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CheckCircle2, KeyRound, Mail, Shield, TriangleAlert } from 'lucide-react-native';

import { useMobileSession } from '../../../context/MobileSessionContext';
import { supabase } from '../../../lib/supabase';
import { Colors, Fonts } from '../../../lib/theme';
import { GlassCard } from '../../../components/ui/GlassCard';

const WEB_RESET_PASSWORD_URL = 'https://primansh.com/reset-password';

function formatTimestamp(value?: string | null) {
  if (!value) return 'Unavailable';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unavailable';

  return `${date.toLocaleDateString()} at ${date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })}`;
}

export default function SecurityScreen() {
  const { profile, session, refreshProfile } = useMobileSession();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);
  const [sendingReset, setSendingReset] = useState(false);
  const [resendingVerification, setResendingVerification] = useState(false);

  const isEmailVerified = useMemo(
    () => Boolean(session?.user?.email_confirmed_at),
    [session?.user?.email_confirmed_at]
  );

  const sessionExpiry = useMemo(() => {
    if (!session?.expires_at) return 'Unavailable';
    return formatTimestamp(new Date(session.expires_at * 1000).toISOString());
  }, [session?.expires_at]);

  const handlePasswordUpdate = async () => {
    if (!newPassword.trim() || !confirmPassword.trim()) {
      Alert.alert('Missing Password', 'Enter and confirm the new password before saving.');
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert('Passwords Do Not Match', 'Use the same new password in both fields.');
      return;
    }

    if (newPassword.length < 8) {
      Alert.alert('Weak Password', 'Use at least 8 characters for a production account password.');
      return;
    }

    setSavingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;

      setNewPassword('');
      setConfirmPassword('');
      Alert.alert('Password Updated', 'Your password has been changed for this account.');
    } catch (error: any) {
      const message = error?.message || 'The password could not be updated right now.';
      Alert.alert(
        'Update Failed',
        message.toLowerCase().includes('session')
          ? 'Your session expired while updating the password. Please sign in again and retry.'
          : message
      );
    } finally {
      setSavingPassword(false);
    }
  };

  const handleResetEmail = async () => {
    if (!profile?.email) {
      Alert.alert('Email Missing', 'This account does not have a valid email address on file.');
      return;
    }

    setSendingReset(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(profile.email, {
        redirectTo: WEB_RESET_PASSWORD_URL,
      });

      if (error) throw error;
      Alert.alert('Reset Email Sent', 'A secure password reset link has been sent to your inbox.');
    } catch (error: any) {
      Alert.alert('Reset Failed', error?.message || 'We could not send the password reset email.');
    } finally {
      setSendingReset(false);
    }
  };

  const handleResendVerification = async () => {
    if (!profile?.email) {
      Alert.alert('Email Missing', 'This account does not have a valid email address on file.');
      return;
    }

    setResendingVerification(true);
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: profile.email,
      });

      if (error) throw error;
      Alert.alert('Verification Sent', 'A fresh verification email has been sent to your inbox.');
      await refreshProfile().catch(() => null);
    } catch (error: any) {
      Alert.alert('Verification Failed', error?.message || 'We could not resend the verification email.');
    } finally {
      setResendingVerification(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Account Security</Text>
            <Text style={styles.headerSubtitle}>PASSWORDS, EMAIL VERIFICATION, AND SESSION HEALTH</Text>
          </View>

          <GlassCard style={styles.card} intensity={28}>
            <View style={styles.statusHeader}>
              <View style={styles.iconContainer}>
                <Shield color="#85adff" size={22} />
              </View>
              <View style={styles.statusCopy}>
                <Text style={styles.title}>Security Status</Text>
                <Text style={styles.description}>
                  Your portal access is protected by Supabase auth and role-level policies.
                </Text>
              </View>
            </View>

            <View style={styles.statusList}>
              <SecurityRow icon={Mail} label="Login Email" value={profile?.email || 'Unavailable'} tone="neutral" />
              <SecurityRow
                icon={isEmailVerified ? CheckCircle2 : TriangleAlert}
                label="Email Verification"
                value={isEmailVerified ? 'Verified' : 'Verification pending'}
                tone={isEmailVerified ? 'good' : 'warning'}
              />
              <SecurityRow icon={KeyRound} label="Session Expires" value={sessionExpiry} tone="neutral" />
              <SecurityRow
                icon={Shield}
                label="Last Profile Sync"
                value={formatTimestamp(profile?.last_seen_at)}
                tone="neutral"
              />
            </View>

            {!isEmailVerified ? (
              <TouchableOpacity
                activeOpacity={0.9}
                style={[styles.secondaryButton, resendingVerification && styles.buttonDisabled]}
                disabled={resendingVerification}
                onPress={() => void handleResendVerification()}
              >
                {resendingVerification ? (
                  <ActivityIndicator color="#e2e8f0" />
                ) : (
                  <Text style={styles.secondaryButtonText}>Resend Verification Email</Text>
                )}
              </TouchableOpacity>
            ) : null}
          </GlassCard>

          <GlassCard style={styles.card} intensity={28}>
            <Text style={styles.title}>Change Password</Text>
            <Text style={styles.description}>
              Update the password for this device session immediately. New password must be at least 8 characters.
            </Text>

            <Text style={styles.fieldLabel}>New Password</Text>
            <TextInput
              value={newPassword}
              onChangeText={setNewPassword}
              placeholder="Enter a stronger password"
              placeholderTextColor={Colors.slate600}
              style={styles.input}
              secureTextEntry
              autoCapitalize="none"
            />

            <Text style={styles.fieldLabel}>Confirm Password</Text>
            <TextInput
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="Re-enter the password"
              placeholderTextColor={Colors.slate600}
              style={styles.input}
              secureTextEntry
              autoCapitalize="none"
            />

            <TouchableOpacity
              activeOpacity={0.9}
              style={[styles.primaryButton, savingPassword && styles.buttonDisabled]}
              disabled={savingPassword}
              onPress={() => void handlePasswordUpdate()}
            >
              {savingPassword ? (
                <ActivityIndicator color="#020617" />
              ) : (
                <Text style={styles.primaryButtonText}>Update Password</Text>
              )}
            </TouchableOpacity>
          </GlassCard>

          <GlassCard style={styles.card} intensity={24}>
            <Text style={styles.title}>Recovery Options</Text>
            <Text style={styles.description}>
              Send a password reset email if you need to complete recovery outside this active session.
            </Text>

            <TouchableOpacity
              activeOpacity={0.9}
              style={[styles.secondaryButton, sendingReset && styles.buttonDisabled]}
              disabled={sendingReset}
              onPress={() => void handleResetEmail()}
            >
              {sendingReset ? (
                <ActivityIndicator color="#e2e8f0" />
              ) : (
                <Text style={styles.secondaryButtonText}>Send Reset Email</Text>
              )}
            </TouchableOpacity>
          </GlassCard>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function SecurityRow({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: any;
  label: string;
  value: string;
  tone: 'neutral' | 'good' | 'warning';
}) {
  const color = tone === 'good' ? '#34d399' : tone === 'warning' ? '#fbbf24' : '#85adff';
  return (
    <View style={styles.statusRow}>
      <View style={[styles.statusIconWrap, { backgroundColor: `${color}18` }]}>
        <Icon color={color} size={16} />
      </View>
      <View style={styles.statusTextWrap}>
        <Text style={styles.statusLabel}>{label}</Text>
        <Text style={styles.statusValue}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  keyboardView: {
    flex: 1,
  },
  header: {
    gap: 6,
  },
  content: {
    padding: 20,
    paddingBottom: 120,
    gap: 18,
  },
  headerTitle: {
    fontFamily: Fonts.Outfit_700Bold,
    fontSize: 28,
    color: '#fff',
  },
  headerSubtitle: {
    fontFamily: Fonts.SpaceMono_400Regular,
    fontSize: 10,
    color: Colors.slate500,
    letterSpacing: 1.6,
  },
  card: {
    gap: 12,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: 'rgba(133,173,255,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
  },
  statusCopy: {
    flex: 1,
    gap: 6,
  },
  statusList: {
    gap: 12,
  },
  title: {
    fontFamily: Fonts.Outfit_700Bold,
    fontSize: 18,
    color: '#fff',
  },
  description: {
    fontFamily: Fonts.Outfit_400Regular,
    fontSize: 13,
    color: Colors.slate500,
    lineHeight: 20,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 6,
  },
  statusIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusTextWrap: {
    flex: 1,
    gap: 2,
  },
  statusLabel: {
    fontFamily: Fonts.SpaceMono_400Regular,
    fontSize: 10,
    color: Colors.slate500,
    textTransform: 'uppercase',
    letterSpacing: 1.1,
  },
  statusValue: {
    fontFamily: Fonts.Outfit_600SemiBold,
    fontSize: 14,
    color: '#e2e8f0',
  },
  fieldLabel: {
    marginTop: 6,
    fontFamily: Fonts.SpaceMono_400Regular,
    fontSize: 10,
    color: Colors.slate500,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  input: {
    minHeight: 50,
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
    minHeight: 50,
    marginTop: 10,
    borderRadius: 16,
    backgroundColor: '#85adff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    fontFamily: Fonts.Outfit_700Bold,
    fontSize: 14,
    color: '#020617',
  },
  secondaryButton: {
    minHeight: 48,
    marginTop: 4,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    fontFamily: Fonts.Outfit_600SemiBold,
    fontSize: 14,
    color: '#e2e8f0',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
});
