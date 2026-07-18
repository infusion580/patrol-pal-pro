/**
 * Configuración de secciones del reporte del Portal Cliente.
 *
 * El admin decide qué información se le muestra a cada cliente. Este módulo:
 *  - define el tipo compartido
 *  - expone la lista de secciones con su etiqueta legible (single source of truth)
 *  - centraliza la carga desde Supabase con defaults seguros
 *
 * Al añadir una nueva sección, basta con:
 *  1) Agregar la columna en la tabla `cliente_reporte_config`
 *  2) Añadir un entry en `REPORT_SECTIONS`
 *  3) Envolver el bloque JSX con `{config.<flag> && (...)}` en ClienteDashboard
 */
import { supabase } from '@/integrations/supabase/client';

export interface ClienteReportConfig {
  show_kpi_cumplimiento: boolean;
  show_kpi_rondines: boolean;
  show_kpi_guardias: boolean;
  show_kpi_incidencias: boolean;
  show_semaforo: boolean;
  show_chart_rondines_dia: boolean;
  show_chart_rondines_servicio: boolean;
  show_chart_distribucion_turnos: boolean;
  show_lista_guardias: boolean;
  show_lista_servicios: boolean;
  show_reportes_incidencias: boolean;
  show_export_excel: boolean;
}

export type ClienteReportSectionKey = keyof ClienteReportConfig;

/** Sección agrupada para el editor del admin. */
export interface ReportSection {
  key: ClienteReportSectionKey;
  label: string;
  description: string;
  group: 'KPIs' | 'Gráficas' | 'Listados' | 'Exportación';
}

export const REPORT_SECTIONS: ReportSection[] = [
  { key: 'show_kpi_cumplimiento',       label: 'KPI: % de cumplimiento de turnos', description: 'Porcentaje de turnos finalizados respecto al total.', group: 'KPIs' },
  { key: 'show_kpi_rondines',           label: 'KPI: Total de rondines',           description: 'Cantidad total de rondines en el período.',           group: 'KPIs' },
  { key: 'show_kpi_incidencias',        label: 'KPI: Incidencias',                 description: 'Número de reportes con incidencias.',                 group: 'KPIs' },
  { key: 'show_kpi_guardias',           label: 'KPI: Guardias asignados',          label_alt: 'Guardias', description: 'Total de guardias en los servicios visibles.', group: 'KPIs' } as ReportSection,
  { key: 'show_chart_rondines_dia',        label: 'Gráfica: Rondines por día',       description: 'Línea de tiempo con rondines diarios.',              group: 'Gráficas' },
  { key: 'show_chart_rondines_servicio',   label: 'Gráfica: Rondines por servicio',  description: 'Barras comparando rondines por ubicación.',          group: 'Gráficas' },
  { key: 'show_chart_distribucion_turnos', label: 'Gráfica: Distribución de turnos', description: 'Pastel de turnos finalizados vs abiertos.',          group: 'Gráficas' },
  { key: 'show_semaforo',                  label: 'Semáforo por servicio',           description: 'Indicador verde/amarillo/rojo de cada servicio.',   group: 'Listados' },
  { key: 'show_lista_servicios',           label: 'Listado de servicios contratados',description: 'Detalle de cada servicio con su estado.',            group: 'Listados' },
  { key: 'show_lista_guardias',            label: 'Listado de guardias por servicio',description: 'Muestra qué guardias atienden cada servicio.',       group: 'Listados' },
  { key: 'show_reportes_incidencias',      label: 'Historial de rondines',           description: 'Registro cronológico de rondines del período.',      group: 'Listados' },
  { key: 'show_export_excel',              label: 'Botón "Descargar reporte" (Excel)', description: 'Permite exportar el reporte a XLSX.',              group: 'Exportación' },
];

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
  return { ...base, ...(data as any) };
}
