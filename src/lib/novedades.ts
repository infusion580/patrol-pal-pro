import { supabase } from '@/integrations/supabase/client';

/**
 * Reporte de Novedades
 * --------------------
 * Un guardia registra N novedades durante su turno. Cada novedad guarda
 * fecha/hora automática (created_at), descripción, ubicación opcional,
 * evidencia fotográfica opcional y un nivel de importancia.
 * Las novedades marcadas como "importante" disparan alerta a supervisor y admin.
 */

export type NivelImportancia = 'normal' | 'importante';

export interface Novedad {
  id: string;
  guardia_id: string;
  servicio_id: string | null;
  turno_id: string | null;
  descripcion: string;
  importancia: NivelImportancia;
  lat: number | null;
  lng: number | null;
  ubicacion_texto: string | null;
  foto_url: string | null;
  alerta_enviada_at: string | null;
  created_at: string;
}

export interface NovedadFiltros {
  desde?: string | null; // YYYY-MM-DD
  hasta?: string | null; // YYYY-MM-DD
  guardiaId?: string | null;
  importancia?: NivelImportancia | null;
}

/** Convierte YYYY-MM-DD a límites ISO del día en hora local. */
function dayBounds(desde?: string | null, hasta?: string | null) {
  const start = desde ? new Date(`${desde}T00:00:00`) : null;
  const end = hasta ? new Date(`${hasta}T23:59:59.999`) : null;
  return { start: start?.toISOString() || null, end: end?.toISOString() || null };
}

export async function listNovedades(filtros: NovedadFiltros = {}): Promise<Novedad[]> {
  const { start, end } = dayBounds(filtros.desde, filtros.hasta);
  let q = supabase
    .from('novedades')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(500);
  if (start) q = q.gte('created_at', start);
  if (end) q = q.lte('created_at', end);
  if (filtros.guardiaId) q = q.eq('guardia_id', filtros.guardiaId);
  if (filtros.importancia) q = q.eq('importancia', filtros.importancia);
  const { data, error } = await q;
  if (error) throw error;
  return (data as any[] as Novedad[]) || [];
}

/** Novedades del turno actual del guardia (desde una hora de inicio dada, o el día de hoy). */
export async function listNovedadesDelTurno(guardiaId: string, desdeISO?: string | null): Promise<Novedad[]> {
  const desde = desdeISO || new Date(new Date().setHours(0, 0, 0, 0)).toISOString();
  const { data, error } = await supabase
    .from('novedades')
    .select('*')
    .eq('guardia_id', guardiaId)
    .gte('created_at', desde)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data as any[] as Novedad[]) || [];
}

export interface NuevaNovedad {
  guardia_id: string;
  servicio_id?: string | null;
  turno_id?: string | null;
  descripcion: string;
  importancia: NivelImportancia;
  lat?: number | null;
  lng?: number | null;
  ubicacion_texto?: string | null;
  foto_url?: string | null;
}

export async function createNovedad(n: NuevaNovedad): Promise<Novedad> {
  const { data, error } = await supabase
    .from('novedades')
    .insert({
      ...n,
      servicio_id: n.servicio_id || null,
      turno_id: n.turno_id || null,
      alerta_enviada_at: n.importancia === 'importante' ? new Date().toISOString() : null,
    } as any)
    .select()
    .single();
  if (error) throw error;
  return data as any as Novedad;
}

export async function deleteNovedad(id: string) {
  const { error } = await supabase.from('novedades').delete().eq('id', id);
  if (error) throw error;
}

/** Obtiene la ubicación actual sin bloquear el registro si el GPS falla. */
export async function tryGetPosition(): Promise<{ lat: number; lng: number } | null> {
  if (!('geolocation' in navigator)) return null;
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 },
    );
  });
}

export function formatFechaHora(iso: string) {
  const d = new Date(iso);
  return {
    fecha: d.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' }),
    hora: d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: true }),
  };
}
