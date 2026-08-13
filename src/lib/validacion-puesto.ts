import { supabase } from '@/integrations/supabase/client';
import { compressImage } from '@/lib/image-compress';
import { getDeviceInfo } from '@/lib/device-info';
import { capturarUbicacion } from '@/lib/sesion-registros';

/**
 * Alertas programadas de asistencia / validación de puesto
 * --------------------------------------------------------
 * El admin o supervisor programa horarios, días, frecuencia (por horario),
 * guardias y punto/puesto esperado. Al llegar la hora, el guardia recibe una
 * pantalla bloqueante que exige fotografía en vivo; la app añade fecha, hora,
 * GPS, precisión y dispositivo, y valida si está dentro del punto del servicio.
 */

export type ResultadoValidacion = 'valida' | 'fuera_area' | 'sin_ubicacion';

export interface ValidacionConfig {
  id: string;
  nombre: string;
  servicio_id: string;
  checkpoint_id: string | null;
  /** Horarios "HH:MM:SS" en los que se solicita la validación. */
  horarios: string[];
  /** Días de aplicación: 0 = domingo … 6 = sábado. */
  dias: number[];
  tolerancia_minutos: number;
  radio_metros: number;
  /** Guardias asignados. Vacío = todos los guardias del servicio. */
  guardia_ids: string[];
  activo: boolean;
  created_at: string;
}

export interface ValidacionRegistro {
  id: string;
  config_id: string | null;
  guardia_id: string;
  servicio_id: string | null;
  checkpoint_id: string | null;
  programado_at: string;
  respondido_at: string;
  foto_url: string | null;
  lat: number | null;
  lng: number | null;
  precision_metros: number | null;
  ubicacion_error: string | null;
  distancia_metros: number | null;
  dentro_area: boolean;
  resultado: ResultadoValidacion | string;
  dispositivo: Record<string, unknown> | null;
  created_at: string;
}

/* ------------------------------------------------------------------ */
/* Geometría                                                           */
/* ------------------------------------------------------------------ */

