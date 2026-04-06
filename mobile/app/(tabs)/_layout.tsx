import React, { useEffect, useState } from 'react';
import { Tabs } from 'expo-router';
import { 
  LayoutDashboard, Users, CheckSquare, MessageSquare, Video, FileText 
} from 'lucide-react-native';
import { BlurView } from 'expo-blur';
import { Platform, View, StyleSheet } from 'react-native';
import { supabase } from '../../lib/supabase';
import { Colors, Fonts } from '../../lib/theme';

export default function TabLayout() {
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    async function getRole() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single();
        setRole(profile?.role || null);
      }
    }
    getRole();
  }, []);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          position: 'absolute',
          backgroundColor: Platform.OS === 'ios' ? 'transparent' : 'rgba(2, 6, 23, 0.95)',
          borderTopColor: 'rgba(255, 255, 255, 0.05)',
          height: 64,
          paddingBottom: 8,
          borderTopWidth: 1,
        },
        tabBarActiveTintColor: Colors.accent,
        tabBarInactiveTintColor: Colors.slate500,
        tabBarLabelStyle: {
          fontFamily: Fonts.Outfit_700Bold,
          fontSize: 9,
          textTransform: 'uppercase',
          letterSpacing: 0.5,
        },
        tabBarBackground: () =>
          Platform.OS === 'ios' ? (
            <BlurView intensity={80} tint="dark" style={{ flex: 1 }} />
          ) : null,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'HOME',
          tabBarIcon: ({ color, size }) => (
            <LayoutDashboard color={color} size={20} />
          ),
        }}
      />
      <Tabs.Screen
        name="clients"
        options={{
          title: 'CLIENTS',
          tabBarIcon: ({ color, size }) => (
             <Users color={color} size={20} />
          ),
        }}
      />
      <Tabs.Screen
        name="tasks"
        options={{
          title: 'TASKS',
          tabBarIcon: ({ color, size }) => (
            <CheckSquare color={color} size={20} />
          ),
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: 'CHAT',
          tabBarIcon: ({ color, size }) => (
            <MessageSquare color={color} size={20} />
          ),
        }}
      />
      <Tabs.Screen
        name="meetings"
        options={{
          title: 'MEETINGS',
          tabBarIcon: ({ color, size }) => (
            <Video color={color} size={20} />
          ),
        }}
      />
      <Tabs.Screen
        name="docs"
        options={{
          title: 'DOCS',
          tabBarIcon: ({ color, size }) => (
            <FileText color={color} size={20} />
          ),
        }}
      />

      {/* Hide deprecated or background tabs automatically from the bottom bar */}
      <Tabs.Screen name="articles" options={{ href: null }} />
      <Tabs.Screen name="profile" options={{ href: null }} />
    </Tabs>
  );
}
