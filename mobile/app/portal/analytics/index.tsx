import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BarChart3, CheckCircle2, FileText, TrendingUp, Users } from 'lucide-react-native';
import { Colors, Fonts } from '../../../lib/theme';
import { GlassCard } from '../../../components/ui/GlassCard';
import { useMobileSession } from '../../../context/MobileSessionContext';
import { useClientPortalData } from '../../../hooks/useClientPortalData';

export default function AnalyticsScreen() {
  const { profile } = useMobileSession();
  const { detail, refreshing, refresh, summary } = useClientPortalData();

  const monthlySnapshot = useMemo(() => {
    const analytics = detail?.siteAnalytics || [];
    const leads = detail?.leads || [];
    const keywords = detail?.keywords || [];

    return {
      traffic: analytics.length,
      leads: leads.length,
      top10Keywords: keywords.filter((item: any) => Number(item.current_pos || 999) <= 10).length,
      completedTasks: (detail?.tasks || []).filter((item: any) => item.status === 'done').length,
    };
  }, [detail?.keywords, detail?.leads, detail?.siteAnalytics, detail?.tasks]);

  if (profile?.normalizedRole !== 'client') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Analytics</Text>
          <Text style={styles.headerSubtitle}>AGENCY BI & DATA INSIGHTS</Text>
        </View>
        
        <View style={styles.content}>
          <GlassCard style={styles.card} intensity={20}>
            <View style={styles.iconContainer}>
              <BarChart3 color="#10b981" size={40} />
            </View>
            <Text style={styles.title}>Admin analytics stay on the main dashboard</Text>
            <Text style={styles.description}>
              This mobile analytics route now focuses on the client portal reporting experience.
            </Text>
          </GlassCard>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={Colors.accent} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Reports & Performance</Text>
          <Text style={styles.headerSubtitle}>SIMPLE CLIENT-FRIENDLY MONTHLY SNAPSHOT</Text>
        </View>

        <View style={styles.statsGrid}>
          <StatsCard icon={BarChart3} label="Traffic Events" value={String(monthlySnapshot.traffic)} accent="#85adff" />
          <StatsCard icon={Users} label="Leads Captured" value={String(monthlySnapshot.leads)} accent="#10b981" />
          <StatsCard icon={TrendingUp} label="Top 10 Keywords" value={String(monthlySnapshot.top10Keywords)} accent="#9093ff" />
          <StatsCard icon={CheckCircle2} label="Tasks Completed" value={String(monthlySnapshot.completedTasks)} accent="#f59e0b" />
        </View>

        <GlassCard style={styles.sectionCard} intensity={22}>
          <Text style={styles.sectionTitle}>What this means</Text>
          <Text style={styles.description}>
            {summary.last30DayViews > 0
              ? `Your synced portal currently shows ${summary.last30DayViews} website activity events, ${monthlySnapshot.leads} tracked leads, and ${monthlySnapshot.top10Keywords} keywords ranking in the top 10.`
              : 'Website analytics will appear here as soon as your site tracker and reporting feeds sync data into the portal.'}
          </Text>
        </GlassCard>

        <GlassCard style={styles.sectionCard} intensity={18}>
          <Text style={styles.sectionTitle}>Latest report notes</Text>
          {(detail?.updates || []).slice(0, 5).map((item) => (
            <View key={item.id} style={styles.updateRow}>
              <View style={styles.updateIcon}>
                <FileText color="#85adff" size={14} />
              </View>
              <View style={styles.updateCopy}>
                <Text style={styles.updateTitle}>{item.title}</Text>
                <Text style={styles.updateSubtitle}>{item.description || item.type}</Text>
              </View>
            </View>
          ))}
          {(detail?.updates || []).length === 0 ? (
            <Text style={styles.description}>Fresh monthly reports and performance notes will appear here automatically.</Text>
          ) : null}
        </GlassCard>
      </ScrollView>
    </SafeAreaView>
  );
}

function StatsCard({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: any;
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <GlassCard style={styles.statsCard} intensity={20}>
      <View style={[styles.statsIconWrap, { backgroundColor: `${accent}18` }]}>
        <Icon color={accent} size={18} />
      </View>
      <Text style={styles.statsLabel}>{label}</Text>
      <Text style={styles.statsValue}>{value}</Text>
    </GlassCard>
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
  scrollContent: {
    padding: 20,
    paddingBottom: 120,
    gap: 16,
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
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
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
    lineHeight: 22,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statsCard: {
    width: '48.2%',
    minHeight: 120,
  },
  statsIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  statsLabel: {
    fontFamily: Fonts.SpaceMono_400Regular,
    fontSize: 10,
    color: Colors.slate500,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  statsValue: {
    marginTop: 6,
    fontFamily: Fonts.Outfit_700Bold,
    fontSize: 22,
    color: '#fff',
  },
  sectionCard: {
    gap: 12,
  },
  sectionTitle: {
    fontFamily: Fonts.Outfit_700Bold,
    fontSize: 18,
    color: '#fff',
  },
  updateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  updateIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(133,173,255,0.08)',
  },
  updateCopy: {
    flex: 1,
    gap: 3,
  },
  updateTitle: {
    fontFamily: Fonts.Outfit_600SemiBold,
    fontSize: 14,
    color: '#fff',
  },
  updateSubtitle: {
    fontFamily: Fonts.Outfit_400Regular,
    fontSize: 12,
    color: Colors.slate500,
  },
});
