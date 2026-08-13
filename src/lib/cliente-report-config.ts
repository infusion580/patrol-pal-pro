/**
 * Configuración de visibilidad del Portal Cliente.
 *
 * El admin decide, dato por dato, qué información capturada por la plataforma
 * se le muestra a cada cliente. Este módulo:
 *  - define el tipo compartido (single source of truth)
 *  - expone el catálogo completo de datos con su etiqueta legible y grupo
 *  - centraliza la carga desde la base con defaults seguros (todo visible)
 *
 * Al añadir un dato nuevo:
 *  1) Agregar la columna booleana en la tabla `cliente_reporte_config`
 *  2) Añadir un entry en `REPORT_SECTIONS`
 *  3) Consumir la bandera donde se renderiza (dashboard, datos capturados o PDF)
 */
import { supabase } from '@/integrations/supabase/client';

export interface ClienteReportConfig {
  // KPIs
  show_kpi_cumplimiento: boolean;
  show_kpi_rondines: boolean;
  show_kpi_guardias: boolean;
  show_kpi_incidencias: boolean;
  // Gráficas
  show_chart_rondines_dia: boolean;
  show_chart_rondines_servicio: boolean;
  show_chart_distribucion_turnos: boolean;
  // Listados base
  show_semaforo: boolean;
  show_lista_guardias: boolean;
  show_lista_servicios: boolean;
  show_reportes_incidencias: boolean;
  // Turnos y asistencia
  show_turnos_detalle: boolean;
  show_asistencias: boolean;
  show_horas_extra: boolean;
  show_faltas: boolean;
  show_notas_relevo: boolean;
  // Rondines
  show_rondin_puntos: boolean;
  show_rondin_fotos: boolean;
  show_rondin_coordenadas: boolean;
  show_checkpoints: boolean;
  // Novedades y reportes
  show_novedades: boolean;
  show_novedades_importantes: boolean;
  show_reportes_turno: boolean;
  // Visitas
  show_visitas: boolean;
  show_visitas_detalle: boolean;
  show_visitas_fotos: boolean;
  // Pendientes
  show_pendientes: boolean;
  show_pendientes_cumplimiento: boolean;
  // Validación de puesto
  show_validaciones_puesto: boolean;
  show_validaciones_fotos: boolean;
  show_validaciones_ubicacion: boolean;
  // Accesos / sesiones
  show_sesiones: boolean;
  show_sesiones_fotos: boolean;
  show_sesiones_ubicacion: boolean;
  // Alertas
  show_alertas: boolean;
  show_emergencias: boolean;
  // Gestión
  show_comunicados: boolean;
  show_reconocimientos: boolean;
  show_metas_servicio: boolean;
  show_cumplimiento_guardia: boolean;
  // Exportación
  show_export_excel: boolean;
  show_export_pdf: boolean;
}

export type ClienteReportSectionKey = keyof ClienteReportConfig;

export type ReportGroup =
  | 'KPIs'
  | 'Gráficas'
  | 'Listados'
  | 'Turnos y asistencia'
  | 'Rondines'
  | 'Novedades y reportes'
  | 'Visitas'
  | 'Pendientes del puesto'
  | 'Validación de puesto'
  | 'Accesos y sesiones'
  | 'Alertas'
  | 'Gestión y reconocimientos'
  | 'Exportación';

/** Orden en el que se muestran los grupos en el editor del admin. */
export const REPORT_GROUP_ORDER: ReportGroup[] = [
  'KPIs',
  'Gráficas',
  'Listados',
  'Turnos y asistencia',
  'Rondines',
  'Novedades y reportes',
  'Visitas',
  'Pendientes del puesto',
  'Validación de puesto',
  'Accesos y sesiones',
  'Alertas',
  'Gestión y reconocimientos',
  'Exportación',
];

/** Sección/dato configurable para el editor del admin. */
export interface ReportSection {
  key: ClienteReportSectionKey;
  label: string;
  description: string;
  group: ReportGroup;
  /** true = el dato se renderiza en la pestaña "Datos" del portal */
  datos?: boolean;
}

