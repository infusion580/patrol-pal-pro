import { useState, useEffect } from 'react';
import { ArrowLeft, Download, FileSpreadsheet, Calendar, Building2, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth-context';
import BottomNav from '@/components/BottomNav';
import * as XLSX from 'xlsx';
import { tipoTurnoLabel, tipoTurnoHoras, TipoTurno } from '@/lib/asistencias-helpers';

interface Servicio { id: string; nombre: string; cliente: string; tipo_turno: TipoTurno; }
interface Asistencia {
  id: string;
  guardia_id: string;
  servicio_id: string | null;
  tipo_turno: TipoTurno;
  inicio: string;
  fin: string | null;
  fin_esperado: string | null;
  duracion_minutos: number | null;
  status: string;
  observaciones: string;
  horas_extra: number | null;
}

interface Profile { user_id: string; nombre: string; apellido: string; numero_empleado: string; }

const ReporteAsistencias = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const [servicios, setServicios] = useState<Servicio[]>([]);
  const [servicioId, setServicioId] = useState<string>('');
  const today = new Date().toISOString().slice(0, 10);
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const [fechaInicio, setFechaInicio] = useState(weekAgo);
  const [fechaFin, setFechaFin] = useState(today);
  const [asistencias, setAsistencias] = useState<Asistencia[]>([]);
  const [profiles, setProfiles] = useState<Map<string, Profile>>(new Map());
  const [loading, setLoading] = useState(false);
  const [generated, setGenerated] = useState(false);

  useEffect(() => {
    if (!user) return;
    if (user.role !== 'admin' && user.role !== 'supervisor') {
      navigate('/dashboard');
      return;
    }
    loadServicios();
  }, [user]);

  const loadServicios = async () => {
    const { data } = await supabase.from('servicios').select('id, nombre, cliente, tipo_turno').order('nombre');
    if (data) setServicios((data as any[]).map(s => ({ ...s, tipo_turno: (s.tipo_turno || '12h') as TipoTurno })));
  };

  const generarReporte = async () => {
    if (!servicioId) { toast({ title: 'Selecciona un servicio', variant: 'destructive' }); return; }
    setLoading(true);
    const desde = new Date(fechaInicio + 'T00:00:00').toISOString();
    const hasta = new Date(fechaFin + 'T23:59:59').toISOString();

    const { data, error } = await supabase
      .from('asistencias' as any)
      .select('*')
      .eq('servicio_id', servicioId)
      .gte('inicio', desde)
      .lte('inicio', hasta)
      .order('inicio', { ascending: false });

    if (error) {
      toast({ title: 'Error al generar', description: error.message, variant: 'destructive' });
      setLoading(false);
      return;
    }

    const list = (data || []) as any as Asistencia[];
    setAsistencias(list);

    const guardIds = [...new Set(list.map(a => a.guardia_id))];
    if (guardIds.length > 0) {
      const { data: profs } = await supabase
        .from('profiles')
        .select('user_id, nombre, apellido, numero_empleado')
        .in('user_id', guardIds);
      setProfiles(new Map((profs || []).map(p => [p.user_id, p as Profile])));
    } else {
      setProfiles(new Map());
    }

    setGenerated(true);
    setLoading(false);
    toast({ title: '✅ Reporte generado', description: `${list.length} asistencias encontradas.` });
  };

  /**
   * Faltas = días del rango en los que un guardia asignado al servicio no tiene
   * asistencia completa o activa.
   *
   * Excepción: si RH tiene un registro APROBADO de vacaciones, incapacidad o
   * permiso que cubre ese día, no se considera falta — se reporta como
   * "Ausencia justificada" en una columna aparte.
   */
  const calcularFaltas = async () => {
    const { data: asignados } = await supabase
      .from('guardia_servicios')
      .select('guardia_id')
      .eq('servicio_id', servicioId);

    const guardIds = [...new Set((asignados || []).map((a: any) => a.guardia_id))];
    if (guardIds.length === 0) return [];

    const { data: profs } = await supabase
      .from('profiles')
      .select('user_id, nombre, apellido, numero_empleado')
      .in('user_id', guardIds);
    const profMap = new Map((profs || []).map(p => [p.user_id, p as Profile]));

    // Ausencias autorizadas por RH que solapan el rango consultado.
    const { data: ausencias } = await supabase
      .from('registros_rh' as any)
      .select('guardia_id, tipo, fecha, fecha_fin')
      .in('guardia_id', guardIds)
      .eq('status', 'aprobado')
      .in('tipo', ['vacaciones', 'incapacidad', 'permiso'])
      .lte('fecha', fechaFin);

    /** guardia -> fecha (YYYY-MM-DD) -> tipo de ausencia justificada */
    const justificadas = new Map<string, Map<string, string>>();
    for (const a of (ausencias || []) as any[]) {
      const desde = new Date(a.fecha + 'T00:00:00');
      const hasta = new Date((a.fecha_fin || a.fecha) + 'T00:00:00');
      if (!justificadas.has(a.guardia_id)) justificadas.set(a.guardia_id, new Map());
      const m = justificadas.get(a.guardia_id)!;
      for (let d = new Date(desde); d <= hasta; d.setDate(d.getDate() + 1)) {
        m.set(d.toISOString().slice(0, 10), a.tipo);
      }
    }

    const servicio = servicios.find(s => s.id === servicioId);
    const tipoEsperado = servicio?.tipo_turno || '12h';

    const start = new Date(fechaInicio + 'T00:00:00');
    const end = new Date(fechaFin + 'T23:59:59');
    const days: string[] = [];
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      days.push(d.toISOString().slice(0, 10));
    }

    // Mapa: guardia -> set de fechas con asistencia completa o activa
    const asistMap = new Map<string, Set<string>>();
    const incompletas = new Map<string, Set<string>>();
    for (const a of asistencias) {
      const fecha = a.inicio.slice(0, 10);
      if (a.status === 'completo' || a.status === 'activo') {
        if (!asistMap.has(a.guardia_id)) asistMap.set(a.guardia_id, new Set());
        asistMap.get(a.guardia_id)!.add(fecha);
      }
      if (a.status === 'incompleto') {
        if (!incompletas.has(a.guardia_id)) incompletas.set(a.guardia_id, new Set());
        incompletas.get(a.guardia_id)!.add(fecha);
      }
    }

    const TIPO_LABEL: Record<string, string> = {
      vacaciones: 'Vacaciones autorizadas',
      incapacidad: 'Incapacidad',
      permiso: 'Permiso autorizado',
    };

    const faltas: any[] = [];
    for (const gid of guardIds) {
      const prof = profMap.get(gid);
      const nombre = prof ? `${prof.nombre} ${prof.apellido}` : gid;
      const numEmp = prof?.numero_empleado || '';
      const cumplidos = asistMap.get(gid) || new Set();
      const incomp = incompletas.get(gid) || new Set();
      const just = justificadas.get(gid) || new Map<string, string>();

      for (const day of days) {
        if (cumplidos.has(day)) continue;

        const tipoJustificado = just.get(day);
        const motivo = tipoJustificado
          ? TIPO_LABEL[tipoJustificado]
          : incomp.has(day)
            ? 'No completó turno'
            : 'No inició turno';

        faltas.push({
          'Empleado #': numEmp,
          'Guardia': nombre,
          'Servicio': servicio?.nombre || '',
          'Fecha': day,
          'Tipo de turno esperado': tipoTurnoLabel(tipoEsperado),
          'Motivo': motivo,
          'Justificada': tipoJustificado ? 'Sí' : 'No',
          'Cuenta como falta': tipoJustificado ? 'No' : 'Sí',
        });
      }
    }
    return faltas;
  };


  const exportarExcel = async () => {
    if (asistencias.length === 0) {
      toast({ title: 'No hay datos para exportar', variant: 'destructive' });
      return;
    }
    const servicio = servicios.find(s => s.id === servicioId);

    // Hoja 1: Asistencias
    const filasAsist = asistencias.map(a => {
      const prof = profiles.get(a.guardia_id);
      const dur = a.duracion_minutos != null ? `${Math.floor(a.duracion_minutos / 60)}h ${a.duracion_minutos % 60}m` : '—';
      const extras = a.horas_extra != null ? Number(a.horas_extra) : 0;
      return {
        'Servicio': servicio?.nombre || '',
        'Empleado #': prof?.numero_empleado || '',
        'Guardia': prof ? `${prof.nombre} ${prof.apellido}` : a.guardia_id,
        'Tipo de turno': tipoTurnoLabel(a.tipo_turno),
        'Fecha y hora de entrada': new Date(a.inicio).toLocaleString('es-MX'),
        'Fecha y hora de salida': a.fin ? new Date(a.fin).toLocaleString('es-MX') : '—',
        'Duración trabajada': dur,
        'Horas extra': extras > 0 ? extras.toFixed(2) : '0',
        'Estatus': a.status,
        'Observaciones': a.observaciones || '',
      };
    });


    // Hoja 2: Faltas
    const faltas = await calcularFaltas();

    const wb = XLSX.utils.book_new();
    const ws1 = XLSX.utils.json_to_sheet(filasAsist);
    XLSX.utils.book_append_sheet(wb, ws1, 'Asistencias');
    const ws2 = XLSX.utils.json_to_sheet(faltas.length > 0 ? faltas : [{ Mensaje: 'Sin faltas detectadas en el periodo' }]);
    XLSX.utils.book_append_sheet(wb, ws2, 'Faltas');

    const fileName = `Asistencias_${servicio?.nombre.replace(/\s+/g, '_') || 'servicio'}_${fechaInicio}_a_${fechaFin}.xlsx`;
    XLSX.writeFile(wb, fileName);
    toast({ title: '📥 Excel descargado', description: fileName });
  };

  const stats = {
    total: asistencias.length,
    completos: asistencias.filter(a => a.status === 'completo').length,
    incompletos: asistencias.filter(a => a.status === 'incompleto').length,
    activos: asistencias.filter(a => a.status === 'activo').length,
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="text-primary-foreground px-4 pt-12 pb-6 rounded-b-3xl app-header">
        <div className="max-w-lg mx-auto">
          <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm opacity-80 mb-2">
            <ArrowLeft className="w-4 h-4" /> Regresar
          </button>
          <h1 className="text-xl font-display font-bold">Reporte de Asistencias</h1>
          <p className="text-sm opacity-70 mt-1">Por servicio y rango de fechas</p>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 -mt-4 space-y-3">
        <div className="bg-card rounded-xl p-4 shadow-card space-y-3">
          <div>
            <Label className="text-xs flex items-center gap-1"><Building2 className="w-3 h-3" /> Servicio</Label>
            <select
              value={servicioId}
              onChange={e => setServicioId(e.target.value)}
              className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground mt-1"
            >
              <option value="">Selecciona un servicio…</option>
              {servicios.map(s => (
                <option key={s.id} value={s.id}>{s.nombre} — {tipoTurnoLabel(s.tipo_turno)}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs flex items-center gap-1"><Calendar className="w-3 h-3" /> Desde</Label>
              <Input type="date" value={fechaInicio} onChange={e => setFechaInicio(e.target.value)} className="h-10 mt-1" />
            </div>
            <div>
              <Label className="text-xs flex items-center gap-1"><Calendar className="w-3 h-3" /> Hasta</Label>
              <Input type="date" value={fechaFin} onChange={e => setFechaFin(e.target.value)} className="h-10 mt-1" />
            </div>
          </div>
          <Button onClick={generarReporte} disabled={loading || !servicioId} className="w-full">
            {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generando…</> : 'Generar Reporte'}
          </Button>
        </div>

        {generated && (
          <>
            <div className="grid grid-cols-4 gap-2">
              <div className="bg-card rounded-lg p-2 shadow-card text-center">
                <p className="text-[10px] text-muted-foreground uppercase">Total</p>
                <p className="text-lg font-bold text-foreground">{stats.total}</p>
              </div>
              <div className="bg-card rounded-lg p-2 shadow-card text-center">
                <p className="text-[10px] text-success uppercase">Completos</p>
                <p className="text-lg font-bold text-success">{stats.completos}</p>
              </div>
              <div className="bg-card rounded-lg p-2 shadow-card text-center">
                <p className="text-[10px] text-warning uppercase">Incomp.</p>
                <p className="text-lg font-bold text-warning">{stats.incompletos}</p>
              </div>
              <div className="bg-card rounded-lg p-2 shadow-card text-center">
                <p className="text-[10px] text-primary uppercase">Activos</p>
                <p className="text-lg font-bold text-primary">{stats.activos}</p>
              </div>
            </div>

            <Button onClick={exportarExcel} className="w-full bg-success text-success-foreground hover:bg-success/90">
              <FileSpreadsheet className="w-4 h-4 mr-2" /> Descargar Excel (.xlsx)
            </Button>

            <div className="bg-card rounded-xl shadow-card overflow-hidden">
              <div className="px-4 py-2 border-b border-border bg-accent/30">
                <p className="text-xs font-semibold text-foreground">Vista previa</p>
              </div>
              {asistencias.length === 0 ? (
                <p className="p-6 text-center text-sm text-muted-foreground">Sin asistencias en el rango seleccionado.</p>
              ) : (
                <div className="divide-y divide-border max-h-96 overflow-y-auto">
                  {asistencias.map(a => {
                    const prof = profiles.get(a.guardia_id);
                    const statusColor = a.status === 'completo' ? 'text-success' : a.status === 'incompleto' ? 'text-warning' : 'text-primary';
                    return (
                      <div key={a.id} className="p-3">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-semibold text-foreground">{prof ? `${prof.nombre} ${prof.apellido}` : a.guardia_id.slice(0, 8)}</p>
                          <span className={`text-[10px] font-bold uppercase ${statusColor}`}>{a.status}</span>
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          {tipoTurnoLabel(a.tipo_turno)} • {new Date(a.inicio).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })}
                          {a.fin && ` → ${new Date(a.fin).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })}`}
                        </p>
                        {a.duracion_minutos != null && (
                          <p className="text-[11px] text-muted-foreground">Duración: {Math.floor(a.duracion_minutos / 60)}h {a.duracion_minutos % 60}m</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      <BottomNav />
    </div>
  );
};

export default ReporteAsistencias;
