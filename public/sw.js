// Service Worker for Primansh Agency OS
// Handles background Web Push notifications for incoming calls

const CACHE_NAME = 'primansh-v1';

// ─── PUSH EVENT ─────────────────────────────────────────────────────────────
// Fired when the server sends a push notification (even when the app is closed)
self.addEventListener('push', (event) => {
  if (!event.data) return;

  let data = {};
  try {
    data = event.data.json();
  } catch (e) {
    data = { title: 'Incoming Call', body: event.data.text() };
  }

  const {
    title = 'Incoming Call',
    body = 'Someone is calling you',
    meetingId = '',
    isAudioOnly = false,
    callerName = 'Unknown',
    icon = '/favicon.ico',
    badge = '/favicon.ico',
  } = data;

  const callType = isAudioOnly ? 'Voice Call' : 'Video Call';

  const notificationOptions = {
    body: `${callerName} is calling you · ${callType}`,
    icon,
    badge,
    tag: `call-${meetingId}`, // Prevents duplicate notifications for the same call
    renotify: true,
    requireInteraction: true, // Keep notification on screen until user acts
    vibrate: [200, 100, 200, 100, 200], // WhatsApp-like vibration pattern
    data: { meetingId, isAudioOnly, url: `/meeting/${meetingId}?audioOnly=${isAudioOnly}` },
    actions: [
      {
        action: 'decline',
        title: '❌ Decline',
      },
      {
        action: 'answer',
        title: isAudioOnly ? '📞 Answer' : '📹 Answer',
      },
    ],
  };

  event.waitUntil(
    self.registration.showNotification(title, notificationOptions)
  );
});

// ─── NOTIFICATION CLICK ──────────────────────────────────────────────────────
// Handles user tapping action buttons or the notification body
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const { action } = event;
  const { url, meetingId } = event.notification.data || {};

  if (action === 'decline') {
    // Just close — no navigation
    return;
  }

  // action === 'answer' OR they clicked the notification body
  const targetUrl = url || `/meeting/${meetingId}`;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // If the app is already open in a tab, focus it and navigate
      for (const client of windowClients) {
        if ('focus' in client) {
          client.focus();
          client.navigate(targetUrl);
          return;
        }
      }
      // Otherwise, open a new window
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});

// ─── FETCH ───────────────────────────────────────────────────────────────────
// Basic pass-through fetch handler (no caching for now)
self.addEventListener('fetch', (event) => {
  // Let the browser handle all requests normally
});

// ─── INSTALL / ACTIVATE ──────────────────────────────────────────────────────
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});
