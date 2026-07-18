/**
 * Offline write queue
 * -------------------
 * Persists JSON-only Supabase writes to localStorage when the browser is
 * offline (or the request fails with a network error) and replays them
 * automatically when connectivity returns.
 *
 * SCOPE: this queue is safe for **fire-and-forget** writes whose success
 * we do not need to await synchronously in the UI (e.g. notification
 * inserts, log entries, telemetry). Do NOT use it for:
 *   - mutations whose returned row is used immediately (e.g. inserting a
 *     shift and then reading `asistencia.id` to update later),
 *   - anything that uploads binary content (photos) — the binary would
 *     need to live in IndexedDB, out of scope for this file.
 *
 * Storage: localStorage under `defender.offline-queue.v1` (small JSON).
 * Replay: on `online` event, and once at boot if there are pending items.
 * Failure handling: an item that keeps failing keeps `attempts` count;
 * after 10 failed attempts it is dropped to avoid poisoning the queue.
 */
import { supabase } from '@/integrations/supabase/client';

const STORAGE_KEY = 'defender.offline-queue.v1';
const MAX_ATTEMPTS = 10;

type QueueOp =
  | { kind: 'insert'; table: string; values: Record<string, any> }
  | { kind: 'update'; table: string; values: Record<string, any>; matchColumn: string; matchValue: any };

interface QueueItem {
  id: string;
  op: QueueOp;
  attempts: number;
  queuedAt: number;
}

type Listener = (count: number) => void;
const listeners = new Set<Listener>();

function readQueue(): QueueItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as QueueItem[]) : [];
  } catch {
    return [];
  }
}

function writeQueue(items: QueueItem[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch (e) {
    console.warn('offline-queue: localStorage write failed', e);
  }
  listeners.forEach((l) => l(items.length));
}

/** Subscribe to queue-length changes (for UI indicators). */
export function subscribeOfflineQueue(l: Listener): () => void {
  listeners.add(l);
  l(readQueue().length);
  return () => {
    listeners.delete(l);
  };
}

export function offlineQueueSize(): number {
  return readQueue().length;
}

async function tryExecute(op: QueueOp): Promise<boolean> {
  try {
    if (op.kind === 'insert') {
      const { error } = await supabase.from(op.table as any).insert(op.values as any);
      return !error;
    }
    const { error } = await supabase
      .from(op.table as any)
      .update(op.values as any)
      .eq(op.matchColumn, op.matchValue);
    return !error;
  } catch {
    return false;
  }
}

function enqueue(op: QueueOp) {
  const items = readQueue();
  items.push({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    op,
    attempts: 0,
    queuedAt: Date.now(),
  });
  writeQueue(items);
}

/** Insert with automatic offline fallback (fire-and-forget only). */
export async function queuedInsert(table: string, values: Record<string, any>): Promise<void> {
  if (!navigator.onLine) {
    enqueue({ kind: 'insert', table, values });
    return;
  }
  const ok = await tryExecute({ kind: 'insert', table, values });
  if (!ok) enqueue({ kind: 'insert', table, values });
}

/** Update with automatic offline fallback (fire-and-forget only). */
export async function queuedUpdate(
  table: string,
  values: Record<string, any>,
  matchColumn: string,
  matchValue: any,
): Promise<void> {
  if (!navigator.onLine) {
    enqueue({ kind: 'update', table, values, matchColumn, matchValue });
    return;
  }
  const ok = await tryExecute({ kind: 'update', table, values, matchColumn, matchValue });
  if (!ok) enqueue({ kind: 'update', table, values, matchColumn, matchValue });
}

let flushing = false;

/** Attempt to replay every pending item. Safe to call repeatedly. */
export async function flushOfflineQueue(): Promise<void> {
  if (flushing) return;
  flushing = true;
  try {
    let items = readQueue();
    if (items.length === 0) return;
    const remaining: QueueItem[] = [];
    for (const item of items) {
      const ok = await tryExecute(item.op);
      if (ok) continue;
      const attempts = item.attempts + 1;
      if (attempts >= MAX_ATTEMPTS) {
        console.warn('offline-queue: dropping item after max attempts', item);
        continue;
      }
      remaining.push({ ...item, attempts });
    }
    writeQueue(remaining);
  } finally {
    flushing = false;
  }
}

/** Wire browser events. Call once at app startup. */
export function initOfflineQueue() {
  window.addEventListener('online', () => {
    void flushOfflineQueue();
  });
  // Retry on boot in case items are pending from a previous session.
  if (navigator.onLine) void flushOfflineQueue();
}
