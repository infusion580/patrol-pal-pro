import { useState, useEffect, lazy, Suspense } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import BottomNav from '@/components/BottomNav';

const statusLabels: Record<string, string> = {
  activo: 'En Ronda',
  completado: 'Completado',
};

interface Guard {
  id: string;
  nombre: string;
  status: string;
  lat: number;
  lng: number;
}

const MapView = lazy(() => import('@/components/MapView'));

const MapaSupervisor = () => {
  const navigate = useNavigate();
  const [guards, setGuards] = useState<Guard[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadGuards(); }, []);

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
      .select('guardia_id, status, checkin_lat, checkin_lng')
      .gte('created_at', today)
      .order('created_at', { ascending: false });

    if (rondines && rondines.length > 0) {
      const guardIds = [...new Set(rondines.map(r => r.guardia_id))];
      const { data: profiles } = await supabase.from('profiles').select('user_id, nombre, apellido').in('user_id', guardIds);
      const profileMap = new Map((profiles || []).map(p => [p.user_id, `${p.nombre} ${p.apellido}`] as const));

      const seen = new Set<string>();
      setGuards(rondines
        .filter(r => { if (seen.has(r.guardia_id)) return false; seen.add(r.guardia_id); return true; })
        .filter(r => r.checkin_lat && r.checkin_lng)
        .map(r => ({
          id: r.guardia_id,
          nombre: profileMap.get(r.guardia_id) || 'Guardia',
          status: r.status,
          lat: r.checkin_lat!,
          lng: r.checkin_lng!,
        }))
      );
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="bg-primary text-primary-foreground px-4 pt-12 pb-6 rounded-b-3xl">
        <div className="max-w-lg mx-auto">
          <button onClick={() => navigate('/dashboard')} className="flex items-center gap-1 text-sm opacity-80 mb-2">
            <ArrowLeft className="w-4 h-4" /> Regresar
          </button>
          <h1 className="text-xl font-display font-bold">Mapa en Tiempo Real</h1>
          <p className="text-sm opacity-70 mt-1">{guards.length} elementos activos</p>
        </div>
      </div>

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

        <div className="flex items-center gap-4 mb-4 px-1">
          {Object.entries(statusLabels).map(([key, label]) => (
            <div key={key} className="flex items-center gap-1.5">
              <div className={`w-2.5 h-2.5 rounded-full ${key === 'activo' ? 'bg-success' : 'bg-primary'}`} />
              <span className="text-xs text-muted-foreground">{label}</span>
            </div>
          ))}
        </div>

        <h2 className="text-sm font-semibold text-muted-foreground mb-3">Ubicación de Elementos</h2>
        <div className="space-y-2">
          {guards.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">Sin guardias activos hoy</p>
          )}
          {guards.map(guard => (
            <div key={guard.id} className="bg-card rounded-xl p-4 shadow-card flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${guard.status === 'activo' ? 'bg-success' : 'bg-primary'}`} />
              <div className="flex-1">
                <p className="text-sm font-semibold text-foreground">{guard.nombre}</p>
                <p className="text-xs text-muted-foreground">{guard.lat.toFixed(4)}, {guard.lng.toFixed(4)}</p>
              </div>
              <span className="text-xs text-muted-foreground">{statusLabels[guard.status] || guard.status}</span>
            </div>
          ))}
        </div>
      </div>

      <BottomNav />
    </div>
  );
};

export default MapaSupervisor;
