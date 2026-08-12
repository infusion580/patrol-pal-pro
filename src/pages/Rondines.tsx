import { useState, useEffect } from 'react';
import { ArrowLeft, MapPin, QrCode, CheckCircle2, Clock, Navigation, Camera, X, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth-context';
import BottomNav from '@/components/BottomNav';
import EmergencyButton from '@/components/EmergencyButton';
import { useZoneMonitor } from '@/hooks/use-zone-monitor';
import { useToast } from '@/hooks/use-toast';
import { notifyRondinCheckIn, notifyRondinPunto, notifyRondinCheckOut } from '@/lib/notification-helpers';
import { SignedImg } from '@/components/SignedImg';
import { loadServiciosParaUsuario } from '@/lib/guardia-servicios';

type EstadoPunto = 'sin_novedad' | 'con_novedad';

interface CheckpointItem {
  id: string;
  name: string;
  scanned: boolean;
  time: string | null;
  lat: number | null;
  lng: number | null;
  radius: number;
  obligatorio: boolean;
  foto_url?: string | null;
  observacion?: string;
  estado?: EstadoPunto;
  scan_lat?: number | null;
  scan_lng?: number | null;
}

function getDistanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371e3;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function getCurrentPositionRobust(): Promise<GeolocationPosition> {
  if (!('geolocation' in navigator)) throw new Error('Tu dispositivo no soporta geolocalización.');
  try {
    if ('permissions' in navigator) {
      const status = await (navigator as any).permissions.query({ name: 'geolocation' });
      if (status.state === 'denied') throw new Error('Permiso de ubicación denegado.');
    }
  } catch (e: any) { if (e?.message?.includes('denegado')) throw e; }
  const tryGet = (opts: PositionOptions) =>
    new Promise<GeolocationPosition>((resolve, reject) =>
      navigator.geolocation.getCurrentPosition(resolve, reject, opts)
    );
  try {
    return await tryGet({ enableHighAccuracy: true, timeout: 12000, maximumAge: 10000 });
  } catch (err: any) {
    if (err?.code === 1) throw new Error('Permiso de ubicación denegado.');
    try {
      return await tryGet({ enableHighAccuracy: false, timeout: 15000, maximumAge: 60000 });
    } catch (err2: any) {
      if (err2?.code === 1) throw new Error('Permiso de ubicación denegado.');
      if (err2?.code === 2) throw new Error('GPS no disponible.');
      if (err2?.code === 3) throw new Error('Tiempo agotado obteniendo GPS.');
      throw new Error('No se pudo obtener tu ubicación.');
    }
  }
}

const Rondines = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [checkedIn, setCheckedIn] = useState(false);
  const [rondinId, setRondinId] = useState<string | null>(null);
  const [points, setPoints] = useState<CheckpointItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [servicios, setServicios] = useState<Array<{ id: string; nombre: string }>>([]);
  const [selectedServicio, setSelectedServicio] = useState<string | null>(null);
  const [zoneCenter, setZoneCenter] = useState<{ lat: number; lng: number; radius: number } | undefined>();

  const [permitirIncompleto, setPermitirIncompleto] = useState(false);

  // Scan dialog state
  const [scanTarget, setScanTarget] = useState<CheckpointItem | null>(null);
  const [scanFile, setScanFile] = useState<File | null>(null);
  const [scanPreview, setScanPreview] = useState<string | null>(null);
  const [scanObservacion, setScanObservacion] = useState('');
  const [scanEstado, setScanEstado] = useState<EstadoPunto>('sin_novedad');

  // Checkout dialog state
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [reporte, setReporte] = useState('');
  const [submittingCheckout, setSubmittingCheckout] = useState(false);

  useZoneMonitor(checkedIn ? selectedServicio : null, zoneCenter);

  useEffect(() => { if (user) loadServicios(); }, [user]);
  useEffect(() => { if (selectedServicio) loadCheckpoints(selectedServicio); }, [selectedServicio]);

  const loadServicios = async () => {
    if (!user) { setLoading(false); return; }
    const data = await loadServiciosParaUsuario(user.id, user.role);
    if (data && data.length > 0) {
      setServicios(data.map((d: any) => ({ id: d.id, nombre: d.nombre })));
      setSelectedServicio(data[0].id);
    }
    setLoading(false);
  };

  const loadCheckpoints = async (servicioId: string) => {
    const { data: cps } = await supabase.from('checkpoints').select('*').eq('servicio_id', servicioId).order('created_at');
    if (!user) return;

    const { data: svc } = await supabase.from('servicios').select('permitir_rondin_incompleto').eq('id', servicioId).maybeSingle();
    setPermitirIncompleto(!!(svc as any)?.permitir_rondin_incompleto);

    const { data: activeRondin } = await supabase
      .from('rondines').select('*')
      .eq('guardia_id', user.id).eq('status', 'activo')
      .maybeSingle();

    let scannedMap = new Map<string, any>();
    if (activeRondin) {
      setRondinId(activeRondin.id);
      setCheckedIn(true);
      const { data: scans } = await supabase
        .from('rondin_scans').select('checkpoint_id, scanned_at, foto_url, observacion, estado, lat, lng')
        .eq('rondin_id', activeRondin.id);
      scannedMap = new Map(scans?.map((s: any) => [s.checkpoint_id, s]) || []);
    }

    const mapped: CheckpointItem[] = (cps || []).map((cp: any) => {
      const s = scannedMap.get(cp.id);
      return {
        id: cp.id, name: cp.nombre, lat: cp.lat, lng: cp.lng, radius: cp.radius_metros || 50,
        obligatorio: cp.obligatorio ?? true,
        scanned: !!s,
        time: s ? new Date(s.scanned_at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }) : null,
        foto_url: s?.foto_url || null,
        observacion: s?.observacion || '',
        estado: (s?.estado as EstadoPunto) || 'sin_novedad',
        scan_lat: s?.lat ?? null,
        scan_lng: s?.lng ?? null,
      };
    });
    setPoints(mapped);
    const first = mapped.find(p => p.lat && p.lng);
    if (first) setZoneCenter({ lat: first.lat!, lng: first.lng!, radius: first.radius * 10 });
  };

  const handleCheckIn = async () => {
    if (!user || !selectedServicio) return;
    if (checkedIn && rondinId) {
      // Bloquear checkout si faltan puntos OBLIGATORIOS,
      // salvo que el administrador permita cerrar rondines incompletos.
      const faltantes = points.filter(p => !p.scanned && p.obligatorio);
      if (!permitirIncompleto && (points.length === 0 || faltantes.length > 0)) {
        toast({
          title: 'Rondín incompleto',
          description: faltantes.length > 0
            ? `Faltan ${faltantes.length} punto(s) obligatorio(s): ${faltantes.map(p => p.name).join(', ')}`
            : 'No hay puntos configurados para este servicio.',
          variant: 'destructive',
        });
        return;
      }
      // Open checkout dialog to request report
      setReporte('');
      setCheckoutOpen(true);
      return;
    }
    // Validar ubicación ANTES de crear el rondín: debe estar dentro de la zona del servicio
    // (usamos el checkpoint más cercano como referencia — debe estar dentro de su radio).
    const cpsConGps = points.filter(p => p.lat != null && p.lng != null);
    if (cpsConGps.length === 0) {
      toast({ title: 'Servicio sin puntos GPS', description: 'Configura al menos un punto con coordenadas antes de iniciar el rondín.', variant: 'destructive' });
      return;
    }
    let lat: number | null = null, lng: number | null = null;
    try {
      const pos = await getCurrentPositionRobust();
      lat = pos.coords.latitude; lng = pos.coords.longitude;
      const accuracy = pos.coords.accuracy || 0;
      const nearest = cpsConGps
        .map(p => ({ p, dist: getDistanceMeters(lat!, lng!, p.lat!, p.lng!) }))
        .sort((a, b) => a.dist - b.dist)[0];
      const allowed = nearest.p.radius + Math.min(accuracy, 50);
      if (nearest.dist > allowed) {
        toast({
          title: '❌ Fuera de la ubicación del servicio',
          description: `Estás a ${Math.round(nearest.dist)}m del punto más cercano (máx ${nearest.p.radius}m). Acércate al servicio para iniciar el rondín.`,
          variant: 'destructive',
        });
        return;
      }
    } catch (e: any) {
      toast({ title: '📍 GPS requerido', description: e?.message || 'Activa la ubicación para iniciar el rondín.', variant: 'destructive' });
      return;
    }
    const { data } = await supabase.from('rondines').insert({
      guardia_id: user.id,
      servicio_id: selectedServicio,
      checkin_at: new Date().toISOString(),
      checkin_lat: lat, checkin_lng: lng,
    }).select().single();
    if (data) {
      setRondinId(data.id);
      setCheckedIn(true);
      const svcName = servicios.find(s => s.id === selectedServicio)?.nombre;
      notifyRondinCheckIn(user.id, `${user.nombre} ${user.apellido}`, svcName);
    }
  };

  const submitCheckout = async () => {
    if (!rondinId) return;
    if (reporte.trim().length < 10) {
      toast({ title: 'Reporte requerido', description: 'Escribe al menos 10 caracteres describiendo el rondín.', variant: 'destructive' });
      return;
    }
    setSubmittingCheckout(true);
    const { error } = await supabase.from('rondines').update({
      status: 'completado',
      checkout_at: new Date().toISOString(),
      reporte: reporte.trim(),
    }).eq('id', rondinId);
    setSubmittingCheckout(false);
    if (error) {
      toast({ title: 'Error', description: 'No se pudo cerrar el rondín.', variant: 'destructive' });
      return;
    }
    if (user) {
      const svcName = servicios.find(s => s.id === selectedServicio)?.nombre;
      const escaneados = points.filter(p => p.scanned).length;
      notifyRondinCheckOut(user.id, `${user.nombre} ${user.apellido}`, svcName, reporte.trim(), escaneados, points.length);
    }
    setCheckoutOpen(false);
    setCheckedIn(false);
    setRondinId(null);
    setReporte('');
    setPoints(prev => prev.map(p => ({ ...p, scanned: false, time: null, foto_url: null })));
    toast({ title: '✅ Rondín completado', description: 'Reporte guardado correctamente.' });
  };

  const openScanDialog = async (checkpoint: CheckpointItem) => {
    // Bloquear apertura del picker si el guardia no está dentro del radio del punto.
    if (checkpoint.lat != null && checkpoint.lng != null) {
      try {
        const pos = await getCurrentPositionRobust();
        const dist = getDistanceMeters(pos.coords.latitude, pos.coords.longitude, checkpoint.lat, checkpoint.lng);
        const accuracy = pos.coords.accuracy || 0;
        const allowed = checkpoint.radius + Math.min(accuracy, 50);
        if (dist > allowed) {
          toast({
            title: '❌ Fuera del punto',
            description: `Estás a ${Math.round(dist)}m de "${checkpoint.name}" (máx ${checkpoint.radius}m). No puedes tomar foto hasta acercarte.`,
            variant: 'destructive',
          });
          return;
        }
      } catch (e: any) {
        toast({ title: '📍 GPS requerido', description: e?.message || 'Activa la ubicación para verificar el punto.', variant: 'destructive' });
        return;
      }
    }
    setScanTarget(checkpoint);
    setScanFile(null);
    setScanPreview(null);
    setScanObservacion('');
    setScanEstado('sin_novedad');
  };

  const onSelectPhoto = (file: File | null) => {
    if (!file) { setScanFile(null); setScanPreview(null); return; }
    if (file.size > 8 * 1024 * 1024) {
      toast({ title: 'Foto muy grande', description: 'Máximo 8MB.', variant: 'destructive' });
      return;
    }
    // Bloquear fotos de galería: solo aceptar imágenes tomadas al momento (< 2 min).
    const ageMs = Date.now() - file.lastModified;
    if (Number.isFinite(ageMs) && ageMs > 2 * 60 * 1000) {
      toast({
        title: 'Solo cámara en vivo',
        description: 'No se permiten fotos de la galería. Toma la foto con la cámara en este momento.',
        variant: 'destructive',
      });
      return;
    }
    setScanFile(file);
    setScanPreview(URL.createObjectURL(file));
  };


  const confirmScan = async () => {
    if (!scanTarget || !rondinId || !user) return;
    if (!scanFile) {
      toast({ title: 'Foto requerida', description: 'Debes adjuntar una foto de evidencia del punto.', variant: 'destructive' });
      return;
    }
    if (scanEstado === 'con_novedad' && scanObservacion.trim().length < 10) {
      toast({ title: 'Observación requerida', description: 'Describe la novedad con al menos 10 caracteres.', variant: 'destructive' });
      return;
    }
    setScanning(true);


    // GPS check
    let lat: number | null = null, lng: number | null = null;
    if (scanTarget.lat && scanTarget.lng) {
      try {
        const pos = await getCurrentPositionRobust();
        lat = pos.coords.latitude; lng = pos.coords.longitude;
        const dist = getDistanceMeters(lat, lng, scanTarget.lat, scanTarget.lng);
        const accuracy = pos.coords.accuracy || 0;
        const allowed = scanTarget.radius + Math.min(accuracy, 50);
        if (dist > allowed) {
          toast({ title: '❌ Fuera de rango', description: `Estás a ${Math.round(dist)}m (máx ${scanTarget.radius}m).`, variant: 'destructive' });
          setScanning(false);
          return;
        }
      } catch (e: any) {
        toast({ title: '📍 GPS no disponible', description: e?.message || 'Sin ubicación.', variant: 'destructive' });
        setScanning(false);
        return;
      }
    }

    // Upload photo (resilient: si no hay red se encola y sube al reconectar)
    const ext = scanFile.name.split('.').pop() || 'jpg';
    const path = `${user.id}/${rondinId}/${scanTarget.id}-${Date.now()}.${ext}`;
    const { uploadPhotoResilient } = await import('@/lib/offline-photo-queue');
    const { queued } = await uploadPhotoResilient('evidencias', path, scanFile, scanFile.type);
    if (queued) {
      toast({ title: '📥 Foto en cola', description: 'Se subirá automáticamente al recuperar la señal.' });
    }
    const foto_url = path;

    const observacion = scanObservacion.trim();
    const { error } = await supabase.from('rondin_scans').insert({
      rondin_id: rondinId,
      checkpoint_id: scanTarget.id,
      lat, lng,
      foto_url,
      observacion,
      estado: scanEstado,
    } as any);
    setScanning(false);
    if (error) {
      toast({ title: 'Error', description: 'No se pudo guardar el escaneo.', variant: 'destructive' });
      return;
    }
    setPoints(prev => prev.map(p => p.id === scanTarget.id
      ? {
          ...p,
          scanned: true,
          time: new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }),
          foto_url,
          observacion,
          estado: scanEstado,
          scan_lat: lat,
          scan_lng: lng,
        }
      : p));
    const svcName = servicios.find(s => s.id === selectedServicio)?.nombre;
    const estadoLabel = scanEstado === 'con_novedad' ? '⚠️ CON NOVEDAD' : 'Sin novedad';
    notifyRondinPunto(
      user.id,
      `${user.nombre} ${user.apellido}`,
      `${scanTarget.name} — ${estadoLabel}${observacion ? `: ${observacion}` : ''}`,
      svcName,
      foto_url,
    );
    toast({ title: '✅ Punto registrado', description: `${scanTarget.name} — ${estadoLabel}.` });
    setScanTarget(null);
    setScanFile(null);
    setScanPreview(null);
    setScanObservacion('');
    setScanEstado('sin_novedad');
  };

  const scannedCount = points.filter(p => p.scanned).length;

  if (loading) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-background pb-20">
      <div className="text-primary-foreground px-4 pt-12 pb-6 rounded-b-3xl app-header">
        <div className="max-w-lg mx-auto">
          <button onClick={() => navigate('/dashboard')} className="flex items-center gap-1 text-sm opacity-80 mb-2">
            <ArrowLeft className="w-4 h-4" /> Regresar
          </button>
          <h1 className="text-xl font-display font-bold">Control de Rondines</h1>
          <p className="text-sm opacity-70 mt-1">{scannedCount}/{points.length} puntos escaneados</p>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 -mt-4">
        {servicios.length > 0 && (
          <div className="bg-card rounded-xl p-4 shadow-card mb-4">
            <label className="text-xs font-semibold text-muted-foreground mb-2 block">Servicio</label>
            <select
              value={selectedServicio || ''}
              onChange={(e) => setSelectedServicio(e.target.value)}
              className="w-full h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground"
              disabled={checkedIn}
            >
              {servicios.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
            </select>
          </div>
        )}

        {servicios.length === 0 && (
          <div className="bg-card rounded-xl p-8 shadow-card mb-4 text-center">
            <MapPin className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No hay servicios configurados</p>
          </div>
        )}

        {servicios.length > 0 && (
          <div className="bg-card rounded-xl p-4 shadow-card mb-6">
            <Button
              onClick={handleCheckIn}
              disabled={checkedIn && (points.length === 0 || scannedCount < points.length)}
              className={`w-full h-14 text-base font-bold rounded-xl ${
                checkedIn ? 'bg-emergency text-emergency-foreground hover:bg-emergency/90' : 'bg-success text-success-foreground hover:bg-success/90'
              }`}
            >
              <MapPin className="w-5 h-5 mr-2" />
              {checkedIn
                ? (scannedCount < points.length
                    ? `Faltan ${points.length - scannedCount} punto(s)`
                    : 'Hacer Check-out y enviar reporte')
                : 'Hacer Check-in'}
            </Button>
            {checkedIn && <p className="text-xs text-success text-center mt-2 font-semibold">✅ Check-in activo — GPS registrado</p>}
          </div>
        )}

        {points.length > 0 && (
          <>
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-foreground">Progreso del Rondín</span>
                <span className="text-sm font-bold text-primary">{points.length > 0 ? Math.round(scannedCount / points.length * 100) : 0}%</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${points.length > 0 ? scannedCount / points.length * 100 : 0}%` }} />
              </div>
            </div>

            <h2 className="text-sm font-semibold text-muted-foreground mb-3">Puntos de Control</h2>
            <div className="space-y-2">
              {points.map((point) => (
                <div key={point.id} className="bg-card rounded-xl p-4 shadow-card flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${point.scanned ? 'bg-success/10' : 'bg-accent'}`}>
                    {point.scanned ? <CheckCircle2 className="w-5 h-5 text-success" /> : <QrCode className="w-5 h-5 text-muted-foreground" />}
                  </div>
                  <div className="flex-1">
                    <p className={`text-sm font-semibold ${point.scanned ? 'text-foreground' : 'text-muted-foreground'}`}>{point.name}</p>
                    {point.time && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {point.time}
                      </p>
                    )}
                    {point.lat && point.lng && !point.scanned && (
                      <p className="text-[10px] text-primary flex items-center gap-1">
                        <Navigation className="w-3 h-3" /> GPS + foto requeridos (r:{point.radius}m)
                      </p>
                    )}
                  </div>
                  {point.scanned && point.foto_url && (
                    <SignedImg bucket="evidencias" path={point.foto_url} alt="Evidencia" className="w-10 h-10 rounded object-cover border border-border" />
                  )}
                  {!point.scanned && checkedIn && (
                    <Button size="sm" onClick={() => openScanDialog(point)} className="text-xs h-8">
                      <Camera className="w-3 h-3 mr-1" /> Verificar
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Scan dialog */}
      <Dialog open={!!scanTarget} onOpenChange={(o) => { if (!o) { setScanTarget(null); setScanFile(null); setScanPreview(null); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Camera className="w-5 h-5 text-primary" />
              Evidencia del punto
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Toma una foto del punto <span className="font-semibold text-foreground">{scanTarget?.name}</span> para confirmarlo.
            </p>
            {scanPreview ? (
              <div className="relative">
                <img src={scanPreview} alt="Preview" className="w-full h-56 object-cover rounded-lg border border-border" />
                <button
                  onClick={() => onSelectPhoto(null)}
                  className="absolute top-2 right-2 bg-black/60 text-white rounded-full p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center h-40 border-2 border-dashed border-border rounded-lg cursor-pointer hover:bg-accent">
                <Camera className="w-8 h-8 text-muted-foreground mb-2" />
                <span className="text-sm text-muted-foreground">Tomar foto con la cámara</span>
                <span className="text-[10px] text-muted-foreground mt-1">No se permiten fotos de la galería</span>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => onSelectPhoto(e.target.files?.[0] || null)}
                />
              </label>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setScanTarget(null)} disabled={scanning}>Cancelar</Button>
            <Button onClick={confirmScan} disabled={scanning || !scanFile}>
              {scanning ? 'Guardando...' : 'Confirmar punto'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Checkout dialog */}
      <Dialog open={checkoutOpen} onOpenChange={setCheckoutOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              Reporte del rondín
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Describe cómo transcurrió el rondín: observaciones, incidencias, novedades, condiciones del área.
            </p>
            <Textarea
              value={reporte}
              onChange={(e) => setReporte(e.target.value)}
              placeholder="Ej. Rondín sin novedad. Todas las puertas cerradas correctamente. Luminarias operando..."
              rows={6}
              maxLength={1500}
            />
            <p className="text-[10px] text-muted-foreground text-right">{reporte.length}/1500</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCheckoutOpen(false)} disabled={submittingCheckout}>Cancelar</Button>
            <Button onClick={submitCheckout} disabled={submittingCheckout}>
              {submittingCheckout ? 'Guardando...' : 'Finalizar rondín'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <EmergencyButton />
      <BottomNav />
    </div>
  );
};

export default Rondines;
