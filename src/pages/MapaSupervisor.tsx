import { useState, useEffect, lazy, Suspense } from 'react';

import { supabase } from '@/integrations/supabase/client';
import BottomNav from '@/components/BottomNav';
import AppHeader from '@/components/AppHeader';

const statusLabels: Record<string, string> = {
  activo: 'En Ronda',
  completado: 'Completado',
  inactivo: 'Sin señal reciente',
};

const FRESH_MINUTES = 5;

interface Guard {
  id: string;
  nombre: string;
  status: string;
  lat: number;
  lng: number;
  lastSeen: string;
  ageMinutes: number;
  fresh: boolean;
}

const MapView = lazy(() => import('@/components/MapView'));

const MapaSupervisor = () => {
  const [guards, setGuards] = useState<Guard[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadGuards();
    const t = setInterval(loadGuards, 60000); // recalcular "hace X min" cada minuto
    return () => clearInterval(t);
  }, []);

  // Realtime: refresh when rondines change
  useEffect(() => {
    const channel = supabase
      .channel('rondines-map-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rondines' }, () => {
        loadGuards();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const loadGuards = async () => {
    const today = new Date().toISOString().split('T')[0];
    const { data: rondines } = await supabase
      .from('rondines')
      .select('guardia_id, status, checkin_lat, checkin_lng, created_at')
      .gte('created_at', today)
      .order('created_at', { ascending: false });

    if (rondines && rondines.length > 0) {
      const guardIds = [...new Set(rondines.map(r => r.guardia_id))];
      const { data: profiles } = await supabase.from('profiles').select('user_id, nombre, apellido').in('user_id', guardIds);
      const profileMap = new Map((profiles || []).map(p => [p.user_id, `${p.nombre} ${p.apellido}`] as const));

      const seen = new Set<string>();
      const now = Date.now();
      setGuards(rondines
        .filter(r => { if (seen.has(r.guardia_id)) return false; seen.add(r.guardia_id); return true; })
        .filter(r => r.checkin_lat && r.checkin_lng)
        .map(r => {
          const ageMinutes = Math.floor((now - new Date(r.created_at).getTime()) / 60000);
          const fresh = ageMinutes <= FRESH_MINUTES;
          return {
            id: r.guardia_id,
            nombre: profileMap.get(r.guardia_id) || 'Guardia',
            status: fresh ? r.status : 'inactivo',
            lat: r.checkin_lat!,
            lng: r.checkin_lng!,
            lastSeen: r.created_at,
            ageMinutes,
            fresh,
          };
        })
      );
    }
    setLoading(false);
  };


  return (
    <div className="min-h-dvh bg-background pb-20">
      <AppHeader
        showBack
        backLabel="Regresar"
        title="Mapa en Tiempo Real"
        subtitle={`${guards.length} elementos activos`}
      />

      <div className="max-w-lg mx-auto px-4 -mt-4">
        <div className="bg-card rounded-xl shadow-card overflow-hidden mb-6">
          {loading ? (
            <div className="h-72 flex items-center justify-center">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <Suspense fallback={<div className="h-72 flex items-center justify-center"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div>}>
              <MapView guards={guards} />
            </Suspense>
          )}
        </div>

        <div className="flex items-center gap-4 mb-4 px-1 flex-wrap">
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-success" />
            <span className="text-xs text-muted-foreground">En Ronda</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-primary" />
            <span className="text-xs text-muted-foreground">Completado</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-muted-foreground/50" />
            <span className="text-xs text-muted-foreground">Sin señal &gt; {FRESH_MINUTES} min</span>
          </div>
        </div>

        <h2 className="text-sm font-semibold text-muted-foreground mb-3">Ubicación de Elementos</h2>
        <div className="space-y-2">
          {guards.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">Sin guardias activos hoy</p>
          )}
          {guards.map(guard => {
            const dotColor = !guard.fresh
              ? 'bg-muted-foreground/50'
              : guard.status === 'activo' ? 'bg-success' : 'bg-primary';
            const ageLabel = guard.ageMinutes < 1 ? 'ahora' : `hace ${guard.ageMinutes} min`;
            return (
              <div key={guard.id} className={`bg-card rounded-xl p-4 shadow-card flex items-center gap-3 ${!guard.fresh ? 'opacity-70' : ''}`}>
                <div className={`w-3 h-3 rounded-full ${dotColor}`} />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-foreground">{guard.nombre}</p>
                  <p className="text-xs text-muted-foreground">{guard.lat.toFixed(4)}, {guard.lng.toFixed(4)} • {ageLabel}</p>
                </div>
                <span className="text-xs text-muted-foreground">{statusLabels[guard.status] || guard.status}</span>
              </div>
            );
          })}
        </div>

      </div>

      <BottomNav />
    </div>
  );
};

export default MapaSupervisor;
