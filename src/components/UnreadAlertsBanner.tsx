import { useCallback, useEffect, useState } from 'react';
import { Bell, ChevronRight } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { useRealtimeTable } from '@/hooks/use-realtime';

/**
 * Aviso en el inicio: "Tienes N alertas por revisar".
 * Desaparece cuando el usuario marca las notificaciones como leídas.
 */
const UnreadAlertsBanner = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [unread, setUnread] = useState(0);

  const refresh = useCallback(async () => {
    if (!user) return;
    const { count } = await supabase
      .from('notificaciones')
      .select('*', { count: 'exact', head: true })
      .eq('leida', false);
    setUnread(count || 0);
  }, [user]);

  useEffect(() => { refresh(); }, [refresh, location.pathname]);

  useRealtimeTable('notificaciones', () => refresh());

  if (unread <= 0) return null;

  return (
    <button
      onClick={() => navigate('/notificaciones')}
      className="w-full mb-4 bg-card border border-emergency/40 rounded-xl p-4 shadow-card flex items-center gap-3 text-left hover:shadow-elevated transition-shadow active:scale-[0.99]"
    >
      <div className="relative w-10 h-10 rounded-lg bg-emergency flex items-center justify-center shrink-0">
        <Bell className="w-5 h-5 text-emergency-foreground" />
        <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-warning text-warning-foreground text-[9px] font-bold flex items-center justify-center">
          {unread > 9 ? '9+' : unread}
        </span>
      </div>
      <div className="flex-1">
        <p className="font-display font-bold text-sm text-foreground">
          Tienes {unread} {unread === 1 ? 'alerta' : 'alertas'} por revisar
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">Toca para abrir las notificaciones</p>
      </div>
      <ChevronRight className="w-4 h-4 text-muted-foreground" />
    </button>
  );
};

export default UnreadAlertsBanner;
