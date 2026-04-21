import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useNavigate } from 'react-router-dom';
import { MapPin, FileText, MessageCircle, Users, Clock, CheckCircle2, AlertTriangle, ClipboardList, History, Trophy } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import BottomNav from '@/components/BottomNav';
import EmergencyButton from '@/components/EmergencyButton';
import ShiftControl from '@/components/ShiftControl';
import DailyProgress from '@/components/DailyProgress';
import AppHeader from '@/components/AppHeader';

const GuardDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [rondinesHoy, setRondinesHoy] = useState('0');
  const [incidencias, setIncidencias] = useState('0');
  const [recentActivity, setRecentActivity] = useState<Array<{time: string;text: string;type: string;}>>([]);

  useEffect(() => {
    if (!user) return;
    loadStats();
  }, [user]);

  const loadStats = async () => {
    if (!user) return;
    const today = new Date().toISOString().split('T')[0];

    // Count today's rondines
    const { count: rCount } = await supabase.
    from('rondines').
    select('*', { count: 'exact', head: true }).
    eq('guardia_id', user.id).
    gte('created_at', today);
    setRondinesHoy(String(rCount || 0));

    // Count today's reportes with incidents
    const { data: reportes } = await supabase.
    from('reportes_turno').
    select('incidencias').
    eq('guardia_id', user.id).
    gte('created_at', today);
    const incCount = reportes?.filter((r) => r.incidencias.trim().length > 0).length || 0;
    setIncidencias(String(incCount));

    // Recent activity from rondines
    const { data: recentRondines } = await supabase.
    from('rondines').
    select('created_at, status').
    eq('guardia_id', user.id).
    order('created_at', { ascending: false }).
    limit(5);

    const activity = (recentRondines || []).map((r) => ({
      time: new Date(r.created_at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }),
      text: r.status === 'completado' ? 'Rondín completado' : r.status === 'activo' ? 'Check-in realizado' : 'Rondín cancelado',
      type: r.status === 'completado' ? 'success' : 'info'
    }));
    setRecentActivity(activity);
  };

  const quickActions = [
  { icon: MapPin, label: 'Iniciar Rondín', desc: 'Check-in con GPS', color: 'bg-primary', path: '/rondines' },
  { icon: FileText, label: 'Reporte de Turno', desc: 'Bitácora digital', color: 'bg-secondary', path: '/reportes' },
  { icon: ClipboardList, label: 'Visitas', desc: 'Control de acceso', color: 'bg-warning', path: '/visitas' },
  { icon: MessageCircle, label: 'Chat Supervisor', desc: 'Mensajes directos', color: 'bg-success', path: '/chat' },
  { icon: History, label: 'Mi Historial', desc: 'Actividad completa', color: 'bg-accent', path: '/historial' },
  { icon: Trophy, label: 'Cuadro de Honor', desc: 'Top guardias', color: 'bg-warning', path: '/cuadro-honor' }];


  const stats = [
  { icon: CheckCircle2, label: 'Rondines hoy', value: rondinesHoy, color: 'text-success' },
  { icon: Clock, label: 'Turno activo', value: '—', color: 'text-primary' },
  { icon: AlertTriangle, label: 'Incidencias', value: incidencias, color: 'text-warning' }];


  return (
    <div className="min-h-screen bg-background pb-20">
      <AppHeader
        eyebrow="Bienvenido de vuelta"
        title={`${user?.nombre ?? ''} ${user?.apellido ?? ''}`.trim()}
        subtitle={user?.numeroEmpleado ? `#${user.numeroEmpleado}` : undefined}
      />

      <div className="max-w-lg mx-auto px-4 -mt-4">
        <div className="bg-card rounded-xl p-4 shadow-card mb-6 grid grid-cols-3 gap-3">
          {stats.map((stat) =>
          <div key={stat.label} className="text-center">
              <stat.icon className={`w-5 h-5 mx-auto mb-1 ${stat.color}`} />
              <p className="text-lg font-bold text-foreground">{stat.value}</p>
              <p className="text-[10px] text-muted-foreground">{stat.label}</p>
            </div>
          )}
        </div>

        <ShiftControl />

        <DailyProgress />

        <h2 className="text-sm font-semibold text-muted-foreground mb-3">Acciones Rápidas</h2>
        <div className="grid grid-cols-2 gap-3 mb-6">
          {quickActions.map((action) =>
          <button key={action.label} onClick={() => navigate(action.path)} className="bg-card rounded-xl p-4 shadow-card text-left hover:shadow-elevated transition-shadow active:scale-[0.98]">
              <div className={`w-10 h-10 rounded-lg ${action.color} flex items-center justify-center mb-3`}>
                <action.icon className="w-5 h-5 text-primary-foreground" />
              </div>
              <p className="font-display font-bold text-sm text-foreground">{action.label}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{action.desc}</p>
            </button>
          )}
        </div>

        <h2 className="text-sm font-semibold text-muted-foreground mb-3">Actividad Reciente</h2>
        <div className="space-y-2">
          {recentActivity.length === 0 &&
          <p className="text-sm text-muted-foreground text-center py-4">Sin actividad reciente</p>
          }
          {recentActivity.map((activity, i) =>
          <div key={i} className="bg-card rounded-lg p-3 shadow-card flex items-center gap-3">
              <div className={`w-2 h-2 rounded-full ${activity.type === 'success' ? 'bg-success' : 'bg-primary'}`} />
              <div className="flex-1">
                <p className="text-sm text-foreground">{activity.text}</p>
              </div>
              <span className="text-xs text-muted-foreground font-mono">{activity.time}</span>
            </div>
          )}
        </div>
      </div>

      <EmergencyButton />
      <BottomNav />
    </div>);

};

export default GuardDashboard;