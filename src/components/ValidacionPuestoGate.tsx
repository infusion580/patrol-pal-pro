import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Camera, Loader2, MapPin, RefreshCw, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { loadServiciosParaUsuario } from '@/lib/guardia-servicios';
import { notifyValidacionPuesto } from '@/lib/notification-helpers';
import { playAlertSound } from '@/lib/alert-sound';
import {
  listConfigsDelGuardia,
  registrarValidacion,
  respondidosHoy,
  slotKey,
  slotVigente,
  type SlotPendiente,
} from '@/lib/validacion-puesto';

/**
 * Alertas programadas de validación de puesto (lado guardia).
 * Cuando llega un horario programado por admin/supervisor, bloquea la app
 * —esté donde esté el guardia— y exige fotografía en vivo. La fecha, hora,
 * GPS, precisión y usuario se capturan automáticamente.
 */

const POLL_MS = 10_000;

interface Punto {
  nombre: string;
  lat: number;
  lng: number;
  radio: number;
}

export function ValidacionPuestoGate() {
  const { user } = useAuth();
  const esGuardia = user?.role === 'guardia';

  const [slot, setSlot] = useState<SlotPendiente | null>(null);
  const [servicio, setServicio] = useState<{ id: string; nombre: string } | null>(null);
  const [punto, setPunto] = useState<Punto | null>(null);
  const [servicioIds, setServicioIds] = useState<string[]>([]);
  const respondidos = useRef<Set<string>>(new Set());

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [camError, setCamError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ url: string; blob: Blob } | null>(null);
  const [saving, setSaving] = useState(false);

  /* ---------------- Servicios del guardia ----------------
   * Se usa el principal para mostrar el nombre, pero la búsqueda de
   * programaciones considera todos sus servicios asignados. */
  useEffect(() => {
    if (!esGuardia || !user) return;
    let vivo = true;
    (async () => {
      try {
        const svcs = await loadServiciosParaUsuario(user.id, 'guardia');
        if (!vivo) return;
        if (svcs[0]) setServicio({ id: svcs[0].id, nombre: svcs[0].nombre });
        const { data } = await supabase
          .from('guardia_servicios')
          .select('servicio_id')
          .eq('guardia_id', user.id);
        if (!vivo) return;
        const ids = (data || []).map((r: { servicio_id: string }) => r.servicio_id);
        setServicioIds(ids.length ? ids : svcs.map((s) => s.id));
      } catch {
        /* se reintenta al recargar */
      }
    })();
    return () => {
      vivo = false;
    };
  }, [esGuardia, user]);

  /* ---------------- Detección del horario programado ---------------- */
  const revisar = useCallback(async () => {
    // Un guardia elegido explícitamente en la programación debe recibirla
    // aunque todavía no tenga un servicio principal/asignado.
    if (!user || slot) return;
    try {
      const [configs, hechos] = await Promise.all([
        listConfigsDelGuardia(user.id, servicioIds),
        respondidos.current.size ? Promise.resolve(respondidos.current) : respondidosHoy(user.id),
      ]);
      respondidos.current = hechos;
      const vigente = slotVigente(configs, new Date(), hechos);
      if (!vigente) return;

      // Punto/puesto esperado para cotejar coordenadas.
      let p: Punto | null = null;
      if (vigente.config.checkpoint_id) {
        const { data } = await supabase
          .from('checkpoints')
          .select('nombre, lat, lng, radius_metros')
          .eq('id', vigente.config.checkpoint_id)
          .maybeSingle();
        const cp = data as { nombre: string; lat: number | null; lng: number | null; radius_metros: number } | null;
        if (cp?.lat != null && cp?.lng != null) {
          p = {
            nombre: cp.nombre,
            lat: cp.lat,
            lng: cp.lng,
            radio: vigente.config.radio_metros || cp.radius_metros || 100,
          };
        }
      }
      setPunto(p);
      setSlot(vigente);

      // Aviso audible + notificación del sistema por si la app está en segundo plano.
      playAlertSound('alta');
      try {
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification('Validación de puesto', {
            body: `${vigente.config.nombre}: confirma con una fotografía que estás en tu puesto.`,
            tag: `validacion-${vigente.config.id}`,
          });
        }
      } catch {
        /* el navegador puede bloquear las notificaciones */
      }
    } catch {
      /* red intermitente: se reintenta en el siguiente ciclo */
    }
  }, [servicioIds, slot, user]);

  useEffect(() => {
    if (!esGuardia || !user) return;
    revisar();
    const id = window.setInterval(revisar, POLL_MS);
    // Al volver a la app (pestaña o celular suspendido) se revisa de inmediato.
    const onWake = () => { if (document.visibilityState === 'visible') revisar(); };
    document.addEventListener('visibilitychange', onWake);
    window.addEventListener('focus', onWake);
    window.addEventListener('online', onWake);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onWake);
      window.removeEventListener('focus', onWake);
      window.removeEventListener('online', onWake);
    };
  }, [esGuardia, user, revisar]);

  /* ---------------- Cámara en vivo ---------------- */
  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const startStream = useCallback(async () => {
    setCamError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 } },
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
    if (!slot) return;
    startStream();
    return stopStream;
  }, [slot, startStream, stopStream]);

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

  /* ---------------- Envío ---------------- */
  const confirmar = async () => {
    if (!preview || !slot || !user) return;
    setSaving(true);
    try {
      const res = await registrarValidacion({
        config: slot.config,
        programado: slot.programado,
        guardiaId: user.id,
        foto: preview.blob,
        punto: punto ? { lat: punto.lat, lng: punto.lng, radio: punto.radio } : null,
      });

      await notifyValidacionPuesto({
        guardiaId: user.id,
        guardiaNombre: `${user.nombre} ${user.apellido}`.trim() || user.email,
        servicioNombre: servicio?.nombre,
        puntoNombre: punto?.nombre || slot.config.nombre,
        programado: slot.programado,
        resultado: res.resultado,
        distancia: res.distancia,
        lat: res.lat,
        lng: res.lng,
        precision: res.precision,
        fotoUrl: res.fotoPath,
      }).catch(() => undefined);

      respondidos.current.add(slotKey(slot.config.id, slot.programado));

      if (res.resultado === 'valida') {
        toast.success('Validación registrada: estás en tu puesto');
      } else if (res.resultado === 'fuera_area') {
        toast.warning(`Registrado fuera del área esperada (${res.distancia}m). Se notificó a tu supervisor.`);
      } else {
        toast.warning('Registrado sin ubicación GPS. Se notificó a tu supervisor.');
      }

      URL.revokeObjectURL(preview.url);
      setPreview(null);
      setSlot(null);
      setPunto(null);
    } catch {
      toast.error('No se pudo registrar la validación. Intenta de nuevo.');
    } finally {
      setSaving(false);
    }
  };

  if (!esGuardia || !slot || !user) return null;

  const horaProgramada = slot.programado.toLocaleTimeString('es-MX', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

  return (
    <div className="fixed inset-0 z-[110] flex flex-col bg-background">
      <header className="border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <div className="min-w-0">
            <p className="text-sm font-semibold leading-tight">Confirma que estás en tu puesto</p>
            <p className="truncate text-xs text-muted-foreground">
              {slot.config.nombre} · {horaProgramada}
            </p>
          </div>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          {`${user.nombre} ${user.apellido}`.trim()} · {servicio?.nombre || 'Servicio'}
          {punto ? ` · Punto: ${punto.nombre}` : ''}
        </p>
      </header>

      <div className="flex flex-1 items-center justify-center overflow-hidden bg-muted/40 p-4">
        <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-border bg-card">
          {preview ? (
            <img src={preview.url} alt="Fotografía de validación de puesto" className="w-full object-cover" />
          ) : (
            <video ref={videoRef} playsInline muted className="w-full bg-black object-cover" />
          )}
        </div>
      </div>

      <footer className="space-y-3 border-t border-border p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
        <p className="flex items-center justify-center gap-2 text-center text-xs text-muted-foreground">
          <MapPin className="h-3.5 w-3.5" />
          Se registrará tu fecha, hora, ubicación GPS y precisión automáticamente.
        </p>
        {camError && <p className="text-center text-xs text-emergency">{camError}</p>}

        {preview ? (
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={repetir} disabled={saving} className="h-12">
              <RefreshCw className="mr-2 h-4 w-4" /> Repetir
            </Button>
            <Button onClick={confirmar} disabled={saving} className="h-12">
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
              {saving ? 'Enviando...' : 'Confirmar'}
            </Button>
          </div>
        ) : camError ? (
          <label className="flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-md bg-primary text-sm font-semibold text-primary-foreground">
            <Camera className="h-4 w-4" /> Tomar foto con la cámara
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) setPreview({ url: URL.createObjectURL(f), blob: f });
              }}
            />
          </label>
        ) : (
          <Button onClick={tomarFoto} className="h-12 w-full">
            <Camera className="mr-2 h-4 w-4" /> Tomar fotografía
          </Button>
        )}
      </footer>
    </div>
  );
}

export default ValidacionPuestoGate;
