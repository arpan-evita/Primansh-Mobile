import React from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { 
  BarChart3, Users, CreditCard, Star, FileText, 
  Search, Shield, ClipboardList, LogOut, ChevronRight,
  Zap, Database, Mail, Video
} from 'lucide-react-native';
import { GlassCard } from '../../components/ui/GlassCard';
import { Colors, Fonts } from '../../lib/theme';
import { supabase } from '../../lib/supabase';
import { unregisterMobilePushNotifications } from '../../lib/pushNotifications';

export default function MoreScreen() {
  const router = useRouter();

  const menuSections = [
    {
      title: 'BUSINESS & GROWTH',
      items: [
        { title: 'Leads & CRM', icon: Zap, color: '#f97316', route: '/portal/leads' },
        { title: 'SEO Dashboard', icon: Search, color: '#3b82f6', route: '/portal/seo' },
        { title: 'Article Master', icon: FileText, color: '#a78bfa', route: '/portal/articles' },
        { title: 'Testimonials', icon: Star, color: '#fbbf24', route: '/portal/testimonials' },
        { title: 'Analytics', icon: BarChart3, color: '#10b981', route: '/portal/analytics' },
      ]
    },
    {
      title: 'OPERATIONS',
      items: [
        { title: 'Billing & Invoices', icon: CreditCard, color: '#ef4444', route: '/portal/billing' },
        { title: 'Team Hub', icon: Users, color: '#3b82f6', route: '/portal/team' },
        { title: 'Case Studies', icon: Database, color: '#6366f1', route: '/portal/cases' },
      ]
    },
    {
      title: 'ACCOUNT',
      items: [
        { title: 'Security', icon: Shield, color: '#64748b', route: '/portal/security' },
        { title: 'Sign Out', icon: LogOut, color: '#ef4444', action: async () => {
          const { data: { user } } = await supabase.auth.getUser();
          if (user?.id) {
            await unregisterMobilePushNotifications(user.id).catch(() => undefined);
          }
          await supabase.auth.signOut();
          router.replace('/(auth)/login');
        }},
      ]
    }
  ];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>More</Text>
        <Text style={styles.headerSubtitle}>AGENCY MANAGEMENT SUITE</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {menuSections.map((section, idx) => (
          <View key={idx} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <View style={styles.sectionItems}>
              {section.items.map((item, itemIdx) => (
                <TouchableOpacity 
                  key={itemIdx} 
                  onPress={() => item.action ? item.action() : router.push(item.route)}
                  activeOpacity={0.7}
                >
                  <GlassCard style={styles.menuItem} intensity={10}>
                    <View style={styles.menuItemLeft}>
                      <View style={[styles.iconBox, { backgroundColor: item.color + '1A' }]}>
                        <item.icon color={item.color} size={20} />
                      </View>
                      <Text style={styles.menuItemText}>{item.title}</Text>
                    </View>
                    <ChevronRight color={Colors.slate500} size={18} />
                  </GlassCard>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}

        <View style={styles.footer}>
          <Text style={styles.versionText}>Primansh Mobile v1.0.4</Text>
          <Text style={styles.copyrightText}>© 2026 Primansh Agency</Text>
        </View>
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
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
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
    letterSpacing: 2,
    marginTop: 4,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 120,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontFamily: Fonts.SpaceMono_700Bold,
    fontSize: 10,
    color: Colors.slate500,
    letterSpacing: 1.5,
    marginBottom: 16,
    marginLeft: 4,
  },
  sectionItems: {
    gap: 12,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 18,
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  menuItemText: {
    fontFamily: Fonts.Outfit_600SemiBold,
    fontSize: 15,
    color: '#fff',
  },
  footer: {
    alignItems: 'center',
    marginTop: 20,
    paddingBottom: 40,
  },
  versionText: {
    fontFamily: Fonts.SpaceMono_400Regular,
    fontSize: 10,
    color: Colors.slate500,
  },
  copyrightText: {
    fontFamily: Fonts.SpaceMono_400Regular,
    fontSize: 8,
    color: 'rgba(255,255,255,0.1)',
    marginTop: 4,
  }
});
