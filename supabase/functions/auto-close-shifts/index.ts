import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const cutoffHours = 48;
    const cutoff = new Date(Date.now() - cutoffHours * 60 * 60 * 1000).toISOString();

    // 1. Cerrar turnos activos con inicio > 48 h atrás
    const { data: turnos, error: tErr } = await supabase
      .from('turnos')
      .select('id, guardia_id, inicio')
      .eq('status', 'activo')
      .lt('inicio', cutoff);

    if (tErr) throw tErr;

    let cerrados = 0;
    const ahora = new Date().toISOString();

    for (const t of turnos ?? []) {
      // Cerrar turno
      await supabase
        .from('turnos')
        .update({
          fin: ahora,
          status: 'completado',
          comentario_cambio: 'Cerrado automáticamente por exceder 48 horas sin finalizar.',
        })
        .eq('id', t.id);

      // Cerrar asistencia activa asociada como INCOMPLETA
      const inicio = new Date(t.inicio).getTime();
      const durMin = Math.round((Date.now() - inicio) / 60000);

      await supabase
        .from('asistencias')
        .update({
          fin: ahora,
          duracion_minutos: durMin,
          status: 'incompleto',
          observaciones: 'Cierre automático: turno abandonado (>48 h).',
        })
        .eq('turno_id', t.id)
        .eq('status', 'activo');

      // Registrar falta
      await supabase.from('faltas').insert({
        guardia_id: t.guardia_id,
        fecha: new Date(t.inicio).toISOString().slice(0, 10),
        motivo: 'turno_abandonado',
        detalle: `Turno iniciado ${new Date(t.inicio).toLocaleString('es-MX')} sin cierre en 48h.`,
      });

      cerrados++;
    }

    return new Response(
      JSON.stringify({ ok: true, cerrados, cutoff }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (e) {
    console.error('auto-close-shifts error', e);
    return new Response(
      JSON.stringify({ ok: false, error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
