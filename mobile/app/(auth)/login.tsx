import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator, Alert } from 'react-native';
import { supabase } from '../../lib/supabase';
import { useRouter } from 'expo-router';
import { Mail, Lock, Zap, ShieldAlert, ExternalLink } from 'lucide-react-native';
import { GlassCard } from '../../components/ui/GlassCard';
import { GlassButton } from '../../components/ui/GlassButton';
import * as WebBrowser from 'expo-web-browser';

const WEB_PORTAL_URL = 'https://primansh.com/forgot-password'; // Base fallback

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleLogin() {
    if (!email || !password) {
      Alert.alert('Incomplete Session', 'Please provide both identification fields to initialize.');
      return;
    }
    
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      Alert.alert('Access Denied', error.message);
      setLoading(false);
    }
    // Session state is handled by RootLayout listener
  }

  const handleForgotPassword = async () => {
    await WebBrowser.openBrowserAsync(WEB_PORTAL_URL);
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <View style={styles.background}>
         <View style={[styles.blob, { top: -80, left: -40, backgroundColor: 'rgba(59, 130, 246, 0.2)' }]} />
         <View style={[styles.blob, { bottom: -120, right: -40, backgroundColor: 'rgba(99, 102, 241, 0.15)' }]} />
      </View>

      <View style={styles.header}>
        <View style={styles.logoContainer}>
          <Zap color="#3b82f6" size={32} />
        </View>
        <Text style={styles.title}>PRIMANSH <Text style={styles.italicText}>HUB</Text></Text>
        <Text style={styles.subtitle}>// SECURE TERMINAL v4.2.0</Text>
      </View>

      <GlassCard style={styles.formCard} intensity={40}>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>IDENTIFICATION (EMAIL)</Text>
          <View style={styles.inputWrapper}>
             <Mail size={18} color="#64748b" style={styles.inputIcon} />
             <TextInput 
               placeholder="admin@primansh.com"
               placeholderTextColor="#475569"
               value={email}
               onChangeText={setEmail}
               autoCapitalize="none"
               keyboardType="email-address"
               style={styles.input}
             />
          </View>
        </View>

        <View style={[styles.inputGroup, { marginBottom: 12 }]}>
          <Text style={styles.label}>ACCESS KEY (PASSWORD)</Text>
          <View style={styles.inputWrapper}>
             <Lock size={18} color="#64748b" style={styles.inputIcon} />
             <TextInput 
               placeholder="••••••••"
               placeholderTextColor="#475569"
               value={password}
               onChangeText={setPassword}
               secureTextEntry
               style={styles.input}
             />
          </View>
        </View>

        <View style={styles.forgotContainer}>
          <Text style={styles.forgotText} onPress={handleForgotPassword}>
            Recover Access Key <ExternalLink size={10} color="#64748b" style={{ marginLeft: 4 }} />
          </Text>
        </View>

        <GlassButton 
          title={loading ? "INITIALIZING..." : "SYNCHRONIZE SESSION"} 
          onPress={handleLogin}
          variant="primary"
          style={styles.loginButton}
          icon={!loading ? <ShieldAlert size={18} color="#fff" /> : <ActivityIndicator color="#fff" size="small" />}
        />
      </GlassCard>

      <Text style={styles.footer}>AUTHORIZED PERSONNEL ONLY // DATA ENCRYPTED</Text>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#070b14',
    padding: 24,
    justifyContent: 'center',
  },
  background: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  blob: {
    position: 'absolute',
    width: 320,
    height: 320,
    borderRadius: 160,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logoContainer: {
    width: 64,
    height: 64,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.2)',
    marginBottom: 20,
  },
  title: {
    fontSize: 26,
    fontWeight: '900',
    color: '#fff',
    letterSpacing: 2,
  },
  italicText: {
    fontStyle: 'italic',
    fontWeight: '300',
    color: '#3b82f6',
  },
  subtitle: {
    fontSize: 10,
    fontWeight: '900',
    color: '#334155',
    letterSpacing: 3,
    marginTop: 8,
  },
  formCard: {
    padding: 24,
    borderRadius: 32,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 9,
    fontWeight: '900',
    color: '#475569',
    letterSpacing: 1.5,
    marginBottom: 10,
    marginLeft: 2,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(2, 6, 23, 0.5)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 16,
    paddingHorizontal: 16,
    height: 54,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    color: '#fff',
    fontSize: 15,
  },
  forgotContainer: {
    alignItems: 'flex-end',
    marginBottom: 24,
  },
  forgotText: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  loginButton: {
    marginTop: 8,
  },
  footer: {
    textAlign: 'center',
    color: '#1e293b',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 2,
    marginTop: 40,
  },
});
