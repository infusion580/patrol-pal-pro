import { useState, useEffect } from 'react';
import { ArrowLeft, FileText, Users, DollarSign, MapPin, AlertTriangle, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth-context';
import BottomNav from '@/components/BottomNav';

type TabKey = 'reportes' | 'visitas' | 'prestamos' | 'rondines' | 'alertas';

const tabs: { key: TabKey; label: string; icon: any }[] = [
  { key: 'reportes', label: 'Reportes', icon: FileText },
  { key: 'visitas', label: 'Visitas', icon: Users },
  { key: 'prestamos', label: 'Préstamos', icon: DollarSign },
  { key: 'rondines', label: 'Rondines', icon: MapPin },
  { key: 'alertas', label: 'Alertas', icon: AlertTriangle },
];

const Historial = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabKey>('reportes');
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) loadTab(activeTab);
  }, [activeTab, user]);

  // Realtime for notifications
  useEffect(() => {
    const channel = supabase
      .channel('historial-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notificaciones' }, () => {
        if (activeTab === 'alertas') loadTab('alertas');
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [activeTab]);

  const loadTab = async (tab: TabKey) => {
    if (!user) return;
    setLoading(true);
    let result: any[] = [];

    switch (tab) {
      case 'reportes': {
        const { data: reportes } = await supabase
          .from('reportes_turno')
          .select('*')
          .eq('guardia_id', user.id)
          .order('created_at', { ascending: false })
          .limit(50);
        result = reportes || [];
        break;
      }
      case 'visitas': {
        const { data: visitas } = await supabase
          .from('visitas')
          .select('*')
          .eq('guardia_id', user.id)
          .order('created_at', { ascending: false })
          .limit(50);
        result = visitas || [];
        break;
      }
      case 'prestamos': {
        const { data: prestamos } = await supabase
          .from('registros_rh')
          .select('*')
          .eq('guardia_id', user.id)
          .order('created_at', { ascending: false })
          .limit(50);
        result = prestamos || [];
        break;
      }
      case 'rondines': {
        const { data: rondines } = await supabase
          .from('rondines')
          .select('*')
          .eq('guardia_id', user.id)
          .order('created_at', { ascending: false })
          .limit(50);
        result = rondines || [];
        break;
      }
      case 'alertas': {
        const { data: alertas } = await supabase
          .from('notificaciones')
          .select('*')
          .eq('guardia_id', user.id)
          .eq('tipo', 'zona')
          .order('created_at', { ascending: false })
          .limit(50);
        result = alertas || [];
        break;
      }
    }
    setData(result);
    setLoading(false);
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

  const renderReportes = () => data.map((r: any) => (
    <div key={r.id} className="bg-card rounded-xl p-4 shadow-card">
      <div className="flex items-center justify-between mb-1">
        <p className="font-semibold text-sm text-foreground">Reporte de Turno</p>
        {statusBadge(r.status)}
      </div>
      <p className="text-xs text-muted-foreground">{formatDate(r.created_at)}</p>
      {r.actividades && <p className="text-xs text-foreground mt-2 line-clamp-2">{r.actividades}</p>}
      {r.incidencias && <p className="text-xs text-destructive mt-1">Incidencias: {r.incidencias}</p>}
      {r.retroalimentacion && (
        <p className="text-xs text-primary mt-1 italic">Retroalimentación: {r.retroalimentacion}</p>
      )}
    </div>
  ));

  const renderVisitas = () => data.map((v: any) => (
    <div key={v.id} className="bg-card rounded-xl p-4 shadow-card">
      <div className="flex items-center justify-between mb-1">
        <p className="font-semibold text-sm text-foreground">{v.nombre_visitante}</p>
        {statusBadge(v.status)}
      </div>
      <p className="text-xs text-muted-foreground">Entrada: {formatDate(v.hora_entrada)}</p>
      {v.hora_salida && <p className="text-xs text-muted-foreground">Salida: {formatDate(v.hora_salida)}</p>}
      <p className="text-xs text-foreground mt-1">Motivo: {v.motivo}</p>
      <div className="flex gap-2 mt-2">
        {v.foto_ine_url && (
          <a href={v.foto_ine_url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-primary underline">Ver INE</a>
        )}
        {v.foto_placa_url && (
          <a href={v.foto_placa_url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-primary underline">Ver Placa</a>
        )}
        {v.foto_salida_url && (
          <a href={v.foto_salida_url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-primary underline">Ver Salida</a>
        )}
      </div>
    </div>
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

  const renderers: Record<TabKey, () => JSX.Element[]> = {
    reportes: renderReportes,
    visitas: renderVisitas,
    prestamos: renderPrestamos,
    rondines: renderRondines,
    alertas: renderAlertas,
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="bg-primary text-primary-foreground px-4 pt-12 pb-6 rounded-b-3xl">
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
        {loading ? (
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

      <BottomNav />
    </div>
  );
};

export default Historial;
