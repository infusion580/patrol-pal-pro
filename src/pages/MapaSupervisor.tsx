import { ArrowLeft, MapPin, Users, AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import BottomNav from '@/components/BottomNav';

const guards = [
  { id: '1', nombre: 'Carlos López', status: 'en_ronda', lat: 19.43, lng: -99.13 },
  { id: '2', nombre: 'Pedro Martínez', status: 'en_descanso', lat: 19.44, lng: -99.14 },
  { id: '3', nombre: 'Ana Rodríguez', status: 'en_ronda', lat: 19.42, lng: -99.12 },
  { id: '4', nombre: 'Luis Hernández', status: 'en_incidencia', lat: 19.45, lng: -99.15 },
];

const statusColors: Record<string, string> = {
  en_ronda: 'bg-success',
  en_descanso: 'bg-warning',
  en_incidencia: 'bg-emergency',
};

const statusLabels: Record<string, string> = {
  en_ronda: 'En Ronda',
  en_descanso: 'Descanso',
  en_incidencia: 'Incidencia',
};

const MapaSupervisor = () => {
  const navigate = useNavigate();

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
        {/* Map placeholder */}
        <div className="bg-card rounded-xl shadow-card overflow-hidden mb-6">
          <div className="h-64 bg-accent flex items-center justify-center relative">
            <div className="text-center">
              <MapPin className="w-12 h-12 text-primary/30 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground font-semibold">Mapa Interactivo</p>
              <p className="text-xs text-muted-foreground">Integración con Google Maps / Mapbox</p>
            </div>
            {/* Simulated pins */}
            {guards.map((g, i) => (
              <div
                key={g.id}
                className={`absolute w-4 h-4 rounded-full ${statusColors[g.status]} border-2 border-card shadow-sm`}
                style={{ top: `${30 + i * 15}%`, left: `${20 + i * 18}%` }}
              />
            ))}
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 mb-4 px-1">
          {Object.entries(statusLabels).map(([key, label]) => (
            <div key={key} className="flex items-center gap-1.5">
              <div className={`w-2.5 h-2.5 rounded-full ${statusColors[key]}`} />
              <span className="text-xs text-muted-foreground">{label}</span>
            </div>
          ))}
        </div>

        {/* Guards List */}
        <h2 className="text-sm font-semibold text-muted-foreground mb-3">Ubicación de Elementos</h2>
        <div className="space-y-2">
          {guards.map(guard => (
            <div key={guard.id} className="bg-card rounded-xl p-4 shadow-card flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${statusColors[guard.status]}`} />
              <div className="flex-1">
                <p className="text-sm font-semibold text-foreground">{guard.nombre}</p>
                <p className="text-xs text-muted-foreground">
                  {guard.lat.toFixed(4)}, {guard.lng.toFixed(4)}
                </p>
              </div>
              <span className="text-xs text-muted-foreground">{statusLabels[guard.status]}</span>
            </div>
          ))}
        </div>
      </div>

      <BottomNav />
    </div>
  );
};

export default MapaSupervisor;
