import { supabase } from '@/integrations/supabase/client';

export type TipoTurno = '12h' | '24h' | 'corrido';

export const tipoTurnoLabel = (t: TipoTurno) =>
  t === '12h' ? '12 horas' : t === '24h' ? '24 horas' : 'De corrido';

export const tipoTurnoHoras = (t: TipoTurno) => (t === '12h' ? 12 : t === '24h' ? 24 : 24);

/**
 * Genera asistencias automáticas faltantes para guardias en turno "de corrido".
 * Para cada asistencia activa de tipo "corrido", si han pasado >= 24h desde su inicio
 * y no existe una asistencia auto-generada para ese día, se crea.
 *
 * Se llama al abrir la app (Dashboard / GuardDashboard).
 */
export async function generarAsistenciasCorridoFaltantes(userId: string) {
  const { data: activas } = await supabase
    .from('asistencias' as any)
    .select('*')
    .eq('guardia_id', userId)
    .eq('tipo_turno', 'corrido')
    .eq('status', 'activo')
    .order('inicio', { ascending: true });

  if (!activas || activas.length === 0) return 0;

  let creadas = 0;
  for (const a of activas as any[]) {
    const inicio = new Date(a.inicio).getTime();
    const ahora = Date.now();
    const diasTranscurridos = Math.floor((ahora - inicio) / (24 * 60 * 60 * 1000));
    if (diasTranscurridos < 1) continue;

    // Buscar todas las asistencias auto-generadas previas de esta racha
    const { data: previas } = await supabase
      .from('asistencias' as any)
      .select('inicio')
      .eq('guardia_id', userId)
      .eq('servicio_id', a.servicio_id)
      .eq('tipo_turno', 'corrido')
      .eq('auto_generado', true)
      .gte('inicio', a.inicio);

    const yaCreadas = new Set((previas || []).map((p: any) => {
      const d = new Date(p.inicio);
      return `${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}`;
    }));

    for (let i = 1; i <= diasTranscurridos; i++) {
      const nuevoInicio = new Date(inicio + i * 24 * 60 * 60 * 1000);
      const key = `${nuevoInicio.getUTCFullYear()}-${nuevoInicio.getUTCMonth()}-${nuevoInicio.getUTCDate()}`;
      if (yaCreadas.has(key)) continue;

      const finEsperado = new Date(nuevoInicio.getTime() + 24 * 60 * 60 * 1000);
      const { error } = await supabase.from('asistencias' as any).insert({
        guardia_id: userId,
        servicio_id: a.servicio_id,
        tipo_turno: 'corrido',
        inicio: nuevoInicio.toISOString(),
        fin_esperado: finEsperado.toISOString(),
        status: 'completo',
        auto_generado: true,
        observaciones: 'Asistencia diaria automática (turno de corrido)',
        duracion_minutos: 24 * 60,
        fin: finEsperado.toISOString(),
      } as any);
      if (!error) creadas++;
    }
  }
  return creadas;
}
