import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/hooks/use-toast';
import { createNotification } from '@/lib/notification-helpers';

interface TurnoInfo {
  turno_id: string;
  servicio_id: string;
  servicio_nombre: string;
  intervalo_min: number;
  tolerancia_min: number;
  inicio: string;
}

const POLL_MS = 30_000;

/**
 * Monitor de alarmas de rondines: mientras el guardia tenga turno activo
 * y el servicio tenga configurado `rondin_intervalo_minutos`, dispara una
 * alarma cada N minutos. Si el guardia no responde dentro de la tolerancia,
 * se marca la alarma como falta y se notifica al supervisor.
 */
export function useRondinAlarm() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [turnoInfo, setTurnoInfo] = useState<TurnoInfo | null>(null);
  const respondedRef = useRef<Set<string>>(new Set());

  // Detectar turno + servicio con alarma configurada
  useEffect(() => {
    if (!user || user.role !== 'guardia') { setTurnoInfo(null); return; }
    let cancelled = false;

    const load = async () => {
      const { data: turno } = await supabase
        .from('turnos')
        .select('id, servicio_id, inicio')
        .eq('guardia_id', user.id)
        .eq('status', 'activo')
        .maybeSingle();
      if (cancelled) return;
      if (!turno || !turno.servicio_id) { setTurnoInfo(null); return; }

      const { data: svc } = await supabase
        .from('servicios')
        .select('id, nombre, rondin_intervalo_minutos, rondin_tolerancia_minutos')
        .eq('id', turno.servicio_id)
        .maybeSingle();
      if (cancelled) return;
      const intervalo = (svc as any)?.rondin_intervalo_minutos;
      if (!svc || !intervalo || intervalo <= 0) { setTurnoInfo(null); return; }

      setTurnoInfo({
        turno_id: turno.id,
        servicio_id: turno.servicio_id,
        servicio_nombre: (svc as any).nombre,
        intervalo_min: intervalo,
        tolerancia_min: (svc as any).rondin_tolerancia_minutos ?? 10,
        inicio: turno.inicio,
      });
    };

    load();
    const ch = supabase
      .channel('rondin-alarm-turno')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'turnos', filter: `guardia_id=eq.${user.id}` }, load)
      .subscribe();
    return () => { cancelled = true; supabase.removeChannel(ch); };
  }, [user]);

  // Ciclo principal: programar/despachar/verificar alarmas
  useEffect(() => {
    if (!user || !turnoInfo) return;

    const tick = async () => {
      const now = Date.now();

      // Última alarma del turno
      const { data: last } = await supabase
        .from('rondin_alarmas')
        .select('id, scheduled_at, notified_at, responded_at, delay_seconds, falta_generada')
        .eq('guardia_id', user.id)
        .eq('turno_id', turnoInfo.turno_id)
        .order('scheduled_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      // Verificar pendiente / falta
      if (last && !last.responded_at) {
        const notifiedAt = new Date(last.notified_at || last.scheduled_at).getTime();
        const overdueMs = now - notifiedAt;
        const toleranciaMs = turnoInfo.tolerancia_min * 60_000;
        if (overdueMs > toleranciaMs && !last.falta_generada) {
          const delay = Math.floor(overdueMs / 1000);
          await supabase.from('rondin_alarmas').update({
            falta_generada: true,
            delay_seconds: delay,
          }).eq('id', last.id);
          await createNotification({
            tipo: 'incidencia',
            mensaje: `⚠️ RONDÍN NO ATENDIDO\nEmpleado: ${user.nombre} ${user.apellido}\nServicio: ${turnoInfo.servicio_nombre}\nTolerancia: ${turnoInfo.tolerancia_min} min\nRetraso: ${Math.floor(delay / 60)} min ${delay % 60} s`,
            guardia_id: user.id,
            metadata: { alarma_id: last.id, servicio: turnoInfo.servicio_nombre, retraso_seg: delay },
          });
        }
      }

      // Programar siguiente
      const lastAnchor = last ? new Date(last.scheduled_at).getTime() : new Date(turnoInfo.inicio).getTime();
      const nextAt = lastAnchor + turnoInfo.intervalo_min * 60_000;

      if (now >= nextAt && (!last || last.responded_at || last.falta_generada)) {
        // Insertar nueva alarma
        const nowIso = new Date(now).toISOString();
        const { data: nueva } = await supabase.from('rondin_alarmas').insert({
          servicio_id: turnoInfo.servicio_id,
          guardia_id: user.id,
          turno_id: turnoInfo.turno_id,
          scheduled_at: new Date(nextAt).toISOString(),
          notified_at: nowIso,
        }).select('id').maybeSingle();

        if (nueva) {
          const hora = new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
          toast({
            title: '⏰ Hora de tu rondín',
            description: `${turnoInfo.servicio_nombre} · Tienes ${turnoInfo.tolerancia_min} min para iniciar.`,
          });
          try {
            if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
              const n = new Notification('⏰ Hora del rondín', {
                body: `${turnoInfo.servicio_nombre} · ${hora}\nInicia tu rondín en menos de ${turnoInfo.tolerancia_min} min.`,
                icon: '/logo-defender.png',
                tag: 'rondin-alarma',
                requireInteraction: true,
              });
              n.onclick = () => { window.focus(); navigate('/rondines'); };
            }
          } catch {}
        }
      }
    };

    tick();
    const id = window.setInterval(tick, POLL_MS);
    return () => window.clearInterval(id);
  }, [user, turnoInfo, toast, navigate]);

  // Marcar respuesta cuando el guardia entra a /rondines
  useEffect(() => {
    if (!user || !turnoInfo) return;
    if (location.pathname !== '/rondines') return;

    (async () => {
      const { data: pending } = await supabase
        .from('rondin_alarmas')
        .select('id, notified_at')
        .eq('guardia_id', user.id)
        .eq('turno_id', turnoInfo.turno_id)
        .is('responded_at', null)
        .order('scheduled_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!pending || respondedRef.current.has(pending.id)) return;
      respondedRef.current.add(pending.id);

      const notifiedAt = new Date(pending.notified_at || Date.now()).getTime();
      const delay = Math.floor((Date.now() - notifiedAt) / 1000);
      const cumplido = delay <= turnoInfo.tolerancia_min * 60;

      await supabase.from('rondin_alarmas').update({
        responded_at: new Date().toISOString(),
        delay_seconds: delay,
        cumplido,
      }).eq('id', pending.id);

      if (!cumplido) {
        toast({
          title: 'Respuesta tardía registrada',
          description: `Tardaste ${Math.floor(delay / 60)} min ${delay % 60} s en atender la alarma.`,
          variant: 'destructive',
        });
      }
    })();
  }, [location.pathname, user, turnoInfo, toast]);
}
