/**
 * "Datos capturados" del Portal Cliente.
 *
 * Toma TODO lo que la plataforma registra para los servicios contratados por el
 * cliente y lo entrega ya normalizado en bloques listos para pintar (tabla) o
 * exportar a PDF. Cada bloque está atado a una bandera de `ClienteReportConfig`,
 * de modo que el administrador decide dato por dato qué se muestra.
 *
 * Para añadir un bloque nuevo:
 *  1) Agregar la bandera en `cliente-report-config.ts` (y su columna en la BD)
 *  2) Agregar aquí un `push(...)` con su consulta
 */
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import type { ClienteReportConfig, ClienteReportSectionKey } from '@/lib/cliente-report-config';

export type FotoBucket = 'evidencias' | 'visitas' | 'pendientes';

export interface FotoCapturada {
  bucket: FotoBucket;
  path: string;
  caption: string;
}

export interface BloqueDatos {
  key: ClienteReportSectionKey;
  titulo: string;
  columnas: string[];
  filas: (string | number)[][];
  fotos?: FotoCapturada[];
  total: number;
}

const MAX_FILAS = 300;

const fecha = (v?: string | null) =>
  v ? format(new Date(v), "dd/MM/yyyy HH:mm", { locale: es }) : '—';
const fechaCorta = (v?: string | null) =>
  v ? format(new Date(`${v}T12:00:00`), 'dd/MM/yyyy') : '—';
const txt = (v: unknown, max = 180) => {
  const s = String(v ?? '').trim();
  return s ? (s.length > max ? `${s.slice(0, max)}…` : s) : '—';
};
const coord = (lat?: number | null, lng?: number | null) =>
  lat != null && lng != null ? `${Number(lat).toFixed(5)}, ${Number(lng).toFixed(5)}` : 'Sin ubicación';

/** Ejecuta una consulta tolerando errores de permisos: devuelve [] en su lugar. */
const safe = async <T,>(p: PromiseLike<{ data: T[] | null }>): Promise<T[]> => {
  try {
    const { data } = await p;
    return (data as T[]) || [];
  } catch {
    return [];
  }
};

export interface DatosCapturados {
  bloques: BloqueDatos[];
  servicios: { id: string; nombre: string }[];
}

/**
 * Carga todos los datos capturados del periodo para los servicios del cliente,
 * filtrando por la configuración de visibilidad definida por el administrador.
 */
