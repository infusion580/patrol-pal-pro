import { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, MapPin, QrCode, CheckCircle2, Clock, Navigation } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth-context';
import BottomNav from '@/components/BottomNav';
import EmergencyButton from '@/components/EmergencyButton';
import { useZoneMonitor } from '@/hooks/use-zone-monitor';
import { useToast } from '@/hooks/use-toast';
import { notifyRondinRegistro } from '@/lib/notification-helpers';

interface CheckpointItem {
  id: string;
  name: string;
  scanned: boolean;
  time: string | null;
  lat: number | null;
  lng: number | null;
  radius: number;
}

function getDistanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371e3;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Robust GPS getter: tries high-accuracy first, falls back to low-accuracy with cached position.
 * Returns position or throws an Error with a user-friendly message.
 */
async function getCurrentPositionRobust(): Promise<GeolocationPosition> {
  if (!('geolocation' in navigator)) {
    throw new Error('Tu dispositivo no soporta geolocalización.');
  }

  // Check permission state if available (not supported on all browsers)
  try {
    if ('permissions' in navigator) {
      const status = await (navigator as any).permissions.query({ name: 'geolocation' });
      if (status.state === 'denied') {
        throw new Error('Permiso de ubicación denegado. Habilítalo en los ajustes del navegador para este sitio.');
      }
    }
  } catch (e: any) {
    if (e?.message?.includes('denegado')) throw e;
    // ignore — permissions API not available
  }

  const tryGet = (opts: PositionOptions) =>
    new Promise<GeolocationPosition>((resolve, reject) =>
      navigator.geolocation.getCurrentPosition(resolve, reject, opts)
    );

  try {
    // First attempt: high accuracy, allow recent cached fix (up to 10s)
    return await tryGet({ enableHighAccuracy: true, timeout: 12000, maximumAge: 10000 });
  } catch (err: any) {
    if (err?.code === 1) {
      throw new Error('Permiso de ubicación denegado. Habilítalo en los ajustes del navegador.');
    }
    // Fallback: lower accuracy, accept older cache (up to 60s) — works better indoors
    try {
      return await tryGet({ enableHighAccuracy: false, timeout: 15000, maximumAge: 60000 });
    } catch (err2: any) {
      if (err2?.code === 1) {
        throw new Error('Permiso de ubicación denegado. Habilítalo en los ajustes del navegador.');
      }
      if (err2?.code === 2) {
        throw new Error('GPS no disponible. Verifica que la ubicación esté activada y tengas señal.');
      }
      if (err2?.code === 3) {
        throw new Error('Tiempo agotado al obtener GPS. Sal a un área abierta e inténtalo de nuevo.');
      }
      throw new Error('No se pudo obtener tu ubicación. Inténtalo de nuevo.');
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
  const [scanning, setScanning] = useState<string | null>(null);
  const [servicios, setServicios] = useState<Array<{ id: string; nombre: string }>>([]);
  const [selectedServicio, setSelectedServicio] = useState<string | null>(null);
  const [zoneCenter, setZoneCenter] = useState<{ lat: number; lng: number; radius: number } | undefined>();

  // Monitor zone exit using first checkpoint as zone center
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

    if (user) {
      const { data: activeRondin } = await supabase
        .from('rondines').select('*')
        .eq('guardia_id', user.id).eq('status', 'activo')
        .maybeSingle();

      if (activeRondin) {
        setRondinId(activeRondin.id);
        setCheckedIn(true);

        const { data: scans } = await supabase
          .from('rondin_scans').select('checkpoint_id, scanned_at')
          .eq('rondin_id', activeRondin.id);

        const scannedMap = new Map(scans?.map((s) => [s.checkpoint_id, s.scanned_at]) || []);

        const mapped = (cps || []).map((cp: any) => ({
          id: cp.id, name: cp.nombre, lat: cp.lat, lng: cp.lng, radius: cp.radius_metros || 50,
          scanned: scannedMap.has(cp.id),
          time: scannedMap.has(cp.id)
            ? new Date(scannedMap.get(cp.id)!).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
            : null,
        }));
        setPoints(mapped);
        // Set zone center from first checkpoint with coordinates
        const first = mapped.find(p => p.lat && p.lng);
        if (first) setZoneCenter({ lat: first.lat!, lng: first.lng!, radius: first.radius * 10 });
      } else {
        const mapped = (cps || []).map((cp: any) => ({
          id: cp.id, name: cp.nombre, lat: cp.lat, lng: cp.lng, radius: cp.radius_metros || 50,
          scanned: false, time: null,
        }));
        setPoints(mapped);
        const first = mapped.find(p => p.lat && p.lng);
        if (first) setZoneCenter({ lat: first.lat!, lng: first.lng!, radius: first.radius * 10 });
      }
    }
  };

  const handleCheckIn = async () => {
    if (!user || !selectedServicio) return;
    if (checkedIn && rondinId) {
      await supabase.from('rondines').update({ status: 'completado', checkout_at: new Date().toISOString() }).eq('id', rondinId);
      setCheckedIn(false);
      setRondinId(null);
      setPoints((prev) => prev.map((p) => ({ ...p, scanned: false, time: null })));
    } else {
      // Get current position for check-in
      let lat: number | null = null;
      let lng: number | null = null;
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
          navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 10000 })
        );
        lat = pos.coords.latitude;
        lng = pos.coords.longitude;
      } catch { /* continue without GPS */ }

      const { data, error } = await supabase.from('rondines').insert({
        guardia_id: user.id,
        servicio_id: selectedServicio,
        checkin_at: new Date().toISOString(),
        checkin_lat: lat,
        checkin_lng: lng,
      }).select().single();

      if (data) {
        setRondinId(data.id);
        setCheckedIn(true);
        const svcName = servicios.find(s => s.id === selectedServicio)?.nombre;
        notifyRondinRegistro(user.id, `${user.nombre} ${user.apellido}`, svcName);
      }
    }
  };

  const handleScan = async (checkpoint: CheckpointItem) => {
    if (!rondinId) return;
    setScanning(checkpoint.id);

    // Verify GPS proximity if checkpoint has coordinates
    if (checkpoint.lat && checkpoint.lng) {
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
          navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 15000 })
        );
        const dist = getDistanceMeters(pos.coords.latitude, pos.coords.longitude, checkpoint.lat, checkpoint.lng);
        if (dist > checkpoint.radius) {
          toast({
            title: '❌ Fuera de rango',
            description: `Estás a ${Math.round(dist)}m del punto. Debes estar a menos de ${checkpoint.radius}m para confirmar.`,
            variant: 'destructive',
          });
          setScanning(null);
          return;
        }

        // Save scan with GPS
        const { error } = await supabase.from('rondin_scans').insert({
          rondin_id: rondinId,
          checkpoint_id: checkpoint.id,
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
        if (!error) {
          setPoints((prev) => prev.map((p) =>
            p.id === checkpoint.id
              ? { ...p, scanned: true, time: new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }) }
              : p
          ));
          toast({ title: '✅ Punto confirmado', description: `${checkpoint.name} verificado a ${Math.round(dist)}m.` });
        }
      } catch {
        toast({ title: 'Error GPS', description: 'No se pudo obtener tu ubicación. Activa el GPS.', variant: 'destructive' });
      }
    } else {
      // No coordinates configured, allow scan without GPS check
      const { error } = await supabase.from('rondin_scans').insert({
        rondin_id: rondinId,
        checkpoint_id: checkpoint.id,
      });
      if (!error) {
        setPoints((prev) => prev.map((p) =>
          p.id === checkpoint.id
            ? { ...p, scanned: true, time: new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }) }
            : p
        ));
      }
    }
    setScanning(null);
  };

  const scannedCount = points.filter((p) => p.scanned).length;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="text-primary-foreground px-4 pt-12 pb-6 rounded-b-3xl bg-destructive">
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
              {checkedIn ? 'Hacer Check-out' : 'Hacer Check-in'}
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
                        <Navigation className="w-3 h-3" /> GPS requerido (r:{point.radius}m)
                      </p>
                    )}
                  </div>
                  {!point.scanned && checkedIn && (
                    <Button
                      size="sm"
                      onClick={() => handleScan(point)}
                      disabled={scanning === point.id}
                      className="text-xs h-8"
                    >
                      {scanning === point.id ? 'Verificando...' : 'Confirmar'}
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <EmergencyButton />
      <BottomNav />
    </div>
  );
};

export default Rondines;
