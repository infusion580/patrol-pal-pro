import { MessageCircle, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useChatNotifications } from '@/hooks/use-chat-notifications';

/**
 * Aviso en el inicio: "Tienes N mensajes sin leer".
 * Desaparece automáticamente cuando el usuario abre y lee los mensajes.
 */
const UnreadMessagesBanner = () => {
  const navigate = useNavigate();
  const { unreadTotal } = useChatNotifications();

  if (unreadTotal <= 0) return null;

  return (
    <button
      onClick={() => navigate('/chat')}
      className="w-full mb-4 bg-card border border-primary/40 rounded-xl p-4 shadow-card flex items-center gap-3 text-left hover:shadow-elevated transition-shadow active:scale-[0.99]"
    >
      <div className="relative w-10 h-10 rounded-lg bg-primary flex items-center justify-center shrink-0">
        <MessageCircle className="w-5 h-5 text-primary-foreground" />
        <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-emergency text-emergency-foreground text-[9px] font-bold flex items-center justify-center">
          {unreadTotal > 9 ? '9+' : unreadTotal}
        </span>
      </div>
      <div className="flex-1">
        <p className="font-display font-bold text-sm text-foreground">
          Tienes {unreadTotal} {unreadTotal === 1 ? 'mensaje' : 'mensajes'} sin leer
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">Toca para abrir el chat</p>
      </div>
      <ChevronRight className="w-4 h-4 text-muted-foreground" />
    </button>
  );
};

export default UnreadMessagesBanner;
