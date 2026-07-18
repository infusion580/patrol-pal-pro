import { supabase } from '@/integrations/supabase/client';

/**
 * Extract the storage object path from either a full public URL or a bare path.
 * Buckets: evidencias, visitas, pendientes.
 */
export function extractStoragePath(bucket: string, urlOrPath: string | null | undefined): string | null {
  if (!urlOrPath) return null;
  // If it looks like a URL, take everything after `/object/(public|sign)/<bucket>/`
  const marker = `/object/`;
  const idx = urlOrPath.indexOf(marker);
  if (idx >= 0) {
    const rest = urlOrPath.slice(idx + marker.length);
    // rest is either "public/<bucket>/<path>" or "sign/<bucket>/<path>?..."
    const bucketMarker = `/${bucket}/`;
    const bi = rest.indexOf(bucketMarker);
    if (bi >= 0) {
      const p = rest.slice(bi + bucketMarker.length).split('?')[0];
      return decodeURIComponent(p);
    }
  }
  return urlOrPath;
}

/**
 * Create a short-lived signed URL for a private bucket file.
 */
export async function getSignedUrl(
  bucket: 'evidencias' | 'visitas' | 'pendientes',
  urlOrPath: string | null | undefined,
  expiresInSeconds = 3600,
): Promise<string | null> {
  const path = extractStoragePath(bucket, urlOrPath);
  if (!path) return null;
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresInSeconds);
  if (error || !data) return null;
  return data.signedUrl;
}
