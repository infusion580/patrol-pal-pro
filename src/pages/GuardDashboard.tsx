import { useAuth } from '@/lib/auth-context';
import { useNavigate } from 'react-router-dom';
import { MapPin, FileText, MessageCircle, Users, Clock, CheckCircle2, AlertTriangle } from 'lucide-react';
import BottomNav from '@/components/BottomNav';
import EmergencyButton from '@/components/EmergencyButton';

const GuardDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const quickActions = [
    { icon: MapPin, label: 'Iniciar Rondín', desc: 'Check-in con GPS', color: 'bg-primary', path: '/rondines' },
    { icon: FileText, label: 'Reporte de Turno', desc: 'Bitácora digital', color: 'bg-secondary', path: '/reportes' },
    { icon: MessageCircle, label: 'Chat Supervisor', desc: 'Mensajes directos', color: 'bg-success', path: '/chat' },
    { icon: Users, label: 'Chat con RH', desc: 'Canal confidencial', color: 'bg-primary', path: '/chat-rh' },
  ];

  const stats = [
    { icon: CheckCircle2, label: 'Rondines hoy', value: '3/5', color: 'text-success' },
    { icon: Clock, label: 'Turno activo', value: '4h 23m', color: 'text-primary' },
    { icon: AlertTriangle, label: 'Incidencias', value: '0', color: 'text-warning' },
  ];

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="bg-primary text-primary-foreground px-4 pt-12 pb-6 rounded-b-3xl">
        <div className="max-w-lg mx-auto">
          <p className="text-sm opacity-80">Bienvenido de vuelta</p>
          <h1 className="text-2xl font-display font-bold">{user?.nombre} {user?.apellido}</h1>
          <p className="text-xs opacity-70 mt-1 font-mono">#{user?.numeroEmpleado}</p>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 -mt-4">
        {/* Stats */}
        <div className="bg-card rounded-xl p-4 shadow-card mb-6 grid grid-cols-3 gap-3">
          {stats.map(stat => (
            <div key={stat.label} className="text-center">
              <stat.icon className={`w-5 h-5 mx-auto mb-1 ${stat.color}`} />
              <p className="text-lg font-bold text-foreground">{stat.value}</p>
              <p className="text-[10px] text-muted-foreground">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Quick Actions */}
        <h2 className="text-sm font-semibold text-muted-foreground mb-3">Acciones Rápidas</h2>
        <div className="grid grid-cols-2 gap-3 mb-6">
          {quickActions.map(action => (
            <button
              key={action.label}
              onClick={() => navigate(action.path)}
              className="bg-card rounded-xl p-4 shadow-card text-left hover:shadow-elevated transition-shadow active:scale-[0.98]"
            >
              <div className={`w-10 h-10 rounded-lg ${action.color} flex items-center justify-center mb-3`}>
                <action.icon className="w-5 h-5 text-primary-foreground" />
              </div>
              <p className="font-display font-bold text-sm text-foreground">{action.label}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{action.desc}</p>
            </button>
          ))}
        </div>

        {/* Recent Activity */}
        <h2 className="text-sm font-semibold text-muted-foreground mb-3">Actividad Reciente</h2>
        <div className="space-y-2">
          {[
            { time: '14:30', text: 'Rondín completado — Zona Norte', type: 'success' },
            { time: '12:15', text: 'Reporte de turno enviado', type: 'info' },
            { time: '10:00', text: 'Check-in realizado', type: 'info' },
          ].map((activity, i) => (
            <div key={i} className="bg-card rounded-lg p-3 shadow-card flex items-center gap-3">
              <div className={`w-2 h-2 rounded-full ${activity.type === 'success' ? 'bg-success' : 'bg-primary'}`} />
              <div className="flex-1">
                <p className="text-sm text-foreground">{activity.text}</p>
              </div>
              <span className="text-xs text-muted-foreground font-mono">{activity.time}</span>
            </div>
          ))}
        </div>
      </div>

      <EmergencyButton />
      <BottomNav />
    </div>
  );
};

export default GuardDashboard;
