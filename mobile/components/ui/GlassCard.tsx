import React from 'react';
import { View, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';

interface GlassCardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  intensity?: number;
  tint?: 'light' | 'dark' | 'default';
  gradient?: boolean;
}

export const GlassCard: React.FC<GlassCardProps> = ({ 
  children, 
  style, 
  intensity = 40, 
  tint = 'dark',
  gradient = true
}) => {
  return (
    <View style={[styles.container, style]}>
      {/* Outer Glow/Border Shadow effect */}
      <View style={styles.borderEffect} />
      
      <BlurView intensity={intensity} tint={tint} style={StyleSheet.absoluteFill} />
      
      {gradient && (
        <LinearGradient
          colors={['rgba(255, 255, 255, 0.08)', 'rgba(255, 255, 255, 0.02)']}
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
      )}
      
      <View style={styles.innerContent}>
        {children}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 28,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    backgroundColor: 'rgba(15, 23, 42, 0.2)', // Base fallback
  },
  borderEffect: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 28,
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    margin: -0.5,
  },
  innerContent: {
    padding: 24,
  },
});
