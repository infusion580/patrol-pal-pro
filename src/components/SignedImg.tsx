import { useEffect, useState } from 'react';
import { getSignedUrl } from '@/lib/storage-helpers';

type Bucket = 'evidencias' | 'visitas' | 'pendientes';

interface SignedImgProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  bucket: Bucket;
  path: string | null | undefined;
  fallback?: React.ReactNode;
}

/**
 * Renders an <img> whose src is a short-lived signed URL for a file
 * stored in a private Supabase Storage bucket.
 * Accepts either a raw storage path or a legacy full public URL.
 */
export function SignedImg({ bucket, path, fallback = null, ...imgProps }: SignedImgProps) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!path) { setUrl(null); return; }
    getSignedUrl(bucket, path).then((u) => { if (!cancelled) setUrl(u); });
    return () => { cancelled = true; };
  }, [bucket, path]);

  if (!url) return <>{fallback}</>;
  return <img src={url} {...imgProps} />;
}
