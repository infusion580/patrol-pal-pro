import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'sonner';

/** Evento global que dispara el chat al marcar mensajes como leídos. */
export const CHAT_READ_EVENT = 'chat:read';
export const notifyChatRead = () => window.dispatchEvent(new Event(CHAT_READ_EVENT));


/**
 * Global hook: subscribes to incoming chat_messages for the current user,
 * shows a toast when a new message arrives (unless already on /chat with that contact),
 * and tracks the unread total badge.
 */
export function useChatNotifications() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [unreadTotal, setUnreadTotal] = useState(0);

  const refreshUnread = useCallback(async () => {
    if (!user) return;
    const { count } = await supabase
      .from('chat_messages')
      .select('*', { count: 'exact', head: true })
      .eq('receiver_id', user.id)
      .eq('read', false);
    setUnreadTotal(count || 0);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    refreshUnread();
  }, [user, refreshUnread, location.pathname]);

  // Refresco inmediato cuando el chat marca mensajes como leídos
  useEffect(() => {
    const onRead = () => refreshUnread();
    window.addEventListener(CHAT_READ_EVENT, onRead);
    return () => window.removeEventListener(CHAT_READ_EVENT, onRead);
  }, [refreshUnread]);


  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`global-chat-notif-${user.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `receiver_id=eq.${user.id}` },
        async (payload: any) => {
          refreshUnread();
          // Don't toast if user is already on /chat (they will see it inline)
          if (location.pathname === '/chat') return;

          // Look up sender name
          const { data: senderProfile } = await supabase
            .from('profiles')
            .select('nombre, apellido')
            .eq('user_id', payload.new.sender_id)
            .maybeSingle();

          const senderName = senderProfile
            ? `${senderProfile.nombre} ${senderProfile.apellido}`.trim()
            : 'Nuevo mensaje';

          toast.message(`💬 ${senderName}`, {
            description: payload.new.message?.slice(0, 80) || '',
            action: {
              label: 'Abrir',
              onClick: () => navigate('/chat'),
            },
          });
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'chat_messages', filter: `receiver_id=eq.${user.id}` },
        () => refreshUnread()
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, navigate, location.pathname, refreshUnread]);

  return { unreadTotal };
}
