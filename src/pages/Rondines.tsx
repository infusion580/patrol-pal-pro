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

interface CheckpointItem {
  id: string;
  name: string;
  scanned: boolean;
  time: string | null;
  lat: number | null;
  lng: number | null;
  radius: number;
  foto_url?: string | null;
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

  // Scan dialog state
  const [scanTarget, setScanTarget] = useState<CheckpointItem | null>(null);
  const [scanFile, setScanFile] = useState<File | null>(null);
  const [scanPreview, setScanPreview] = useState<string | null>(null);

  // Checkout dialog state
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [reporte, setReporte] = useState('');
  const [submittingCheckout, setSubmittingCheckout] = useState(false);

  useZoneMonitor(checkedIn ? selectedServicio : null, zoneCenter);

  useEffect(() => { loadServicios(); }, []);
  useEffect(() => { if (selectedServicio) loadCheckpoints(selectedServicio); }, [selectedServicio]);

  const loadServicios = async () => {
    const { data } = await supabase.from('servicios').select('id, nombre').order('nombre');
    if (data && data.length > 0) {
      setServicios(data);
      setSelectedServicio(data[0].id);
    }
    setLoading(false);
  };

  const loadCheckpoints = async (servicioId: string) => {
    const { data: cps } = await supabase.from('checkpoints').select('*').eq('servicio_id', servicioId).order('created_at');
    if (!user) return;

    const { data: activeRondin } = await supabase
      .from('rondines').select('*')
      .eq('guardia_id', user.id).eq('status', 'activo')
      .maybeSingle();

    let scannedMap = new Map<string, { scanned_at: string; foto_url: string | null }>();
    if (activeRondin) {
      setRondinId(activeRondin.id);
      setCheckedIn(true);
      const { data: scans } = await supabase
        .from('rondin_scans').select('checkpoint_id, scanned_at, foto_url')
        .eq('rondin_id', activeRondin.id);
      scannedMap = new Map(scans?.map((s: any) => [s.checkpoint_id, { scanned_at: s.scanned_at, foto_url: s.foto_url }]) || []);
    }

    const mapped = (cps || []).map((cp: any) => {
      const s = scannedMap.get(cp.id);
      return {
        id: cp.id, name: cp.nombre, lat: cp.lat, lng: cp.lng, radius: cp.radius_metros || 50,
        scanned: !!s,
        time: s ? new Date(s.scanned_at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }) : null,
        foto_url: s?.foto_url || null,
      };
    });
    setPoints(mapped);
    const first = mapped.find(p => p.lat && p.lng);
    if (first) setZoneCenter({ lat: first.lat!, lng: first.lng!, radius: first.radius * 10 });
  };

  const handleCheckIn = async () => {
    if (!user || !selectedServicio) return;
    if (checkedIn && rondinId) {
      // Open checkout dialog to request report
      setReporte('');
      setCheckoutOpen(true);
      return;
    }
    let lat: number | null = null, lng: number | null = null;
    try {
      const pos = await getCurrentPositionRobust();
      lat = pos.coords.latitude; lng = pos.coords.longitude;
    } catch (e: any) {
      toast({ title: 'Aviso GPS', description: e?.message || 'Check-in sin coordenadas.' });
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
    setCheckoutOpen(false);
    setCheckedIn(false);
    setRondinId(null);
    setReporte('');
    setPoints(prev => prev.map(p => ({ ...p, scanned: false, time: null, foto_url: null })));
    toast({ title: '✅ Rondín completado', description: 'Reporte guardado correctamente.' });
  };

  const openScanDialog = (checkpoint: CheckpointItem) => {
    setScanTarget(checkpoint);
    setScanFile(null);
    setScanPreview(null);
  };

  const onSelectPhoto = (file: File | null) => {
    if (!file) { setScanFile(null); setScanPreview(null); return; }
    if (file.size > 8 * 1024 * 1024) {
      toast({ title: 'Foto muy grande', description: 'Máximo 8MB.', variant: 'destructive' });
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

    // Upload photo
    const ext = scanFile.name.split('.').pop() || 'jpg';
    const path = `${user.id}/${rondinId}/${scanTarget.id}-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from('evidencias').upload(path, scanFile, { upsert: false });
    if (upErr) {
      toast({ title: 'Error', description: 'No se pudo subir la foto.', variant: 'destructive' });
      setScanning(false);
      return;
    }
    const { data: pub } = supabase.storage.from('evidencias').getPublicUrl(path);
    const foto_url = pub.publicUrl;

    const { error } = await supabase.from('rondin_scans').insert({
      rondin_id: rondinId,
      checkpoint_id: scanTarget.id,
      lat, lng,
      foto_url,
    });
    setScanning(false);
    if (error) {
      toast({ title: 'Error', description: 'No se pudo guardar el escaneo.', variant: 'destructive' });
      return;
    }
    setPoints(prev => prev.map(p => p.id === scanTarget.id
      ? { ...p, scanned: true, time: new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }), foto_url }
      : p));
    const svcName = servicios.find(s => s.id === selectedServicio)?.nombre;
    notifyRondinPunto(user.id, `${user.nombre} ${user.apellido}`, scanTarget.name, svcName, foto_url);
    toast({ title: '✅ Punto confirmado', description: `${scanTarget.name} con evidencia guardada.` });
    setScanTarget(null);
    setScanFile(null);
    setScanPreview(null);
  };

  const scannedCount = points.filter(p => p.scanned).length;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
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
              className={`w-full h-14 text-base font-bold rounded-xl ${
                checkedIn ? 'bg-emergency text-emergency-foreground hover:bg-emergency/90' : 'bg-success text-success-foreground hover:bg-success/90'
              }`}
            >
              <MapPin className="w-5 h-5 mr-2" />
              {checkedIn ? 'Hacer Check-out y enviar reporte' : 'Hacer Check-in'}
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
                    <img src={point.foto_url} alt="Evidencia" className="w-10 h-10 rounded object-cover border border-border" />
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
                <span className="text-sm text-muted-foreground">Tomar / seleccionar foto</span>
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
