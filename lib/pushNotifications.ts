import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { supabase } from './supabase';

const EXPO_PUSH_TOKEN_KEY = 'primansh_mobile_expo_push_token_v1';
const EXPO_PUSH_PROFILE_KEY = 'primansh_mobile_expo_push_profile_v1';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

function getExpoProjectId() {
  const constants = Constants as typeof Constants & {
    expoConfig?: { extra?: { eas?: { projectId?: string } } };
    easConfig?: { projectId?: string };
  };

  return (
    constants.expoConfig?.extra?.eas?.projectId ||
    constants.easConfig?.projectId ||
    undefined
  );
}

async function ensureAndroidNotificationChannel() {
  if (Platform.OS !== 'android') return;

  await Notifications.setNotificationChannelAsync('default', {
    name: 'default',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#3b82f6',
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  });
}

async function getPermissionStatus() {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted || current.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL) {
    return current;
  }

  return Notifications.requestPermissionsAsync({
    ios: {
      allowAlert: true,
      allowBadge: false,
      allowSound: true,
    },
  });
}

function getDeviceInfo() {
  return {
    platform: Platform.OS,
    platformVersion: Platform.Version,
    appOwnership: Constants.appOwnership || null,
    executionEnvironment: Constants.executionEnvironment || null,
    deviceName: Constants.deviceName || null,
    appVersion: Constants.expoConfig?.version || null,
  };
}

export async function registerMobilePushNotifications(profileId: string) {
  if (!profileId) return null;

  await ensureAndroidNotificationChannel();

  const permission = await getPermissionStatus();
  const permissionGranted =
    permission.granted ||
    permission.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;

  if (!permissionGranted) {
    return null;
  }

  const projectId = getExpoProjectId();
  const tokenResponse = projectId
    ? await Notifications.getExpoPushTokenAsync({ projectId })
    : await Notifications.getExpoPushTokenAsync();

  const token = tokenResponse.data;
  if (!token) return null;

  const stored = await AsyncStorage.multiGet([EXPO_PUSH_TOKEN_KEY, EXPO_PUSH_PROFILE_KEY]);
  const previousToken = stored[0]?.[1] || null;
  const previousProfileId = stored[1]?.[1] || null;

  if (previousToken && previousToken !== token && previousProfileId === profileId) {
    const { error: cleanupError } = await supabase
      .from('expo_push_tokens')
      .delete()
      .eq('profile_id', profileId)
      .eq('token', previousToken);

    if (cleanupError) {
      console.warn('[MobilePush] Old token cleanup failed:', cleanupError.message);
    }
  }

  const { error } = await supabase.from('expo_push_tokens').upsert(
    {
      profile_id: profileId,
      token,
      device_info: getDeviceInfo(),
    },
    { onConflict: 'token' }
  );

  if (error) {
    throw error;
  }

  await AsyncStorage.multiSet([
    [EXPO_PUSH_TOKEN_KEY, token],
    [EXPO_PUSH_PROFILE_KEY, profileId],
  ]);

  return token;
}

export async function unregisterMobilePushNotifications(profileId?: string | null) {
  const stored = await AsyncStorage.multiGet([EXPO_PUSH_TOKEN_KEY, EXPO_PUSH_PROFILE_KEY]);
  const token = stored[0]?.[1] || null;
  const storedProfileId = stored[1]?.[1] || null;
  const targetProfileId = profileId || storedProfileId;

  if (token && targetProfileId) {
    const { error } = await supabase
      .from('expo_push_tokens')
      .delete()
      .eq('profile_id', targetProfileId)
      .eq('token', token);

    if (error) {
      console.warn('[MobilePush] Token removal failed:', error.message);
    }
  }

  await AsyncStorage.multiRemove([EXPO_PUSH_TOKEN_KEY, EXPO_PUSH_PROFILE_KEY]);
}

export async function areMobilePushNotificationsEnabled() {
  const [permission, token] = await Promise.all([
    Notifications.getPermissionsAsync(),
    AsyncStorage.getItem(EXPO_PUSH_TOKEN_KEY),
  ]);

  const permissionGranted =
    permission.granted ||
    permission.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;

  return permissionGranted && Boolean(token);
}

export async function setMobilePushNotificationsEnabled(
  enabled: boolean,
  profileId?: string | null
) {
  if (enabled && profileId) {
    const token = await registerMobilePushNotifications(profileId);
    return Boolean(token);
  }

  await unregisterMobilePushNotifications(profileId);
  return false;
}
