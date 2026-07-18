import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/integrations/supabase/client';
import { Building2, Users, MapPin, CheckCircle2, AlertTriangle, Download, TrendingUp, Calendar as CalendarIcon, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { useToast } from '@/hooks/use-toast';
import { format, startOfMonth, endOfMonth, subDays, eachDayOfInterval, isWithinInterval } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip as ReTooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line, CartesianGrid,
} from 'recharts';
import * as XLSX from 'xlsx';
import BottomNav from '@/components/BottomNav';
import AppHeader from '@/components/AppHeader';
import {
  defaultClienteReportConfig,
  loadClienteReportConfig,
  type ClienteReportConfig,
} from '@/lib/cliente-report-config';


interface Servicio { id: string; nombre: string; cliente: string; direccion: string; }
interface Guardia { user_id: string; nombre: string; apellido: string; numero_empleado: string; servicio_id: string | null; }
interface Rondin { id: string; guardia_id: string; servicio_id: string | null; created_at: string; status: string; checkin_at: string | null; checkout_at: string | null; }
interface Turno { id: string; guardia_id: string; servicio_id: string | null; inicio: string; fin: string | null; status: string; }
interface Reporte { id: string; guardia_id: string; created_at: string; incidencias: string; }

const COLORS = ['hsl(var(--primary))', 'hsl(var(--secondary))', 'hsl(var(--success))', 'hsl(var(--warning))', 'hsl(var(--emergency))', 'hsl(var(--accent-foreground))'];