/** Distancia en metros entre dos coordenadas (haversine). */
export function distanciaMetros(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6371000;
  const toRad = (v: number) => (v * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/* ------------------------------------------------------------------ */
/* Programación                                                        */
/* ------------------------------------------------------------------ */

export const DIAS_LABEL = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

export function horaCorta(hhmmss: string): string {
  return hhmmss.slice(0, 5);
}

/** Convierte "HH:MM[:SS]" del día indicado a una fecha local. */
export function horarioADate(base: Date, hhmm: string): Date {
  const [h, m] = hhmm.split(':').map(Number);
  const d = new Date(base);
  d.setHours(h || 0, m || 0, 0, 0);
  return d;
}

export interface SlotPendiente {
  config: ValidacionConfig;
  /** Momento programado exacto. */
  programado: Date;
}

/**
 * Devuelve el slot vigente (dentro de la tolerancia) que el guardia aún no
 * ha respondido. Solo el más reciente: se atiende uno a la vez.
 */
export function slotVigente(
  configs: ValidacionConfig[],
  ahora: Date,
  respondidos: Set<string>,
): SlotPendiente | null {
  let mejor: SlotPendiente | null = null;
  for (const config of configs) {
    if (!config.activo) continue;
    if (!config.dias.includes(ahora.getDay())) continue;
    for (const horario of config.horarios) {
      const programado = horarioADate(ahora, horario);
      const minutos = (ahora.getTime() - programado.getTime()) / 60000;
      if (minutos < 0 || minutos > config.tolerancia_minutos) continue;
      const clave = slotKey(config.id, programado);
      if (respondidos.has(clave)) continue;
      if (!mejor || programado > mejor.programado) mejor = { config, programado };
    }
  }
  return mejor;
}

export function slotKey(configId: string, programado: Date): string {
  return `${configId}|${programado.toISOString()}`;
}

/* ------------------------------------------------------------------ */
/* Acceso a datos                                                      */
/* ------------------------------------------------------------------ */

export async function listConfigs(servicioId?: string | null): Promise<ValidacionConfig[]> {
  let q = supabase.from('validacion_puesto_config').select('*').order('created_at', { ascending: false });
  if (servicioId) q = q.eq('servicio_id', servicioId);
  const { data, error } = await q;
  if (error) throw error;
  return (data as unknown as ValidacionConfig[]) || [];
}

/**
 * Programaciones que aplican a un guardia.
 * Aplica si el guardia está listado explícitamente (sin importar el servicio,
 * porque el admin ya lo eligió) o si la programación es abierta y corresponde
 * a alguno de los servicios que tiene asignados.
 */
export async function listConfigsDelGuardia(
  guardiaId: string,
  servicioIds: string | string[],
): Promise<ValidacionConfig[]> {
  const ids = (Array.isArray(servicioIds) ? servicioIds : [servicioIds]).filter(Boolean);
  const configs = await listConfigs();
  return configs.filter(
    (c) =>
      c.activo &&
      (c.guardia_ids?.includes(guardiaId) ||
        ((c.guardia_ids?.length ?? 0) === 0 && ids.includes(c.servicio_id))),
  );
}

export async function saveConfig(
  config: Partial<ValidacionConfig> & { servicio_id: string },
): Promise<void> {
  const payload = { ...config } as Record<string, unknown>;
  if (config.id) {
    const { id, ...rest } = payload as { id: string } & Record<string, unknown>;
    const { error } = await supabase.from('validacion_puesto_config').update(rest as never).eq('id', id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from('validacion_puesto_config').insert(payload as never);
    if (error) throw error;
  }
}

export async function deleteConfig(id: string): Promise<void> {
  const { error } = await supabase.from('validacion_puesto_config').delete().eq('id', id);
  if (error) throw error;
}

/** Validaciones ya respondidas hoy por el guardia (para no repetir slots). */
export async function respondidosHoy(guardiaId: string): Promise<Set<string>> {
  const inicio = new Date();
  inicio.setHours(0, 0, 0, 0);
  const { data } = await supabase
    .from('validaciones_puesto')
    .select('config_id, programado_at')
    .eq('guardia_id', guardiaId)
    .gte('programado_at', inicio.toISOString());
  const set = new Set<string>();
  for (const row of (data as { config_id: string | null; programado_at: string }[]) || []) {
    if (row.config_id) set.add(slotKey(row.config_id, new Date(row.programado_at)));
  }
  return set;
}

async function subirFoto(guardiaId: string, blob: Blob): Promise<string | null> {
  try {
    const comprimida = await compressImage(blob, { maxSide: 1024, quality: 0.7 });
    const path = `${guardiaId}/validacion-puesto/${Date.now()}.jpg`;
    const { error } = await supabase.storage
      .from('evidencias')
      .upload(path, comprimida, { contentType: 'image/jpeg', upsert: false });
    if (error) throw error;
    return path;
  } catch {
    return null;
  }
}

export interface RegistrarValidacionInput {
  config: ValidacionConfig;
  programado: Date;
  guardiaId: string;
  foto: Blob;
  /** Coordenadas del punto esperado (checkpoint del servicio). */
  punto: { lat: number; lng: number; radio: number } | null;
}

export interface RegistrarValidacionResult {
  resultado: ResultadoValidacion;
  distancia: number | null;
  dentro: boolean;
  lat: number | null;
  lng: number | null;
  precision: number | null;
  fotoPath: string | null;
}

/** Guarda la validación: foto + fecha/hora + GPS + comparación con el punto. */
export async function registrarValidacion({
  config,
  programado,
  guardiaId,
  foto,
  punto,
}: RegistrarValidacionInput): Promise<RegistrarValidacionResult> {
  const [fotoPath, pos] = await Promise.all([subirFoto(guardiaId, foto), capturarUbicacion()]);

  let distancia: number | null = null;
  let dentro = false;
  let resultado: ResultadoValidacion = 'valida';

  if (pos.lat == null || pos.lng == null) {
    resultado = 'sin_ubicacion';
  } else if (punto) {
    distancia = Math.round(distanciaMetros({ lat: pos.lat, lng: pos.lng }, punto));
    // El margen de precisión GPS evita falsos negativos en interiores.
    const margen = Math.min(pos.precision ?? 0, 50);
    dentro = distancia <= punto.radio + margen;
    resultado = dentro ? 'valida' : 'fuera_area';
  } else {
    // Sin punto configurado no hay área contra la cual comparar.
    dentro = true;
  }

  const { error } = await supabase.from('validaciones_puesto').insert({
    config_id: config.id,
    guardia_id: guardiaId,
    servicio_id: config.servicio_id,
    checkpoint_id: config.checkpoint_id,
    programado_at: programado.toISOString(),
    respondido_at: new Date().toISOString(),
    foto_url: fotoPath,
    lat: pos.lat,
    lng: pos.lng,
    precision_metros: pos.precision,
    ubicacion_error: pos.error,
    distancia_metros: distancia,
    dentro_area: dentro,
    resultado,
    dispositivo: getDeviceInfo() as unknown as Record<string, unknown>,
  } as never);
  if (error) throw error;

  return {
    resultado,
    distancia,
    dentro,
    lat: pos.lat,
    lng: pos.lng,
    precision: pos.precision,
    fotoPath,
  };
}

export interface ValidacionFiltros {
  desde?: string | null;
  hasta?: string | null;
  guardiaId?: string | null;
  servicioId?: string | null;
  resultado?: string | null;
}

export async function listValidaciones(filtros: ValidacionFiltros = {}): Promise<ValidacionRegistro[]> {
  let q = supabase
    .from('validaciones_puesto')
    .select('*')
    .order('programado_at', { ascending: false })
    .limit(500);
  if (filtros.desde) q = q.gte('programado_at', new Date(`${filtros.desde}T00:00:00`).toISOString());
  if (filtros.hasta) q = q.lte('programado_at', new Date(`${filtros.hasta}T23:59:59.999`).toISOString());
  if (filtros.guardiaId) q = q.eq('guardia_id', filtros.guardiaId);
  if (filtros.servicioId) q = q.eq('servicio_id', filtros.servicioId);
  if (filtros.resultado) q = q.eq('resultado', filtros.resultado);
  const { data, error } = await q;
  if (error) throw error;
  return (data as unknown as ValidacionRegistro[]) || [];
}

export const RESULTADO_LABEL: Record<string, string> = {
  valida: 'En su puesto',
  fuera_area: 'Fuera del área',
  sin_ubicacion: 'Sin ubicación',
};
