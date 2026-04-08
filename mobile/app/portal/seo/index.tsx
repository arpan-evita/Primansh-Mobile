import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Search } from 'lucide-react-native';
import { Colors, Fonts } from '../../../lib/theme';
import { GlassCard } from '../../../components/ui/GlassCard';

export default function SEOScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>SEO Dashboard</Text>
        <Text style={styles.headerSubtitle}>SEARCH PERFORMANCE & ANALYTICS</Text>
      </View>
      
      <View style={styles.content}>
        <GlassCard style={styles.card} intensity={20}>
          <View style={styles.iconContainer}>
            <Search color="#3b82f6" size={40} />
          </View>
          <Text style={styles.title}>Neural SEO Sync</Text>
          <Text style={styles.description}>
            The SEO performance engine is currently synchronizing with Google Search Console. 
            Real-time keyword tracking will be available shortly.
          </Text>
        </GlassCard>
      </View>
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
  content: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  card: {
    padding: 40,
    alignItems: 'center',
    borderRadius: 32,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontFamily: Fonts.Outfit_700Bold,
    fontSize: 20,
    color: '#fff',
    marginBottom: 12,
  },
  description: {
    fontFamily: Fonts.Outfit_400Regular,
    fontSize: 14,
    color: Colors.slate500,
    textAlign: 'center',
    lineHeight: 22,
  }
});
