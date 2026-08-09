/**
 * Realtime manager (single shared socket, ref-counted channels)
 * -------------------------------------------------------------
 * Problem it solves: every page used to open its own `supabase.channel(...)`.
 * After the phone suspends and wakes up, those channels reconnect
 * independently — duplicated subscriptions, duplicated callbacks and a
 * noticeable battery/bandwidth cost.
 *
 * This module centralizes all `postgres_changes` subscriptions:
 *  - One channel per table (not per page). Multiple listeners share it.
 *  - Reference counting: the channel is removed only when the last
 *    listener unsubscribes (after a short grace period, so navigating
 *    between two pages that watch the same table doesn't churn).
 *  - Recovery: on `online` and on `visibilitychange -> visible` every
 *    channel that is not in a healthy state is torn down and recreated
 *    once, and every listener is invoked so the UI re-syncs.
 *
 * Usage: prefer the `useRealtimeTable` hook (src/hooks/use-realtime.ts).
 */
import { supabase } from '@/integrations/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';

type Listener = (payload: unknown) => void;

interface Entry {
  channel: RealtimeChannel | null;
  listeners: Set<Listener>;
  closeTimer?: number;
  healthy: boolean;
}

/** key = `${table}|${filter ?? ''}` */
const entries = new Map<string, Entry>();

const CLOSE_GRACE_MS = 5_000;

function keyFor(table: string, filter?: string) {
  return `${table}|${filter ?? ''}`;
}

function openChannel(key: string, table: string, filter?: string) {
  const entry = entries.get(key);
  if (!entry || entry.channel) return;

  const channel = supabase
    .channel(`rt:${key}`)
    .on(
      // @ts-expect-error - supabase-js typing for the generic string event
      'postgres_changes',
      { event: '*', schema: 'public', table, ...(filter ? { filter } : {}) },
      (payload: unknown) => {
        entry.listeners.forEach((l) => {
          try {
            l(payload);
          } catch (e) {
            console.warn('realtime listener error', e);
          }
        });
      },
    )
    .subscribe((status) => {
      entry.healthy = status === 'SUBSCRIBED';
    });

  entry.channel = channel;
}

function closeChannel(key: string) {
  const entry = entries.get(key);
  if (!entry?.channel) return;
  supabase.removeChannel(entry.channel);
  entry.channel = null;
  entry.healthy = false;
}

/**
 * Subscribe to changes on a table. Returns an unsubscribe function.
 * `filter` uses PostgREST syntax, e.g. `guardia_id=eq.<uuid>`.
 */
export function subscribeTable(table: string, listener: Listener, filter?: string): () => void {
  const key = keyFor(table, filter);
  let entry = entries.get(key);
  if (!entry) {
    entry = { channel: null, listeners: new Set(), healthy: false };
    entries.set(key, entry);
  }
  if (entry.closeTimer) {
    window.clearTimeout(entry.closeTimer);
    entry.closeTimer = undefined;
  }
  entry.listeners.add(listener);
  openChannel(key, table, filter);

  return () => {
    const e = entries.get(key);
    if (!e) return;
    e.listeners.delete(listener);
    if (e.listeners.size > 0) return;
    // Grace period: avoids tearing down + recreating while navigating.
    e.closeTimer = window.setTimeout(() => {
      const cur = entries.get(key);
      if (!cur || cur.listeners.size > 0) return;
      closeChannel(key);
      entries.delete(key);
    }, CLOSE_GRACE_MS);
  };
}

/** Recreate any unhealthy channel and force listeners to re-sync. */
function recoverAll() {
  entries.forEach((entry, key) => {
    if (entry.listeners.size === 0) return;
    const [table, filter] = key.split('|');
    if (!entry.healthy) {
      closeChannel(key);
      openChannel(key, table, filter || undefined);
    }
    // Always nudge listeners: while suspended we may have missed events.
    entry.listeners.forEach((l) => {
      try {
        l({ type: 'resync' });
      } catch {
        /* ignore */
      }
    });
  });
}

let initialized = false;

/** Wire global recovery handlers. Safe to call multiple times. */
export function initRealtimeManager() {
  if (initialized || typeof window === 'undefined') return;
  initialized = true;
  window.addEventListener('online', recoverAll);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') recoverAll();
  });
}

/** Debug helper: how many shared channels are currently open. */
export function activeChannelCount(): number {
  let n = 0;
  entries.forEach((e) => {
    if (e.channel) n++;
  });
  return n;
}
