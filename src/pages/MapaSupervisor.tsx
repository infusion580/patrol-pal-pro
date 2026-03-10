import { useState, useEffect } from 'react';
import { ArrowLeft, MapPin } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import BottomNav from '@/components/BottomNav';

const statusColors: Record<string, string> = {
  activo: 'bg-success',
  completado: 'bg-primary',
};

const statusLabels: Record<string, string> = {
  activo: 'En Ronda',
  completado: 'Completado',
};

const MapaSupervisor = () => {
  const navigate = useNavigate();
  const [guards, setGuards] = useState<Array<{ id: string; nombre: string; status: string; lat: number; lng: number }>>([]);

  useEffect(() => { loadGuards(); }, []);

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
        .map(r => ({
          id: r.guardia_id,
          nombre: profileMap.get(r.guardia_id) || 'Guardia',
          status: r.status,
          lat: r.checkin_lat || 19.43,
          lng: r.checkin_lng || -99.13,
        }))
      );
    }
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
          <div className="h-64 bg-accent flex items-center justify-center relative">
            <div className="text-center">
              <MapPin className="w-12 h-12 text-primary/30 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground font-semibold">Mapa Interactivo</p>
              <p className="text-xs text-muted-foreground">Integración con Google Maps / Mapbox</p>
            </div>
            {guards.map((g, i) => (
              <div
                key={g.id}
                className={`absolute w-4 h-4 rounded-full ${statusColors[g.status] || 'bg-primary'} border-2 border-card shadow-sm`}
                style={{ top: `${30 + i * 15}%`, left: `${20 + i * 18}%` }}
              />
            ))}
          </div>
        </div>

        <div className="flex items-center gap-4 mb-4 px-1">
          {Object.entries(statusLabels).map(([key, label]) => (
            <div key={key} className="flex items-center gap-1.5">
              <div className={`w-2.5 h-2.5 rounded-full ${statusColors[key]}`} />
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
              <div className={`w-3 h-3 rounded-full ${statusColors[guard.status] || 'bg-primary'}`} />
              <div className="flex-1">
                <p className="text-sm font-semibold text-foreground">{guard.nombre}</p>
                <p className="text-xs text-muted-foreground">
                  {guard.lat.toFixed(4)}, {guard.lng.toFixed(4)}
                </p>
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
