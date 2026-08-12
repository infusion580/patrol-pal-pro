/**
 * Política de retención de datos operativos — PUNTO ÚNICO DE CONFIGURACIÓN
 * ------------------------------------------------------------------------
 * Toda la información operativa (fotografías, asistencias, coordenadas,
 * reportes, alertas, evidencias, rondines y datos temporales asociados) se
 * conserva RETENTION_DAYS días y después se elimina automáticamente.
 *
 * Para cambiar la regla basta modificar RETENTION_DAYS (o el `days` de una
 * entrada concreta si algún dato requiere un plazo distinto).
 *
 * NO se incluye aquí nada estructural: perfiles, roles, servicios,
 * checkpoints, metas, catálogos de pendientes, teléfonos, NIPs, branding,
 * configuración de reportes ni la bitácora inmutable `audit_log`.
 */

/** Días de retención por defecto para todos los datos operativos. */
export const RETENTION_DAYS = 30;

export interface FotoColumna {
  /** Bucket de Storage donde vive el archivo. */
  bucket: 'evidencias' | 'visitas' | 'pendientes';
  /** Columna que guarda la ruta (o URL heredada) del archivo. */
  column: string;
}

export interface RetentionTarget {
  /** Tabla operativa a depurar. */
  table: string;
  /** Columna de fecha que define la antigüedad del registro. */
  dateColumn: string;
  /** Fotografías/evidencias a borrar de Storage antes de eliminar la fila. */
  photos?: FotoColumna[];
  /** Días de retención específicos (por defecto RETENTION_DAYS). */
  days?: number;
  /**
   * Si es true solo se borran las fotos y se conserva la fila
   * (útil para bitácoras que deben sobrevivir sin datos personales).
   */
  onlyPhotos?: boolean;
}

/**
 * Orden importante: las tablas hijas van ANTES que sus padres para no
 * romper llaves foráneas (p. ej. rondin_scans antes de rondines).
 */
export const RETENTION_TARGETS: RetentionTarget[] = [
  // Rondines y evidencia fotográfica
  { table: 'rondin_scans', dateColumn: 'scanned_at', photos: [{ bucket: 'evidencias', column: 'foto_url' }] },
  { table: 'rondin_alarmas', dateColumn: 'created_at' },
  { table: 'rondines', dateColumn: 'created_at' },

  // Turnos y asistencia
  { table: 'asistencias', dateColumn: 'created_at' },
  { table: 'faltas', dateColumn: 'created_at' },
  { table: 'notas_relevo', dateColumn: 'created_at' },
  { table: 'turnos', dateColumn: 'created_at' },
  { table: 'cuadro_honor', dateColumn: 'created_at' },

  // Reportes y novedades
  { table: 'reportes_turno', dateColumn: 'created_at' },
  { table: 'novedades', dateColumn: 'created_at', photos: [{ bucket: 'evidencias', column: 'foto_url' }] },
  {
    table: 'pendientes_completados',
    dateColumn: 'created_at',
    photos: [{ bucket: 'pendientes', column: 'foto_url' }],
  },

  // Alertas y emergencias
  { table: 'notificaciones', dateColumn: 'created_at', photos: [{ bucket: 'evidencias', column: 'foto_url' }] },
  { table: 'emergencias', dateColumn: 'created_at' },

  // Accesos: control de visitas (se conserva la bitácora sin fotos personales)
  {
    table: 'visitas',
    dateColumn: 'hora_entrada',
    photos: [
      { bucket: 'visitas', column: 'foto_ine_url' },
      { bucket: 'visitas', column: 'foto_placa_url' },
      { bucket: 'visitas', column: 'foto_salida_url' },
    ],
  },

  // Validación fotográfica de inicio/cierre de sesión
  { table: 'sesion_registros', dateColumn: 'created_at', photos: [{ bucket: 'evidencias', column: 'foto_url' }] },
  { table: 'validaciones_puesto', dateColumn: 'created_at', photos: [{ bucket: 'evidencias', column: 'foto_url' }] },

  // Mensajería operativa
  { table: 'chat_messages', dateColumn: 'created_at' },
];

/** Fecha de corte ISO para un objetivo de retención. */
export function cutoffISO(target: RetentionTarget, now = Date.now()): string {
  const days = target.days ?? RETENTION_DAYS;
  return new Date(now - days * 86_400_000).toISOString();
}

/** Convierte una URL heredada o ruta cruda en la ruta del objeto de Storage. */
export function toStoragePath(bucket: string, value: string | null | undefined): string | null {
  if (!value) return null;
  const marker = `/${bucket}/`;
  const i = value.indexOf(marker);
  if (i >= 0) return decodeURIComponent(value.slice(i + marker.length).split('?')[0]);
  return value.startsWith('http') ? null : value;
}
