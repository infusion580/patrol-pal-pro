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
          const n = payload.new as { id: string; tipo: string; mensaje: string };
          if (!n?.id || seen.current.has(n.id)) return;
          seen.current.add(n.id);

          const meta = getNotifMeta(n.tipo);
          playAlertSound(meta.severidad);

          const titulo = `${meta.label} · ${SEVERIDAD_LABEL[meta.severidad]}`;
          const detalle = (n.mensaje || '').split('\n').slice(0, 3).join(' · ');
          toast(titulo, { description: detalle, duration: meta.severidad === 'critica' ? 12000 : 6000 });
        },
      )
      .subscribe();

    return () => { void supabase.removeChannel(channel); };
  }, [user]);

  return null;
};

export default GlobalAlertSound;
