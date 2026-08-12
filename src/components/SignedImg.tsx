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
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    if (!path) { setUrl(null); setCargando(false); return; }
    setCargando(true);
    getSignedUrl(bucket, path).then((u) => {
      if (cancelled) return;
      setUrl(u);
      setCargando(false);
    });
    return () => { cancelled = true; };
  }, [bucket, path]);

  // Las fotografías se eliminan a los 30 días por la política de retención:
  // en ese caso se muestra un marcador del mismo tamaño, nunca una imagen rota.
  const vacio = fallback ?? (
    <div
      className={`${imgProps.className ?? ''} flex items-center justify-center border border-dashed border-border bg-muted/40 p-1 text-[10px] leading-tight text-center text-muted-foreground`}
      title="Evidencia no disponible (retención de 30 días)"
    >
      Sin foto
    </div>
  );

  if (!path) return <>{fallback ?? null}</>;
  if (cargando) return <div className={`${imgProps.className ?? ''} animate-pulse bg-muted`} />;
  if (!url || failed) return <>{vacio}</>;



  return <img src={url} onError={() => setFailed(true)} {...imgProps} />;
}

