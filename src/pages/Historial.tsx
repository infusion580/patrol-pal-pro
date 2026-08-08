import { useState, useEffect, useMemo } from 'react';
import { ArrowLeft, FileText, Users, DollarSign, MapPin, AlertTriangle, Clock, BarChart3, TrendingUp, TrendingDown, Eye } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth-context';
import BottomNav from '@/components/BottomNav';
import ReporteDetailDialog from '@/components/ReporteDetailDialog';
import VisitaDetailDialog from '@/components/VisitaDetailDialog';

type TabKey = 'estadisticas' | 'reportes' | 'visitas' | 'prestamos' | 'rondines' | 'alertas';

const tabs: { key: TabKey; label: string; icon: any }[] = [
  { key: 'estadisticas', label: 'Resumen', icon: BarChart3 },
  { key: 'reportes', label: 'Reportes', icon: FileText },
  { key: 'visitas', label: 'Visitas', icon: Users },
  { key: 'prestamos', label: 'Préstamos', icon: DollarSign },
  { key: 'rondines', label: 'Rondines', icon: MapPin },
  { key: 'alertas', label: 'Alertas', icon: AlertTriangle },
];

interface MonthlyStats {
  month: string;
  label: string;
  rondines: number;
  rondinesCompletados: number;
  visitas: number;
  alertas: number;
  reportes: number;
}

