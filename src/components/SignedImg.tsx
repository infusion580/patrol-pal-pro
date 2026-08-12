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
export function SignedImg({ bucket, path, fallback, ...imgProps }: SignedImgProps) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    if (!path) { setUrl(null); return; }
    getSignedUrl(bucket, path).then((u) => { if (!cancelled) setUrl(u); });
    return () => { cancelled = true; };
  }, [bucket, path]);

  // Las fotografías se eliminan a los 30 días por la política de retención:
  // en ese caso se muestra un aviso en lugar de una imagen rota.
  const vacio = fallback ?? (
    <div className="w-full rounded-lg border border-dashed border-border bg-muted/40 px-3 py-4 text-center text-xs text-muted-foreground">
      Evidencia no disponible (eliminada por la política de retención de 30 días)
    </div>
  );

  if (!url || failed) return <>{vacio}</>;
  return <img src={url} onError={() => setFailed(true)} {...imgProps} />;
}

