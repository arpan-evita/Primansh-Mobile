import React from 'react';
import { Tabs } from 'expo-router';
import { 
  LayoutDashboard, Users, CheckSquare, MessageSquare, Video, FileText, Settings
} from 'lucide-react-native';
import { BlurView } from 'expo-blur';
import { Platform } from 'react-native';
import { Colors, Fonts } from '../../lib/theme';
import { useMobileSession } from '../../context/MobileSessionContext';

export default function TabLayout() {
  const { profile } = useMobileSession();
  const isClient = profile?.normalizedRole === 'client';

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          position: 'absolute',
          left: 16,
          right: 16,
          bottom: 16,
          height: 72,
          paddingBottom: 10,
          paddingTop: 8,
          borderTopWidth: 0,
          borderTopColor: 'transparent',
          borderRadius: 24,
          backgroundColor: Platform.OS === 'ios' ? 'transparent' : 'rgba(13, 19, 33, 0.92)',
          shadowColor: '#000',
          shadowOpacity: 0.28,
          shadowRadius: 24,
          shadowOffset: { width: 0, height: 14 },
          elevation: 16,
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
          title: isClient ? 'HOME' : 'HOME',
          tabBarIcon: ({ color, size }) => (
            <LayoutDashboard color={color} size={20} />
          ),
        }}
      />
      <Tabs.Screen
        name="clients"
        options={{
          href: isClient ? null : undefined,
          title: isClient ? 'PROJECT' : 'CLIENTS',
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
      <Tabs.Screen
        name="more"
        options={{
          href: isClient ? null : null,
        }}
      />

      {/* Hide deprecated or background tabs automatically from the bottom bar */}
      <Tabs.Screen name="articles" options={{ href: null }} />
      <Tabs.Screen
        name="profile"
        options={{
          href: isClient ? undefined : null,
          title: 'SETTINGS',
          tabBarIcon: ({ color }) => <Settings color={color} size={20} />,
        }}
      />
    </Tabs>
  );
}
