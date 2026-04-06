import { supabase } from '@/integrations/supabase/client';

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || '';

/**
 * Converts a base64url string to a Uint8Array for the pushManager API
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const buffer = new ArrayBuffer(rawData.length);
  const view = new Uint8Array(buffer);
  for (let i = 0; i < rawData.length; i++) {
    view[i] = rawData.charCodeAt(i);
  }
  return view;
}

/**
 * Registers the service worker and subscribes the user to Web Push.
 * Saves the subscription to Supabase so the server can send OS-level call alerts.
 */
export async function registerPushNotifications(profileId: string): Promise<void> {
  try {
    // 1. Check browser support
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      console.log('[Push] Not supported in this browser.');
      return;
    }

    if (!VAPID_PUBLIC_KEY) {
      console.warn('[Push] VITE_VAPID_PUBLIC_KEY is not set. Push notifications disabled.');
      return;
    }

    // 2. Register service worker
    const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    await navigator.serviceWorker.ready;

    // 3. Request notification permission (shows browser prompt)
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.log('[Push] Notification permission denied.');
      return;
    }

    // 4. Check if already subscribed
    const existingSubscription = await registration.pushManager.getSubscription();
    if (existingSubscription) {
      // Ensure it's saved in DB (idempotent upsert)
      await savePushSubscription(profileId, existingSubscription);
      return;
    }

    // 5. Create new subscription
    console.log('[Push] Creating new push subscription with key:', VAPID_PUBLIC_KEY.substring(0, 10) + '...');
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });

    // 6. Save to Supabase
    console.log('[Push] Saving subscription to database...', subscription.endpoint);
    await savePushSubscription(profileId, subscription);

    console.log('[Push] Registered successfully for OS-level alerts.');
  } catch (err) {
    // Don't crash the app if push setup fails
    console.error('[Push] Setup failed CRITICAL:', err);
  }
}

async function savePushSubscription(profileId: string, subscription: PushSubscription): Promise<void> {
  const json = subscription.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return;

  const { error } = await supabase
    .from('push_subscriptions')
    .upsert({
      profile_id: profileId,
      endpoint: json.endpoint,
      p256dh: json.keys.p256dh,
      auth: json.keys.auth,
      user_agent: navigator.userAgent.substring(0, 200),
    }, { onConflict: 'profile_id,endpoint' });

  if (error) console.warn('[Push] Failed to save subscription:', error.message);
}

/**
 * Unregisters push notifications (call on logout)
 */
export async function unregisterPushNotifications(profileId: string): Promise<void> {
  try {
    const registration = await navigator.serviceWorker.getRegistration('/sw.js');
    if (!registration) return;

    const subscription = await registration.pushManager.getSubscription();
    if (subscription) {
      // Remove from DB
      await supabase
        .from('push_subscriptions')
        .delete()
        .eq('profile_id', profileId)
        .eq('endpoint', subscription.endpoint);

      await subscription.unsubscribe();
    }
  } catch (err) {
    console.warn('[Push] Unsubscribe failed:', err);
  }
}
