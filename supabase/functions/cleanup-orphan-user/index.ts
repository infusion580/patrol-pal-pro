import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Elimina la cuenta de auth si el registro falló tras signUp y la cuenta quedó huérfana.
// El propio usuario (autenticado) solicita su eliminación cuando el flujo de NIP falló.
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'No autorizado' }, 401);

    const supabaseAnon = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_PUBLISHABLE_KEY') ?? Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userRes } = await supabaseAnon.auth.getUser();
    const user = userRes?.user;
    if (!user) return json({ error: 'Sesión inválida' }, 401);

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Solo elimina si el usuario NO tiene rol asignado (evita borrar cuentas válidas).
    const { data: roles } = await admin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);

    if (roles && roles.length > 0) {
      return json({ error: 'La cuenta ya tiene rol asignado, no se puede eliminar.' }, 400);
    }

    await admin.from('profiles').delete().eq('user_id', user.id);
    const { error } = await admin.auth.admin.deleteUser(user.id);
    if (error) throw error;

    return json({ ok: true });
  } catch (e) {
    console.error('cleanup-orphan-user error', e);
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
