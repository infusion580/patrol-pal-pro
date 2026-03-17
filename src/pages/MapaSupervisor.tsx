import { useState, useEffect } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import BottomNav from '@/components/BottomNav';

// Fix default marker icons for Leaflet + bundlers
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

const createColorIcon = (color: string) =>
  new L.DivIcon({
    className: '',
    html: `<div style="width:16px;height:16px;border-radius:50%;background:${color};border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,.35)"></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
    popupAnchor: [0, -12],
  });

const icons: Record<string, L.DivIcon> = {
  activo: createColorIcon('#22c55e'),
  completado: createColorIcon('hsl(var(--primary))'),
};

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

function FitBounds({ guards }: { guards: Guard[] }) {
  const map = useMap();
  useEffect(() => {
    if (guards.length === 0) return;
    const bounds = L.latLngBounds(guards.map(g => [g.lat, g.lng]));
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
  }, [guards, map]);
  return null;
}

const MapaSupervisor = () => {
  const navigate = useNavigate();
  const [guards, setGuards] = useState<Guard[]>([]);

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
  };

  const defaultCenter: [number, number] = [19.4326, -99.1332]; // CDMX

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
          <MapContainer
            center={defaultCenter}
            zoom={12}
            className="h-72 w-full z-0"
            scrollWheelZoom={true}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <FitBounds guards={guards} />
            {guards.map(g => (
              <Marker key={g.id} position={[g.lat, g.lng]} icon={icons[g.status] || icons.activo}>
                <Popup>
                  <strong>{g.nombre}</strong><br />
                  {statusLabels[g.status] || g.status}<br />
                  <span className="text-xs">{g.lat.toFixed(4)}, {g.lng.toFixed(4)}</span>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
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
