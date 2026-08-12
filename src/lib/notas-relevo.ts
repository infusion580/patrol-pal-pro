/**
 * Notas para el próximo relevo
 * ----------------------------
 * El guardia saliente deja pendientes e instrucciones importantes al cerrar su
 * turno; el guardia entrante del mismo servicio las visualiza y las marca como
 * leídas. Las notas forman parte de los datos operativos y se eliminan
 * automáticamente al cumplir el periodo de retención (30 días).
 */
import { supabase } from '@/integrations/supabase/client';

export interface NotaRelevo {
  id: string;
  servicio_id: string | null;
  turno_id: string | null;
  autor_id: string;
  autor_nombre: string;
  pendientes: string;
  instrucciones: string;
  importante: boolean;
  leida_por: string | null;
  leida_at: string | null;
  created_at: string;
}

export interface NuevaNotaRelevo {
  servicioId: string | null;
  turnoId: string | null;
  autorId: string;
  autorNombre: string;
  pendientes: string;
  instrucciones: string;
  importante?: boolean;
}

/** Guarda la nota del turno que termina. Devuelve true si se registró. */
export async function crearNotaRelevo(nota: NuevaNotaRelevo): Promise<boolean> {
  const pendientes = nota.pendientes.trim();
  const instrucciones = nota.instrucciones.trim();
  if (!pendientes && !instrucciones) return false;

  const { error } = await supabase.from('notas_relevo' as any).insert({
    servicio_id: nota.servicioId,
    turno_id: nota.turnoId,
    autor_id: nota.autorId,
    autor_nombre: nota.autorNombre,
    pendientes,
    instrucciones,
    importante: nota.importante ?? false,
  } as any);

  return !error;
}

/**
 * Notas pendientes de leer para el guardia entrante de un servicio.
 * Excluye las que el propio usuario escribió.
 */
export async function cargarNotasPendientes(
  servicioIds: string[],
  userId: string,
): Promise<NotaRelevo[]> {
  if (servicioIds.length === 0) return [];
  const { data } = await supabase
    .from('notas_relevo' as any)
    .select('*')
    .in('servicio_id', servicioIds)
    .is('leida_at', null)
    .neq('autor_id', userId)
    .order('created_at', { ascending: false })
    .limit(10);
  return (data as any as NotaRelevo[]) || [];
}

/** Últimas notas de un servicio (histórico visible dentro de la retención). */
export async function cargarNotasServicio(servicioId: string, limite = 20): Promise<NotaRelevo[]> {
  const { data } = await supabase
    .from('notas_relevo' as any)
    .select('*')
    .eq('servicio_id', servicioId)
    .order('created_at', { ascending: false })
    .limit(limite);
  return (data as any as NotaRelevo[]) || [];
}

/** Marca la nota como recibida por el guardia entrante. */
export async function marcarNotaLeida(notaId: string, userId: string): Promise<void> {
  await supabase
    .from('notas_relevo' as any)
    .update({ leida_por: userId, leida_at: new Date().toISOString() } as any)
    .eq('id', notaId);
}
