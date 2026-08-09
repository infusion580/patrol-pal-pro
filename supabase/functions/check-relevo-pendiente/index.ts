import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const HORAS_POR_TIPO: Record<string, number> = {
  '12h': 12,
  '24h': 24,
  'corrido': 24,
};

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

  try {
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
    const ahora = new Date();
    const margenMs = 5 * 60 * 1000; // 5 minutos de anticipación
    const ventanaFin = new Date(ahora.getTime() + margenMs).toISOString();

    // 1. Turnos activos con su servicio y guardia
    const { data: turnos, error: tErr } = await admin
      .from('turnos')
      .select(`
        id,
        inicio,
        status,
        guardia_id,
        servicio_id,
        servicios!inner(id, nombre, tipo_turno),
        profiles!inner(user_id, nombre, apellido, supervisor_asignado_id)
      `)
      .eq('status', 'activo');

    if (tErr) throw tErr;

    const relevosPendientes: any[] = [];

    for (const t of (turnos || []) as any[]) {
      const tipo = t.servicios?.tipo_turno ?? '12h';
      if (tipo === 'corrido') continue; // los turnos de corrido no tienen relevo programado

      const horas = HORAS_POR_TIPO[tipo] ?? 12;
      const inicio = new Date(t.inicio).getTime();
      const finEsperado = new Date(inicio + horas * 60 * 60 * 1000);

      // Solo alertar si el fin esperado cae dentro de los próximos 5 minutos
      if (finEsperado.getTime() > ahora.getTime() + margenMs) continue;
      if (finEsperado.getTime() < ahora.getTime() - 2 * 60 * 1000) continue; // ya pasó hace más de 2 min

      // ¿Ya existe un turno de relevo para el mismo servicio iniciado después de este turno?
      const { data: relevos, error: rErr } = await admin
        .from('turnos')
        .select('id')
        .eq('servicio_id', t.servicio_id)
        .gt('inicio', t.inicio)
        .in('status', ['activo', 'completado'])
        .limit(1);

      if (rErr) throw rErr;
      if ((relevos || []).length > 0) continue;

      relevosPendientes.push({ ...t, fin_esperado: finEsperado.toISOString() });
    }

    if (relevosPendientes.length === 0) {
      return new Response(
        JSON.stringify({ ok: true, alertas: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // 2. Supervisoras/os a notificar: asignado al guardia + todos los supers/admins
    const { data: roles, error: rolesErr } = await admin
      .from('user_roles')
      .select('user_id, role')
      .in('role', ['supervisor', 'admin']);

    if (rolesErr) throw rolesErr;
    const supervisorIds = new Set((roles || []).map((r: any) => r.user_id));

    let totalAlertas = 0;

    for (const t of relevosPendientes) {
      const guardiaNombre = `${t.profiles?.nombre ?? ''} ${t.profiles?.apellido ?? ''}`.trim() || 'Guardia';
      const servicioNombre = t.servicios?.nombre ?? 'N/A';
      const finHora = new Date(t.fin_esperado).toLocaleTimeString('es-MX', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });

      // Evitar spam: una alerta por turno cada 30 minutos como máximo
      const hace30min = new Date(ahora.getTime() - 30 * 60 * 1000).toISOString();
      const { data: previas } = await admin
        .from('notificaciones')
        .select('id')
        .eq('tipo', 'relevo_pendiente')
        .eq('guardia_id', t.guardia_id)
        .gte('created_at', hace30min)
        .filter('metadata->>turno_id', 'eq', t.id)
        .limit(1);

      if ((previas || []).length > 0) continue;

      // Destinatarios: supervisor asignado + todos los supers/admins
      const targets = new Set<string>();
      if (t.profiles?.supervisor_asignado_id) targets.add(t.profiles.supervisor_asignado_id);
      supervisorIds.forEach((id) => targets.add(id));

      const mensaje =
        `⏰ RELEVO NO CUBIERTO\n` +
        `Empleado: ${guardiaNombre}\n` +
        `Servicio: ${servicioNombre}\n` +
        `Fin esperado: ${finHora}\n` +
        `No se ha registrado guardia entrante.`;

      const metadata = {
        turno_id: t.id,
        guardia: guardiaNombre,
        servicio: servicioNombre,
        servicio_id: t.servicio_id,
        fin_esperado: t.fin_esperado,
      };

      // Insertar una notificación por supervisor
      const inserts = Array.from(targets).map((supervisor_id) => ({
        tipo: 'relevo_pendiente',
        mensaje,
        guardia_id: t.guardia_id,
        supervisor_id,
        metadata,
      }));

      const { error: nErr } = await admin.from('notificaciones').insert(inserts as any);
      if (nErr) throw nErr;

      totalAlertas += inserts.length;

      // Web push a los supervisores suscritos
      if (VAPID_PUBLIC && VAPID_PRIVATE) {
        const { data: subs } = await admin
          .from('push_subscriptions')
          .select('id, endpoint, p256dh, auth')
          .in('user_id', Array.from(targets));

        const payload = JSON.stringify({
          title: '⏰ Relevo no cubierto',
          body: `${guardiaNombre} · ${servicioNombre} · fin ${finHora}`,
          url: '/notificaciones',
          tag: `relevo-${t.id}`,
        });

        const stale: string[] = [];
        await Promise.all(
          (subs || []).map(async (s: any) => {
            try {
              await webpush.sendNotification(
                { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
                payload,
                { TTL: 60 * 10 },
              );
            } catch (e: any) {
              const status = e?.statusCode ?? 0;
              if (status === 404 || status === 410) stale.push(s.id);
            }
          }),
        );
        if (stale.length) await admin.from('push_subscriptions').delete().in('id', stale);
      }
    }

    return new Response(
      JSON.stringify({ ok: true, alertas: totalAlertas }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (e) {
    console.error('check-relevo-pendiente error', e);
    return new Response(
      JSON.stringify({ ok: false, error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
