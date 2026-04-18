import { supabase } from '@/integrations/supabase/client';

export interface MetaServicio {
  id: string;
  servicio_id: string;
  rondines_diarios: number;
  reportes_diarios: number;
  hora_inicio: string;
  hora_fin: string;
}

export interface ProgresoDiario {
  rondinesCompletados: number;
  reportesCompletados: number;
  rondinesMeta: number;
  reportesMeta: number;
  porcentaje: number;
  metaCumplida: boolean;
  horaInicio: string;
  horaFin: string;
  insignias: string[];
  puntos: number;
  servicioId: string | null;
}

const todayISO = () => new Date().toISOString().split('T')[0];

/** Get assigned service for guard, fallback to first service */
async function getServicioForGuard(guardiaId: string): Promise<string | null> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('servicio_asignado_id')
    .eq('user_id', guardiaId)
    .maybeSingle();
  if (profile?.servicio_asignado_id) return profile.servicio_asignado_id;

  const { data: svc } = await supabase.from('servicios').select('id').limit(1).maybeSingle();
  return svc?.id || null;
}

/** Compute today's progress for a guard, including badges */
export async function computeGuardProgress(guardiaId: string): Promise<ProgresoDiario> {
  const today = todayISO();
  const servicioId = await getServicioForGuard(guardiaId);

  // Defaults if no meta defined
  let meta: MetaServicio | null = null;
  if (servicioId) {
    const { data } = await supabase
      .from('metas_servicio')
      .select('*')
      .eq('servicio_id', servicioId)
      .maybeSingle();
    meta = data as MetaServicio | null;
  }

  const rondinesMeta = meta?.rondines_diarios ?? 4;
  const reportesMeta = meta?.reportes_diarios ?? 1;
  const horaInicio = meta?.hora_inicio?.slice(0, 5) ?? '08:00';
  const horaFin = meta?.hora_fin?.slice(0, 5) ?? '20:00';

  // Count completed rondines today (status completado)
  const { count: rCount } = await supabase
    .from('rondines')
    .select('*', { count: 'exact', head: true })
    .eq('guardia_id', guardiaId)
    .eq('status', 'completado')
    .gte('created_at', today);

  const { count: repCount } = await supabase
    .from('reportes_turno')
    .select('*', { count: 'exact', head: true })
    .eq('guardia_id', guardiaId)
    .gte('created_at', today);

  const rondinesCompletados = rCount || 0;
  const reportesCompletados = repCount || 0;

  const totalReq = rondinesMeta + reportesMeta;
  const totalDone = Math.min(rondinesCompletados, rondinesMeta) + Math.min(reportesCompletados, reportesMeta);
  const porcentaje = totalReq > 0 ? Math.round((totalDone / totalReq) * 100) : 0;
  const metaCumplida = rondinesCompletados >= rondinesMeta && reportesCompletados >= reportesMeta;

  // Compute badges
  const insignias: string[] = [];
  if (rondinesCompletados >= rondinesMeta) insignias.push('rondines_completos');
  if (reportesCompletados >= reportesMeta) insignias.push('reportes_completos');
  if (metaCumplida) insignias.push('meta_diaria');
  if (rondinesCompletados >= rondinesMeta * 1.5) insignias.push('super_rondinero');

  // Streak badge: check last 7 days in cuadro_honor
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
  const { data: streakData } = await supabase
    .from('cuadro_honor')
    .select('fecha')
    .eq('guardia_id', guardiaId)
    .gte('fecha', sevenDaysAgo.toISOString().split('T')[0]);
  if ((streakData?.length || 0) + (metaCumplida ? 1 : 0) >= 7) insignias.push('racha_semanal');

  const puntos = rondinesCompletados * 10 + reportesCompletados * 25 + (metaCumplida ? 50 : 0);

  return {
    rondinesCompletados,
    reportesCompletados,
    rondinesMeta,
    reportesMeta,
    porcentaje,
    metaCumplida,
    horaInicio,
    horaFin,
    insignias,
    puntos,
    servicioId,
  };
}

/** Upsert today's progress in cuadro_honor (only when meta cumplida) */
export async function upsertCuadroHonorIfMet(guardiaId: string, p: ProgresoDiario) {
  if (!p.metaCumplida) return false;
  const today = todayISO();
  const { error } = await supabase
    .from('cuadro_honor')
    .upsert(
      {
        guardia_id: guardiaId,
        servicio_id: p.servicioId,
        fecha: today,
        rondines_completados: p.rondinesCompletados,
        reportes_completados: p.reportesCompletados,
        rondines_meta: p.rondinesMeta,
        reportes_meta: p.reportesMeta,
        puntos: p.puntos,
        insignias: p.insignias,
      },
      { onConflict: 'guardia_id,fecha' }
    );
  if (error) console.error('cuadro_honor upsert error', error);
  return !error;
}

export const INSIGNIA_META: Record<string, { label: string; emoji: string; color: string }> = {
  meta_diaria: { label: 'Meta Diaria', emoji: '🏆', color: 'bg-warning/20 text-warning' },
  rondines_completos: { label: 'Rondines Completos', emoji: '🛡️', color: 'bg-primary/20 text-primary' },
  reportes_completos: { label: 'Reportes Completos', emoji: '📋', color: 'bg-success/20 text-success' },
  super_rondinero: { label: 'Súper Rondinero', emoji: '⚡', color: 'bg-accent text-accent-foreground' },
  racha_semanal: { label: 'Racha 7 Días', emoji: '🔥', color: 'bg-destructive/20 text-destructive' },
};
