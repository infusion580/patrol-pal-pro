/**
 * Módulo de Comunicados
 * ---------------------
 * Fuente única de verdad para crear, editar, programar, publicar y consultar
 * los comunicados internos que el administrador o supervisor envía a todos los
 * empleados con rol de guardia.
 *
 * Estados:
 *  - `borrador`   → solo visible para admin/supervisor.
 *  - `programado` → se publica automáticamente al llegar `publicar_at`
 *                   (tarea programada en el backend, cada 5 minutos).
 *  - `publicado`  → visible para todos y notificado a los guardias.
 */
import { supabase } from '@/integrations/supabase/client';
import { compressImage } from '@/lib/image-compress';

export type ComunicadoPrioridad = 'baja' | 'normal' | 'alta' | 'urgente';
export type ComunicadoEstado = 'borrador' | 'programado' | 'publicado';

export interface Comunicado {
  id: string;
  titulo: string;
  contenido: string;
  prioridad: ComunicadoPrioridad;
  imagen_url: string | null;
  estado: ComunicadoEstado;
  publicar_at: string | null;
  publicado_at: string | null;
  autor_id: string | null;
  autor_nombre: string;
  created_at: string;
  updated_at: string;
}

export interface ComunicadoInput {
  titulo: string;
  contenido: string;
  prioridad: ComunicadoPrioridad;
  imagen_url?: string | null;
  publicar_at?: string | null;
  estado?: ComunicadoEstado;
}

export const PRIORIDADES: { value: ComunicadoPrioridad; label: string; style: string }[] = [
  { value: 'baja', label: 'Baja', style: 'bg-muted text-muted-foreground' },
  { value: 'normal', label: 'Normal', style: 'bg-primary/10 text-primary' },
  { value: 'alta', label: 'Alta', style: 'bg-warning/15 text-warning' },
  { value: 'urgente', label: 'Urgente', style: 'bg-emergency/15 text-emergency' },
];

export const prioridadStyle = (p: ComunicadoPrioridad) =>
  PRIORIDADES.find((x) => x.value === p)?.style ?? PRIORIDADES[1].style;

export const ESTADO_LABEL: Record<ComunicadoEstado, string> = {
  borrador: 'Borrador',
  programado: 'Programado',
  publicado: 'Publicado',
};

export const formatFecha = (iso?: string | null) =>
  iso
    ? new Date(iso).toLocaleString('es-MX', {
        day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
      })
    : '—';

/** Lista comunicados. `soloPublicados` para la vista del guardia. */
export async function listarComunicados(soloPublicados = false): Promise<Comunicado[]> {
  let query = supabase.from('comunicados').select('*').order('created_at', { ascending: false });
  if (soloPublicados) query = query.eq('estado', 'publicado');
  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as Comunicado[];
}

/** Sube la imagen/evidencia del comunicado al bucket privado y regresa su ruta. */
export async function subirImagenComunicado(file: Blob): Promise<string> {
  const comprimida = await compressImage(file, { maxSide: 1400, quality: 0.75 });
  const path = `comunicados/${crypto.randomUUID()}.jpg`;
  const { error } = await supabase.storage
    .from('evidencias')
    .upload(path, comprimida, { contentType: 'image/jpeg', upsert: false });
  if (error) throw error;
  return path;
}

export async function crearComunicado(input: ComunicadoInput) {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id ?? null;
  let autorNombre = '';
  if (uid) {
    const { data } = await supabase.from('profiles').select('nombre,apellido').eq('user_id', uid).maybeSingle();
    autorNombre = `${data?.nombre ?? ''} ${data?.apellido ?? ''}`.trim();
  }
  const { data, error } = await supabase
    .from('comunicados')
    .insert({
      titulo: input.titulo,
      contenido: input.contenido,
      prioridad: input.prioridad,
      imagen_url: input.imagen_url ?? null,
      publicar_at: input.publicar_at ?? null,
      estado: input.estado ?? 'borrador',
      autor_id: uid,
      autor_nombre: autorNombre || 'Administración',
    })
    .select('id')
    .single();
  if (error) throw error;
  return data.id as string;
}

export async function actualizarComunicado(id: string, input: Partial<ComunicadoInput>) {
  const { error } = await supabase.from('comunicados').update(input).eq('id', id);
  if (error) throw error;
}

export async function eliminarComunicado(id: string) {
  const { error } = await supabase.from('comunicados').delete().eq('id', id);
  if (error) throw error;
}

/** Publica de inmediato y notifica a todos los guardias (RPC SECURITY DEFINER). */
export async function publicarComunicado(id: string) {
  const { error } = await supabase.rpc('publicar_comunicado', { _id: id });
  if (error) throw error;
}

/** Marca el comunicado como leído por el usuario en sesión (idempotente). */
export async function marcarLeido(comunicadoId: string) {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) return;
  await supabase
    .from('comunicado_lecturas')
    .upsert({ comunicado_id: comunicadoId, user_id: uid }, { onConflict: 'comunicado_id,user_id', ignoreDuplicates: true });
}

/** IDs de comunicados ya leídos por el usuario en sesión. */
export async function misLecturas(): Promise<Record<string, string>> {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) return {};
  const { data } = await supabase
    .from('comunicado_lecturas')
    .select('comunicado_id,leido_at')
    .eq('user_id', uid);
  return Object.fromEntries((data || []).map((r) => [r.comunicado_id, r.leido_at]));
}

/** Conteo de lecturas por comunicado (para admin/supervisor). */
export async function conteoLecturas(): Promise<Record<string, number>> {
  const { data } = await supabase.from('comunicado_lecturas').select('comunicado_id');
  const out: Record<string, number> = {};
  (data || []).forEach((r) => { out[r.comunicado_id] = (out[r.comunicado_id] || 0) + 1; });
  return out;
}
