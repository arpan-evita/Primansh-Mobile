import { Slot, useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { MobileTasksProvider } from '../hooks/useMobileTasks';
import { MobileClientsProvider } from '../hooks/useMobileClients';
import { registerMobilePushNotifications, unregisterMobilePushNotifications } from '../lib/pushNotifications';
import { MobileSessionProvider, useMobileSession } from '../context/MobileSessionContext';
import { supabase } from '../lib/supabase';

import {
  useFonts,
  Outfit_300Light,
  Outfit_400Regular,
  Outfit_500Medium,
  Outfit_600SemiBold,
  Outfit_700Bold,
} from '@expo-google-fonts/outfit';
import {
  SpaceMono_400Regular,
  SpaceMono_700Bold,
} from '@expo-google-fonts/space-mono';

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Outfit_300Light,
    Outfit_400Regular,
    Outfit_500Medium,
    Outfit_600SemiBold,
    Outfit_700Bold,
    SpaceMono_400Regular,
    SpaceMono_700Bold,
  });

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <MobileSessionProvider>
          <AppRuntime fontsLoaded={fontsLoaded} />
        </MobileSessionProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function AppRuntime({ fontsLoaded }: { fontsLoaded: boolean }) {
  const { session, loading: sessionLoading } = useMobileSession();
  const loading = sessionLoading || !fontsLoaded;

  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (!session?.user?.id) return;

    registerMobilePushNotifications(session.user.id).catch((error) => {
      console.warn('[MobilePush] Registration failed:', error);
    });
  }, [session?.user?.id]);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (event === 'SIGNED_OUT') {
        unregisterMobilePushNotifications().catch(() => undefined);
      }

      if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') && nextSession?.user?.id) {
        registerMobilePushNotifications(nextSession.user.id).catch(() => undefined);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (loading) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!session && !inAuthGroup) {
      router.replace('/(auth)/login');
    } else if (session && inAuthGroup) {
      router.replace('/(tabs)');
    }
  }, [session, loading, segments]);

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: '#070b14',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  return (
    <MobileClientsProvider>
      <MobileTasksProvider>
        <Slot />
      </MobileTasksProvider>
    </MobileClientsProvider>
  );
}
