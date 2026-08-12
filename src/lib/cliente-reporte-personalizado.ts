/**
 * Reporte personalizado del Portal Cliente.
 *
 * Módulo autocontenido que:
 *  - Define el catálogo de secciones disponibles (single source of truth).
 *  - Calcula los indicadores del periodo reutilizando las tablas del sistema.
 *  - Persiste/lee los reportes escritos por el administrador (`cliente_reportes`).
 *  - Genera el PDF reutilizando `generateReportPdf` (branding de la empresa).
 *
 * Para agregar una sección nueva basta con añadir un entry en `REPORTE_SECCIONES`
 * (y, si aplica, alimentar `buildMetrics` con sus datos). Nada más cambia.
 */
import { supabase } from '@/integrations/supabase/client';
import { generateReportPdf } from '@/lib/pdf-report';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

// ---------------------------------------------------------------- Catálogo

export type SeccionKey =
  | 'resumen'
  | 'rondines'
  | 'asistencia'
  | 'incidencias'
  | 'novedades_importantes'
  | 'observaciones'
  | 'tareas'
  | 'alertas'
  | 'visitas'
  | 'otros';

export interface SeccionCatalogo {
  key: SeccionKey;
  titulo: string;
  descripcion: string;
}

export const REPORTE_SECCIONES: SeccionCatalogo[] = [
  { key: 'resumen', titulo: 'Resumen general del periodo', descripcion: 'Visión ejecutiva de la operación.' },
  { key: 'rondines', titulo: 'Cumplimiento de rondines', descripcion: 'Rondines realizados, completados y puntos verificados.' },
  { key: 'asistencia', titulo: 'Asistencia y validaciones de puesto', descripcion: 'Turnos cubiertos y validaciones de permanencia.' },
  { key: 'incidencias', titulo: 'Incidencias y novedades', descripcion: 'Eventos registrados durante el periodo.' },
  { key: 'novedades_importantes', titulo: 'Novedades importantes', descripcion: 'Eventos marcados como importantes.' },
  { key: 'observaciones', titulo: 'Observaciones relevantes', descripcion: 'Comentarios del supervisor o administrador.' },
  { key: 'tareas', titulo: 'Cumplimiento de tareas', descripcion: 'Pendientes del puesto completados.' },
  { key: 'alertas', titulo: 'Alertas generadas', descripcion: 'Notificaciones operativas y de emergencia.' },
  { key: 'visitas', titulo: 'Visitas', descripcion: 'Control de acceso de visitantes.' },
  { key: 'otros', titulo: 'Otros indicadores', descripcion: 'Cualquier información adicional relevante.' },
];

// ---------------------------------------------------------------- Tipos

export interface SeccionReporte {
  key: SeccionKey;
  incluir: boolean;
  /** Texto escrito por el administrador */
  texto: string;
  /** Incluir la tabla de datos automáticos del sistema */
  incluir_datos: boolean;
}

export interface ClienteReporte {
  id: string;
  cliente_id: string;
  titulo: string;
  periodo_inicio: string; // yyyy-MM-dd
  periodo_fin: string;
  estado: 'borrador' | 'publicado';
  secciones: SeccionReporte[];
  autor_nombre: string;
  publicado_at: string | null;
  created_at: string;
  updated_at: string;
}

export const seccionesPorDefecto = (): SeccionReporte[] =>
  REPORTE_SECCIONES.map(s => ({ key: s.key, incluir: s.key !== 'otros', texto: '', incluir_datos: true }));

/** Normaliza secciones guardadas contra el catálogo actual (tolerante a versiones). */
export function normalizarSecciones(raw: unknown): SeccionReporte[] {
  const arr = Array.isArray(raw) ? (raw as Partial<SeccionReporte>[]) : [];
  return REPORTE_SECCIONES.map(cat => {
    const found = arr.find(s => s?.key === cat.key);
    return {
      key: cat.key,
      incluir: found?.incluir ?? false,
      texto: found?.texto ?? '',
      incluir_datos: found?.incluir_datos ?? true,
    };
  });
}

// ---------------------------------------------------------------- Persistencia

const mapRow = (r: any): ClienteReporte => ({
  ...r,
  estado: r.estado === 'publicado' ? 'publicado' : 'borrador',
  secciones: normalizarSecciones(r.secciones),
});

export async function listarReportes(clienteId: string): Promise<ClienteReporte[]> {
  const { data } = await supabase
    .from('cliente_reportes' as any)
    .select('*')
    .eq('cliente_id', clienteId)
    .order('periodo_fin', { ascending: false });
  return ((data as any[]) || []).map(mapRow);
}

