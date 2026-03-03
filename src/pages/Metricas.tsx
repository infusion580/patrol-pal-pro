import { ArrowLeft, TrendingUp, Clock, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import BottomNav from '@/components/BottomNav';

const Metricas = () => {
  const navigate = useNavigate();

  const weeklyData = [
    { day: 'Lun', rondines: 18, incidencias: 2 },
    { day: 'Mar', rondines: 20, incidencias: 1 },
    { day: 'Mié', rondines: 17, incidencias: 3 },
    { day: 'Jue', rondines: 19, incidencias: 0 },
    { day: 'Vie', rondines: 20, incidencias: 1 },
    { day: 'Sáb', rondines: 15, incidencias: 2 },
    { day: 'Dom', rondines: 12, incidencias: 0 },
  ];

  const maxRondines = Math.max(...weeklyData.map(d => d.rondines));

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="bg-primary text-primary-foreground px-4 pt-12 pb-6 rounded-b-3xl">
        <div className="max-w-lg mx-auto">
          <button onClick={() => navigate('/dashboard')} className="flex items-center gap-1 text-sm opacity-80 mb-2">
            <ArrowLeft className="w-4 h-4" /> Regresar
          </button>
          <h1 className="text-xl font-display font-bold">Métricas Operativas</h1>
          <p className="text-sm opacity-70 mt-1">Resumen semanal</p>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 -mt-4 space-y-4">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 gap-3">
          {[
            { icon: CheckCircle2, label: 'Cumplimiento', value: '87%', color: 'text-success', desc: 'Rondines completados' },
            { icon: Clock, label: 'Tiempo Resp.', value: '2.3 min', color: 'text-primary', desc: 'Promedio' },
            { icon: AlertTriangle, label: 'Incidencias', value: '9', color: 'text-warning', desc: 'Esta semana' },
            { icon: TrendingUp, label: 'Tendencia', value: '+12%', color: 'text-success', desc: 'vs semana pasada' },
          ].map(kpi => (
            <div key={kpi.label} className="bg-card rounded-xl p-4 shadow-card">
              <kpi.icon className={`w-5 h-5 ${kpi.color} mb-2`} />
              <p className="text-2xl font-bold text-foreground">{kpi.value}</p>
              <p className="text-xs font-semibold text-foreground">{kpi.label}</p>
              <p className="text-[10px] text-muted-foreground">{kpi.desc}</p>
            </div>
          ))}
        </div>

        {/* Bar Chart */}
        <div className="bg-card rounded-xl p-4 shadow-card">
          <h3 className="text-sm font-semibold text-foreground mb-4">Rondines por Día</h3>
          <div className="flex items-end gap-2 h-32">
            {weeklyData.map(d => (
              <div key={d.day} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-[10px] font-bold text-foreground">{d.rondines}</span>
                <div
                  className="w-full bg-primary rounded-t-md transition-all"
                  style={{ height: `${(d.rondines / maxRondines) * 100}%` }}
                />
                <span className="text-[10px] text-muted-foreground">{d.day}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Top Sites */}
        <div className="bg-card rounded-xl p-4 shadow-card">
          <h3 className="text-sm font-semibold text-foreground mb-3">Incidencias por Sitio</h3>
          <div className="space-y-3">
            {[
              { site: 'Centro Comercial', count: 4, pct: 44 },
              { site: 'Plaza Central', count: 3, pct: 33 },
              { site: 'Parque Industrial', count: 2, pct: 22 },
            ].map(s => (
              <div key={s.site}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-foreground font-semibold">{s.site}</span>
                  <span className="text-muted-foreground">{s.count} incidencias</span>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-warning rounded-full" style={{ width: `${s.pct}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <BottomNav />
    </div>
  );
};

export default Metricas;
