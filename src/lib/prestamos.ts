/**
 * Módulo de Solicitud de Préstamos
 * --------------------------------
 * Flujo: Guardia → Supervisor → Administrador → Depósito.
 *
 * Toda transición de estado se realiza con funciones SECURITY DEFINER en la
 * base de datos (`prestamo_*`), que validan el rol del usuario, escriben la
 * bitácora (`prestamo_historial`) y generan las comunicaciones PRIVADAS
 * dirigidas únicamente a quien corresponde.
 */
import { supabase } from '@/integrations/supabase/client';

export type PrestamoEstado =
  | 'pendiente_supervisor'
  | 'pendiente_admin'
  | 'aprobado_transito'
  | 'depositado'
  | 'rechazado';

export interface Prestamo {
  id: string;
  folio: string;
  guardia_id: string;
  supervisor_id: string | null;
  monto: number;
  motivo: string;
  observaciones: string;
  estado: PrestamoEstado;
  rechazo_motivo: string | null;
  rechazo_comentario: string | null;
  aprobado_supervisor_at: string | null;
  aprobado_admin_at: string | null;
  depositado_at: string | null;
  rechazado_at: string | null;
  created_at: string;
  guardia_nombre?: string;
}

export interface PrestamoHistorial {
  id: string;
  prestamo_id: string;
  actor_nombre: string;
  actor_rol: string;
  accion: string;
  estado_anterior: string | null;
  estado_nuevo: string | null;
  comentario: string | null;
  motivo: string | null;
  created_at: string;
}

export const ESTADO_PRESTAMO: Record<PrestamoEstado, { label: string; style: string }> = {
  pendiente_supervisor: { label: 'Pendiente Supervisor', style: 'bg-warning/15 text-warning' },
  pendiente_admin: { label: 'Pendiente Administrador', style: 'bg-primary/10 text-primary' },
  aprobado_transito: { label: 'Aprobado — Depósito en tránsito', style: 'bg-success/15 text-success' },
  depositado: { label: 'Depositado', style: 'bg-success/20 text-success' },
  rechazado: { label: 'Rechazado', style: 'bg-emergency/15 text-emergency' },
};

export const MOTIVOS_RECHAZO = [
  'Límite de préstamos rebasado.',
  'Monto demasiado elevado.',
  'No cumple condiciones.',
  'Otro',
] as const;

export const HORARIO_RH =
  'Recursos Humanos atiende de lunes a viernes de 9:00 a.m. a 6:00 p.m. El tiempo máximo estimado de respuesta es de 4 horas dentro de horario laboral.';

export const AVISO_CANAL =
  'Para una atención más eficiente, evita contactar directamente por WhatsApp al Supervisor o a Recursos Humanos. Utiliza este módulo para solicitar y consultar el estado de tu préstamo.';

/**
 * Aviso adicional cuando la solicitud se envía fuera de horario, cerca del
 * cierre (16:00 en adelante) o en fin de semana: la respuesta puede pasar al
 * siguiente día hábil.
 */
export function avisoTiempoRespuesta(ahora = new Date()): string | null {
  const dia = ahora.getDay(); // 0 domingo … 6 sábado
  const hora = ahora.getHours();
  if (dia === 0 || dia === 6) {
    return 'Estás solicitando en fin de semana: tu solicitud será atendida el siguiente día hábil.';
  }
  if (hora < 9 || hora >= 18) {
    return 'Estás solicitando fuera del horario de Recursos Humanos: tu solicitud será atendida el siguiente día hábil.';
  }
  if (hora >= 16) {
    return dia === 5
      ? 'Es viernes después de las 4:00 p.m.: es probable que tu solicitud se atienda el siguiente día hábil.'
      : 'Estás solicitando cerca de las 4:00 p.m.: es posible que tu solicitud se atienda el siguiente día hábil.';
  }
  return null;
}

export const formatMonto = (n: number) =>
  n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });

export const formatFechaHora = (iso?: string | null) =>
  iso
    ? new Date(iso).toLocaleString('es-MX', {
        day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
      })
    : '—';

/**
 * Lista las solicitudes visibles para el usuario en sesión.
 * El filtrado real ocurre en la base de datos (RLS): el guardia solo ve las
 * suyas, el supervisor las de sus guardias y el administrador todas.
 */
export async function listarPrestamos(): Promise<Prestamo[]> {
  const { data, error } = await supabase
    .from('prestamos')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  const rows = (data || []) as unknown as Prestamo[];

  const ids = [...new Set(rows.map((r) => r.guardia_id))];
  if (!ids.length) return rows;

  const { data: profs } = await supabase
    .from('profiles').select('user_id,nombre,apellido').in('user_id', ids);
  const nombres = new Map((profs || []).map((p) => [p.user_id, `${p.nombre} ${p.apellido}`.trim()]));
  return rows.map((r) => ({ ...r, guardia_nombre: nombres.get(r.guardia_id) || 'Guardia' }));
}

export async function historialPrestamo(prestamoId: string): Promise<PrestamoHistorial[]> {
  const { data, error } = await supabase
    .from('prestamo_historial')
    .select('*')
    .eq('prestamo_id', prestamoId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data || []) as unknown as PrestamoHistorial[];
}

export async function crearPrestamo(monto: number, motivo: string, observaciones: string) {
  const { error } = await supabase.rpc('prestamo_crear', {
    _monto: monto, _motivo: motivo, _observaciones: observaciones,
  });
  if (error) throw error;
}

export async function aprobarSupervisor(id: string, comentario?: string) {
  const { error } = await supabase.rpc('prestamo_aprobar_supervisor', { _id: id, _comentario: comentario ?? null });
  if (error) throw error;
}

export async function aprobarAdmin(id: string, comentario?: string) {
  const { error } = await supabase.rpc('prestamo_aprobar_admin', { _id: id, _comentario: comentario ?? null });
  if (error) throw error;
}

export async function confirmarDeposito(id: string, comentario?: string) {
  const { error } = await supabase.rpc('prestamo_confirmar_deposito', { _id: id, _comentario: comentario ?? null });
  if (error) throw error;
}

export async function rechazarPrestamo(id: string, motivo: string, comentario?: string) {
  const { error } = await supabase.rpc('prestamo_rechazar', { _id: id, _motivo: motivo, _comentario: comentario ?? null });
  if (error) throw error;
}
