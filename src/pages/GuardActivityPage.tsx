import { useState, useEffect } from 'react';
import { ArrowLeft, FileText, Users, DollarSign, MapPin, AlertTriangle, Clock, Eye } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import BottomNav from '@/components/BottomNav';
import ReporteDetailDialog from '@/components/ReporteDetailDialog';
import VisitaDetailDialog from '@/components/VisitaDetailDialog';

type TabKey = 'reportes' | 'visitas' | 'prestamos' | 'rondines' | 'alertas' | 'turnos';

const tabs: { key: TabKey; label: string; icon: any }[] = [
  { key: 'reportes', label: 'Reportes', icon: FileText },
  { key: 'visitas', label: 'Visitas', icon: Users },
  { key: 'prestamos', label: 'Préstamos', icon: DollarSign },
  { key: 'rondines', label: 'Rondines', icon: MapPin },
  { key: 'alertas', label: 'Alertas', icon: AlertTriangle },
  { key: 'turnos', label: 'Turnos', icon: Clock },
];

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

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
    'salió': 'bg-muted text-muted-foreground',
    retroalimentacion: 'bg-destructive/10 text-destructive',
  };
  return (
    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${map[status] || 'bg-muted text-muted-foreground'}`}>
      {status}
    </span>
  );
};

const GuardActivityPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const guardId = searchParams.get('id') || '';
  const guardName = searchParams.get('name') || 'Guardia';

  const [activeTab, setActiveTab] = useState<TabKey>('reportes');
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedReporte, setSelectedReporte] = useState<any>(null);
  const [selectedVisita, setSelectedVisita] = useState<any>(null);

  useEffect(() => {
    if (guardId) loadTab(activeTab);
  }, [activeTab, guardId]);

  const loadTab = async (tab: TabKey) => {
    setLoading(true);
    let result: any[] = [];

    switch (tab) {
      case 'reportes': {
        const { data: d } = await supabase.from('reportes_turno').select('*').eq('guardia_id', guardId).order('created_at', { ascending: false }).limit(100);
        result = d || [];
        break;
      }
      case 'visitas': {
        const { data: d } = await supabase.from('visitas').select('*').eq('guardia_id', guardId).order('created_at', { ascending: false }).limit(100);
        result = d || [];
        break;
      }
      case 'prestamos': {
        const { data: d } = await supabase.from('registros_rh').select('*').eq('guardia_id', guardId).order('created_at', { ascending: false }).limit(100);
        result = d || [];
        break;
      }
      case 'rondines': {
        const { data: d } = await supabase.from('rondines').select('*').eq('guardia_id', guardId).order('created_at', { ascending: false }).limit(100);
        result = d || [];
        break;
      }
      case 'alertas': {
        const { data: d } = await supabase.from('notificaciones').select('*').eq('guardia_id', guardId).eq('tipo', 'zona').order('created_at', { ascending: false }).limit(100);
        result = d || [];
        break;
      }
      case 'turnos': {
        const { data: d } = await supabase.from('turnos').select('*').eq('guardia_id', guardId).order('created_at', { ascending: false }).limit(100);
        result = d || [];
        break;
      }
    }
    setData(result);
    setLoading(false);
  };

  return (
    <div className="min-h-dvh bg-background pb-20">
      <div className="text-primary-foreground px-4 pt-12 pb-6 rounded-b-3xl app-header">
        <div className="max-w-lg mx-auto">
          <button onClick={() => navigate('/dashboard')} className="flex items-center gap-1 text-sm opacity-80 mb-2">
            <ArrowLeft className="w-4 h-4" /> Regresar
          </button>
          <h1 className="text-xl font-display font-bold">Actividad del Guardia</h1>
          <p className="text-sm opacity-70 mt-1">{guardName}</p>
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
            {activeTab === 'reportes' && data.map((r: any) => (
              <button key={r.id} onClick={() => setSelectedReporte({ ...r, guardia_nombre: guardName })} className="w-full text-left bg-card rounded-xl p-4 shadow-card hover:shadow-elevated transition-shadow">
                <div className="flex items-center justify-between mb-1">
                  <p className="font-semibold text-sm text-foreground">Reporte de Turno</p>
                  <div className="flex items-center gap-2">
                    {statusBadge(r.status)}
                    <Eye className="w-3.5 h-3.5 text-primary" />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">{formatDate(r.created_at)}</p>
                {r.actividades && <p className="text-xs text-foreground mt-1 line-clamp-2">{r.actividades}</p>}
              </button>
            ))}

            {activeTab === 'visitas' && data.map((v: any) => (
              <button key={v.id} onClick={() => setSelectedVisita({ ...v, guardia_nombre: guardName })} className="w-full text-left bg-card rounded-xl p-4 shadow-card hover:shadow-elevated transition-shadow">
                <div className="flex items-center justify-between mb-1">
                  <p className="font-semibold text-sm text-foreground">{v.nombre_visitante}</p>
                  <div className="flex items-center gap-2">
                    {statusBadge(v.status)}
                    <Eye className="w-3.5 h-3.5 text-primary" />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">Entrada: {formatDate(v.hora_entrada)}</p>
                <p className="text-xs text-foreground mt-1">{v.motivo}</p>
              </button>
            ))}

            {activeTab === 'prestamos' && data.map((p: any) => {
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
            })}

            {activeTab === 'rondines' && data.map((r: any) => (
              <div key={r.id} className="bg-card rounded-xl p-4 shadow-card">
                <div className="flex items-center justify-between mb-1">
                  <p className="font-semibold text-sm text-foreground">Rondín</p>
                  {statusBadge(r.status)}
                </div>
                <p className="text-xs text-muted-foreground">{formatDate(r.created_at)}</p>
                {r.checkin_at && <p className="text-xs text-foreground mt-1">Check-in: {formatDate(r.checkin_at)}</p>}
                {r.checkout_at && <p className="text-xs text-foreground">Check-out: {formatDate(r.checkout_at)}</p>}
              </div>
            ))}

            {activeTab === 'alertas' && data.map((a: any) => (
              <div key={a.id} className="bg-card rounded-xl p-4 shadow-card border-l-4 border-destructive">
                <div className="flex items-center gap-2 mb-1">
                  <AlertTriangle className="w-4 h-4 text-destructive" />
                  <p className="font-semibold text-sm text-foreground">Salida de zona</p>
                </div>
                <p className="text-xs text-foreground mt-1">{a.mensaje}</p>
                <p className="text-[10px] text-muted-foreground mt-1">{formatDate(a.created_at)}</p>
              </div>
            ))}

            {activeTab === 'turnos' && data.map((t: any) => (
              <div key={t.id} className="bg-card rounded-xl p-4 shadow-card">
                <div className="flex items-center justify-between mb-1">
                  <p className="font-semibold text-sm text-foreground">Turno</p>
                  {statusBadge(t.status)}
                </div>
                <p className="text-xs text-muted-foreground">Inicio: {formatDate(t.inicio)}</p>
                {t.fin && <p className="text-xs text-muted-foreground">Fin: {formatDate(t.fin)}</p>}
                {t.guardia_entrante && <p className="text-xs text-foreground mt-1">Entrante: {t.guardia_entrante}</p>}
                {t.comentario_cambio && <p className="text-xs text-muted-foreground italic mt-1">{t.comentario_cambio}</p>}
              </div>
            ))}
          </div>
        )}
      </div>

      <ReporteDetailDialog reporte={selectedReporte} open={!!selectedReporte} onClose={() => setSelectedReporte(null)} />
      <VisitaDetailDialog visita={selectedVisita} open={!!selectedVisita} onClose={() => setSelectedVisita(null)} />
      <BottomNav />
    </div>
  );
};

export default GuardActivityPage;
