/**
 * Offline photo upload queue backed by IndexedDB.
 *
 * Purpose
 * -------
 * Photos captured while offline (rondín scans, pendientes, visitas INE) are
 * persisted to IndexedDB and uploaded to Supabase Storage as soon as the
 * network returns. The caller can insert the DB row referencing the
 * deterministic storage `path` without waiting for the actual upload.
 *
 * Public API
 * ----------
 * - `uploadPhotoResilient(bucket, path, file)`: attempts immediate upload;
 *   on failure or offline, enqueues the blob for later. Always resolves.
 * - `initPhotoQueue()`: bootstraps retry on `online` events (call once at
 *   app boot).
 * - `pendingPhotoCount()`: current queue size, for UI badges.
 */

import { supabase } from '@/integrations/supabase/client';
import { compressImage } from '@/lib/image-compress';


type Bucket = 'evidencias' | 'visitas' | 'pendientes';
interface QueuedPhoto {
  id: string;
  bucket: Bucket;
  path: string;
  blob: Blob;
  contentType: string;
  attempts: number;
  createdAt: number;
}

const DB_NAME = 'defender-offline';
const STORE = 'photoQueue';
const MAX_ATTEMPTS = 10;

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

async function tx<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T> | void): Promise<T | void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const store = t.objectStore(STORE);
    let result: T | undefined;
    const r = fn(store);
    if (r) r.onsuccess = () => (result = r.result as T);
    t.oncomplete = () => resolve(result);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}

async function putPhoto(item: QueuedPhoto): Promise<void> {
  await tx('readwrite', (s) => s.put(item));
}

async function deletePhoto(id: string): Promise<void> {
  await tx('readwrite', (s) => s.delete(id));
}

async function listPhotos(): Promise<QueuedPhoto[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, 'readonly');
    const req = t.objectStore(STORE).getAll();
    req.onsuccess = () => resolve((req.result || []) as QueuedPhoto[]);
    req.onerror = () => reject(req.error);
  });
}

export async function pendingPhotoCount(): Promise<number> {
  try {
    const items = await listPhotos();
    return items.length;
  } catch {
    return 0;
  }
}

async function tryUpload(item: QueuedPhoto): Promise<boolean> {
  const { error } = await supabase.storage
    .from(item.bucket)
    .upload(item.path, item.blob, { contentType: item.contentType, upsert: false });
  // Treat "already exists" as success (idempotent replay).
  if (!error) return true;
  const msg = (error.message || '').toLowerCase();
  if (msg.includes('exists') || msg.includes('duplicate')) return true;
  return false;
}

let draining = false;
async function drain() {
  if (draining || !navigator.onLine) return;
  draining = true;
  try {
    const items = await listPhotos();
    for (const item of items) {
      const ok = await tryUpload(item);
      if (ok) {
        await deletePhoto(item.id);
      } else {
        const next = { ...item, attempts: item.attempts + 1 };
        if (next.attempts >= MAX_ATTEMPTS) {
          console.warn('[photo-queue] discarding after max attempts', item.path);
          await deletePhoto(item.id);
        } else {
          await putPhoto(next);
        }
      }
    }
  } finally {
    draining = false;
  }
}

/**
 * Attempt to upload a photo. If offline or the upload fails, persist the
 * blob to IndexedDB and retry automatically on the next `online` event.
 * Always resolves — never throws — so the caller can proceed to insert the
 * DB row that references `path`.
 */
export async function uploadPhotoResilient(
  bucket: Bucket,
  path: string,
  file: Blob,
  contentType?: string,
): Promise<{ path: string; queued: boolean }> {
  // Compress before anything else so both the immediate upload and the
  // IndexedDB fallback store the small version (saves mobile data + storage).
  const compressed = await compressImage(file);
  const type = compressed === file ? contentType || (file as File).type || 'image/jpeg' : 'image/jpeg';

  if (navigator.onLine) {
    try {
      const { error } = await supabase.storage.from(bucket).upload(path, compressed, { contentType: type, upsert: false });
      if (!error) return { path, queued: false };
    } catch {
      // fall through to queue
    }
  }
  const id = `${bucket}:${path}:${Date.now()}`;
  await putPhoto({ id, bucket, path, blob: compressed, contentType: type, attempts: 0, createdAt: Date.now() });
  return { path, queued: true };
}


let initialized = false;
export function initPhotoQueue() {
  if (initialized) return;
  initialized = true;
  window.addEventListener('online', () => {
    void drain();
  });
  // Attempt a drain shortly after boot in case items linger from a prior session.
  setTimeout(() => void drain(), 2500);
}
