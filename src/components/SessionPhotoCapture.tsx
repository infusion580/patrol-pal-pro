import { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, Loader2, MapPin, RefreshCw, ShieldCheck, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { SesionEvento } from '@/lib/sesion-registros';

/**
 * Pantalla de validación fotográfica de sesión.
 * Usa la cámara en vivo (getUserMedia). Si el navegador la bloquea, cae a un
 * input con `capture`, que en móvil abre la cámara y nunca la galería.
 */

interface Props {
  evento: SesionEvento;
  /** Recibe la foto tomada; debe resolver cuando el registro quedó guardado. */
  onConfirm: (foto: Blob) => Promise<void>;
  /** Si se permite cancelar (cierre de sesión), se muestra el botón. */
  onCancel?: () => void;
  nombre?: string;
}

export function SessionPhotoCapture({ evento, onConfirm, onCancel, nombre }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [camError, setCamError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ url: string; blob: Blob } | null>(null);
  const [saving, setSaving] = useState(false);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const startStream = useCallback(async () => {
    setCamError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
    } catch {
      setCamError('No se pudo abrir la cámara. Usa el botón para tomar la foto con la cámara del dispositivo.');
    }
  }, []);

  useEffect(() => {
    startStream();
    return stopStream;
  }, [startStream, stopStream]);

  const tomarFoto = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d')?.drawImage(video, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        stopStream();
        setPreview({ url: URL.createObjectURL(blob), blob });
      },
      'image/jpeg',
      0.9,
    );
  };

  const repetir = () => {
    if (preview) URL.revokeObjectURL(preview.url);
    setPreview(null);
    startStream();
  };

  const confirmar = async () => {
    if (!preview) return;
    setSaving(true);
    try {
      await onConfirm(preview.blob);
    } finally {
      setSaving(false);
    }
  };

  const titulo = evento === 'login' ? 'Validación de ingreso' : 'Validación de cierre de sesión';

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-background">
      <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <div>
            <p className="text-sm font-semibold leading-tight">{titulo}</p>
            <p className="text-xs text-muted-foreground">{nombre || 'Toma tu fotografía para continuar'}</p>
          </div>
        </div>
        {onCancel && (
          <Button variant="ghost" size="icon" onClick={onCancel} aria-label="Cancelar">
            <X className="h-5 w-5" />
          </Button>
        )}
      </header>

      <div className="flex flex-1 items-center justify-center overflow-hidden bg-muted/40 p-4">
        <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-border bg-card">
          {preview ? (
            <img src={preview.url} alt="Fotografía de validación" className="w-full object-cover" />
          ) : (
            <video ref={videoRef} playsInline muted className="w-full bg-black object-cover" />
          )}
        </div>
      </div>

      <footer className="space-y-3 border-t border-border p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
        <p className="flex items-center justify-center gap-2 text-center text-xs text-muted-foreground">
          <MapPin className="h-3.5 w-3.5" />
          Se registrará tu ubicación, fecha, hora y dispositivo.
        </p>

        {camError && <p className="text-center text-xs text-destructive">{camError}</p>}

        {preview ? (
          <div className="grid grid-cols-2 gap-3">
            <Button variant="outline" onClick={repetir} disabled={saving}>
              <RefreshCw className="mr-2 h-4 w-4" /> Repetir
            </Button>
            <Button onClick={confirmar} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
              {saving ? 'Registrando…' : 'Confirmar'}
            </Button>
          </div>
        ) : camError ? (
          <label className="block">
            <input
              type="file"
              accept="image/*"
              capture="user"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) setPreview({ url: URL.createObjectURL(file), blob: file });
              }}
            />
            <Button asChild className="w-full">
              <span>
                <Camera className="mr-2 h-4 w-4" /> Abrir cámara
              </span>
            </Button>
          </label>
        ) : (
          <Button className="w-full" size="lg" onClick={tomarFoto}>
            <Camera className="mr-2 h-4 w-4" /> Tomar fotografía
          </Button>
        )}
      </footer>
    </div>
  );
}

export default SessionPhotoCapture;
