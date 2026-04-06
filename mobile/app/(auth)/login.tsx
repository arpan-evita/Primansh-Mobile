import React, { useState } from 'react';
import { 
  View, Text, TextInput, StyleSheet, KeyboardAvoidingView, 
  Platform, ActivityIndicator, Alert, TouchableOpacity 
} from 'react-native';
import { supabase } from '../../lib/supabase';
import { useRouter } from 'expo-router';
import { Mail, Lock, Zap, ArrowRight, ShieldCheck } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as WebBrowser from 'expo-web-browser';
import { Colors, Fonts } from '../../lib/theme';

const WEB_PORTAL_URL = 'https://primansh.com/forgot-password';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleLogin() {
    if (!email || !password) {
      Alert.alert('Incomplete Credentials', 'Please provide both identification fields.');
      return;
    }
    
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      Alert.alert('Authentication Failed', error.message || 'Please check your credentials and try again.');
      setLoading(false);
    }
    // Session state is handled by RootLayout listener automatically redirecting
  }

  const handleForgotPassword = async () => {
    await WebBrowser.openBrowserAsync(WEB_PORTAL_URL);
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      {/* Background Decorative Blur Blobs */}
      <View style={StyleSheet.absoluteFill}>
        <LinearGradient
          colors={['rgba(72, 122, 246, 0.15)', 'transparent']}
          style={[styles.blob, { top: -100, left: -60 }]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        />
        <LinearGradient
          colors={['rgba(48, 84, 195, 0.1)', 'transparent']}
          style={[styles.blob, { bottom: -100, right: -60 }]}
          start={{ x: 1, y: 1 }} end={{ x: 0, y: 0 }}
        />
      </View>

      <View style={styles.header}>
        <View style={styles.logoContainer}>
          <View style={styles.logoGlow} />
          <Zap color={Colors.accent} size={32} style={{ zIndex: 10 }} />
        </View>
        <Text style={styles.title}>
          Primansh <Text style={styles.italicText}>Admin</Text>
        </Text>
        <Text style={styles.subtitle}>// SECURE AUTHENTICATION REQUIRED</Text>
      </View>

      <View style={styles.glassContainer}>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>ADMINISTRATIVE EMAIL</Text>
          <View style={styles.inputWrapper}>
             <Mail size={18} color={Colors.slate500} style={styles.inputIcon} />
             <TextInput 
               placeholder="admin@primansh.com"
               placeholderTextColor={Colors.slate600}
               value={email}
               onChangeText={setEmail}
               autoCapitalize="none"
               keyboardType="email-address"
               style={styles.input}
             />
          </View>
        </View>

        <View style={[styles.inputGroup, { marginBottom: 32 }]}>
          <View style={styles.labelRow}>
            <Text style={styles.label}>ACCESS KEY</Text>
            <TouchableOpacity onPress={handleForgotPassword}>
              <Text style={styles.forgotText}>FORGOT KEY?</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.inputWrapper}>
             <Lock size={18} color={Colors.slate500} style={styles.inputIcon} />
             <TextInput 
               placeholder="••••••••"
               placeholderTextColor={Colors.slate600}
               value={password}
               onChangeText={setPassword}
               secureTextEntry
               style={styles.input}
             />
          </View>
        </View>

        <TouchableOpacity 
          style={styles.primaryButton}
          onPress={handleLogin}
          activeOpacity={0.8}
          disabled={loading}
        >
          {loading ? (
             <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <Text style={styles.primaryButtonText}>INITIALIZE SESSION</Text>
              <ArrowRight size={18} color="#fff" style={{ marginLeft: 8 }} />
            </>
          )}
        </TouchableOpacity>

        <View style={styles.dividerContainer}>
          <View style={styles.divider} />
        </View>

        <View style={styles.footerInfo}>
          <ShieldCheck color={Colors.slate600} size={16} style={{ marginRight: 8 }} />
          <Text style={styles.footerInfoText}>END-TO-END ENCRYPTED NODE</Text>
        </View>
        
        <View style={styles.signupRow}>
          <Text style={styles.signupText}>New Operator?</Text>
          <TouchableOpacity onPress={() => WebBrowser.openBrowserAsync('https://primansh.com/signup')}>
             <Text style={styles.signupLink}>Initialize New Access</Text>
          </TouchableOpacity>
        </View>
      </View>

      <Text style={styles.systemVersion}>
        PRIMANSH AGENCY OS v4.2.0 // NODE: SG-ALPHA-01
      </Text>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    padding: 24,
    justifyContent: 'center',
  },
  blob: {
    position: 'absolute',
    width: 380,
    height: 380,
    borderRadius: 190,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
    zIndex: 10,
  },
  logoContainer: {
    width: 80,
    height: 80,
    backgroundColor: Colors.surface,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: Colors.slate900,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
    marginBottom: 24,
  },
  logoGlow: {
    position: 'absolute',
    width: 40,
    height: 40,
    backgroundColor: Colors.accent,
    borderRadius: 20,
    opacity: 0.2,
  },
  title: {
    fontFamily: Fonts.Outfit_700Bold,
    fontSize: 32,
    color: '#fff',
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  italicText: {
    fontFamily: Fonts.SpaceMono_400Regular,
    fontStyle: 'italic',
    fontSize: 24,
    color: Colors.accent,
  },
  subtitle: {
    fontFamily: Fonts.SpaceMono_400Regular,
    fontSize: 11,
    color: Colors.slate500,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  glassContainer: {
    backgroundColor: Colors.glassPremiumBg,
    borderRadius: 40,
    padding: 32,
    borderWidth: 1,
    borderColor: Colors.glassBorderTop,
    borderLeftColor: Colors.glassBorderLeft,
    shadowColor: Colors.slate900,
    shadowOffset: { width: 0, height: 15 },
    shadowOpacity: 0.4,
    shadowRadius: 30,
    elevation: 8,
    zIndex: 10,
  },
  inputGroup: {
    marginBottom: 24,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  label: {
    fontFamily: Fonts.Outfit_700Bold,
    fontSize: 10,
    color: Colors.slate500,
    letterSpacing: 1.5,
  },
  forgotText: {
    fontFamily: Fonts.Outfit_700Bold,
    fontSize: 10,
    color: Colors.slate600,
    letterSpacing: 0.5,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(2, 6, 23, 0.5)', /* slate-950/50 equivalent */
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 16,
    paddingHorizontal: 16,
    height: 56,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontFamily: Fonts.Outfit_400Regular,
    color: '#fff',
    fontSize: 15,
  },
  primaryButton: {
    flexDirection: 'row',
    height: 56,
    backgroundColor: Colors.accent,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 15,
    elevation: 8,
  },
  primaryButtonText: {
    fontFamily: Fonts.Outfit_700Bold,
    color: '#fff',
    fontSize: 13,
    letterSpacing: 1.5,
  },
  dividerContainer: {
    marginVertical: 32,
    alignItems: 'center',
  },
  divider: {
    height: 1,
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  footerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  footerInfoText: {
    fontFamily: Fonts.SpaceMono_400Regular,
    fontSize: 10,
    color: Colors.slate600,
    letterSpacing: 1,
  },
  signupRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  signupText: {
    fontFamily: Fonts.Outfit_500Medium,
    fontSize: 12,
    color: Colors.slate500,
  },
  signupLink: {
    fontFamily: Fonts.Outfit_700Bold,
    fontSize: 12,
    color: Colors.accent,
    marginLeft: 6,
  },
  systemVersion: {
    fontFamily: Fonts.SpaceMono_400Regular,
    textAlign: 'center',
    color: Colors.slate600,
    fontSize: 10,
    letterSpacing: 1,
    marginTop: 40,
  },
});
