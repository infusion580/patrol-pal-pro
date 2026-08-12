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

/** Montos sugeridos; el administrador puede capturar cualquier otro monto. */
export const BONOS_SUGERIDOS = [500, 1000, 2000];

/** Solo la posición 1 conserva bono. */
export const normalizarBono = (posicion: number, bono: number) =>
  posicion === 1 ? Math.max(0, Number(bono) || 0) : 0;

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