export async function cargarDatosCapturados(
  clienteId: string,
  desde: Date,
  hasta: Date,
  config: ClienteReportConfig,
  servicioFiltro: string | 'all' = 'all',
): Promise<DatosCapturados> {
  const startIso = new Date(`${format(desde, 'yyyy-MM-dd')}T00:00:00`).toISOString();
  const endIso = new Date(`${format(hasta, 'yyyy-MM-dd')}T23:59:59`).toISOString();

  const { data: cs } = await supabase
    .from('cliente_servicios' as any)
    .select('servicio_id')
    .eq('cliente_id', clienteId);
  let servicioIds = ((cs as any[]) || []).map(r => r.servicio_id as string);
  if (servicioFiltro !== 'all') servicioIds = servicioIds.filter(id => id === servicioFiltro);
  if (servicioIds.length === 0) return { bloques: [], servicios: [] };

  const { data: srvs } = await supabase.from('servicios').select('id, nombre').in('id', servicioIds);
  const servicios = ((srvs as any[]) || []).map(s => ({ id: s.id as string, nombre: s.nombre as string }));
  const nombreServicio = (id?: string | null) => servicios.find(s => s.id === id)?.nombre ?? '—';

  // Perfiles de los guardias que atienden estos servicios (para mostrar nombres).
  const gs = await safe<any>(
    supabase.from('guardia_servicios').select('guardia_id, servicio_id').in('servicio_id', servicioIds),
  );
  const guardiaIds = Array.from(new Set(gs.map(g => g.guardia_id as string)));
  const perfiles = guardiaIds.length
    ? await safe<any>(supabase.from('profiles').select('user_id, nombre, apellido, numero_empleado').in('user_id', guardiaIds))
    : [];
  const nombreGuardia = (id?: string | null) => {
    const p = perfiles.find(x => x.user_id === id);
    return p ? `${p.nombre} ${p.apellido}` : 'Guardia';
  };

  const [
    turnos, asistencias, faltas, notas,
    rondines, scans, checkpoints,
    novedades, reportesTurno,
    visitas, pendientes, completados,
    validaciones, sesiones, alertas, emergencias,
    comunicados, reconocimientos, metas, cuadro,
  ] = await Promise.all([
    safe<any>(supabase.from('turnos').select('*').in('servicio_id', servicioIds).gte('inicio', startIso).lte('inicio', endIso).order('inicio', { ascending: false })),
    safe<any>(supabase.from('asistencias').select('*').in('servicio_id', servicioIds).gte('inicio', startIso).lte('inicio', endIso).order('inicio', { ascending: false })),
    safe<any>(supabase.from('faltas').select('*').in('servicio_id', servicioIds).gte('fecha', format(desde, 'yyyy-MM-dd')).lte('fecha', format(hasta, 'yyyy-MM-dd'))),
    safe<any>(supabase.from('notas_relevo').select('*').in('servicio_id', servicioIds).gte('created_at', startIso).lte('created_at', endIso).order('created_at', { ascending: false })),
    safe<any>(supabase.from('rondines').select('*').in('servicio_id', servicioIds).gte('created_at', startIso).lte('created_at', endIso).order('created_at', { ascending: false })),
    safe<any>(supabase.from('rondin_scans').select('*').gte('scanned_at', startIso).lte('scanned_at', endIso).order('scanned_at', { ascending: false })),
    safe<any>(supabase.from('checkpoints').select('*').in('servicio_id', servicioIds)),
    safe<any>(supabase.from('novedades').select('*').in('servicio_id', servicioIds).gte('created_at', startIso).lte('created_at', endIso).order('created_at', { ascending: false })),
    safe<any>(supabase.from('reportes_turno').select('*').gte('created_at', startIso).lte('created_at', endIso).order('created_at', { ascending: false })),
    safe<any>(supabase.from('visitas').select('*').in('servicio_id', servicioIds).gte('hora_entrada', startIso).lte('hora_entrada', endIso).order('hora_entrada', { ascending: false })),
    safe<any>(supabase.from('pendientes_puesto').select('*').in('servicio_id', servicioIds)),
    safe<any>(supabase.from('pendientes_completados').select('*').gte('created_at', startIso).lte('created_at', endIso).order('created_at', { ascending: false })),
    safe<any>(supabase.from('validaciones_puesto').select('*').in('servicio_id', servicioIds).gte('created_at', startIso).lte('created_at', endIso).order('created_at', { ascending: false })),
    safe<any>(supabase.from('sesion_registros').select('*').gte('created_at', startIso).lte('created_at', endIso).order('created_at', { ascending: false })),
    safe<any>(supabase.from('notificaciones').select('*').gte('created_at', startIso).lte('created_at', endIso).order('created_at', { ascending: false })),
    safe<any>(supabase.from('emergencias').select('*').gte('created_at', startIso).lte('created_at', endIso).order('created_at', { ascending: false })),
    safe<any>(supabase.from('comunicados').select('*').eq('estado', 'publicado').gte('created_at', startIso).lte('created_at', endIso).order('created_at', { ascending: false })),
    safe<any>(supabase.from('reconocimientos').select('*').eq('publicado', true).order('created_at', { ascending: false })),
    safe<any>(supabase.from('metas_servicio').select('*').in('servicio_id', servicioIds)),
    safe<any>(supabase.from('cuadro_honor').select('*').in('servicio_id', servicioIds).gte('fecha', format(desde, 'yyyy-MM-dd')).lte('fecha', format(hasta, 'yyyy-MM-dd'))),
  ]);

  const rondinIds = new Set(rondines.map(r => r.id as string));
  const scansDelCliente = scans.filter(s => rondinIds.has(s.rondin_id));
  const pendienteIds = new Set(pendientes.map(p => p.id as string));
  const completadosDelCliente = completados.filter(c => pendienteIds.has(c.pendiente_id));
  const nombreCheckpoint = (id?: string | null) => checkpoints.find(c => c.id === id)?.nombre ?? 'Punto';

  const bloques: BloqueDatos[] = [];
  const push = (
    key: ClienteReportSectionKey,
    titulo: string,
    columnas: string[],
    filas: (string | number)[][],
    fotos?: FotoCapturada[],
  ) => {
    if (!config[key]) return;
    bloques.push({ key, titulo, columnas, filas: filas.slice(0, MAX_FILAS), total: filas.length, fotos });
  };

  // ------------------------------------------------- Turnos y asistencia
  push('show_turnos_detalle', 'Detalle de turnos', ['Guardia', 'Servicio', 'Inicio', 'Fin', 'Estado'],
    turnos.map(t => [nombreGuardia(t.guardia_id), nombreServicio(t.servicio_id), fecha(t.inicio), fecha(t.fin), txt(t.status)]));

  push('show_asistencias', 'Registros de asistencia', ['Guardia', 'Servicio', 'Tipo de turno', 'Inicio', 'Fin', 'Duración (min)', 'Estado'],
    asistencias.map(a => [nombreGuardia(a.guardia_id), nombreServicio(a.servicio_id), txt(a.tipo_turno), fecha(a.inicio), fecha(a.fin), a.duracion_minutos ?? '—', txt(a.status)]));

  push('show_horas_extra', 'Horas extra', ['Guardia', 'Servicio', 'Fecha', 'Horas extra'],
    asistencias.filter(a => Number(a.horas_extra || 0) > 0)
      .map(a => [nombreGuardia(a.guardia_id), nombreServicio(a.servicio_id), fecha(a.inicio), Number(a.horas_extra).toFixed(1)]));

  push('show_faltas', 'Faltas e inasistencias', ['Guardia', 'Servicio', 'Fecha', 'Motivo', 'Detalle'],
    faltas.map(f => [nombreGuardia(f.guardia_id), nombreServicio(f.servicio_id), fechaCorta(f.fecha), txt(f.motivo), txt(f.detalle)]));

  push('show_notas_relevo', 'Notas de relevo', ['Fecha', 'Servicio', 'Autor', 'Pendientes', 'Instrucciones', 'Importante'],
    notas.map(n => [fecha(n.created_at), nombreServicio(n.servicio_id), txt(n.autor_nombre), txt(n.pendientes), txt(n.instrucciones), n.importante ? 'Sí' : 'No']));

  // ------------------------------------------------------------ Rondines
  push('show_rondin_puntos', 'Reporte por punto de rondín', ['Fecha', 'Punto', 'Estado', 'Observación'],
    scansDelCliente.map(s => [fecha(s.scanned_at), nombreCheckpoint(s.checkpoint_id), txt(s.estado), txt(s.observacion)]));

  push('show_rondin_fotos', 'Fotografías de rondines', ['Fecha', 'Punto'],
    scansDelCliente.filter(s => s.foto_url).map(s => [fecha(s.scanned_at), nombreCheckpoint(s.checkpoint_id)]),
    scansDelCliente.filter(s => s.foto_url).slice(0, 60).map(s => ({
      bucket: 'evidencias' as const,
      path: s.foto_url as string,
      caption: `${nombreCheckpoint(s.checkpoint_id)} · ${fecha(s.scanned_at)}`,
    })));

  push('show_rondin_coordenadas', 'Coordenadas GPS de rondines', ['Fecha', 'Punto', 'Coordenadas'],
    scansDelCliente.map(s => [fecha(s.scanned_at), nombreCheckpoint(s.checkpoint_id), coord(s.lat, s.lng)]));

  push('show_checkpoints', 'Puntos de control configurados', ['Servicio', 'Punto', 'Ubicación', 'Radio (m)', 'Obligatorio'],
    checkpoints.map(c => [nombreServicio(c.servicio_id), txt(c.nombre), txt(c.ubicacion), c.radius_metros ?? '—', c.obligatorio ? 'Sí' : 'No']));

  // -------------------------------------------------- Novedades y reportes
  push('show_novedades', 'Novedades del turno', ['Fecha', 'Servicio', 'Guardia', 'Importancia', 'Descripción', 'Ubicación'],
    novedades.map(n => [fecha(n.created_at), nombreServicio(n.servicio_id), nombreGuardia(n.guardia_id), txt(n.importancia), txt(n.descripcion), txt(n.ubicacion_texto ?? coord(n.lat, n.lng))]));

  push('show_novedades_importantes', 'Novedades importantes', ['Fecha', 'Servicio', 'Guardia', 'Descripción'],
    novedades.filter(n => n.importancia === 'alta' || n.importancia === 'importante')
      .map(n => [fecha(n.created_at), nombreServicio(n.servicio_id), nombreGuardia(n.guardia_id), txt(n.descripcion)]));

  push('show_reportes_turno', 'Reportes de turno', ['Fecha', 'Guardia', 'Incidencias', 'Actividades', 'Observaciones', 'Estado'],
    reportesTurno.map(r => [fecha(r.created_at), nombreGuardia(r.guardia_id), txt(r.incidencias), txt(r.actividades), txt(r.observaciones), txt(r.status)]));

  // -------------------------------------------------------------- Visitas
  push('show_visitas', 'Registro de visitas', ['Entrada', 'Salida', 'Servicio', 'Visitante', 'Estado'],
    visitas.map(v => [fecha(v.hora_entrada), fecha(v.hora_salida), nombreServicio(v.servicio_id), txt(v.nombre_visitante), txt(v.status)]));

  push('show_visitas_detalle', 'Detalle de la visita', ['Entrada', 'Visitante', 'Persona a visitar', 'Área destino', 'Motivo'],
    visitas.map(v => [fecha(v.hora_entrada), txt(v.nombre_visitante), txt(v.persona_a_visitar), txt(v.area_destino), txt(v.motivo)]));

  const fotosVisitas: FotoCapturada[] = [];
  visitas.forEach(v => {
    ([['foto_ine_url', 'Identificación'], ['foto_placa_url', 'Placas'], ['foto_salida_url', 'Salida']] as const).forEach(([campo, etiqueta]) => {
      if (v[campo]) fotosVisitas.push({ bucket: 'visitas', path: v[campo] as string, caption: `${etiqueta} · ${txt(v.nombre_visitante, 40)}` });
    });
  });
  push('show_visitas_fotos', 'Fotografías de visitas', ['Visitante', 'Entrada', 'Evidencias'],
    visitas.filter(v => v.foto_ine_url || v.foto_placa_url || v.foto_salida_url)
      .map(v => [txt(v.nombre_visitante), fecha(v.hora_entrada), [v.foto_ine_url && 'INE', v.foto_placa_url && 'Placas', v.foto_salida_url && 'Salida'].filter(Boolean).join(', ')]),
    fotosVisitas.slice(0, 60));

  // -------------------------------------------------- Pendientes del puesto
  push('show_pendientes', 'Tareas del puesto', ['Servicio', 'Título', 'Prioridad', 'Frecuencia', 'Activo'],
    pendientes.map(p => [nombreServicio(p.servicio_id), txt(p.titulo), txt(p.prioridad), txt(p.frecuencia), p.activo ? 'Sí' : 'No']));

  push('show_pendientes_cumplimiento', 'Cumplimiento de tareas', ['Fecha', 'Tarea', 'Guardia', 'Nota'],
    completadosDelCliente.map(c => [
      fecha(c.created_at),
      txt(pendientes.find(p => p.id === c.pendiente_id)?.titulo),
      nombreGuardia(c.guardia_id),
      txt(c.nota),
    ]),
    completadosDelCliente.filter(c => c.foto_url).slice(0, 60).map(c => ({
      bucket: 'pendientes' as const,
      path: c.foto_url as string,
      caption: `${txt(pendientes.find(p => p.id === c.pendiente_id)?.titulo, 40)} · ${fecha(c.created_at)}`,
    })));

  // -------------------------------------------------- Validación de puesto
  push('show_validaciones_puesto', 'Validaciones de permanencia', ['Programado', 'Respondido', 'Guardia', 'Servicio', 'Resultado'],
    validaciones.map(v => [fecha(v.programado_at), fecha(v.respondido_at), nombreGuardia(v.guardia_id), nombreServicio(v.servicio_id), txt(v.resultado)]));

  push('show_validaciones_fotos', 'Fotografías de validación de puesto', ['Fecha', 'Guardia'],
    validaciones.filter(v => v.foto_url).map(v => [fecha(v.respondido_at), nombreGuardia(v.guardia_id)]),
    validaciones.filter(v => v.foto_url).slice(0, 60).map(v => ({
      bucket: 'evidencias' as const,
      path: v.foto_url as string,
      caption: `${nombreGuardia(v.guardia_id)} · ${fecha(v.respondido_at)}`,
    })));

  push('show_validaciones_ubicacion', 'Ubicación de validaciones', ['Fecha', 'Guardia', 'Coordenadas', 'Precisión (m)', 'Distancia (m)', 'Dentro del área'],
    validaciones.map(v => [fecha(v.respondido_at), nombreGuardia(v.guardia_id), coord(v.lat, v.lng), v.precision_metros ?? '—', v.distancia_metros ?? '—', v.dentro_area ? 'Sí' : 'No']));

  // ---------------------------------------------------- Accesos y sesiones
  const sesionesCliente = sesiones.filter(s => guardiaIds.includes(s.user_id));
  push('show_sesiones', 'Ingresos y cierres de sesión', ['Fecha', 'Guardia', 'Evento'],
    sesionesCliente.map(s => [fecha(s.created_at), nombreGuardia(s.user_id), txt(s.evento)]));

  push('show_sesiones_fotos', 'Fotografía de ingreso/salida', ['Fecha', 'Guardia', 'Evento'],
    sesionesCliente.filter(s => s.foto_url).map(s => [fecha(s.created_at), nombreGuardia(s.user_id), txt(s.evento)]),
    sesionesCliente.filter(s => s.foto_url).slice(0, 60).map(s => ({
      bucket: 'evidencias' as const,
      path: s.foto_url as string,
      caption: `${nombreGuardia(s.user_id)} · ${txt(s.evento, 20)} · ${fecha(s.created_at)}`,
    })));

  push('show_sesiones_ubicacion', 'Ubicación de ingreso/salida', ['Fecha', 'Guardia', 'Evento', 'Coordenadas', 'Precisión (m)'],
    sesionesCliente.map(s => [fecha(s.created_at), nombreGuardia(s.user_id), txt(s.evento), coord(s.lat, s.lng), s.precision_metros ?? '—']));

  // --------------------------------------------------------------- Alertas
  const alertasCliente = alertas.filter(a => guardiaIds.includes(a.guardia_id));
  push('show_alertas', 'Alertas y notificaciones', ['Fecha', 'Tipo', 'Guardia', 'Mensaje'],
    alertasCliente.map(a => [fecha(a.created_at), txt(a.tipo), nombreGuardia(a.guardia_id), txt(a.mensaje)]));

  const emergenciasCliente = emergencias.filter(e => guardiaIds.includes(e.guardia_id));
  push('show_emergencias', 'Botón de emergencia', ['Fecha', 'Guardia', 'Tipo', 'Ubicación', 'Atendida'],
    emergenciasCliente.map(e => [fecha(e.created_at), nombreGuardia(e.guardia_id), txt(e.tipo), coord(e.lat, e.lng), e.atendida ? 'Sí' : 'No']));

  // ------------------------------------------------ Gestión y reconocimientos
  push('show_comunicados', 'Comunicados publicados', ['Fecha', 'Título', 'Prioridad', 'Autor'],
    comunicados.map(c => [fecha(c.publicado_at ?? c.created_at), txt(c.titulo), txt(c.prioridad), txt(c.autor_nombre)]));

  push('show_reconocimientos', 'Cuadro de honor y reconocimientos', ['Periodo', 'Posición', 'Guardia', 'Motivo', 'Bono'],
    reconocimientos.map(r => [txt(r.periodo), r.posicion, nombreGuardia(r.guardia_id), txt(r.motivo), Number(r.bono || 0) > 0 ? `$${Number(r.bono).toFixed(2)}` : '—']));

  push('show_metas_servicio', 'Metas por servicio', ['Servicio', 'Rondines/día', 'Reportes/día', 'Pendientes/día', 'Horario'],
    metas.map(m => [nombreServicio(m.servicio_id), m.rondines_diarios, m.reportes_diarios, m.pendientes_diarios, `${m.hora_inicio}–${m.hora_fin}`]));

  push('show_cumplimiento_guardia', 'Cumplimiento por guardia', ['Fecha', 'Guardia', 'Servicio', 'Rondines', 'Reportes', 'Puntos'],
    cuadro.map(c => [fechaCorta(c.fecha), nombreGuardia(c.guardia_id), nombreServicio(c.servicio_id),
      `${c.rondines_completados}/${c.rondines_meta}`, `${c.reportes_completados}/${c.reportes_meta}`, c.puntos]));

  return { bloques, servicios };
}