export async function guardarReporte(input: {
  id?: string;
  cliente_id: string;
  titulo: string;
  periodo_inicio: string;
  periodo_fin: string;
  estado: 'borrador' | 'publicado';
  secciones: SeccionReporte[];
  autor_id?: string | null;
  autor_nombre?: string;
}): Promise<ClienteReporte | null> {
  const payload: any = {
    cliente_id: input.cliente_id,
    titulo: input.titulo,
    periodo_inicio: input.periodo_inicio,
    periodo_fin: input.periodo_fin,
    estado: input.estado,
    secciones: input.secciones as any,
    autor_id: input.autor_id ?? null,
    autor_nombre: input.autor_nombre ?? '',
    publicado_at: input.estado === 'publicado' ? new Date().toISOString() : null,
  };
  const query = input.id
    ? supabase.from('cliente_reportes' as any).update(payload).eq('id', input.id).select().maybeSingle()
    : supabase.from('cliente_reportes' as any).insert(payload).select().maybeSingle();
  const { data, error } = await query;
  if (error || !data) return null;
  return mapRow(data);
}

export async function eliminarReporte(id: string): Promise<void> {
  await supabase.from('cliente_reportes' as any).delete().eq('id', id);
}

// ---------------------------------------------------------------- Métricas

export interface MetricaFila {
  label: string;
  valor: string | number;
}

export type MetricasPorSeccion = Partial<Record<SeccionKey, MetricaFila[]>>;

/**
 * Calcula los indicadores del periodo para los servicios del cliente.
 * Reutiliza las tablas ya existentes del sistema; si una consulta falla
 * (por permisos), esa sección simplemente queda sin datos automáticos.
 */
export async function buildMetrics(
  clienteId: string,
  desde: Date,
  hasta: Date,
): Promise<{ metrics: MetricasPorSeccion; servicios: { id: string; nombre: string }[] }> {
  const startIso = new Date(`${format(desde, 'yyyy-MM-dd')}T00:00:00`).toISOString();
  const endIso = new Date(`${format(hasta, 'yyyy-MM-dd')}T23:59:59`).toISOString();

  const { data: cs } = await supabase
    .from('cliente_servicios' as any)
    .select('servicio_id')
    .eq('cliente_id', clienteId);
  const servicioIds = ((cs as any[]) || []).map(r => r.servicio_id);
  if (servicioIds.length === 0) return { metrics: {}, servicios: [] };

  const { data: srvs } = await supabase.from('servicios').select('id, nombre').in('id', servicioIds);
  const servicios = ((srvs as any[]) || []).map(s => ({ id: s.id, nombre: s.nombre }));

  const safe = async <T,>(p: PromiseLike<{ data: T[] | null }>): Promise<T[]> => {
    try { const { data } = await p; return (data as T[]) || []; } catch { return []; }
  };

  const [rondines, turnos, asistencias, validaciones, novedades, visitas, pendientes] = await Promise.all([
    safe<any>(supabase.from('rondines').select('id, status, servicio_id, created_at').in('servicio_id', servicioIds).gte('created_at', startIso).lte('created_at', endIso)),
    safe<any>(supabase.from('turnos').select('id, status, fin, inicio').in('servicio_id', servicioIds).gte('inicio', startIso).lte('inicio', endIso)),
    safe<any>(supabase.from('asistencias').select('id, status, horas_extra, inicio').in('servicio_id', servicioIds).gte('inicio', startIso).lte('inicio', endIso)),
    safe<any>(supabase.from('validaciones_puesto').select('id, resultado, dentro_area, created_at').in('servicio_id', servicioIds).gte('created_at', startIso).lte('created_at', endIso)),
    safe<any>(supabase.from('novedades').select('id, importancia, descripcion, created_at').in('servicio_id', servicioIds).gte('created_at', startIso).lte('created_at', endIso)),
    safe<any>(supabase.from('visitas').select('id, status, hora_entrada').in('servicio_id', servicioIds).gte('hora_entrada', startIso).lte('hora_entrada', endIso)),
    safe<any>(supabase.from('pendientes_puesto').select('id, activo, servicio_id').in('servicio_id', servicioIds)),
  ]);

  const rondinesCompletados = rondines.filter(r => r.status === 'completado').length;
  const turnosFinalizados = turnos.filter(t => t.status === 'finalizado' || t.fin).length;
  const novedadesImportantes = novedades.filter(n => n.importancia === 'alta' || n.importancia === 'importante');
  const scans = await safe<any>(
    supabase.from('rondin_scans').select('id, estado, scanned_at').gte('scanned_at', startIso).lte('scanned_at', endIso),
  );

  const metrics: MetricasPorSeccion = {
    resumen: [
      { label: 'Servicios cubiertos', valor: servicios.length },
      { label: 'Turnos registrados', valor: turnos.length },
      { label: 'Turnos finalizados', valor: turnosFinalizados },
      { label: 'Rondines realizados', valor: rondines.length },
      { label: 'Novedades registradas', valor: novedades.length },
      { label: 'Visitas atendidas', valor: visitas.length },
    ],
    rondines: [
      { label: 'Rondines totales', valor: rondines.length },
      { label: 'Rondines completados', valor: rondinesCompletados },
      { label: '% de cumplimiento', valor: `${rondines.length ? Math.round((rondinesCompletados / rondines.length) * 100) : 0}%` },
      { label: 'Puntos verificados', valor: scans.length },
      { label: 'Puntos con novedad', valor: scans.filter(s => s.estado && s.estado !== 'sin_novedad').length },
    ],
    asistencia: [
      { label: 'Asistencias registradas', valor: asistencias.length },
      { label: 'Turnos finalizados', valor: turnosFinalizados },
      { label: '% de cobertura de turnos', valor: `${turnos.length ? Math.round((turnosFinalizados / turnos.length) * 100) : 0}%` },
      { label: 'Horas extra acumuladas', valor: asistencias.reduce((a, x) => a + Number(x.horas_extra || 0), 0).toFixed(1) },
      { label: 'Validaciones de puesto', valor: validaciones.length },
      { label: 'Validaciones dentro del área', valor: validaciones.filter(v => v.dentro_area).length },
    ],
    incidencias: [
      { label: 'Novedades totales', valor: novedades.length },
      { label: 'Importancia alta', valor: novedadesImportantes.length },
      { label: 'Importancia media', valor: novedades.filter(n => n.importancia === 'media').length },
      { label: 'Importancia baja', valor: novedades.filter(n => n.importancia === 'baja').length },
    ],
    novedades_importantes: novedadesImportantes.slice(0, 20).map(n => ({
      label: format(new Date(n.created_at), "dd/MM/yyyy HH:mm"),
      valor: String(n.descripcion || '').slice(0, 160),
    })),
    tareas: [
      { label: 'Pendientes del puesto activos', valor: pendientes.filter(p => p.activo).length },
    ],
    visitas: [
      { label: 'Visitas registradas', valor: visitas.length },
      { label: 'Visitas cerradas', valor: visitas.filter(v => v.status === 'cerrada' || v.status === 'salida').length },
      { label: 'Visitas abiertas', valor: visitas.filter(v => !(v.status === 'cerrada' || v.status === 'salida')).length },
    ],
  };

  // Alertas: pueden no ser accesibles para el rol cliente; se agregan sólo si hay datos.
  const notif = await safe<any>(
    supabase.from('notificaciones').select('id, tipo, created_at').gte('created_at', startIso).lte('created_at', endIso),
  );
  if (notif.length > 0) {
    const porTipo = notif.reduce<Record<string, number>>((acc, n) => {
      acc[n.tipo] = (acc[n.tipo] || 0) + 1;
      return acc;
    }, {});
    metrics.alertas = [
      { label: 'Alertas totales', valor: notif.length },
      ...Object.entries(porTipo).slice(0, 12).map(([tipo, n]) => ({ label: tipo, valor: n })),
    ];
  }

  return { metrics, servicios };
}

