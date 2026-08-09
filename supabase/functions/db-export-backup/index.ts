/**
 * db-export-backup
 * ----------------
 * Programmed logical backup of the operational tables.
 *
 * Runs on a schedule (pg_cron, weekly) and can also be triggered manually by
 * an admin from the app. It reads every business table with the service role
 * and writes one JSON file per table plus a `manifest.json` into the private
 * `backups` storage bucket, under `YYYY-MM-DD/`.
 *
 * Why JSON and not pg_dump: Lovable Cloud does not expose the database
 * password, so a logical export through the Data API is the portable option.
 * The output can be re-imported with a simple insert loop or converted to CSV.
 *
 * Retention: exports older than RETENTION_DAYS are deleted on each run.
 */
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const TABLES = [
  'profiles',
  'user_roles',
  'servicios',
  'checkpoints',
  'guardia_servicios',
  'cliente_servicios',
  'metas_servicio',
  'turnos',
  'asistencias',
  'faltas',
  'rondines',
  'rondin_scans',
  'rondin_alarmas',
  'reportes_turno',
  'visitas',
  'pendientes_puesto',
  'pendientes_completados',
  'registros_rh',
  'notificaciones',
  'cuadro_honor',
  'chat_messages',
  'chat_rh',
  'registration_nips',
  'cliente_reporte_config',
  'audit_log',
];

const BUCKET = 'backups';
const RETENTION_DAYS = 90;
const PAGE = 1000;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const stamp = new Date().toISOString().slice(0, 10);
  const folder = `${stamp}`;
  const manifest: Record<string, number> = {};
  const errors: Record<string, string> = {};

  for (const table of TABLES) {
    try {
      // Paginate so large tables don't blow the response limit.
      const rows: unknown[] = [];
      for (let from = 0; ; from += PAGE) {
        const { data, error } = await supabase
          .from(table)
          .select('*')
          .range(from, from + PAGE - 1);
        if (error) throw error;
        rows.push(...(data ?? []));
        if (!data || data.length < PAGE) break;
      }

      const body = new Blob([JSON.stringify(rows)], { type: 'application/json' });
      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(`${folder}/${table}.json`, body, {
          contentType: 'application/json',
          upsert: true,
        });
      if (upErr) throw upErr;
      manifest[table] = rows.length;
    } catch (e) {
      errors[table] = (e as Error).message;
    }
  }

  await supabase.storage.from(BUCKET).upload(
    `${folder}/manifest.json`,
    new Blob([JSON.stringify({ generated_at: new Date().toISOString(), tables: manifest, errors }, null, 2)], {
      type: 'application/json',
    }),
    { contentType: 'application/json', upsert: true },
  );

  // Purge old snapshots.
  try {
    const cutoff = new Date(Date.now() - RETENTION_DAYS * 86_400_000).toISOString().slice(0, 10);
    const { data: folders } = await supabase.storage.from(BUCKET).list('', { limit: 1000 });
    for (const f of folders ?? []) {
      if (f.name >= cutoff) continue;
      const { data: files } = await supabase.storage.from(BUCKET).list(f.name, { limit: 1000 });
      const paths = (files ?? []).map((x) => `${f.name}/${x.name}`);
      if (paths.length) await supabase.storage.from(BUCKET).remove(paths);
    }
  } catch (e) {
    errors['_purge'] = (e as Error).message;
  }

  return new Response(JSON.stringify({ ok: Object.keys(errors).length === 0, folder, manifest, errors }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status: 200,
  });
});
