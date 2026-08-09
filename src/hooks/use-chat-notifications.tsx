import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'sonner';

/** Evento global que dispara el chat al marcar mensajes como leídos. */
export const CHAT_READ_EVENT = 'chat:read';
export const notifyChatRead = () => window.dispatchEvent(new Event(CHAT_READ_EVENT));

/**
 * Store singleton del contador de mensajes sin leer.
 * ---------------------------------------------------
 * Varios componentes (BottomNav, banner del inicio) necesitan el mismo dato.
 * Si cada uno abriera su propio canal de realtime con el mismo nombre,
 * Supabase rechaza la segunda suscripción y el contador deja de actualizarse.
 * Por eso aquí hay UN solo canal y UN solo contador compartido.
 */
type Listener = (n: number) => void;

let currentUserId: string | null = null;
let unreadCount = 0;
let channel: ReturnType<typeof supabase.channel> | null = null;
const listeners = new Set<Listener>();
/** Callback opcional para mostrar el toast de mensaje nuevo (lo fija el primer consumidor). */
let onIncoming: ((senderId: string, message: string) => void) | null = null;

const emit = () => listeners.forEach((l) => l(unreadCount));

async function refreshUnread() {
  if (!currentUserId) return;
  const { count } = await supabase
    .from('chat_messages')
    .select('*', { count: 'exact', head: true })
    .eq('receiver_id', currentUserId)
    // Ignora mensajes a uno mismo: no tienen hilo y nunca se marcarían leídos.
    .neq('sender_id', currentUserId)
    .eq('read', false);
  unreadCount = count || 0;
  emit();
}

function connect(userId: string) {
  if (currentUserId === userId && channel) return;
  disconnect();
  currentUserId = userId;
  refreshUnread();

  channel = supabase
    .channel(`global-chat-notif-${userId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `receiver_id=eq.${userId}` },
      (payload: any) => {
        refreshUnread();
        onIncoming?.(payload.new.sender_id, payload.new.message || '');
      }
    )
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'chat_messages', filter: `receiver_id=eq.${userId}` },
      () => refreshUnread()
    )
    .subscribe();
}

function disconnect() {
  if (channel) supabase.removeChannel(channel);
  channel = null;
  currentUserId = null;
  unreadCount = 0;
  emit();
}

if (typeof window !== 'undefined') {
  window.addEventListener(CHAT_READ_EVENT, () => refreshUnread());
  // Al volver a la app (pestaña o móvil) se revalida el contador.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') refreshUnread();
  });
}

/**
 * Hook global: expone el total de mensajes sin leer y avisa con un toast
 * cuando llega uno nuevo (salvo que ya se esté en /chat).
 */
export function useChatNotifications() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [unreadTotal, setUnreadTotal] = useState(unreadCount);

  useEffect(() => {
    listeners.add(setUnreadTotal);
    return () => { listeners.delete(setUnreadTotal); };
  }, []);

  useEffect(() => {
    if (!user) { disconnect(); return; }
    connect(user.id);
    setUnreadTotal(unreadCount);
  }, [user]);

  // Revalida al navegar (p. ej. al salir del chat).
  useEffect(() => { refreshUnread(); }, [location.pathname]);

  // Sólo un consumidor pinta el toast, para no duplicarlo.
  useEffect(() => {
    if (onIncoming) return;
    onIncoming = async (senderId, message) => {
      if (window.location.pathname === '/chat') return;
      const { data: senderProfile } = await supabase
        .from('profiles')
        .select('nombre, apellido')
        .eq('user_id', senderId)
        .maybeSingle();
      const senderName = senderProfile
        ? `${senderProfile.nombre} ${senderProfile.apellido}`.trim()
        : 'Nuevo mensaje';
      toast.message(`💬 ${senderName}`, {
        description: message.slice(0, 80),
        action: { label: 'Abrir', onClick: () => navigate('/chat') },
      });
    };
    return () => { onIncoming = null; };
  }, [navigate]);

  return { unreadTotal };
}
