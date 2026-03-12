import { useAuth } from '@/lib/auth-context';
import { useNavigate } from 'react-router-dom';
import { LogOut, User, Shield, Phone, Bell, HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import BottomNav from '@/components/BottomNav';

const Perfil = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const menuItems = [
  { icon: User, label: 'Datos Personales' },
  { icon: Bell, label: 'Notificaciones' },
  { icon: Phone, label: 'Números de Emergencia' },
  { icon: HelpCircle, label: 'Ayuda y Soporte' }];


  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="text-primary-foreground px-4 pt-12 pb-8 rounded-b-3xl bg-destructive">
        <div className="max-w-lg mx-auto flex flex-col items-center">
          <div className="w-20 h-20 rounded-full bg-primary-foreground/20 flex items-center justify-center mb-3">
            <span className="text-2xl font-bold">{user?.nombre?.[0]}{user?.apellido?.[0]}</span>
          </div>
          <h1 className="text-xl font-display font-bold">{user?.nombre} {user?.apellido}</h1>
          <p className="text-sm opacity-70 font-mono">#{user?.numeroEmpleado}</p>
          <span className="mt-2 text-xs px-3 py-1 rounded-full bg-primary-foreground/20 font-semibold capitalize flex items-center gap-1">
            <Shield className="w-3 h-3" /> {user?.role}
          </span>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 mt-4 space-y-2">
        {menuItems.map((item) =>
        <button
          key={item.label}
          className="w-full bg-card rounded-xl p-4 shadow-card flex items-center gap-3 hover:shadow-elevated transition-shadow">
          
            <item.icon className="w-5 h-5 text-primary" />
            <span className="text-sm font-semibold text-foreground">{item.label}</span>
          </button>
        )}

        <Button onClick={handleLogout} variant="outline" className="w-full h-12 mt-4 text-emergency border-emergency/30 hover:bg-emergency/5">
          <LogOut className="w-4 h-4 mr-2" /> Cerrar Sesión
        </Button>
      </div>

      <BottomNav />
    </div>);

};

export default Perfil;