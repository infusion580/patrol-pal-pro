import { useAuth } from '@/lib/auth-context';
import { useNavigate } from 'react-router-dom';
import { Users, CheckCircle2, AlertTriangle, Clock, MapPin, FileText, MessageCircle, BarChart3 } from 'lucide-react';
import BottomNav from '@/components/BottomNav';

const guards = [
  { id: '1', nombre: 'Carlos López', empleado: 'EMP001', status: 'en_ronda', sitio: 'Plaza Central', lastUpdate: '14:32' },
  { id: '2', nombre: 'Pedro Martínez', empleado: 'EMP002', status: 'en_descanso', sitio: 'Torre Norte', lastUpdate: '14:15' },
  { id: '3', nombre: 'Ana Rodríguez', empleado: 'EMP003', status: 'en_ronda', sitio: 'Parque Industrial', lastUpdate: '14:28' },
  { id: '4', nombre: 'Luis Hernández', empleado: 'EMP004', status: 'en_incidencia', sitio: 'Centro Comercial', lastUpdate: '14:10' },
];

const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
  en_ronda: { label: 'En Ronda', color: 'text-success', bg: 'bg-success/10' },
  en_descanso: { label: 'Descanso', color: 'text-warning', bg: 'bg-warning/10' },
  en_incidencia: { label: 'Incidencia', color: 'text-emergency', bg: 'bg-emergency/10' },
};

const SupervisorDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const metrics = [
    { icon: Users, label: 'Guardias Activos', value: '4', color: 'text-primary' },
    { icon: CheckCircle2, label: 'Rondines Completos', value: '12/18', color: 'text-success' },
    { icon: AlertTriangle, label: 'Alertas', value: '1', color: 'text-emergency' },
    { icon: Clock, label: 'Tiempo Resp.', value: '2.3m', color: 'text-warning' },
  ];

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="bg-primary text-primary-foreground px-4 pt-12 pb-6 rounded-b-3xl">
        <div className="max-w-lg mx-auto">
          <p className="text-sm opacity-80">Panel de Supervisor</p>
          <h1 className="text-2xl font-display font-bold">{user?.nombre} {user?.apellido}</h1>
          <p className="text-xs opacity-70 mt-1 font-mono">#{user?.numeroEmpleado}</p>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 -mt-4">
        {/* Metrics Grid */}
        <div className="bg-card rounded-xl p-4 shadow-card mb-6 grid grid-cols-2 gap-4">
          {metrics.map(m => (
            <div key={m.label} className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-accent flex items-center justify-center">
                <m.icon className={`w-5 h-5 ${m.color}`} />
              </div>
              <div>
                <p className="text-lg font-bold text-foreground">{m.value}</p>
                <p className="text-[10px] text-muted-foreground">{m.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-3 gap-2 mb-6">
          {[
            { icon: MapPin, label: 'Mapa', path: '/mapa' },
            { icon: FileText, label: 'Reportes', path: '/reportes-supervisor' },
            { icon: BarChart3, label: 'Métricas', path: '/metricas' },
          ].map(a => (
            <button
              key={a.label}
              onClick={() => navigate(a.path)}
              className="bg-card rounded-xl p-3 shadow-card flex flex-col items-center gap-2 hover:shadow-elevated transition-shadow active:scale-[0.98]"
            >
              <a.icon className="w-5 h-5 text-primary" />
              <span className="text-xs font-semibold text-foreground">{a.label}</span>
            </button>
          ))}
        </div>

        {/* Guards List */}
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-muted-foreground">Elementos Activos</h2>
          <span className="text-xs text-primary font-semibold">{guards.length} en turno</span>
        </div>
        <div className="space-y-2">
          {guards.map(guard => {
            const status = statusConfig[guard.status];
            return (
              <div key={guard.id} className="bg-card rounded-xl p-4 shadow-card flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-sm font-bold text-primary">{guard.nombre.split(' ').map(n => n[0]).join('')}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-foreground">{guard.nombre}</p>
                  <p className="text-xs text-muted-foreground">{guard.sitio}</p>
                </div>
                <div className="text-right">
                  <span className={`text-xs font-semibold px-2 py-1 rounded-full ${status.bg} ${status.color}`}>
                    {status.label}
                  </span>
                  <p className="text-[10px] text-muted-foreground mt-1 font-mono">{guard.lastUpdate}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <BottomNav />
    </div>
  );
};

export default SupervisorDashboard;