const Historial = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabKey>('estadisticas');
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<MonthlyStats[]>([]);
  const [statsLoading, setStatsLoading] = useState(true);
  const [selectedReporte, setSelectedReporte] = useState<any>(null);
  const [selectedVisita, setSelectedVisita] = useState<any>(null);

  useEffect(() => {
    if (user) {
      loadStats();
    }
  }, [user]);

  useEffect(() => {
    if (user && activeTab !== 'estadisticas') loadTab(activeTab);
    if (activeTab === 'estadisticas') setLoading(false);
  }, [activeTab, user]);

  useEffect(() => {
    const channel = supabase
      .channel('historial-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notificaciones' }, () => {
        if (activeTab === 'alertas') loadTab('alertas');
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [activeTab]);

  const loadStats = async () => {
    if (!user) return;
    setStatsLoading(true);

    // Get data for last 6 months
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
    sixMonthsAgo.setDate(1);
    sixMonthsAgo.setHours(0, 0, 0, 0);
    const since = sixMonthsAgo.toISOString();

    const [{ data: rondines }, { data: visitas }, { data: alertas }, { data: reportes }] = await Promise.all([
      supabase.from('rondines').select('created_at, status').eq('guardia_id', user.id).gte('created_at', since),
      supabase.from('visitas').select('created_at').eq('guardia_id', user.id).gte('created_at', since),
      supabase.from('notificaciones').select('created_at').eq('guardia_id', user.id).eq('tipo', 'zona').gte('created_at', since),
      supabase.from('reportes_turno').select('created_at').eq('guardia_id', user.id).gte('created_at', since),
    ]);

    const months: MonthlyStats[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleDateString('es-MX', { month: 'short', year: 'numeric' });
      months.push({
        month: key,
        label,
        rondines: 0,
        rondinesCompletados: 0,
        visitas: 0,
        alertas: 0,
        reportes: 0,
      });
    }

    const getKey = (dateStr: string) => {
      const d = new Date(dateStr);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    };

    (rondines || []).forEach(r => {
      const m = months.find(m => m.month === getKey(r.created_at));
      if (m) {
        m.rondines++;
        if (r.status === 'completado') m.rondinesCompletados++;
      }
    });
    (visitas || []).forEach(v => {
      const m = months.find(m => m.month === getKey(v.created_at));
      if (m) m.visitas++;
    });
    (alertas || []).forEach(a => {
      const m = months.find(m => m.month === getKey(a.created_at));
      if (m) m.alertas++;
    });
    (reportes || []).forEach(r => {
      const m = months.find(m => m.month === getKey(r.created_at));
      if (m) m.reportes++;
    });

    setStats(months);
    setStatsLoading(false);
  };

  const loadTab = async (tab: TabKey) => {
    if (!user) return;
    setLoading(true);
    let result: any[] = [];

    switch (tab) {
      case 'reportes': {
        const { data: reportes } = await supabase.from('reportes_turno').select('*').eq('guardia_id', user.id).order('created_at', { ascending: false }).limit(50);
        result = reportes || [];
        break;
      }
      case 'visitas': {
        const { data: visitas } = await supabase.from('visitas').select('*').eq('guardia_id', user.id).order('created_at', { ascending: false }).limit(50);
        result = visitas || [];
        break;
      }
      case 'prestamos': {
        const { data: prestamos } = await supabase.from('registros_rh').select('*').eq('guardia_id', user.id).order('created_at', { ascending: false }).limit(50);
        result = prestamos || [];
        break;
      }
      case 'rondines': {
        const { data: rondines } = await supabase.from('rondines').select('*').eq('guardia_id', user.id).order('created_at', { ascending: false }).limit(50);
        result = rondines || [];
        break;
      }
      case 'alertas': {
        const { data: alertas } = await supabase.from('notificaciones').select('*').eq('guardia_id', user.id).eq('tipo', 'zona').order('created_at', { ascending: false }).limit(50);
        result = alertas || [];
        break;
      }
    }
    setData(result);
    setLoading(false);
  };

  const currentMonth = stats[stats.length - 1];
  const prevMonth = stats[stats.length - 2];

  const getTrend = (curr: number, prev: number) => {
    if (prev === 0 && curr === 0) return { pct: 0, up: true };
    if (prev === 0) return { pct: 100, up: true };
    const pct = Math.round(((curr - prev) / prev) * 100);
    return { pct: Math.abs(pct), up: pct >= 0 };
  };

  const formatDate = (d: string) =>
    new Date(d).toLocaleString('es-MX', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      pendiente: 'bg-warning/10 text-warning',
      aprobado: 'bg-success/10 text-success',
      rechazado: 'bg-destructive/10 text-destructive',
      completado: 'bg-success/10 text-success',
      activo: 'bg-primary/10 text-primary',
      dentro: 'bg-primary/10 text-primary',
      salió: 'bg-muted text-muted-foreground',
    };
    return (
      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${map[status] || 'bg-muted text-muted-foreground'}`}>
        {status}
      </span>
    );
  };

  const renderEstadisticas = () => {
    if (statsLoading) {
      return (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      );
    }

    const summaryCards = [
      { label: 'Rondines', value: currentMonth?.rondines || 0, prev: prevMonth?.rondines || 0, icon: MapPin, color: 'text-primary' },
      { label: 'Completados', value: currentMonth?.rondinesCompletados || 0, prev: prevMonth?.rondinesCompletados || 0, icon: MapPin, color: 'text-success' },
      { label: 'Visitas', value: currentMonth?.visitas || 0, prev: prevMonth?.visitas || 0, icon: Users, color: 'text-secondary' },
      { label: 'Alertas', value: currentMonth?.alertas || 0, prev: prevMonth?.alertas || 0, icon: AlertTriangle, color: 'text-destructive', invertTrend: true },
    ];

    const maxRondines = Math.max(...stats.map(s => s.rondines), 1);
    const maxVisitas = Math.max(...stats.map(s => s.visitas), 1);
    const maxAlertas = Math.max(...stats.map(s => s.alertas), 1);

    return (
      <div className="space-y-4">
        {/* Summary cards */}
        <div className="grid grid-cols-2 gap-3">
          {summaryCards.map(card => {
            const trend = getTrend(card.value, card.prev);
            const isGood = card.invertTrend ? !trend.up : trend.up;
            return (
              <div key={card.label} className="bg-card rounded-xl p-4 shadow-card">
                <div className="flex items-center gap-2 mb-2">
                  <card.icon className={`w-4 h-4 ${card.color}`} />
                  <span className="text-[10px] font-semibold text-muted-foreground">{card.label}</span>
                </div>
                <p className="text-2xl font-bold text-foreground">{card.value}</p>
                <div className="flex items-center gap-1 mt-1">
                  {trend.pct > 0 ? (
                    <>
                      {isGood ? <TrendingUp className="w-3 h-3 text-success" /> : <TrendingDown className="w-3 h-3 text-destructive" />}
                      <span className={`text-[10px] font-semibold ${isGood ? 'text-success' : 'text-destructive'}`}>
                        {trend.up ? '+' : '-'}{trend.pct}%
                      </span>
                    </>
                  ) : (
                    <span className="text-[10px] text-muted-foreground">Sin cambio</span>
                  )}
                  <span className="text-[10px] text-muted-foreground">vs mes anterior</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Bar chart - Rondines */}
        <div className="bg-card rounded-xl p-4 shadow-card">
          <h3 className="text-sm font-semibold text-foreground mb-3">Rondines por Mes</h3>
          <div className="flex items-end gap-2 h-28">
            {stats.map(s => (
              <div key={s.month} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-[9px] font-bold text-foreground">{s.rondines}</span>
                <div className="w-full rounded-t-md bg-primary/20 relative" style={{ height: `${(s.rondines / maxRondines) * 100}%`, minHeight: '4px' }}>
                  <div className="absolute bottom-0 w-full rounded-t-md bg-primary" style={{ height: `${(s.rondinesCompletados / maxRondines) * 100}%`, minHeight: s.rondinesCompletados > 0 ? '4px' : '0' }} />
                </div>
                <span className="text-[8px] text-muted-foreground">{s.label.split(' ')[0]}</span>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-4 mt-2">
            <div className="flex items-center gap-1"><div className="w-2.5 h-2.5 rounded-sm bg-primary" /><span className="text-[9px] text-muted-foreground">Completados</span></div>
            <div className="flex items-center gap-1"><div className="w-2.5 h-2.5 rounded-sm bg-primary/20" /><span className="text-[9px] text-muted-foreground">Total</span></div>
          </div>
        </div>

        {/* Bar chart - Visitas */}
        <div className="bg-card rounded-xl p-4 shadow-card">
          <h3 className="text-sm font-semibold text-foreground mb-3">Visitas por Mes</h3>
          <div className="flex items-end gap-2 h-24">
            {stats.map(s => (
              <div key={s.month} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-[9px] font-bold text-foreground">{s.visitas}</span>
                <div className="w-full rounded-t-md bg-secondary" style={{ height: `${(s.visitas / maxVisitas) * 100}%`, minHeight: '4px' }} />
                <span className="text-[8px] text-muted-foreground">{s.label.split(' ')[0]}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Bar chart - Alertas */}
        <div className="bg-card rounded-xl p-4 shadow-card">
          <h3 className="text-sm font-semibold text-foreground mb-3">Alertas de Zona por Mes</h3>
          <div className="flex items-end gap-2 h-24">
            {stats.map(s => (
              <div key={s.month} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-[9px] font-bold text-foreground">{s.alertas}</span>
                <div className="w-full rounded-t-md bg-destructive/70" style={{ height: `${(s.alertas / maxAlertas) * 100}%`, minHeight: '4px' }} />
                <span className="text-[8px] text-muted-foreground">{s.label.split(' ')[0]}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const renderReportes = () => data.map((r: any) => (
    <button key={r.id} onClick={() => setSelectedReporte(r)} className="w-full text-left bg-card rounded-xl p-4 shadow-card hover:shadow-elevated transition-shadow">
      <div className="flex items-center justify-between mb-1">
        <p className="font-semibold text-sm text-foreground">Reporte de Turno</p>
        <div className="flex items-center gap-2">
          {statusBadge(r.status)}
          <Eye className="w-3.5 h-3.5 text-primary" />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">{formatDate(r.created_at)}</p>
      {r.actividades && <p className="text-xs text-foreground mt-2 line-clamp-2">{r.actividades}</p>}
      {r.incidencias && <p className="text-xs text-destructive mt-1">Incidencias: {r.incidencias}</p>}
      {r.retroalimentacion && (
        <p className="text-xs text-primary mt-1 italic">Retroalimentación: {r.retroalimentacion}</p>
      )}
    </button>
  ));

  const renderVisitas = () => data.map((v: any) => (
    <button key={v.id} onClick={() => setSelectedVisita(v)} className="w-full text-left bg-card rounded-xl p-4 shadow-card hover:shadow-elevated transition-shadow">
      <div className="flex items-center justify-between mb-1">
        <p className="font-semibold text-sm text-foreground">{v.nombre_visitante}</p>
        <div className="flex items-center gap-2">
          {statusBadge(v.status)}
          <Eye className="w-3.5 h-3.5 text-primary" />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">Entrada: {formatDate(v.hora_entrada)}</p>
      {v.hora_salida && <p className="text-xs text-muted-foreground">Salida: {formatDate(v.hora_salida)}</p>}
      <p className="text-xs text-foreground mt-1">Motivo: {v.motivo}</p>
    </button>
  ));

  const renderPrestamos = () => data.map((p: any) => {
    const tipoLabels: Record<string, string> = { turno_extra: 'Turno Extra', prestamo: 'Préstamo', vacaciones: 'Vacaciones' };
    return (
      <div key={p.id} className="bg-card rounded-xl p-4 shadow-card">
        <div className="flex items-center justify-between mb-1">
          <p className="font-semibold text-sm text-foreground">{tipoLabels[p.tipo] || p.tipo}</p>
          {statusBadge(p.status)}
        </div>
        <p className="text-xs text-muted-foreground">{p.fecha}{p.fecha_fin ? ` → ${p.fecha_fin}` : ''}</p>
        {p.monto && <p className="text-xs text-foreground mt-1">Monto: ${p.monto}</p>}
        {p.nota && <p className="text-xs text-muted-foreground italic mt-1">{p.nota}</p>}
      </div>
    );
  });

  const renderRondines = () => data.map((r: any) => (
    <div key={r.id} className="bg-card rounded-xl p-4 shadow-card">
      <div className="flex items-center justify-between mb-1">
        <p className="font-semibold text-sm text-foreground">Rondín</p>
        {statusBadge(r.status)}
      </div>
      <p className="text-xs text-muted-foreground">{formatDate(r.created_at)}</p>
      {r.checkin_at && <p className="text-xs text-foreground mt-1">Check-in: {formatDate(r.checkin_at)}</p>}
      {r.checkout_at && <p className="text-xs text-foreground">Check-out: {formatDate(r.checkout_at)}</p>}
      {(r.checkin_lat && r.checkin_lng) && (
        <p className="text-[10px] text-muted-foreground mt-1">📍 {r.checkin_lat.toFixed(5)}, {r.checkin_lng.toFixed(5)}</p>
      )}
    </div>
  ));

  const renderAlertas = () => data.map((a: any) => (
    <div key={a.id} className="bg-card rounded-xl p-4 shadow-card border-l-4 border-destructive">
      <div className="flex items-center gap-2 mb-1">
        <AlertTriangle className="w-4 h-4 text-destructive" />
        <p className="font-semibold text-sm text-foreground">Salida de zona</p>
      </div>
      <p className="text-xs text-foreground mt-1">{a.mensaje}</p>
      <p className="text-[10px] text-muted-foreground mt-1">{formatDate(a.created_at)}</p>
    </div>
  ));

  const renderers: Record<TabKey, () => JSX.Element | JSX.Element[]> = {
    estadisticas: renderEstadisticas,
    reportes: renderReportes,
    visitas: renderVisitas,
    prestamos: renderPrestamos,
    rondines: renderRondines,
    alertas: renderAlertas,
  };

  return (
    <div className="min-h-dvh bg-background pb-20">
      <div className="text-primary-foreground px-4 pt-12 pb-6 rounded-b-3xl app-header">
        <div className="max-w-lg mx-auto">
          <button onClick={() => navigate('/dashboard')} className="flex items-center gap-1 text-sm opacity-80 mb-2">
            <ArrowLeft className="w-4 h-4" /> Regresar
          </button>
          <h1 className="text-xl font-display font-bold">Mi Historial</h1>
          <p className="text-sm opacity-70 mt-1">{user?.nombre} {user?.apellido} • #{user?.numeroEmpleado}</p>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 -mt-4">
        {/* Tabs */}
        <div className="bg-card rounded-xl shadow-card p-1 flex gap-1 overflow-x-auto mb-4">
          {tabs.map(t => {
            const active = activeTab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                className={`flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                  active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <t.icon className="w-3.5 h-3.5" />
                {t.label}
              </button>
            );
          })}
        </div>

        {/* Content */}
        {activeTab === 'estadisticas' ? (
          renderers.estadisticas()
        ) : loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : data.length === 0 ? (
          <div className="bg-card rounded-xl p-8 shadow-card text-center">
            <Clock className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Sin registros en esta sección</p>
          </div>
        ) : (
          <div className="space-y-3">
            {renderers[activeTab]()}
          </div>
        )}
      </div>

      <ReporteDetailDialog reporte={selectedReporte} open={!!selectedReporte} onClose={() => setSelectedReporte(null)} />
      <VisitaDetailDialog visita={selectedVisita} open={!!selectedVisita} onClose={() => setSelectedVisita(null)} />
      <BottomNav />
    </div>
  );
};

export default Historial;
