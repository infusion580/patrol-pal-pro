/**
 * Cuadro de Honor — Reconocimientos y bonos
 * -----------------------------------------
 * Fuente única de verdad para crear, publicar y consultar los reconocimientos
 * que el administrador o supervisor otorga a los guardias.
 *
 * Regla de negocio: SOLO el guardia en la posición #1 puede recibir bono
 * económico (cumplió sus metas). El resto se registra con bono 0.
 */
import { supabase } from '@/integrations/supabase/client';

export interface Reconocimiento {
  id: string;
  guardia_id: string;
  posicion: number;
  periodo: string;
  motivo: string;
  bono: number;
  publicado: boolean;
  publicado_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReconocimientoInput {
  guardia_id: string;
  posicion: number;
  periodo: string;
  motivo: string;
  bono: number;
}

/** Montos sugeridos para el bono del primer lugar. */
export const BONOS_SUGERIDOS = [500, 1000, 2000];

/**
 * El sistema decide quién recibe bono: solo la posición #1 con el 100% de sus
 * metas cumplidas. Ni el administrador ni el supervisor pueden otorgarlo a otro.
 */
export const esElegibleBono = (posicion: number, cumplimiento: number) =>
  posicion === 1 && cumplimiento >= 100;

export const normalizarBono = (posicion: number, bono: number, cumplimiento = 0) =>
  esElegibleBono(posicion, cumplimiento) ? Math.max(0, Number(bono) || 0) : 0;

/** Cumplimiento de metas (0-100) del guardia en los últimos `dias` días. */
export async function obtenerCumplimiento(guardiaId: string, dias = 30): Promise<number> {
  const { data, error } = await supabase.rpc('cumplimiento_metas_guardia', {
    _guardia_id: guardiaId,
    _dias: dias,
  });
  if (error) throw error;
  return Number(data) || 0;
}

export const formatMoneda = (monto: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 0 }).format(monto || 0);

/** Periodo por defecto: mes y año en curso (ej. "Agosto 2026"). */
export const periodoActual = () => {
  const s = new Date().toLocaleDateString('es-MX', { month: 'long', year: 'numeric' });
  return s.charAt(0).toUpperCase() + s.slice(1);
};

export async function listarReconocimientos(soloPublicados = false): Promise<Reconocimiento[]> {
  let query = supabase
    .from('reconocimientos')
    .select('*')
    .order('created_at', { ascending: false })
    .order('posicion', { ascending: true });
  if (soloPublicados) query = query.eq('publicado', true);
  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as Reconocimiento[];
}

export async function crearReconocimiento(input: ReconocimientoInput) {
  const { data: userData } = await supabase.auth.getUser();
  const { error } = await supabase.from('reconocimientos').insert({
    ...input,
    bono: normalizarBono(input.posicion, input.bono),
    created_by: userData.user?.id ?? null,
  });
  if (error) throw error;
}

export async function actualizarReconocimiento(id: string, input: Partial<ReconocimientoInput>) {
  const patch: Record<string, unknown> = { ...input };
  if (input.posicion !== undefined) {
    patch.bono = normalizarBono(input.posicion, (input.bono ?? 0) as number);
  }
  const { error } = await supabase.from('reconocimientos').update(patch).eq('id', id);
  if (error) throw error;
}

export async function eliminarReconocimiento(id: string) {
  const { error } = await supabase.from('reconocimientos').delete().eq('id', id);
  if (error) throw error;
}

/** Publica el reconocimiento y notifica a todos los guardias (RPC SECURITY DEFINER). */
export async function publicarReconocimiento(id: string) {
  const { error } = await supabase.rpc('publicar_reconocimiento', { _id: id });
  if (error) throw error;
}
