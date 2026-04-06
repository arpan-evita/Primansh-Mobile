import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, Fonts } from '../../lib/theme';

export default function DocsScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Documents & Drive</Text>
      <Text style={styles.subtitle}>// WORK IN PROGRESS</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontFamily: Fonts.Outfit_700Bold,
    color: '#fff',
    fontSize: 24,
  },
  subtitle: {
    fontFamily: Fonts.SpaceMono_400Regular,
    color: Colors.slate500,
    marginTop: 8,
  }
});
