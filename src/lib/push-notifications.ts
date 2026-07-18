/**
 * push-notifications
 * ------------------
 * Client-side Web Push helper. Handles the full subscribe/unsubscribe
 * lifecycle:
 *   1. Requests Notification permission from the user.
 *   2. Obtains the active service worker registration (the same one
 *      vite-plugin-pwa registers — see push-handler.js, imported into it).
 *   3. Fetches the VAPID public key from the edge function.
 *   4. Calls PushManager.subscribe() and stores the subscription in
 *      public.push_subscriptions, so the send-push edge function can
 *      target the user later.
 *
 * Idempotent: calling `enablePush()` twice on the same device is safe;
 * we upsert on `endpoint` (unique).
 */
import { supabase } from '@/integrations/supabase/client';

function urlBase64ToUint8Array(base64: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const normalized = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(normalized);
  const buf = new ArrayBuffer(raw.length);
  const view = new Uint8Array(buf);
  for (let i = 0; i < raw.length; i++) view[i] = raw.charCodeAt(i);
  return buf;
}

export function isPushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

async function getServiceWorkerRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null;
  // ready resolves once the app's SW is active (registered by vite-plugin-pwa).
  return await navigator.serviceWorker.ready;
}

async function fetchVapidPublicKey(): Promise<string | null> {
  const { data, error } = await supabase.functions.invoke('get-vapid-public-key', { method: 'GET' });
  if (error || !data?.publicKey) return null;
  return data.publicKey as string;
}

/** Returns true if a push subscription is currently active on this device. */
export async function isPushEnabled(): Promise<boolean> {
  if (!isPushSupported()) return false;
  const reg = await getServiceWorkerRegistration();
  const sub = await reg?.pushManager.getSubscription();
  return !!sub;
}

/** Enable push notifications on this device for the signed-in user. */
export async function enablePush(): Promise<{ ok: boolean; reason?: string }> {
  if (!isPushSupported()) return { ok: false, reason: 'Este navegador no soporta notificaciones push.' };

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return { ok: false, reason: 'Permiso de notificaciones no concedido.' };

  const reg = await getServiceWorkerRegistration();
  if (!reg) return { ok: false, reason: 'Service worker no disponible. Instala la app primero.' };

  const publicKey = await fetchVapidPublicKey();
  if (!publicKey) return { ok: false, reason: 'El servidor aún no tiene configuradas las llaves VAPID.' };

  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });
  }

  const raw = sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
  if (!raw.endpoint || !raw.keys?.p256dh || !raw.keys?.auth) {
    return { ok: false, reason: 'La suscripción del navegador es inválida.' };
  }

  const { data: session } = await supabase.auth.getUser();
  if (!session.user) return { ok: false, reason: 'Sesión no encontrada.' };

  const { error } = await supabase
    .from('push_subscriptions')
    .upsert(
      {
        user_id: session.user.id,
        endpoint: raw.endpoint,
        p256dh: raw.keys.p256dh,
        auth: raw.keys.auth,
        user_agent: navigator.userAgent.slice(0, 500),
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: 'endpoint' },
    );

  if (error) return { ok: false, reason: error.message };
  return { ok: true };
}

/** Disable push notifications on this device. */
export async function disablePush(): Promise<void> {
  if (!isPushSupported()) return;
  const reg = await getServiceWorkerRegistration();
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return;
  const endpoint = sub.endpoint;
  await sub.unsubscribe();
  await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint);
}

/**
 * Fire a push to a set of users. Fire-and-forget — errors are logged
 * but never rethrown so notification creation stays resilient.
 */
export async function sendPushTo(userIds: string[], title: string, body: string, url?: string) {
  if (!userIds.length) return;
  try {
    await supabase.functions.invoke('send-push', {
      body: { user_ids: userIds, title, body, url },
    });
  } catch (e) {
    console.warn('sendPushTo failed', e);
  }
}
