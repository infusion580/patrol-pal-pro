import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useNavigate } from 'react-router-dom';
import { Users, CheckCircle2, AlertTriangle, Clock, MapPin, FileText, BarChart3, Settings, Bell, UserCog, Target, Trophy, ClipboardList } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import BottomNav from '@/components/BottomNav';
import UnreadMessagesBanner from '@/components/UnreadMessagesBanner';
import UnreadAlertsBanner from '@/components/UnreadAlertsBanner';
import { useBrandLogo } from '@/lib/branding';

const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
  activo: { label: 'En Ronda', color: 'text-success', bg: 'bg-success/10' },
  completado: { label: 'Completado', color: 'text-primary', bg: 'bg-primary/10' },
};

const SupervisorDashboard = () => {
  const logoDefender = useBrandLogo();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [guardiasCount, setGuardiasCount] = useState('0');
  const [rondinesCount, setRondinesCount] = useState('0');
  const [alertasCount, setAlertasCount] = useState('0');
  const [guards, setGuards] = useState<Array<{ id: string; nombre: string; empleado: string; status: string; sitio: string; lastUpdate: string }>>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    // Count guardias
    const { data: guardiaRoles } = await supabase.from('user_roles').select('user_id').eq('role', 'guardia');
    setGuardiasCount(String(guardiaRoles?.length || 0));

    // Today's rondines
    const today = new Date().toISOString().split('T')[0];
    const { count } = await supabase.from('rondines').select('*', { count: 'exact', head: true }).gte('created_at', today);
    setRondinesCount(String(count || 0));

    // Emergencias not attended
    const { count: emergCount } = await supabase.from('emergencias').select('*', { count: 'exact', head: true }).eq('atendida', false);
    setAlertasCount(String(emergCount || 0));

    // Active rondines with guard profiles
    const { data: activeRondines } = await supabase
      .from('rondines')
      .select('id, guardia_id, status, created_at, servicio_id')
      .gte('created_at', today)
      .order('created_at', { ascending: false })
      .limit(10);

    if (activeRondines && activeRondines.length > 0) {
      const guardIds = [...new Set(activeRondines.map(r => r.guardia_id))];
      const { data: profiles } = await supabase.from('profiles').select('*').in('user_id', guardIds);
      
      const servicioIds = activeRondines.map(r => r.servicio_id).filter(Boolean) as string[];
      const { data: svcData } = servicioIds.length > 0
        ? await supabase.from('servicios').select('id, nombre').in('id', servicioIds)
        : { data: [] };

      const profileMap = new Map((profiles || []).map(p => [p.user_id, p] as const));
      const svcMap = new Map((svcData || []).map(s => [s.id, s.nombre] as const));

      const seen = new Set<string>();
      const guardList = activeRondines
        .filter(r => { if (seen.has(r.guardia_id)) return false; seen.add(r.guardia_id); return true; })
        .map(r => {
          const p = profileMap.get(r.guardia_id);
          return {
            id: r.guardia_id,
            nombre: p ? `${p.nombre} ${p.apellido}` : 'Guardia',
            empleado: p?.numero_empleado || '',
            status: r.status,
            sitio: r.servicio_id ? (svcMap.get(r.servicio_id) || '') : '' as string,
            lastUpdate: new Date(r.created_at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }),
          };
        });
      setGuards(guardList);
    }
  };

  const metrics = [
    { icon: Users, label: 'Guardias', value: guardiasCount, color: 'text-primary' },
    { icon: CheckCircle2, label: 'Rondines Hoy', value: rondinesCount, color: 'text-success' },
    { icon: AlertTriangle, label: 'Alertas', value: alertasCount, color: 'text-emergency' },
    { icon: Clock, label: 'Tiempo Resp.', value: '—', color: 'text-warning' },
  ];

  return (
    <div className="min-h-dvh bg-background pb-20">
      <div className="text-primary-foreground px-4 pt-12 pb-6 rounded-b-3xl app-header">
        <div className="max-w-lg mx-auto flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-xs uppercase tracking-[0.18em] text-primary font-bold">Panel de Supervisor</p>
            <h1 className="text-2xl font-display font-bold uppercase truncate">{user?.nombre} {user?.apellido}</h1>
            <p className="text-xs opacity-70 mt-1 font-mono">#{user?.numeroEmpleado}</p>
          </div>
          <div className="shrink-0 flex items-center">
            <img
              src={logoDefender}
              alt="Defender Seguridad Privada"
              className="w-auto object-contain drop-shadow-[0_4px_12px_hsl(0_82%_52%/0.45)]"
              style={{ height: 'clamp(2rem, 7vw, 3rem)' }}
            />
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 -mt-4">
        <UnreadMessagesBanner />

        <UnreadAlertsBanner />
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

        <div className="grid grid-cols-3 gap-2 mb-6">
          {[
            { icon: MapPin, label: 'Mapa', path: '/mapa' },
            { icon: FileText, label: 'Reportes', path: '/reportes-supervisor' },
            { icon: BarChart3, label: 'Métricas', path: '/metricas' },
            { icon: Settings, label: 'Servicios', path: '/servicios' },
            { icon: Bell, label: 'Alertas', path: '/notificaciones' },
            { icon: UserCog, label: 'Gestión RH', path: '/gestion-rh' },
            { icon: Target, label: 'Metas', path: '/metas' },
            { icon: Trophy, label: 'Cuadro Honor', path: '/cuadro-honor' },
            { icon: ClipboardList, label: 'Asistencias', path: '/reporte-asistencias' },
            { icon: ClipboardList, label: 'Pendientes', path: '/pendientes' },
          ].map(a => (
            <button key={a.label} onClick={() => navigate(a.path)} className="bg-card rounded-xl p-3 shadow-card flex flex-col items-center gap-2 hover:shadow-elevated transition-shadow active:scale-[0.98]">
              <a.icon className="w-5 h-5 text-primary" />
              <span className="text-xs font-semibold text-foreground">{a.label}</span>
            </button>
          ))}
        </div>

        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-muted-foreground">Elementos Activos</h2>
          <span className="text-xs text-primary font-semibold">{guards.length} en turno</span>
        </div>
        <div className="space-y-2">
          {guards.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">Sin guardias activos hoy</p>
          )}
          {guards.map(guard => {
            const status = statusConfig[guard.status] || statusConfig.activo;
            return (
              <div key={guard.id} className="bg-card rounded-xl p-4 shadow-card flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-sm font-bold text-primary">{guard.nombre.split(' ').map(n => n[0]).join('')}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-foreground">{guard.nombre}</p>
                  <p className="text-xs text-muted-foreground">{guard.sitio || 'Sin sitio asignado'}</p>
                </div>
                <div className="text-right">
                  <span className={`text-xs font-semibold px-2 py-1 rounded-full ${status.bg} ${status.color}`}>{status.label}</span>
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