// ---------------------------------------------------------------- PDF

export async function descargarReportePersonalizadoPdf(opts: {
  reporte: ClienteReporte;
  clienteNombre: string;
  metrics: MetricasPorSeccion;
  logoUrl?: string;
  primaryHsl?: string;
}): Promise<void> {
  const { reporte, metrics } = opts;
  const incluidas = reporte.secciones.filter(s => s.incluir);

  const sections = incluidas.map((s, i) => {
    const cat = REPORTE_SECCIONES.find(c => c.key === s.key)!;
    const rows: (string | number)[][] = [];
    if (s.texto.trim()) rows.push(['Descripción', s.texto.trim()]);
    if (s.incluir_datos) (metrics[s.key] || []).forEach(m => rows.push([m.label, m.valor]));
    return {
      title: `${i + 1}. ${cat.titulo}`,
      columns: ['Concepto', 'Detalle'],
      rows,
      emptyText: 'Sin información capturada para esta sección.',
    };
  });

  await generateReportPdf({
    title: reporte.titulo || 'Reporte de servicios de seguridad',
    subtitle: opts.clienteNombre,
    primaryHsl: opts.primaryHsl,
    logoUrl: opts.logoUrl,
    meta: [
      { label: 'Periodo', value: `${format(new Date(`${reporte.periodo_inicio}T12:00:00`), 'dd/MM/yyyy')} al ${format(new Date(`${reporte.periodo_fin}T12:00:00`), 'dd/MM/yyyy')}` },
      { label: 'Cliente', value: opts.clienteNombre },
      { label: 'Elaborado por', value: reporte.autor_nombre || 'Administración' },
      { label: 'Emitido', value: format(new Date(), "dd 'de' MMMM yyyy", { locale: es }) },
    ],
    sections,
    footerNote: 'Documento confidencial generado automáticamente.',
    fileName: `Reporte_${reporte.periodo_inicio}_${reporte.periodo_fin}.pdf`,
  });
}