const ClienteDashboard = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [servicios, setServicios] = useState<Servicio[]>([]);
  const [guardias, setGuardias] = useState<Guardia[]>([]);
  const [guardiasByServicio, setGuardiasByServicio] = useState<Record<string, string[]>>({});
  const [rondines, setRondines] = useState<Rondin[]>([]);
  const [turnos, setTurnos] = useState<Turno[]>([]);
  const [reportes, setReportes] = useState<Reporte[]>([]);
  const [servicioFiltro, setServicioFiltro] = useState<string>('all');
  const [fechaInicio, setFechaInicio] = useState<Date>(startOfMonth(new Date()));
  const [fechaFin, setFechaFin] = useState<Date>(new Date());
  const [config, setConfig] = useState<ClienteReportConfig>(defaultClienteReportConfig());

  useEffect(() => { if (user) loadAll(); }, [user]);

  const loadAll = async () => {
    if (!user) return;
    setLoading(true);

    // Configuración de secciones visibles definida por el admin
    const cfg = await loadClienteReportConfig(user.id);
    setConfig(cfg);


    // 1. Get assigned services
    const { data: cs } = await supabase
      .from('cliente_servicios' as any)
      .select('servicio_id')
      .eq('cliente_id', user.id);
    const servicioIds = (cs as any[] | null)?.map(r => r.servicio_id) || [];

    if (servicioIds.length === 0) {
      setServicios([]); setGuardias([]); setRondines([]); setTurnos([]); setReportes([]);
      setLoading(false);
      return;
    }

    // 2. Load services + guards + rondines + turnos + reportes in parallel
    const [{ data: srvs }, { data: gsrv }, { data: rond }, { data: trn }] = await Promise.all([
      supabase.from('servicios').select('*').in('id', servicioIds),
      supabase.from('guardia_servicios' as any).select('guardia_id, servicio_id').in('servicio_id', servicioIds),
      supabase.from('rondines').select('*').in('servicio_id', servicioIds).gte('created_at', subDays(new Date(), 90).toISOString()).order('created_at', { ascending: false }),
      supabase.from('turnos').select('*').in('servicio_id', servicioIds).gte('inicio', subDays(new Date(), 90).toISOString()),
    ]);

    const guardiaIds = Array.from(new Set((gsrv as any[] | null)?.map(g => g.guardia_id) || []));
    const gsMap: Record<string, string[]> = {};
    (gsrv as any[] | null)?.forEach(g => {
      if (!gsMap[g.servicio_id]) gsMap[g.servicio_id] = [];
      if (!gsMap[g.servicio_id].includes(g.guardia_id)) gsMap[g.servicio_id].push(g.guardia_id);
    });

    let profs: Guardia[] = [];
    let reps: Reporte[] = [];
    if (guardiaIds.length > 0) {
      const [{ data: pData }, { data: rData }] = await Promise.all([
        supabase.from('profiles').select('user_id, nombre, apellido, numero_empleado, servicio_asignado_id').in('user_id', guardiaIds),
        supabase.from('reportes_turno').select('id, guardia_id, created_at, incidencias').in('guardia_id', guardiaIds).gte('created_at', subDays(new Date(), 90).toISOString()),
      ]);
      profs = (pData || []).map((p: any) => ({
        user_id: p.user_id, nombre: p.nombre, apellido: p.apellido,
        numero_empleado: p.numero_empleado, servicio_id: p.servicio_asignado_id,
      }));
      reps = (rData || []) as Reporte[];
    }

    setServicios((srvs as any) || []);
    setGuardiasByServicio(gsMap);
    setGuardias(profs);
    setRondines((rond as any) || []);
    setTurnos((trn as any) || []);
    setReportes(reps);
    setLoading(false);
  };

  // Filtered datasets
  const filtered = useMemo(() => {
    const dentroFecha = (iso: string) => {
      const d = new Date(iso);
      return isWithinInterval(d, { start: fechaInicio, end: new Date(fechaFin.getTime() + 86400000 - 1) });
    };
    const servFilter = (sid: string | null) => servicioFiltro === 'all' || sid === servicioFiltro;
    return {
      rondines: rondines.filter(r => dentroFecha(r.created_at) && servFilter(r.servicio_id)),
      turnos: turnos.filter(t => dentroFecha(t.inicio) && servFilter(t.servicio_id)),
      reportes: reportes.filter(r => dentroFecha(r.created_at)),
    };
  }, [rondines, turnos, reportes, servicioFiltro, fechaInicio, fechaFin]);

  // KPIs
  const kpis = useMemo(() => {
    const totalRondines = filtered.rondines.length;
    const rondinesCompletados = filtered.rondines.filter(r => r.status === 'completado').length;
    const turnosTotales = filtered.turnos.length;
    const turnosFinalizados = filtered.turnos.filter(t => t.status === 'finalizado' || t.fin).length;
    const cumplimiento = turnosTotales > 0 ? Math.round((turnosFinalizados / turnosTotales) * 100) : 0;
    const incidencias = filtered.reportes.filter(r => r.incidencias.trim().length > 0).length;
    const guardiasActivos = guardias.length;
    return { totalRondines, rondinesCompletados, cumplimiento, incidencias, turnosTotales, guardiasActivos };
  }, [filtered, guardias]);

  // Chart: rondines per day (line)
  const rondinesPorDia = useMemo(() => {
    const days = eachDayOfInterval({ start: fechaInicio, end: fechaFin });
    return days.map(d => {
      const key = format(d, 'yyyy-MM-dd');
      const count = filtered.rondines.filter(r => r.created_at.startsWith(key)).length;
      return { fecha: format(d, 'dd MMM', { locale: es }), rondines: count };
    });
  }, [filtered.rondines, fechaInicio, fechaFin]);

  // Chart: rondines por servicio (bar)
  const rondinesPorServicio = useMemo(() => {
    return servicios
      .filter(s => servicioFiltro === 'all' || s.id === servicioFiltro)
      .map(s => ({
        nombre: s.nombre.length > 14 ? s.nombre.slice(0, 14) + '…' : s.nombre,
        rondines: filtered.rondines.filter(r => r.servicio_id === s.id).length,
      }));
  }, [servicios, filtered.rondines, servicioFiltro]);

  // Chart: distribución turnos completados/abiertos (pie)
  const distribucionTurnos = useMemo(() => {
    const finalizados = filtered.turnos.filter(t => t.status === 'finalizado' || t.fin).length;
    const activos = filtered.turnos.length - finalizados;
    return [
      { name: 'Finalizados', value: finalizados },
      { name: 'En curso / abiertos', value: activos },
    ];
  }, [filtered.turnos]);

  // Guardias más puntuales (top 5 por # rondines completados)
  const guardiasPuntuales = useMemo(() => {
    const counts = new Map<string, number>();
    filtered.rondines.filter(r => r.status === 'completado').forEach(r => {
      counts.set(r.guardia_id, (counts.get(r.guardia_id) || 0) + 1);
    });
    return Array.from(counts.entries())
      .map(([gid, n]) => {
        const g = guardias.find(x => x.user_id === gid);
        return { nombre: g ? `${g.nombre} ${g.apellido}` : 'Guardia', empleado: g?.numero_empleado || '', rondines: n };
      })
      .sort((a, b) => b.rondines - a.rondines)
      .slice(0, 5);
  }, [filtered.rondines, guardias]);

  // Semáforo por servicio: based on cumplimiento de turnos para ese servicio
  const semaforoServicios = useMemo(() => {
    return servicios.map(s => {
      const tsServ = filtered.turnos.filter(t => t.servicio_id === s.id);
      const fin = tsServ.filter(t => t.status === 'finalizado' || t.fin).length;
      const pct = tsServ.length > 0 ? Math.round((fin / tsServ.length) * 100) : 0;
      const rondCount = filtered.rondines.filter(r => r.servicio_id === s.id).length;
      let color: 'verde' | 'amarillo' | 'rojo' = 'verde';
      if (tsServ.length === 0 && rondCount === 0) color = 'rojo';
      else if (pct < 70) color = 'rojo';
      else if (pct < 90) color = 'amarillo';
      return { ...s, pct, rondines: rondCount, turnos: tsServ.length, color };
    });
  }, [servicios, filtered]);

  const descargarReporte = () => {
    const wb = XLSX.utils.book_new();

    // KPIs
    const kpiSheet = XLSX.utils.json_to_sheet([
      { Indicador: 'Periodo', Valor: `${format(fechaInicio, 'dd/MM/yyyy')} - ${format(fechaFin, 'dd/MM/yyyy')}` },
      { Indicador: 'Filtro de servicio', Valor: servicioFiltro === 'all' ? 'Todos' : servicios.find(s => s.id === servicioFiltro)?.nombre || '' },
      { Indicador: 'Total Rondines', Valor: kpis.totalRondines },
      { Indicador: 'Rondines Completados', Valor: kpis.rondinesCompletados },
      { Indicador: '% Cumplimiento Turnos', Valor: `${kpis.cumplimiento}%` },
      { Indicador: 'Total Turnos', Valor: kpis.turnosTotales },
      { Indicador: 'Reportes con Incidencias', Valor: kpis.incidencias },
      { Indicador: 'Guardias en mis servicios', Valor: kpis.guardiasActivos },
    ]);
    XLSX.utils.book_append_sheet(wb, kpiSheet, 'KPIs');

    // Servicios + semáforo
    const semSheet = XLSX.utils.json_to_sheet(semaforoServicios.map(s => ({
      Servicio: s.nombre, Cliente: s.cliente, Dirección: s.direccion,
      'Cumplimiento %': s.pct, Turnos: s.turnos, Rondines: s.rondines, Estado: s.color.toUpperCase(),
    })));
    XLSX.utils.book_append_sheet(wb, semSheet, 'Servicios');

    // Top guardias
    const gSheet = XLSX.utils.json_to_sheet(guardiasPuntuales.map((g, i) => ({
      Posición: i + 1, Guardia: g.nombre, Empleado: g.empleado, 'Rondines completados': g.rondines,
    })));
    XLSX.utils.book_append_sheet(wb, gSheet, 'Top Guardias');

    // Histórico rondines
    const histSheet = XLSX.utils.json_to_sheet(filtered.rondines.map(r => ({
      Fecha: format(new Date(r.created_at), 'dd/MM/yyyy HH:mm'),
      Servicio: servicios.find(s => s.id === r.servicio_id)?.nombre || '',
      Guardia: (() => { const g = guardias.find(x => x.user_id === r.guardia_id); return g ? `${g.nombre} ${g.apellido}` : ''; })(),
      Estado: r.status,
    })));
    XLSX.utils.book_append_sheet(wb, histSheet, 'Rondines');

    XLSX.writeFile(wb, `Reporte_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
    toast({ title: 'Reporte descargado', description: 'Tu archivo Excel está listo.' });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (servicios.length === 0) {
    return (
      <div className="min-h-screen bg-background pb-20">
        <AppHeader eyebrow="Portal Cliente" title={`${user?.nombre} ${user?.apellido}`} subtitle="Sin servicios asignados" />
        <div className="max-w-lg mx-auto px-4 mt-6">
          <Card className="p-6 text-center">
            <Building2 className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
            <h2 className="font-semibold text-foreground mb-1">Aún no tienes servicios visibles</h2>
            <p className="text-sm text-muted-foreground">
              Contacta a tu administrador para que te asigne las sucursales o ubicaciones que deseas monitorear.
            </p>
          </Card>
        </div>
        <BottomNav />
      </div>
    );
  }

  const semaforoColor = (c: 'verde' | 'amarillo' | 'rojo') =>
    c === 'verde' ? 'bg-success text-success-foreground' :
    c === 'amarillo' ? 'bg-warning text-warning-foreground' :
    'bg-emergency text-emergency-foreground';

  return (
    <div className="min-h-screen bg-background pb-24">
      <AppHeader
        eyebrow="Portal Cliente"
        title={`${user?.nombre} ${user?.apellido}`}
        subtitle={`${servicios.length} ${servicios.length === 1 ? 'servicio contratado' : 'servicios contratados'}`}
      />

      <div className="max-w-5xl mx-auto px-4 -mt-4 space-y-4">
        {/* Filters */}
        <Card className="p-3 flex flex-wrap items-center gap-2">
          <div className="flex-1 min-w-[160px]">
            <label className="text-[10px] font-semibold text-muted-foreground uppercase">Servicio</label>
            <select
              value={servicioFiltro}
              onChange={(e) => setServicioFiltro(e.target.value)}
              className="w-full h-9 mt-1 rounded-lg border border-border bg-background px-2 text-sm"
            >
              <option value="all">Todos los servicios</option>
              {servicios.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
            </select>
          </div>

          <div>
            <label className="text-[10px] font-semibold text-muted-foreground uppercase block">Desde</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="h-9 mt-1 justify-start font-normal">
                  <CalendarIcon className="w-4 h-4 mr-2" />
                  {format(fechaInicio, 'dd MMM yyyy', { locale: es })}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={fechaInicio} onSelect={(d) => d && setFechaInicio(d)} initialFocus className={cn('p-3 pointer-events-auto')} />
              </PopoverContent>
            </Popover>
          </div>

          <div>
            <label className="text-[10px] font-semibold text-muted-foreground uppercase block">Hasta</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="h-9 mt-1 justify-start font-normal">
                  <CalendarIcon className="w-4 h-4 mr-2" />
                  {format(fechaFin, 'dd MMM yyyy', { locale: es })}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={fechaFin} onSelect={(d) => d && setFechaFin(d)} initialFocus className={cn('p-3 pointer-events-auto')} />
              </PopoverContent>
            </Popover>
          </div>

          {config.show_export_excel && (
            <Button onClick={descargarReporte} className="h-9 mt-5 ml-auto">
              <Download className="w-4 h-4 mr-2" />
              Descargar reporte
            </Button>
          )}
        </Card>

        {/* KPIs — cada uno se muestra si el admin lo habilitó */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {config.show_kpi_rondines && (
            <KPI icon={CheckCircle2} label="Rondines totales" value={String(kpis.totalRondines)} hint={`${kpis.rondinesCompletados} completados`} color="text-success" />
          )}
          {config.show_kpi_cumplimiento && (
            <KPI icon={TrendingUp} label="Cumplimiento turnos" value={`${kpis.cumplimiento}%`} hint={`${kpis.turnosTotales} turnos`} color="text-primary" />
          )}
          {config.show_kpi_incidencias && (
            <KPI icon={AlertTriangle} label="Incidencias" value={String(kpis.incidencias)} hint="reportes" color="text-warning" />
          )}
          {config.show_kpi_guardias && (
            <KPI icon={Users} label="Guardias" value={String(kpis.guardiasActivos)} hint="en tus servicios" color="text-secondary" />
          )}
        </div>


        {/* Tabs */}
        {/* Tabs — construidos dinámicamente según lo habilitado por el admin */}
        {(() => {
          const showServiciosTab = config.show_lista_servicios || config.show_semaforo;
          const showGuardiasTab = config.show_lista_guardias;
          const showHistorialTab = config.show_reportes_incidencias;
          const tabs: Array<{ value: string; label: string }> = [{ value: 'resumen', label: 'Resumen' }];
          if (showServiciosTab) tabs.push({ value: 'servicios', label: 'Servicios' });
          if (showGuardiasTab) tabs.push({ value: 'guardias', label: 'Guardias' });
          if (showHistorialTab) tabs.push({ value: 'historial', label: 'Historial' });
          const gridColsClass = ['', 'grid-cols-1', 'grid-cols-2', 'grid-cols-3', 'grid-cols-4'][tabs.length];
          return (
            <Tabs defaultValue="resumen" className="w-full">
              <TabsList className={cn('grid w-full', gridColsClass)}>
                {tabs.map(t => (
                  <TabsTrigger key={t.value} value={t.value}>{t.label}</TabsTrigger>
                ))}
              </TabsList>


          {/* RESUMEN: charts */}
          <TabsContent value="resumen" className="space-y-3 mt-3">
            {config.show_chart_rondines_dia && (
              <Card className="p-4">
                <h3 className="text-sm font-semibold mb-3 text-foreground">Rondines por día</h3>
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={rondinesPorDia}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="fecha" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                      <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} allowDecimals={false} />
                      <ReTooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8 }} />
                      <Line type="monotone" dataKey="rondines" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            )}

            {(config.show_chart_rondines_servicio || config.show_chart_distribucion_turnos) && (
              <div className="grid md:grid-cols-2 gap-3">
                {config.show_chart_rondines_servicio && (
                  <Card className="p-4">
                    <h3 className="text-sm font-semibold mb-3 text-foreground">Rondines por servicio</h3>
                    <div className="h-56">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={rondinesPorServicio}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis dataKey="nombre" stroke="hsl(var(--muted-foreground))" fontSize={10} />
                          <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} allowDecimals={false} />
                          <ReTooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8 }} />
                          <Bar dataKey="rondines" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </Card>
                )}

                {config.show_chart_distribucion_turnos && (
                  <Card className="p-4">
                    <h3 className="text-sm font-semibold mb-3 text-foreground">Distribución de turnos</h3>
                    <div className="h-56">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={distribucionTurnos} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={(e) => `${e.value}`}>
                            {distribucionTurnos.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                          </Pie>
                          <Legend wrapperStyle={{ fontSize: 12 }} />
                          <ReTooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </Card>
                )}
              </div>
            )}


            <Card className="p-4">
              <h3 className="text-sm font-semibold mb-3 text-foreground">🏆 Guardias más puntuales</h3>
              {guardiasPuntuales.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sin datos en el período seleccionado.</p>
              ) : (
                <ol className="space-y-2">
                  {guardiasPuntuales.map((g, i) => (
                    <li key={i} className="flex items-center gap-3 p-2 rounded-lg bg-accent/40">
                      <span className={cn('w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold',
                        i === 0 ? 'bg-warning text-warning-foreground' : 'bg-muted text-muted-foreground')}>
                        {i + 1}
                      </span>
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-foreground">{g.nombre}</p>
                        <p className="text-[11px] text-muted-foreground font-mono">#{g.empleado}</p>
                      </div>
                      <span className="text-sm font-bold text-primary">{g.rondines} rondines</span>
                    </li>
                  ))}
                </ol>
              )}
            </Card>
          </TabsContent>

          {/* SERVICIOS: semáforo + listado */}
          {showServiciosTab && (
            <TabsContent value="servicios" className="space-y-3 mt-3">
              {config.show_semaforo && (
                <p className="text-xs text-muted-foreground">
                  Semáforo basado en cumplimiento de turnos: 🟢 ≥90% &nbsp; 🟡 70–89% &nbsp; 🔴 &lt;70% o sin actividad
                </p>
              )}
              {semaforoServicios.map(s => (
                <Card key={s.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-primary" />
                        <h3 className="font-semibold text-foreground truncate">{s.nombre}</h3>
                      </div>
                      {s.cliente && <p className="text-xs text-muted-foreground mt-0.5">{s.cliente}</p>}
                      {s.direccion && <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1"><MapPin className="w-3 h-3" />{s.direccion}</p>}
                    </div>
                    {config.show_semaforo && (
                      <span className={cn('px-3 py-1 rounded-full text-xs font-bold uppercase', semaforoColor(s.color))}>
                        {s.color === 'verde' ? '🟢 Óptimo' : s.color === 'amarillo' ? '🟡 Atención' : '🔴 Crítico'}
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-2 mt-3 text-center">
                    <div className="bg-accent/40 rounded-lg p-2">
                      <p className="text-lg font-bold text-foreground">{s.pct}%</p>
                      <p className="text-[10px] text-muted-foreground uppercase">Cumplimiento</p>
                    </div>
                    <div className="bg-accent/40 rounded-lg p-2">
                      <p className="text-lg font-bold text-foreground">{s.rondines}</p>
                      <p className="text-[10px] text-muted-foreground uppercase">Rondines</p>
                    </div>
                    <div className="bg-accent/40 rounded-lg p-2">
                      <p className="text-lg font-bold text-foreground">{guardiasByServicio[s.id]?.length || 0}</p>
                      <p className="text-[10px] text-muted-foreground uppercase">Guardias</p>
                    </div>
                  </div>
                </Card>
              ))}
            </TabsContent>
          )}


          {/* GUARDIAS: por servicio */}
          {showGuardiasTab && (
            <TabsContent value="guardias" className="space-y-3 mt-3">
              {servicios.filter(s => servicioFiltro === 'all' || s.id === servicioFiltro).map(s => {
                const ids = guardiasByServicio[s.id] || [];
                const list = ids.map(id => guardias.find(g => g.user_id === id)).filter(Boolean) as Guardia[];
                return (
                  <Card key={s.id} className="p-4">
                    <h3 className="font-semibold text-foreground flex items-center gap-2 mb-2">
                      <Building2 className="w-4 h-4 text-primary" /> {s.nombre}
                      <span className="text-xs font-normal text-muted-foreground">({list.length} guardias)</span>
                    </h3>
                    {list.length === 0 ? (
                      <p className="text-sm text-muted-foreground italic">Sin guardias asignados.</p>
                    ) : (
                      <div className="space-y-2">
                        {list.map(g => (
                          <div key={g.user_id} className="flex items-center gap-3 p-2 rounded-lg bg-accent/40">
                            <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                              <span className="text-xs font-bold text-primary">{g.nombre[0]}{g.apellido[0]}</span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-foreground truncate">{g.nombre} {g.apellido}</p>
                              <p className="text-[11px] text-muted-foreground font-mono">#{g.numero_empleado}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </Card>
                );
              })}
            </TabsContent>
          )}


          {showHistorialTab && (
            <TabsContent value="historial" className="space-y-3 mt-3">
              <Card className="p-4">
                <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-primary" /> Rondines en el período
                  <span className="text-xs font-normal text-muted-foreground">({filtered.rondines.length})</span>
                </h3>
                {filtered.rondines.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic">Sin registros en el período.</p>
                ) : (
                  <div className="max-h-96 overflow-y-auto divide-y divide-border">
                    {filtered.rondines.slice(0, 100).map(r => {
                      const g = guardias.find(x => x.user_id === r.guardia_id);
                      const s = servicios.find(x => x.id === r.servicio_id);
                      return (
                        <div key={r.id} className="py-2 flex items-center gap-3">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">
                              {s?.nombre || 'Servicio'} · {g ? `${g.nombre} ${g.apellido}` : 'Guardia'}
                            </p>
                            <p className="text-[11px] text-muted-foreground">
                              {format(new Date(r.created_at), "dd MMM yyyy 'a las' HH:mm", { locale: es })}
                            </p>
                          </div>
                          <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full',
                            r.status === 'completado' ? 'bg-success/15 text-success' :
                            r.status === 'activo' ? 'bg-primary/15 text-primary' :
                            'bg-muted text-muted-foreground')}>
                            {r.status}
                          </span>
                        </div>
                      );
                    })}
                    {filtered.rondines.length > 100 && (
                      <p className="text-xs text-muted-foreground text-center pt-2">Mostrando primeros 100. Descarga el reporte para ver todos.</p>
                    )}
                  </div>
                )}
              </Card>
            </TabsContent>
          )}
        </Tabs>

        </Tabs>
          );
        })()}

      </div>

      <BottomNav />
    </div>
  );
};

const KPI = ({ icon: Icon, label, value, hint, color }: { icon: any; label: string; value: string; hint: string; color: string }) => (
  <Card className="p-3">
    <div className="flex items-center gap-2 mb-1">
      <Icon className={cn('w-4 h-4', color)} />
      <span className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider">{label}</span>
    </div>
    <p className="text-2xl font-bold text-foreground leading-tight">{value}</p>
    <p className="text-[10px] text-muted-foreground">{hint}</p>
  </Card>
);

export default ClienteDashboard;
