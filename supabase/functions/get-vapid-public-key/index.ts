/**
 * get-vapid-public-key
 * --------------------
 * Returns the VAPID public key so the frontend can subscribe browsers
 * to Web Push. Public by design — the key is meant to be exposed.
 * We serve it from an edge function (rather than an env var baked into
 * the Vite bundle) so it can be rotated without rebuilding the app.
 */
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

Deno.serve((req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const key = Deno.env.get('VAPID_PUBLIC_KEY') ?? '';
  if (!key) {
    return new Response(
      JSON.stringify({ error: 'VAPID public key not configured' }),
      { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
  return new Response(
    JSON.stringify({ publicKey: key }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  );
});
