import { supabase } from '@/integrations/supabase/client';

export interface ServicioAsignado {
  id: string;
  nombre: string;
  tipo_turno?: string | null;
  es_principal?: boolean;
}

/**
 * Devuelve los servicios que un guardia puede cubrir.
 * Regla de negocio: el guardia SOLO puede operar el servicio marcado
 * como principal por el admin, aunque tenga varios asignados.
 * Si no tiene principal explícito, se toma el primero asignado.
 * Los roles supervisor/admin/cliente ven todos los servicios.
 */
export async function loadServiciosParaUsuario(
  userId: string,
  role: string,
): Promise<ServicioAsignado[]> {
  if (role !== 'guardia') {
    const { data } = await supabase
      .from('servicios')
      .select('id, nombre, tipo_turno')
      .order('nombre');
    return (data as any[]) || [];
  }

  const { data: asignaciones } = await supabase
    .from('guardia_servicios')
    .select('servicio_id, es_principal, servicios(id, nombre, tipo_turno)')
    .eq('guardia_id', userId);

  if (!asignaciones || asignaciones.length === 0) return [];

  const principal =
    asignaciones.find((a: any) => a.es_principal) || asignaciones[0];
  const svc: any = (principal as any).servicios;
  if (!svc) return [];
  return [{ id: svc.id, nombre: svc.nombre, tipo_turno: svc.tipo_turno, es_principal: true }];
}
