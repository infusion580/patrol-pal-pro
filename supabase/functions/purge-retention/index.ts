/**
 * purge-retention
 * ---------------
 * Data retention job (LFPDPPP compliance).
 *
 * Personal data captured at access control (visitor ID / plate photos) cannot
 * be kept indefinitely. This scheduled function:
 *
 *  1. Deletes visitor photos (INE, plate, exit) from the `visitas` bucket once
 *     the visit is older than VISITAS_RETENTION_DAYS, and blanks the columns.
 *     The visit record itself (name, time, area) is kept for the logbook.
 *  2. Deletes rondín evidence photos older than EVIDENCIAS_RETENTION_DAYS.
 *
 * Every purge run appends a summary to the immutable audit log.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const VISITAS_RETENTION_DAYS = 90;
const EVIDENCIAS_RETENTION_DAYS = 365;

/** Turn a stored value (full URL or bare path) into a storage object path. */
function toPath(bucket: string, value: string | null): string | null {
  if (!value) return null;
  const marker = `/${bucket}/`;
  const i = value.indexOf(marker);
  if (i >= 0) return decodeURIComponent(value.slice(i + marker.length).split('?')[0]);
  return value.startsWith('http') ? null : value;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  try {
    const now = Date.now();
    const visitasCutoff = new Date(now - VISITAS_RETENTION_DAYS * 86400_000).toISOString();
    const evidenciasCutoff = new Date(now - EVIDENCIAS_RETENTION_DAYS * 86400_000).toISOString();

    // ---- 1. Visitor photos -------------------------------------------------
    const { data: visitas, error: vErr } = await supabase
      .from('visitas')
      .select('id, foto_ine_url, foto_placa_url, foto_salida_url, hora_entrada')
      .lt('hora_entrada', visitasCutoff)
      .or('foto_ine_url.neq.,foto_placa_url.neq.,foto_salida_url.neq.');
    if (vErr) throw vErr;

    const visitaPaths: string[] = [];
    const visitaIds: string[] = [];
    for (const v of visitas ?? []) {
      const paths = [v.foto_ine_url, v.foto_placa_url, v.foto_salida_url]
        .map((p) => toPath('visitas', p))
        .filter((p): p is string => !!p);
      if (paths.length) {
        visitaPaths.push(...paths);
        visitaIds.push(v.id);
      }
    }

    if (visitaPaths.length) {
      await supabase.storage.from('visitas').remove(visitaPaths);
      await supabase
        .from('visitas')
        .update({ foto_ine_url: '', foto_placa_url: '', foto_salida_url: '' })
        .in('id', visitaIds);
    }

    // ---- 2. Rondín evidence ------------------------------------------------
    const { data: scans, error: sErr } = await supabase
      .from('rondin_scans')
      .select('id, foto_url, scanned_at')
      .lt('scanned_at', evidenciasCutoff)
      .neq('foto_url', '');
    if (sErr) throw sErr;

    const scanPaths: string[] = [];
    const scanIds: string[] = [];
    for (const s of scans ?? []) {
      const p = toPath('evidencias', s.foto_url);
      if (p) {
        scanPaths.push(p);
        scanIds.push(s.id);
      }
    }

    if (scanPaths.length) {
      await supabase.storage.from('evidencias').remove(scanPaths);
      await supabase.from('rondin_scans').update({ foto_url: '' }).in('id', scanIds);
    }

    const summary = {
      visitas_purgadas: visitaIds.length,
      fotos_visitas_borradas: visitaPaths.length,
      scans_purgados: scanIds.length,
      fotos_evidencia_borradas: scanPaths.length,
      retencion_visitas_dias: VISITAS_RETENTION_DAYS,
      retencion_evidencias_dias: EVIDENCIAS_RETENTION_DAYS,
    };

    await supabase.from('audit_log').insert({
      accion: 'retencion_purga',
      tabla: 'storage',
      datos_despues: summary,
    });

    return new Response(JSON.stringify({ ok: true, ...summary }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[purge-retention]', error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
