import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ViewStyle, TextStyle, View, StyleProp } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';

interface GlassButtonProps {
  onPress: () => void;
  title: string;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  icon?: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'outline' | 'glass';
}

export const GlassButton: React.FC<GlassButtonProps> = ({ 
  onPress, 
  title, 
  style, 
  textStyle, 
  icon,
  variant = 'primary' 
}) => {
  const isOutline = variant === 'outline';
  const isGlass = variant === 'glass' || variant === 'secondary';

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7} style={[styles.button, style, isOutline && styles.outline]}>
      {(isGlass || variant === 'primary') && (
        <BlurView intensity={variant === 'primary' ? 20 : 40} tint="dark" style={StyleSheet.absoluteFill} />
      )}
      
      <LinearGradient
        colors={
          variant === 'primary' 
            ? ['rgba(59, 130, 246, 0.6)', 'rgba(37, 99, 235, 0.3)'] 
            : isOutline 
              ? ['transparent', 'transparent']
              : ['rgba(255, 255, 255, 0.1)', 'rgba(255, 255, 255, 0.03)']
        }
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      
      <View style={styles.content}>
        {icon && <View style={styles.iconContainer}>{icon}</View>}
        <Text style={[styles.text, textStyle, isOutline && styles.outlineText]}>{title}</Text>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    borderRadius: 20,
    overflow: 'hidden',
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  outline: {
    backgroundColor: 'transparent',
    borderColor: 'rgba(59, 130, 246, 0.5)',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  iconContainer: {
    marginRight: 10,
  },
  text: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  outlineText: {
    color: '#3b82f6',
  },
});
