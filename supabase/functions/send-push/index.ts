/**
 * send-push
 * ---------
 * Sends a Web Push notification to every subscription registered for
 * one user (or a list of users). Called by the app right after logging
 * a notification so guards receive an OS-level alert even when the app
 * is closed.
 *
 * Request body:
 *   { user_ids: string[]; title: string; body: string; url?: string; tag?: string; image?: string }
 *
 * Behavior:
 *   - Requires the caller to be authenticated (verify_jwt is true by
 *     default for edge functions we deploy this way — the app calls it
 *     with supabase.functions.invoke which forwards the session token).
 *   - Reads subscriptions with the service role client (RLS bypass) so
 *     it can push to targets that are not the caller (supervisor →
 *     guardia, etc.).
 *   - Stale subscriptions (410 Gone / 404) are pruned automatically.
 */
import webpush from 'npm:web-push@3.6.7';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { z } from 'npm:zod@3.23.8';

const BodySchema = z.object({
  user_ids: z.array(z.string().uuid()).min(1).max(500),
  title: z.string().min(1).max(120),
  body: z.string().min(1).max(500),
  url: z.string().min(1).max(500).optional(),
  tag: z.string().max(60).optional(),
  image: z.string().min(1).max(2000).optional(),
});

const VAPID_PUBLIC = Deno.env.get('VAPID_PUBLIC_KEY') ?? '';
const VAPID_PRIVATE = Deno.env.get('VAPID_PRIVATE_KEY') ?? '';
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:soporte@defender.app';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

if (VAPID_PUBLIC && VAPID_PRIVATE) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
    return new Response(
      JSON.stringify({ error: 'VAPID keys not configured' }),
      { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return new Response(
      JSON.stringify({ error: parsed.error.flatten().fieldErrors }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
  const { user_ids, title, body, url, tag, image } = parsed.data;

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
  const { data: subs, error } = await admin
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .in('user_id', user_ids);

  if (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  const payload = JSON.stringify({ title, body, url: url ?? '/dashboard', tag, image });
  const stale: string[] = [];
  let sent = 0;

  await Promise.all(
    (subs ?? []).map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          payload,
          { TTL: 60 * 60 * 24 },
        );
        sent++;
      } catch (e: any) {
        const status = e?.statusCode ?? 0;
        if (status === 404 || status === 410) stale.push(s.id);
        else console.error('push failed', status, e?.body ?? e?.message);
      }
    }),
  );

  if (stale.length) {
    await admin.from('push_subscriptions').delete().in('id', stale);
  }

  return new Response(
    JSON.stringify({ sent, pruned: stale.length, total: subs?.length ?? 0 }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  );
});
