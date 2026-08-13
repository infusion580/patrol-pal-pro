// public/push-handler.js
// -----------------------
// Imported into the Workbox-generated service worker via vite-plugin-pwa's
// `workbox.importScripts` setting (see vite.config.ts). Adds Web Push
// handlers to the same SW that already manages the app-shell cache.
// Kept dependency-free so it works from inside the SW global scope.

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (_e) {
    data = { title: 'Defender', body: event.data ? event.data.text() : '' };
  }
  const title = data.title || 'Defender Seguridad';
  const options = {
    body: data.body || '',
    icon: '/logo-defender.png',
    badge: '/logo-defender.png',
    tag: data.tag || 'defender-notif',
    data: { url: data.url || '/dashboard' },
    // Vibration + timestamp help make the notification feel native.
    // Evidencia fotográfica (foto de ingreso/cierre, rondín, novedad…)
    image: data.image || undefined,
    vibrate: [80, 40, 80],
    timestamp: Date.now(),
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || '/dashboard';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If the app is already open, focus that tab and route it.
      for (const client of clientList) {
        if ('focus' in client) {
          client.focus();
          if ('navigate' in client) client.navigate(target).catch(() => {});
          return;
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(target);
    }),
  );
});
