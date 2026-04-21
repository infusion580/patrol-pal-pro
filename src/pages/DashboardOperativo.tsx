import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Calendar, CheckCircle2, AlertTriangle, Shield, Clock, MapPin, Users, TrendingUp, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import BottomNav from '@/components/BottomNav';

type Period = 'day' | 'week' | 'month';

interface Stats {
  totalRondines: number;
  rondinCompleted: number;
  rondinIncomplete: number;
  incidencias: number;
  alertasZona: number;
  turnosIniciados: number;
  turnosFinalizados: number;
  visitas: number;
}

interface GuardiaIncidencia {
  nombre: string;
  count: number;
}

interface ServicioCumplimiento {
  nombre: string;
  rondines: number;
  completados: number;
}

const DashboardOperativo = () => {
  const navigate = useNavigate();
  const [period, setPeriod] = useState<Period>('week');
  const [stats, setStats] = useState<Stats>({ totalRondines: 0, rondinCompleted: 0, rondinIncomplete: 0, incidencias: 0, alertasZona: 0, turnosIniciados: 0, turnosFinalizados: 0, visitas: 0 });
  const [topIncidencias, setTopIncidencias] = useState<GuardiaIncidencia[]>([]);
  const [cumplimiento, setCumplimiento] = useState<ServicioCumplimiento[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, [period]);

  const getSinceDate = (): string => {
    const d = new Date();
    if (period === 'day') d.setDate(d.getDate() - 1);
    else if (period === 'week') d.setDate(d.getDate() - 7);
    else d.setMonth(d.getMonth() - 1);
    return d.toISOString();
  };

  const loadData = async () => {
    setLoading(true);
    const since = getSinceDate();

    const [
      { data: rondines },
      { data: alertas },
      { data: turnos },
      { data: visitas },
      { data: reportes },
      { data: profiles },
      { data: servicios },
    ] = await Promise.all([
      supabase.from('rondines').select('guardia_id, status, servicio_id, created_at').gte('created_at', since),
      supabase.from('notificaciones').select('guardia_id, created_at').eq('tipo', 'zona').gte('created_at', since),
      supabase.from('turnos').select('guardia_id, status, created_at').gte('created_at', since),
      supabase.from('visitas').select('created_at').gte('created_at', since),
      supabase.from('reportes_turno').select('guardia_id, incidencias, created_at').gte('created_at', since),
      supabase.from('profiles').select('user_id, nombre, apellido'),
      supabase.from('servicios').select('id, nombre'),
    ]);

    const r = rondines || [];
    const completed = r.filter(x => x.status === 'completado').length;
    const incidentes = (reportes || []).filter(rp => rp.incidencias?.trim().length > 0);

    setStats({
      totalRondines: r.length,
      rondinCompleted: completed,
      rondinIncomplete: r.length - completed,
      incidencias: incidentes.length,
      alertasZona: (alertas || []).length,
      turnosIniciados: (turnos || []).length,
      turnosFinalizados: (turnos || []).filter(t => t.status === 'completado').length,
      visitas: (visitas || []).length,
    });

    // Top guardias with most incidencias
    const profileMap = new Map((profiles || []).map(p => [p.user_id, `${p.nombre} ${p.apellido}`]));
    const incMap: Record<string, number> = {};
    incidentes.forEach(rp => { incMap[rp.guardia_id] = (incMap[rp.guardia_id] || 0) + 1; });
    const alertMap: Record<string, number> = {};
    (alertas || []).forEach(a => { alertMap[a.guardia_id] = (alertMap[a.guardia_id] || 0) + 1; });

    // Merge incidencias + alertas
    const allIds = new Set([...Object.keys(incMap), ...Object.keys(alertMap)]);
    const merged = Array.from(allIds).map(id => ({
      nombre: profileMap.get(id) || 'Desconocido',
      count: (incMap[id] || 0) + (alertMap[id] || 0),
    })).sort((a, b) => b.count - a.count).slice(0, 5);
    setTopIncidencias(merged);

    // Cumplimiento por servicio
    const svcMap = new Map((servicios || []).map(s => [s.id, s.nombre]));
    const svcStats: Record<string, { rondines: number; completados: number }> = {};
    r.forEach(rd => {
      const name = svcMap.get(rd.servicio_id || '') || 'Sin servicio';
      if (!svcStats[name]) svcStats[name] = { rondines: 0, completados: 0 };
      svcStats[name].rondines++;
      if (rd.status === 'completado') svcStats[name].completados++;
    });
    setCumplimiento(Object.entries(svcStats).map(([nombre, v]) => ({ nombre, ...v })).sort((a, b) => b.rondines - a.rondines));

    setLoading(false);
  };

  const periodLabels: Record<Period, string> = { day: 'Hoy', week: 'Esta Semana', month: 'Este Mes' };

  const kpis = [
    { icon: CheckCircle2, label: 'Rondines', value: stats.totalRondines, color: 'text-success' },
    { icon: CheckCircle2, label: 'Completados', value: stats.rondinCompleted, color: 'text-primary' },
    { icon: AlertTriangle, label: 'Incompletos', value: stats.rondinIncomplete, color: 'text-warning' },
    { icon: Shield, label: 'Incidencias', value: stats.incidencias, color: 'text-emergency' },
    { icon: MapPin, label: 'Alertas Zona', value: stats.alertasZona, color: 'text-emergency' },
    { icon: Clock, label: 'Turnos', value: `${stats.turnosIniciados}/${stats.turnosFinalizados}`, color: 'text-primary' },
  ];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="text-primary-foreground px-4 pt-12 pb-6 rounded-b-3xl app-header">
        <div className="max-w-lg mx-auto">
          <button onClick={() => navigate('/dashboard')} className="flex items-center gap-1 text-sm opacity-80 mb-2">
            <ArrowLeft className="w-4 h-4" /> Regresar
          </button>
          <h1 className="text-xl font-display font-bold">Dashboard Operativo</h1>
          <p className="text-sm opacity-70 mt-1">Control y estadísticas en tiempo real</p>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 -mt-4 space-y-4">
        {/* Period selector */}
        <div className="flex gap-2 justify-end">
          {(['day', 'week', 'month'] as Period[]).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                period === p ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
              }`}
            >
              {periodLabels[p]}
            </button>
          ))}
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-3 gap-2">
          {kpis.map(k => (
            <div key={k.label} className="bg-card rounded-xl p-3 shadow-card text-center">
              <k.icon className={`w-5 h-5 ${k.color} mx-auto mb-1`} />
              <p className="text-xl font-bold text-foreground">{k.value}</p>
              <p className="text-[10px] font-semibold text-foreground">{k.label}</p>
            </div>
          ))}
        </div>

        {/* Turnos summary */}
        <div className="bg-card rounded-xl p-4 shadow-card">
          <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <Clock className="w-4 h-4 text-primary" /> Turnos — {periodLabels[period]}
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="text-center">
              <p className="text-2xl font-bold text-success">{stats.turnosIniciados}</p>
              <p className="text-[10px] text-muted-foreground">Iniciados</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-primary">{stats.turnosFinalizados}</p>
              <p className="text-[10px] text-muted-foreground">Finalizados</p>
            </div>
          </div>
        </div>

        {/* Cumplimiento por servicio */}
        {cumplimiento.length > 0 && (
          <div className="bg-card rounded-xl p-4 shadow-card">
            <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-success" /> Cumplimiento por Servicio
            </h3>
            <div className="space-y-3">
              {cumplimiento.map(s => {
                const pct = s.rondines > 0 ? Math.round((s.completados / s.rondines) * 100) : 0;
                return (
                  <div key={s.nombre}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-foreground font-semibold truncate">{s.nombre}</span>
                      <span className={`font-bold ${pct >= 80 ? 'text-success' : pct >= 50 ? 'text-warning' : 'text-emergency'}`}>{pct}%</span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${pct >= 80 ? 'bg-success' : pct >= 50 ? 'bg-warning' : 'bg-emergency'}`} style={{ width: `${pct}%` }} />
                    </div>
                    <p className="text-[9px] text-muted-foreground mt-0.5">{s.completados}/{s.rondines} rondines</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Guardias con más incidencias */}
        {topIncidencias.length > 0 && (
          <div className="bg-card rounded-xl p-4 shadow-card">
            <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-emergency" /> Guardias con más Incidencias
            </h3>
            <div className="space-y-2">
              {topIncidencias.map((g, i) => (
                <div key={g.nombre} className="flex items-center justify-between text-xs">
                  <span className="text-foreground">
                    <span className="text-emergency font-bold mr-1">#{i + 1}</span>
                    {g.nombre}
                  </span>
                  <span className="bg-emergency/10 text-emergency font-bold px-2 py-0.5 rounded-full text-[10px]">{g.count}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Visitas */}
        <div className="bg-card rounded-xl p-4 shadow-card">
          <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
            <Users className="w-4 h-4 text-secondary" /> Visitas Registradas
          </h3>
          <p className="text-3xl font-bold text-foreground">{stats.visitas}</p>
          <p className="text-[10px] text-muted-foreground">{periodLabels[period]}</p>
        </div>
      </div>

      <BottomNav />
    </div>
  );
};

export default DashboardOperativo;
