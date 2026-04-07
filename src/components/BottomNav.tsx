import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth-context';
import { Home, MapPin, FileText, MessageCircle, User, Settings, History, BarChart3 } from 'lucide-react';

const BottomNav = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();

  const guardItems = [
    { path: '/dashboard', icon: Home, label: 'Inicio' },
    { path: '/rondines', icon: MapPin, label: 'Rondines' },
    { path: '/historial', icon: History, label: 'Historial' },
    { path: '/chat', icon: MessageCircle, label: 'Chat' },
    { path: '/perfil', icon: User, label: 'Perfil' },
  ];

  const supervisorItems = [
    { path: '/dashboard', icon: Home, label: 'Panel' },
    { path: '/dashboard-operativo', icon: BarChart3, label: 'Operativo' },
    { path: '/reportes', icon: FileText, label: 'Reportes' },
    { path: '/chat', icon: MessageCircle, label: 'Chat' },
    { path: '/perfil', icon: User, label: 'Perfil' },
  ];

  const adminItems = [
    { path: '/dashboard', icon: Home, label: 'Panel' },
    { path: '/dashboard-operativo', icon: BarChart3, label: 'Operativo' },
    { path: '/servicios', icon: Settings, label: 'Servicios' },
    { path: '/chat', icon: MessageCircle, label: 'Chat' },
    { path: '/perfil', icon: User, label: 'Perfil' },
  ];

  const items = user?.role === 'admin' ? adminItems : user?.role === 'supervisor' ? supervisorItems : guardItems;

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-card border-t border-border z-50">
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto">
        {items.map(item => {
          const isActive = location.pathname === item.path;
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`flex flex-col items-center justify-center gap-0.5 w-16 h-full transition-colors ${
                isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <item.icon className={`w-5 h-5 ${isActive ? 'stroke-[2.5]' : ''}`} />
              <span className="text-[10px] font-semibold">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;
