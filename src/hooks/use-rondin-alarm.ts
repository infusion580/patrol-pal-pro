import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/hooks/use-toast';
import { createNotification } from '@/lib/notification-helpers';
import { playAlertSound } from '@/lib/alert-sound';

interface TurnoInfo {
  turno_id: string;
  servicio_id: string;
  servicio_nombre: string;
  intervalo_min: number;
  tolerancia_min: number;
  inicio: string;
}

export interface AlarmaActiva {
  id: string;
  servicio_nombre: string;
  notified_at: string;
}

const POLL_MS = 15_000;

/** Tiempo máximo (minutos) que tiene el guardia para atender la alarma. */
export const RESPUESTA_MAX_MIN = 3;

/**
 * Monitor de alarmas de rondines: mientras el guardia tenga turno activo
 * y el servicio tenga configurado `rondin_intervalo_minutos`, dispara una
 * alarma cada N minutos. La alarma bloquea la pantalla (ver RondinAlarmMonitor),
 * suena, genera notificación en el módulo de alertas y da 3 minutos para
 * iniciar el rondín; si no se atiende se marca falta y se avisa al supervisor.
 */
export function useRondinAlarm() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [turnoInfo, setTurnoInfo] = useState<TurnoInfo | null>(null);
  const [alarma, setAlarma] = useState<AlarmaActiva | null>(null);
  const alarmaRef = useRef<AlarmaActiva | null>(null);
  const respondedRef = useRef<Set<string>>(new Set());

  alarmaRef.current = alarma;

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
      const limiteMs = RESPUESTA_MAX_MIN * 60_000;

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
        if (overdueMs > limiteMs) {
          if (!last.falta_generada) {
            const delay = Math.floor(overdueMs / 1000);
            await supabase.from('rondin_alarmas').update({
              falta_generada: true,
              delay_seconds: delay,
            }).eq('id', last.id);
            await createNotification({
              tipo: 'incidencia',
              mensaje: `⚠️ RONDÍN NO ATENDIDO\nEmpleado: ${user.nombre} ${user.apellido}\nServicio: ${turnoInfo.servicio_nombre}\nLímite de respuesta: ${RESPUESTA_MAX_MIN} min\nRetraso: ${Math.floor(delay / 60)} min ${delay % 60} s`,
              guardia_id: user.id,
              metadata: { alarma_id: last.id, servicio: turnoInfo.servicio_nombre, retraso_seg: delay },
            });
          }
          if (alarmaRef.current?.id === last.id) setAlarma(null);
        } else if (!alarmaRef.current) {
          // Reabrir la alarma vigente (p.ej. tras recargar la app).
          setAlarma({
            id: last.id,
            servicio_nombre: turnoInfo.servicio_nombre,
            notified_at: last.notified_at || last.scheduled_at,
          });
          playAlertSound('alta');
        }
      }

      // Programar siguiente
      const lastAnchor = last ? new Date(last.scheduled_at).getTime() : new Date(turnoInfo.inicio).getTime();
      const nextAt = lastAnchor + turnoInfo.intervalo_min * 60_000;

      if (now >= nextAt && (!last || last.responded_at || last.falta_generada)) {
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
          setAlarma({ id: nueva.id, servicio_nombre: turnoInfo.servicio_nombre, notified_at: nowIso });
          playAlertSound('alta');

          // Notificación en el módulo de alertas (visible para guardia y mandos).
          await createNotification({
            tipo: 'rondin_alarma',
            mensaje: `⏰ COMIENZO DE RONDÍN\nEmpleado: ${user.nombre} ${user.apellido}\nServicio: ${turnoInfo.servicio_nombre}\nHora: ${hora}\nDebe iniciar el rondín en máximo ${RESPUESTA_MAX_MIN} minutos.`,
            guardia_id: user.id,
            metadata: { alarma_id: nueva.id, servicio: turnoInfo.servicio_nombre, limite_min: RESPUESTA_MAX_MIN },
          });

          toast({
            title: '⏰ Comienzo de rondín',
            description: `${turnoInfo.servicio_nombre} · Tienes ${RESPUESTA_MAX_MIN} min para iniciarlo.`,
          });
          try {
            if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
              const n = new Notification('⏰ Comienzo de rondín', {
                body: `${turnoInfo.servicio_nombre} · ${hora}\nInicia tu rondín en menos de ${RESPUESTA_MAX_MIN} min.`,
                icon: '/logo-defender.png',
                tag: 'rondin-alarma',
                requireInteraction: true,
              });
              n.onclick = () => { window.focus(); navigate('/rondines'); };
            }
          } catch { /* notificaciones no disponibles */ }
        }
      }
    };

    tick();
    const id = window.setInterval(tick, POLL_MS);
    return () => window.clearInterval(id);
  }, [user, turnoInfo, toast, navigate]);

  /** El guardia acepta la alarma: se registra la respuesta y va al rondín. */
  const aceptar = useCallback(async () => {
    const actual = alarmaRef.current;
    if (!actual || !turnoInfo) return;
    setAlarma(null);
    if (respondedRef.current.has(actual.id)) { navigate('/rondines'); return; }
    respondedRef.current.add(actual.id);

    const delay = Math.floor((Date.now() - new Date(actual.notified_at).getTime()) / 1000);
    const cumplido = delay <= RESPUESTA_MAX_MIN * 60;
    await supabase.from('rondin_alarmas').update({
      responded_at: new Date().toISOString(),
      delay_seconds: delay,
      cumplido,
    }).eq('id', actual.id);

    navigate('/rondines');
    if (!cumplido) {
      toast({
        title: 'Respuesta tardía registrada',
        description: `Tardaste ${Math.floor(delay / 60)} min ${delay % 60} s en atender la alarma.`,
        variant: 'destructive',
      });
    }
  }, [navigate, toast, turnoInfo]);

  return { alarma, aceptar, limiteMin: RESPUESTA_MAX_MIN };
}