export const REPORT_SECTIONS: ReportSection[] = [
  // ------------------------------------------------------------------ KPIs
  { key: 'show_kpi_cumplimiento', label: 'KPI: % de cumplimiento de turnos', description: 'Porcentaje de turnos finalizados respecto al total.', group: 'KPIs' },
  { key: 'show_kpi_rondines', label: 'KPI: Total de rondines', description: 'Cantidad total de rondines en el período.', group: 'KPIs' },
  { key: 'show_kpi_incidencias', label: 'KPI: Incidencias', description: 'Número de reportes con incidencias.', group: 'KPIs' },
  { key: 'show_kpi_guardias', label: 'KPI: Guardias asignados', description: 'Total de guardias en los servicios visibles.', group: 'KPIs' },

  // -------------------------------------------------------------- Gráficas
  { key: 'show_chart_rondines_dia', label: 'Gráfica: Rondines por día', description: 'Línea de tiempo con rondines diarios.', group: 'Gráficas' },
  { key: 'show_chart_rondines_servicio', label: 'Gráfica: Rondines por servicio', description: 'Barras comparando rondines por ubicación.', group: 'Gráficas' },
  { key: 'show_chart_distribucion_turnos', label: 'Gráfica: Distribución de turnos', description: 'Pastel de turnos finalizados vs abiertos.', group: 'Gráficas' },

  // -------------------------------------------------------------- Listados
  { key: 'show_semaforo', label: 'Semáforo por servicio', description: 'Indicador verde/amarillo/rojo de cada servicio.', group: 'Listados' },
  { key: 'show_lista_servicios', label: 'Listado de servicios contratados', description: 'Detalle de cada servicio con su estado.', group: 'Listados' },
  { key: 'show_lista_guardias', label: 'Listado de guardias por servicio', description: 'Muestra qué guardias atienden cada servicio.', group: 'Listados' },
  { key: 'show_reportes_incidencias', label: 'Historial de rondines', description: 'Registro cronológico de rondines del período.', group: 'Listados' },

  // --------------------------------------------------- Turnos y asistencia
  { key: 'show_turnos_detalle', label: 'Detalle de turnos', description: 'Inicio, fin, guardia y servicio de cada turno.', group: 'Turnos y asistencia', datos: true },
  { key: 'show_asistencias', label: 'Registros de asistencia', description: 'Entradas, salidas, tipo de turno y duración.', group: 'Turnos y asistencia', datos: true },
  { key: 'show_horas_extra', label: 'Horas extra', description: 'Horas extra acumuladas por guardia.', group: 'Turnos y asistencia', datos: true },
  { key: 'show_faltas', label: 'Faltas e inasistencias', description: 'Faltas detectadas con su motivo.', group: 'Turnos y asistencia', datos: true },
  { key: 'show_notas_relevo', label: 'Notas de relevo', description: 'Pendientes e instrucciones dejadas entre turnos.', group: 'Turnos y asistencia', datos: true },

  // -------------------------------------------------------------- Rondines
  { key: 'show_rondin_puntos', label: 'Reporte por punto de rondín', description: 'Observación y estado registrados en cada punto.', group: 'Rondines', datos: true },
  { key: 'show_rondin_fotos', label: 'Fotografías de rondines', description: 'Evidencia fotográfica de cada punto verificado.', group: 'Rondines', datos: true },
  { key: 'show_rondin_coordenadas', label: 'Coordenadas GPS de rondines', description: 'Latitud y longitud del escaneo de cada punto.', group: 'Rondines', datos: true },
  { key: 'show_checkpoints', label: 'Puntos de control configurados', description: 'Catálogo de checkpoints de cada servicio.', group: 'Rondines', datos: true },

  // -------------------------------------------------- Novedades y reportes
  { key: 'show_novedades', label: 'Novedades del turno', description: 'Todas las novedades reportadas por los guardias.', group: 'Novedades y reportes', datos: true },
  { key: 'show_novedades_importantes', label: 'Novedades marcadas como importantes', description: 'Solo los eventos marcados como importantes.', group: 'Novedades y reportes', datos: true },
  { key: 'show_reportes_turno', label: 'Reportes de turno', description: 'Incidencias, actividades y observaciones del guardia.', group: 'Novedades y reportes', datos: true },

  // --------------------------------------------------------------- Visitas
  { key: 'show_visitas', label: 'Registro de visitas', description: 'Entradas y salidas de visitantes.', group: 'Visitas', datos: true },
  { key: 'show_visitas_detalle', label: 'Detalle de la visita', description: 'Motivo, persona a visitar y área destino.', group: 'Visitas', datos: true },
  { key: 'show_visitas_fotos', label: 'Fotografías de visitas', description: 'Identificación, placas y salida del visitante.', group: 'Visitas', datos: true },

  // -------------------------------------------------- Pendientes del puesto
  { key: 'show_pendientes', label: 'Tareas del puesto', description: 'Pendientes configurados para cada servicio.', group: 'Pendientes del puesto', datos: true },
  { key: 'show_pendientes_cumplimiento', label: 'Cumplimiento de tareas', description: 'Tareas completadas con nota y evidencia.', group: 'Pendientes del puesto', datos: true },

  // -------------------------------------------------- Validación de puesto
  { key: 'show_validaciones_puesto', label: 'Validaciones de permanencia', description: 'Confirmaciones programadas de presencia en el puesto.', group: 'Validación de puesto', datos: true },
  { key: 'show_validaciones_fotos', label: 'Fotografías de validación', description: 'Foto en vivo tomada al validar el puesto.', group: 'Validación de puesto', datos: true },
  { key: 'show_validaciones_ubicacion', label: 'Ubicación y precisión de validación', description: 'Coordenadas, distancia y si estuvo dentro del área.', group: 'Validación de puesto', datos: true },

  // ---------------------------------------------------- Accesos y sesiones
  { key: 'show_sesiones', label: 'Ingresos y cierres de sesión', description: 'Registro de inicio y cierre de sesión de los guardias.', group: 'Accesos y sesiones', datos: true },
  { key: 'show_sesiones_fotos', label: 'Fotografía de ingreso/salida', description: 'Selfie en vivo capturada al iniciar o cerrar sesión.', group: 'Accesos y sesiones', datos: true },
  { key: 'show_sesiones_ubicacion', label: 'Ubicación de ingreso/salida', description: 'Coordenadas GPS y precisión del registro de sesión.', group: 'Accesos y sesiones', datos: true },

  // ---------------------------------------------------------------- Alertas
  { key: 'show_alertas', label: 'Alertas y notificaciones', description: 'Alertas operativas generadas en sus servicios.', group: 'Alertas', datos: true },
  { key: 'show_emergencias', label: 'Botón de emergencia', description: 'Activaciones del botón de pánico y su atención.', group: 'Alertas', datos: true },

  // ------------------------------------------------ Gestión y reconocimientos
  { key: 'show_comunicados', label: 'Comunicados publicados', description: 'Avisos internos publicados al personal.', group: 'Gestión y reconocimientos', datos: true },
  { key: 'show_reconocimientos', label: 'Cuadro de honor y reconocimientos', description: 'Guardias reconocidos y bonos otorgados.', group: 'Gestión y reconocimientos', datos: true },
  { key: 'show_metas_servicio', label: 'Metas por servicio', description: 'Rondines, reportes y pendientes diarios esperados.', group: 'Gestión y reconocimientos', datos: true },
  { key: 'show_cumplimiento_guardia', label: 'Cumplimiento por guardia', description: 'Puntos e insignias diarias del cuadro de honor.', group: 'Gestión y reconocimientos', datos: true },

  // ----------------------------------------------------------- Exportación
  { key: 'show_export_excel', label: 'Botón "Descargar reporte" (Excel)', description: 'Permite exportar el reporte a XLSX.', group: 'Exportación' },
  { key: 'show_export_pdf', label: 'Descarga de datos en PDF', description: 'Permite exportar los datos capturados a PDF.', group: 'Exportación' },
];

