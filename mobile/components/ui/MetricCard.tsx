import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { GlassCard } from './GlassCard';
import { Fonts, Colors } from '../../lib/theme';

interface MetricCardProps {
  label: string;
  value: string | number;
  icon: any;
  color: string;
  subtitle?: string;
  suffix?: string;
}

export function MetricCard({ label, value, icon: Icon, color, subtitle, suffix }: MetricCardProps) {
  return (
    <GlassCard style={styles.metricCard} intensity={25}>
      <View style={styles.metricHeader}>
        <View style={[styles.metricIconBox, { backgroundColor: color + '1A' }]}>
          <Icon color={color} size={18} />
        </View>
        {subtitle && (
          <Text style={styles.metricSubtitle}>{subtitle}</Text>
        )}
      </View>
      <View style={styles.metricContent}>
        <Text style={[styles.metricValue, { color }]}>
          {value}{suffix}
        </Text>
        <Text style={styles.metricLabel}>{label}</Text>
      </View>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  metricCard: {
    width: '48%',
    padding: 16,
    borderRadius: 20,
  },
  metricHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  metricIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  metricSubtitle: {
    fontFamily: Fonts.SpaceMono_400Regular,
    fontSize: 9,
    color: '#10b981', // Default green for +X this month style
  },
  metricContent: {
    marginTop: 'auto',
  },
  metricValue: {
    fontFamily: Fonts.Outfit_700Bold,
    fontSize: 20,
    marginBottom: 4,
  },
  metricLabel: {
    fontFamily: Fonts.SpaceMono_400Regular,
    fontSize: 9,
    color: Colors.slate500,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
});
