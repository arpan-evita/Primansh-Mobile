import React, { useEffect, useState } from 'react';
import { Tabs } from 'expo-router';
import { LayoutDashboard, MessageSquare, CheckSquare, Settings, FileText } from 'lucide-react-native';
import { BlurView } from 'expo-blur';
import { Platform } from 'react-native';
import { supabase } from '../../lib/supabase';

export default function TabLayout() {
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    async function getRole() {
      const { data: { user } } = await supabase.auth.getUser();
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
          backgroundColor: Platform.OS === 'ios' ? 'transparent' : '#070b14',
          borderTopColor: 'rgba(255, 255, 255, 0.05)',
          height: 64,
          paddingBottom: 8,
        },
        tabBarActiveTintColor: '#3b82f6',
        tabBarInactiveTintColor: '#475569',
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '700',
          textTransform: 'uppercase',
          letterSpacing: 1,
        },
        tabBarBackground: () => (
          Platform.OS === 'ios' ? (
            <BlurView intensity={80} tint="dark" style={{ flex: 1 }} />
          ) : null
        ),
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color, size }) => <LayoutDashboard color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: 'Signals',
          tabBarIcon: ({ color, size }) => <MessageSquare color={color} size={size} />,
        }}
      />
      {role !== 'client' && (
        <Tabs.Screen
          name="articles"
          options={{
            title: 'Articles',
            tabBarIcon: ({ color, size }) => <FileText color={color} size={size} />,
          }}
        />
      )}
      <Tabs.Screen
        name="tasks"
        options={{
          title: 'Workflow',
          tabBarIcon: ({ color, size }) => <CheckSquare color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Operator',
          tabBarIcon: ({ color, size }) => <Settings color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}
