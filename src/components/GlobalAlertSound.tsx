/**
 * GlobalAlertSound
 * ----------------
 * Escucha en tiempo real cualquier alerta nueva (tabla `notificaciones`) y
 * la anuncia con un tono según su severidad + un toast, sin importar en qué
 * pantalla esté el usuario. No renderiza nada.
 */
import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { getNotifMeta, SEVERIDAD_LABEL } from '@/lib/notification-types';
import { initAlertSound, playAlertSound } from '@/lib/alert-sound';

const GlobalAlertSound = () => {
  const { user } = useAuth();
  const seen = useRef<Set<string>>(new Set());

  useEffect(() => { initAlertSound(); }, []);

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('alertas-sonido')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notificaciones' },
        (payload) => {
          const n = payload.new as { id: string; tipo: string; mensaje: string; guardia_id?: string };
          if (!n?.id || seen.current.has(n.id)) return;
          // Sólo admin y supervisor escuchan las alertas de todos los guardias.
          const puedeVerTodas = user.role === 'admin' || user.role === 'supervisor';
          if (!puedeVerTodas && n.guardia_id !== user.id) return;
          seen.current.add(n.id);

          const meta = getNotifMeta(n.tipo);
          playAlertSound(meta.severidad);

          const titulo = `${meta.label} · ${SEVERIDAD_LABEL[meta.severidad]}`;
          const detalle = (n.mensaje || '').split('\n').slice(0, 3).join(' · ');
          // Destino según el tipo de alerta (los comunicados abren su módulo).
          const destino = n.tipo === 'comunicado' ? '/comunicados' : '/notificaciones';

          toast(titulo, {
            description: detalle,
            // Toda alerta se auto-cierra y además puede cerrarse con la "X".
            duration: meta.severidad === 'critica' ? 12000 : 6000,
            dismissible: true,
            closeButton: true,
            action: {
              label: 'Ver',
              onClick: () => { window.location.href = destino; },
            },
          });
        },
      )
      .subscribe();

    return () => { void supabase.removeChannel(channel); };
  }, [user]);

  return null;
};

export default GlobalAlertSound;
