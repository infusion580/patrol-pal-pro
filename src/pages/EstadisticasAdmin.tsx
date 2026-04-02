import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Download, Users, Shield, CheckCircle2, AlertTriangle, Eye, FileText, Calendar, TrendingUp, TrendingDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import BottomNav from '@/components/BottomNav';
import { useToast } from '@/hooks/use-toast';

interface MonthlyRow {
  month: string;
  rondines: number;
  rondinCompleted: number;
  visitas: number;
  emergencias: number;
  reportes: number;
  alertasZona: number;
}

const MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

const EstadisticasAdmin = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<'6m' | '12m'>('6m');

  // KPIs
  const [totalGuardias, setTotalGuardias] = useState(0);
  const [guardiasActivos, setGuardiasActivos] = useState(0);
  const [totalRondinesMes, setTotalRondinesMes] = useState(0);
  const [totalVisitasMes, setTotalVisitasMes] = useState(0);
  const [totalEmergenciasMes, setTotalEmergenciasMes] = useState(0);
  const [totalAlertasMes, setTotalAlertasMes] = useState(0);

  // Monthly data
  const [monthlyData, setMonthlyData] = useState<MonthlyRow[]>([]);

  // Top guardias
  const [topGuardias, setTopGuardias] = useState<Array<{ nombre: string; rondines: number }>>([]);

  useEffect(() => { loadAll(); }, [period]);

  const loadAll = async () => {
    setLoading(true);
    const months = period === '6m' ? 6 : 12;
    const since = new Date();
    since.setMonth(since.getMonth() - months);
    const sinceISO = since.toISOString();
    const thisMonth = new Date();
    thisMonth.setDate(1);
    thisMonth.setHours(0, 0, 0, 0);
    const thisMonthISO = thisMonth.toISOString();

    const [
      { data: profiles },
      { data: roles },
      { data: rondines },
      { data: visitas },
      { data: emergencias },
      { data: alertas },
      { data: reportes },
    ] = await Promise.all([
      supabase.from('profiles').select('user_id, nombre, apellido, status'),
      supabase.from('user_roles').select('user_id, role'),
      supabase.from('rondines').select('guardia_id, status, created_at').gte('created_at', sinceISO),
      supabase.from('visitas').select('created_at').gte('created_at', sinceISO),
      supabase.from('emergencias').select('created_at').gte('created_at', sinceISO),
      supabase.from('notificaciones').select('created_at').eq('tipo', 'zona').gte('created_at', sinceISO),
      supabase.from('reportes_turno').select('created_at').gte('created_at', sinceISO),
    ]);

    // KPIs
    const guardiaIds = new Set(roles?.filter(r => r.role === 'guardia').map(r => r.user_id));
    const guardiaProfiles = profiles?.filter(p => guardiaIds.has(p.user_id)) || [];
    setTotalGuardias(guardiaProfiles.length);
    setGuardiasActivos(guardiaProfiles.filter(p => p.status === 'activo').length);
    setTotalRondinesMes(rondines?.filter(r => r.created_at >= thisMonthISO).length || 0);
    setTotalVisitasMes(visitas?.filter(v => v.created_at >= thisMonthISO).length || 0);
    setTotalEmergenciasMes(emergencias?.filter(e => e.created_at >= thisMonthISO).length || 0);
    setTotalAlertasMes(alertas?.filter(a => a.created_at >= thisMonthISO).length || 0);

    // Monthly breakdown
    const rows: MonthlyRow[] = [];
    for (let i = months - 1; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const y = d.getFullYear();
      const m = d.getMonth();
      const start = new Date(y, m, 1).toISOString();
      const end = new Date(y, m + 1, 1).toISOString();
      const inRange = (dt: string) => dt >= start && dt < end;

      const mRondines = rondines?.filter(r => inRange(r.created_at)) || [];
      rows.push({
        month: `${MONTHS[m]} ${y}`,
        rondines: mRondines.length,
        rondinCompleted: mRondines.filter(r => r.status === 'completado').length,
        visitas: visitas?.filter(v => inRange(v.created_at)).length || 0,
        emergencias: emergencias?.filter(e => inRange(e.created_at)).length || 0,
        reportes: reportes?.filter(r => inRange(r.created_at)).length || 0,
        alertasZona: alertas?.filter(a => inRange(a.created_at)).length || 0,
      });
    }
    setMonthlyData(rows);

    // Top guardias by rondines
    const guardiaRondines: Record<string, number> = {};
    rondines?.forEach(r => { guardiaRondines[r.guardia_id] = (guardiaRondines[r.guardia_id] || 0) + 1; });
    const profileMap = new Map(profiles?.map(p => [p.user_id, `${p.nombre} ${p.apellido}`]));
    const sorted = Object.entries(guardiaRondines)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([id, count]) => ({ nombre: profileMap.get(id) || 'Desconocido', rondines: count }));
    setTopGuardias(sorted);

    setLoading(false);
  };

  const exportCSV = () => {
    const headers = ['Mes', 'Rondines', 'Completados', 'Visitas', 'Emergencias', 'Reportes', 'Alertas Zona'];
    const csvRows = [headers.join(',')];
    monthlyData.forEach(r => {
      csvRows.push([r.month, r.rondines, r.rondinCompleted, r.visitas, r.emergencias, r.reportes, r.alertasZona].join(','));
    });
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `estadisticas_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: 'CSV exportado' });
  };

  const maxBar = Math.max(...monthlyData.map(d => d.rondines), 1);
  const maxVisBar = Math.max(...monthlyData.map(d => d.visitas), 1);

  const kpis = [
    { icon: Users, label: 'Guardias', value: totalGuardias, sub: `${guardiasActivos} activos`, color: 'text-primary' },
    { icon: CheckCircle2, label: 'Rondines', value: totalRondinesMes, sub: 'Este mes', color: 'text-success' },
    { icon: Eye, label: 'Visitas', value: totalVisitasMes, sub: 'Este mes', color: 'text-secondary' },
    { icon: AlertTriangle, label: 'Emergencias', value: totalEmergenciasMes, sub: 'Este mes', color: 'text-emergency' },
    { icon: Shield, label: 'Alertas Zona', value: totalAlertasMes, sub: 'Este mes', color: 'text-warning' },
    { icon: FileText, label: 'Reportes', value: monthlyData[monthlyData.length - 1]?.reportes || 0, sub: 'Este mes', color: 'text-primary' },
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
      <div className="bg-primary text-primary-foreground px-4 pt-12 pb-6 rounded-b-3xl">
        <div className="max-w-lg mx-auto">
          <button onClick={() => navigate('/dashboard')} className="flex items-center gap-1 text-sm opacity-80 mb-2">
            <ArrowLeft className="w-4 h-4" /> Regresar
          </button>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-display font-bold">Estadísticas Generales</h1>
              <p className="text-sm opacity-70 mt-1">Panel Administrador</p>
            </div>
            <Button size="sm" variant="secondary" onClick={exportCSV} className="gap-1.5">
              <Download className="w-4 h-4" /> CSV
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 -mt-4 space-y-4">
        {/* Period toggle */}
        <div className="flex gap-2 justify-end">
          {(['6m', '12m'] as const).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${period === p ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}
            >
              {p === '6m' ? '6 Meses' : '12 Meses'}
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
              <p className="text-[9px] text-muted-foreground">{k.sub}</p>
            </div>
          ))}
        </div>

        {/* Rondines chart */}
        <div className="bg-card rounded-xl p-4 shadow-card">
          <h3 className="text-sm font-semibold text-foreground mb-3">Rondines por Mes</h3>
          <div className="flex items-end gap-1 h-28">
            {monthlyData.map(d => (
              <div key={d.month} className="flex-1 flex flex-col items-center gap-0.5">
                <span className="text-[9px] font-bold text-foreground">{d.rondines}</span>
                <div className="w-full rounded-t-sm bg-primary transition-all" style={{ height: `${(d.rondines / maxBar) * 100}%`, minHeight: d.rondines > 0 ? '3px' : '0' }} />
                <span className="text-[8px] text-muted-foreground leading-tight">{d.month.split(' ')[0]}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Visitas chart */}
        <div className="bg-card rounded-xl p-4 shadow-card">
          <h3 className="text-sm font-semibold text-foreground mb-3">Visitas por Mes</h3>
          <div className="flex items-end gap-1 h-28">
            {monthlyData.map(d => (
              <div key={d.month} className="flex-1 flex flex-col items-center gap-0.5">
                <span className="text-[9px] font-bold text-foreground">{d.visitas}</span>
                <div className="w-full rounded-t-sm bg-secondary transition-all" style={{ height: `${(d.visitas / maxVisBar) * 100}%`, minHeight: d.visitas > 0 ? '3px' : '0' }} />
                <span className="text-[8px] text-muted-foreground leading-tight">{d.month.split(' ')[0]}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Monthly summary table */}
        <div className="bg-card rounded-xl p-4 shadow-card overflow-x-auto">
          <h3 className="text-sm font-semibold text-foreground mb-3">Resumen Mensual</h3>
          <table className="w-full text-[10px]">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-1.5 text-muted-foreground font-semibold">Mes</th>
                <th className="text-right py-1.5 text-muted-foreground font-semibold">Rond.</th>
                <th className="text-right py-1.5 text-muted-foreground font-semibold">Comp.</th>
                <th className="text-right py-1.5 text-muted-foreground font-semibold">Vis.</th>
                <th className="text-right py-1.5 text-muted-foreground font-semibold">Emerg.</th>
                <th className="text-right py-1.5 text-muted-foreground font-semibold">Alert.</th>
              </tr>
            </thead>
            <tbody>
              {monthlyData.map(r => (
                <tr key={r.month} className="border-b border-border/50">
                  <td className="py-1.5 font-semibold text-foreground">{r.month}</td>
                  <td className="text-right text-foreground">{r.rondines}</td>
                  <td className="text-right text-success">{r.rondinCompleted}</td>
                  <td className="text-right text-foreground">{r.visitas}</td>
                  <td className="text-right text-emergency">{r.emergencias}</td>
                  <td className="text-right text-warning">{r.alertasZona}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Top guardias */}
        {topGuardias.length > 0 && (
          <div className="bg-card rounded-xl p-4 shadow-card">
            <h3 className="text-sm font-semibold text-foreground mb-3">Top Guardias (Rondines)</h3>
            <div className="space-y-2">
              {topGuardias.map((g, i) => {
                const maxG = topGuardias[0]?.rondines || 1;
                return (
                  <div key={g.nombre}>
                    <div className="flex items-center justify-between text-xs mb-0.5">
                      <span className="text-foreground font-semibold">
                        <span className="text-primary mr-1">#{i + 1}</span>
                        {g.nombre}
                      </span>
                      <span className="text-muted-foreground">{g.rondines}</span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-primary rounded-full" style={{ width: `${(g.rondines / maxG) * 100}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
};

export default EstadisticasAdmin;