/** Datos que se renderizan en la pestaña "Datos" del portal. */
export const DATA_SECTIONS = REPORT_SECTIONS.filter(s => s.datos);

export const sectionLabel = (key: ClienteReportSectionKey): string =>
  REPORT_SECTIONS.find(s => s.key === key)?.label ?? key;

/** Valores por defecto: todo visible. */
export const defaultClienteReportConfig = (): ClienteReportConfig =>
  REPORT_SECTIONS.reduce((acc, s) => {
    acc[s.key] = true;
    return acc;
  }, {} as ClienteReportConfig);

/**
 * Carga la config para un cliente. Si no existe fila (o hay error), devuelve
 * los valores por defecto para que el portal nunca quede vacío.
 */
export async function loadClienteReportConfig(clienteId: string): Promise<ClienteReportConfig> {
  const { data, error } = await supabase
    .from('cliente_reporte_config' as any)
    .select('*')
    .eq('cliente_id', clienteId)
    .maybeSingle();

  if (error || !data) return defaultClienteReportConfig();

  const base = defaultClienteReportConfig();
  const row = data as unknown as Record<string, unknown>;
  // Solo se toman las claves conocidas del catálogo (tolerante a versiones).
  REPORT_SECTIONS.forEach(s => {
    if (typeof row[s.key] === 'boolean') base[s.key] = row[s.key] as boolean;
  });
  return base;
}
