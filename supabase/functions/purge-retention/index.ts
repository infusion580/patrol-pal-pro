/**
 * purge-retention
 * ---------------
 * Proceso automático de retención de datos (se ejecuta a diario por cron).
 *
 * Elimina toda la información operativa con más de `RETENTION_DAYS` días:
 * fotografías, asistencias, coordenadas, reportes, alertas, evidencias,
 * registros de rondines y datos temporales asociados.
 *
 * La regla está centralizada en `../_shared/retention.ts`. No se toca nada
 * estructural (usuarios, roles, servicios, catálogos, configuración) ni la
 * bitácora inmutable `audit_log`.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import {
  RETENTION_DAYS,
  RETENTION_TARGETS,
  cutoffISO,
  toStoragePath,
  type RetentionTarget,
} from '../_shared/retention.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const PAGE_SIZE = 500;

type Client = ReturnType<typeof createClient>;

interface TargetResult {
  tabla: string;
  filas_eliminadas: number;
  fotos_eliminadas: number;
  error?: string;
}

/** Borra de Storage las fotos de un lote de filas. */
async function removePhotos(
  supabase: Client,
  target: RetentionTarget,
  rows: Record<string, unknown>[],
): Promise<number> {
  if (!target.photos?.length) return 0;
  let removed = 0;

  for (const { bucket, column } of target.photos) {
    const paths = rows
      .map((r) => toStoragePath(bucket, r[column] as string | null))
      .filter((p): p is string => !!p);
    if (!paths.length) continue;

    for (let i = 0; i < paths.length; i += 100) {
      const chunk = paths.slice(i, i + 100);
      const { error } = await supabase.storage.from(bucket).remove(chunk);
      if (!error) removed += chunk.length;
      else console.error(`[purge-retention] storage ${bucket}:`, error.message);
    }
  }

  return removed;
}

/** Depura una tabla: borra sus fotos y luego las filas vencidas. */
async function purgeTarget(supabase: Client, target: RetentionTarget): Promise<TargetResult> {
  const cutoff = cutoffISO(target);
  const result: TargetResult = { tabla: target.table, filas_eliminadas: 0, fotos_eliminadas: 0 };

  try {
    // Se pagina para no cargar en memoria periodos con mucho volumen.
    for (;;) {
      const selectCols = ['id', ...(target.photos?.map((p) => p.column) ?? [])].join(', ');
      const { data: rows, error } = await supabase
        .from(target.table)
        .select(selectCols)
        .lt(target.dateColumn, cutoff)
        .limit(PAGE_SIZE);
      if (error) throw error;
      if (!rows?.length) break;

      const typedRows = rows as unknown as Record<string, unknown>[];
      result.fotos_eliminadas += await removePhotos(supabase, target, typedRows);

      const ids = typedRows.map((r) => r.id as string);

      if (target.onlyPhotos) {
        const blanked = Object.fromEntries((target.photos ?? []).map((p) => [p.column, null]));
        const { error: upErr } = await supabase.from(target.table).update(blanked).in('id', ids);
        if (upErr) throw upErr;
        break; // sin borrado de filas no hay avance de paginación
      }

      const { error: delErr } = await supabase.from(target.table).delete().in('id', ids);
      if (delErr) throw delErr;
      result.filas_eliminadas += ids.length;

      if (ids.length < PAGE_SIZE) break;
    }
  } catch (e) {
    result.error = (e as Error).message;
    console.error(`[purge-retention] ${target.table}:`, result.error);
  }

  return result;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  try {
    const detalle: TargetResult[] = [];
    for (const target of RETENTION_TARGETS) {
      detalle.push(await purgeTarget(supabase, target));
    }

    const summary = {
      retencion_dias: RETENTION_DAYS,
      ejecutado_en: new Date().toISOString(),
      filas_eliminadas: detalle.reduce((a, d) => a + d.filas_eliminadas, 0),
      fotos_eliminadas: detalle.reduce((a, d) => a + d.fotos_eliminadas, 0),
      tablas_con_error: detalle.filter((d) => d.error).map((d) => d.tabla),
      detalle,
    };

    await supabase.from('audit_log').insert({
      accion: 'retencion_purga',
      tabla: 'sistema',
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
