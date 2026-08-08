import { useState, useEffect } from 'react';
import { ArrowLeft, TrendingUp, Clock, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import BottomNav from '@/components/BottomNav';

const Metricas = () => {
  const navigate = useNavigate();
  const [totalRondines, setTotalRondines] = useState(0);
  const [totalIncidencias, setTotalIncidencias] = useState(0);
  const [weeklyData, setWeeklyData] = useState<Array<{ day: string; rondines: number }>>([]);
  const [sitioStats, setSitioStats] = useState<Array<{ site: string; count: number }>>([]);

  useEffect(() => { loadMetrics(); }, []);

  const loadMetrics = async () => {
    // Get last 7 days of rondines
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const { data: rondines } = await supabase
      .from('rondines')
      .select('created_at, servicio_id')
      .gte('created_at', sevenDaysAgo.toISOString());

    if (rondines) {
      setTotalRondines(rondines.length);

      // Group by day
      const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
      const dayCounts: Record<string, number> = {};
      rondines.forEach(r => {
        const day = dayNames[new Date(r.created_at).getDay()];
        dayCounts[day] = (dayCounts[day] || 0) + 1;
      });
      setWeeklyData(dayNames.map(day => ({ day, rondines: dayCounts[day] || 0 })));

      // Group by servicio
      const servicioIds = rondines.map(r => r.servicio_id).filter(Boolean) as string[];
      if (servicioIds.length > 0) {
        const { data: svcs } = await supabase.from('servicios').select('id, nombre').in('id', [...new Set(servicioIds)]);
        const svcMap = new Map(svcs?.map(s => [s.id, s.nombre]));
        const svcCounts: Record<string, number> = {};
        servicioIds.forEach(id => {
          const name = svcMap.get(id) || 'Sin sitio';
          svcCounts[name] = (svcCounts[name] || 0) + 1;
        });
        setSitioStats(Object.entries(svcCounts).map(([site, count]) => ({ site, count })).sort((a, b) => b.count - a.count));
      }
    }

    // Count reportes with incidencias
    const { data: reportes } = await supabase
      .from('reportes_turno')
      .select('incidencias')
      .gte('created_at', sevenDaysAgo.toISOString());
    setTotalIncidencias(reportes?.filter(r => r.incidencias.trim().length > 0).length || 0);
  };

  const maxRondines = Math.max(...weeklyData.map(d => d.rondines), 1);
  const cumplimiento = totalRondines > 0 ? Math.round((totalRondines / Math.max(totalRondines, 1)) * 100) : 0;
  const maxSitio = Math.max(...sitioStats.map(s => s.count), 1);

  return (
    <div className="min-h-dvh bg-background pb-20">
      <div className="text-primary-foreground px-4 pt-12 pb-6 rounded-b-3xl app-header">
        <div className="max-w-lg mx-auto">
          <button onClick={() => navigate('/dashboard')} className="flex items-center gap-1 text-sm opacity-80 mb-2">
            <ArrowLeft className="w-4 h-4" /> Regresar
          </button>
          <h1 className="text-xl font-display font-bold">Métricas Operativas</h1>
          <p className="text-sm opacity-70 mt-1">Resumen semanal</p>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 -mt-4 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          {[
            { icon: CheckCircle2, label: 'Rondines', value: String(totalRondines), color: 'text-success', desc: 'Esta semana' },
            { icon: AlertTriangle, label: 'Incidencias', value: String(totalIncidencias), color: 'text-warning', desc: 'Esta semana' },
            { icon: Clock, label: 'Tiempo Resp.', value: '—', color: 'text-primary', desc: 'Promedio' },
            { icon: TrendingUp, label: 'Servicios', value: String(sitioStats.length), color: 'text-success', desc: 'Con actividad' },
          ].map(kpi => (
            <div key={kpi.label} className="bg-card rounded-xl p-4 shadow-card">
              <kpi.icon className={`w-5 h-5 ${kpi.color} mb-2`} />
              <p className="text-2xl font-bold text-foreground">{kpi.value}</p>
              <p className="text-xs font-semibold text-foreground">{kpi.label}</p>
              <p className="text-[10px] text-muted-foreground">{kpi.desc}</p>
            </div>
          ))}
        </div>

        <div className="bg-card rounded-xl p-4 shadow-card">
          <h3 className="text-sm font-semibold text-foreground mb-4">Rondines por Día</h3>
          {weeklyData.length > 0 ? (
            <div className="flex items-end gap-2 h-32">
              {weeklyData.map(d => (
                <div key={d.day} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-[10px] font-bold text-foreground">{d.rondines}</span>
                  <div className="w-full bg-primary rounded-t-md transition-all" style={{ height: `${(d.rondines / maxRondines) * 100}%`, minHeight: d.rondines > 0 ? '4px' : '0' }} />
                  <span className="text-[10px] text-muted-foreground">{d.day}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">Sin datos esta semana</p>
          )}
        </div>

        {sitioStats.length > 0 && (
          <div className="bg-card rounded-xl p-4 shadow-card">
            <h3 className="text-sm font-semibold text-foreground mb-3">Rondines por Sitio</h3>
            <div className="space-y-3">
              {sitioStats.map(s => (
                <div key={s.site}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-foreground font-semibold">{s.site}</span>
                    <span className="text-muted-foreground">{s.count} rondines</span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full" style={{ width: `${(s.count / maxSitio) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
};

export default Metricas;
