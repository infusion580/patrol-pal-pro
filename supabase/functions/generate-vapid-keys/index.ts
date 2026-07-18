/**
 * generate-vapid-keys
 * -------------------
 * One-shot helper: mints a VAPID key pair for Web Push and returns it.
 * The values are meant to be copied into project secrets:
 *   - VAPID_PUBLIC_KEY   (safe to expose — sent to browsers)
 *   - VAPID_PRIVATE_KEY  (kept in edge function env only)
 *   - VAPID_SUBJECT      (mailto: address used for push provider contact)
 *
 * After the keys are stored in secrets, this function is no longer needed
 * and can be deleted or left in place — it does not persist anything.
 */
import webpush from 'npm:web-push@3.6.7';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

Deno.serve((req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const keys = webpush.generateVAPIDKeys();
  return new Response(
    JSON.stringify({
      VAPID_PUBLIC_KEY: keys.publicKey,
      VAPID_PRIVATE_KEY: keys.privateKey,
      instructions:
        'Copia estos valores en los secretos del proyecto: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, y agrega VAPID_SUBJECT=mailto:tu-correo@dominio.com',
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  );
});
