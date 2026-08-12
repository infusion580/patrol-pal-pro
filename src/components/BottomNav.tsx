import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth-context';
import { Home, MapPin, FileText, MessageCircle, User, Settings, History, BarChart3, Megaphone } from 'lucide-react';
import { useChatNotifications } from '@/hooks/use-chat-notifications';
import { useBrandLogo } from '@/lib/branding';

const BottomNav = () => {
  const logoDefender = useBrandLogo();
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { unreadTotal } = useChatNotifications();

  const guardItems = [
    { path: '/dashboard', icon: Home, label: 'Inicio' },
    { path: '/rondines', icon: MapPin, label: 'Rondines' },
    { path: '/comunicados', icon: Megaphone, label: 'Avisos' },
    { path: '/historial', icon: History, label: 'Historial' },
    { path: '/chat', icon: MessageCircle, label: 'Chat' },
    { path: '/perfil', icon: User, label: 'Perfil' },
  ];

  const supervisorItems = [
    { path: '/dashboard', icon: Home, label: 'Panel' },
    { path: '/dashboard-operativo', icon: BarChart3, label: 'Operativo' },
    { path: '/comunicados', icon: Megaphone, label: 'Avisos' },
    { path: '/reportes', icon: FileText, label: 'Reportes' },
    { path: '/chat', icon: MessageCircle, label: 'Chat' },
    { path: '/perfil', icon: User, label: 'Perfil' },
  ];

  const adminItems = [
    { path: '/dashboard', icon: Home, label: 'Panel' },
    { path: '/dashboard-operativo', icon: BarChart3, label: 'Operativo' },
    { path: '/comunicados', icon: Megaphone, label: 'Avisos' },
    { path: '/servicios', icon: Settings, label: 'Servicios' },
    { path: '/chat', icon: MessageCircle, label: 'Chat' },
    { path: '/perfil', icon: User, label: 'Perfil' },
  ];


  const clienteItems = [
    { path: '/dashboard', icon: Home, label: 'Inicio' },
    { path: '/perfil', icon: User, label: 'Perfil' },
  ];

  const items =
    user?.role === 'admin' ? adminItems
    : user?.role === 'supervisor' ? supervisorItems
    : user?.role === 'cliente' ? clienteItems
    : guardItems;

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-card border-t border-border z-50 shadow-elevated">
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto relative">
        {/* Defender brand mark — always visible, anchored center on the divider */}
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 pointer-events-none hidden">
          <div className="bg-foreground rounded-full p-1.5 shadow-brand border border-primary/40">
            <img src={logoDefender} alt="Defender" className="h-5 w-auto" />
          </div>
        </div>
        {items.map(item => {
          const isActive = location.pathname === item.path;
          const isChat = item.path === '/chat';
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              aria-label={item.label}
              aria-current={isActive ? 'page' : undefined}
              className={`relative flex flex-col items-center justify-center gap-0.5 flex-1 min-w-0 max-w-16 h-full min-h-11 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
                isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {isActive && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-primary rounded-b" />
              )}
              <item.icon className={`w-5 h-5 ${isActive ? 'stroke-[2.5]' : ''}`} />
              <span className="text-[10px] font-semibold uppercase tracking-wider">{item.label}</span>
              {isChat && unreadTotal > 0 && (
                <span className="absolute top-1.5 right-2 min-w-4 h-4 px-1 rounded-full bg-emergency text-emergency-foreground text-[9px] font-bold flex items-center justify-center">
                  {unreadTotal > 9 ? '9+' : unreadTotal}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;
