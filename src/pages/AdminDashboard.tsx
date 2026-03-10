import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useNavigate } from 'react-router-dom';
import { Users, CheckCircle2, AlertTriangle, Clock, MapPin, FileText, BarChart3, Settings, Trash2, Shield, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import BottomNav from '@/components/BottomNav';

interface UserItem {
  id: string;
  nombre: string;
  empleado: string;
  role: string;
  email: string;
}

const AdminDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [users, setUsers] = useState<UserItem[]>([]);
  const [totalRondines, setTotalRondines] = useState('0');
  const [totalEmergencias, setTotalEmergencias] = useState('0');
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    // Load all profiles with roles
    const { data: profiles } = await supabase.from('profiles').select('*');
    const { data: roles } = await supabase.from('user_roles').select('*');
    const roleMap = new Map(roles?.map(r => [r.user_id, r.role]));

    if (profiles) {
      setUsers(profiles.map(p => ({
        id: p.user_id,
        nombre: `${p.nombre} ${p.apellido}`,
        empleado: p.numero_empleado,
        role: roleMap.get(p.user_id) || 'guardia',
        email: p.email,
      })));
    }

    // Stats
    const today = new Date().toISOString().split('T')[0];
    const { count: rCount } = await supabase.from('rondines').select('*', { count: 'exact', head: true }).gte('created_at', today);
    setTotalRondines(String(rCount || 0));

    const { count: eCount } = await supabase.from('emergencias').select('*', { count: 'exact', head: true }).eq('atendida', false);
    setTotalEmergencias(String(eCount || 0));

    setLoading(false);
  };

  const removeUser = async (userId: string, nombre: string) => {
    // Delete from auth via admin - for now just remove profile (auth user remains)
    const { error } = await supabase.from('profiles').delete().eq('user_id', userId);
    if (error) {
      toast({ title: 'Error', description: 'No se pudo eliminar. Se requieren permisos de admin.', variant: 'destructive' });
      return;
    }
    toast({ title: 'Usuario eliminado', description: nombre });
    loadData();
  };

  const guardiasCount = users.filter(u => u.role === 'guardia').length;

  const metrics = [
    { icon: Users, label: 'Total Usuarios', value: String(users.length), color: 'text-primary' },
    { icon: Shield, label: 'Guardias', value: String(guardiasCount), color: 'text-success' },
    { icon: CheckCircle2, label: 'Rondines Hoy', value: totalRondines, color: 'text-secondary' },
    { icon: AlertTriangle, label: 'Emergencias', value: totalEmergencias, color: 'text-emergency' },
  ];

  const roleColors: Record<string, { label: string; cls: string }> = {
    guardia: { label: 'Guardia', cls: 'bg-primary/10 text-primary' },
    supervisor: { label: 'Supervisor', cls: 'bg-secondary/10 text-secondary' },
    admin: { label: 'Admin', cls: 'bg-emergency/10 text-emergency' },
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="bg-primary text-primary-foreground px-4 pt-12 pb-6 rounded-b-3xl">
        <div className="max-w-lg mx-auto">
          <p className="text-sm opacity-80">Panel Administrador</p>
          <h1 className="text-2xl font-display font-bold">{user?.nombre} {user?.apellido}</h1>
          <p className="text-xs opacity-70 mt-1 font-mono">#{user?.numeroEmpleado}</p>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 -mt-4 space-y-4">
        <div className="bg-card rounded-xl p-4 shadow-card grid grid-cols-2 gap-3">
          {metrics.map(m => (
            <div key={m.label} className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-accent flex items-center justify-center">
                <m.icon className={`w-4 h-4 ${m.color}`} />
              </div>
              <div>
                <p className="text-lg font-bold text-foreground leading-tight">{m.value}</p>
                <p className="text-[9px] text-muted-foreground leading-tight">{m.label}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-4 gap-2">
          {[
            { icon: Settings, label: 'Servicios', path: '/servicios' },
            { icon: MapPin, label: 'Mapa', path: '/mapa' },
            { icon: BarChart3, label: 'Métricas', path: '/metricas' },
            { icon: FileText, label: 'Reportes', path: '/reportes-supervisor' },
          ].map(a => (
            <button key={a.label} onClick={() => navigate(a.path)} className="bg-card rounded-xl p-3 shadow-card flex flex-col items-center gap-1.5 hover:shadow-elevated transition-shadow active:scale-[0.98]">
              <a.icon className="w-5 h-5 text-primary" />
              <span className="text-[10px] font-semibold text-foreground">{a.label}</span>
            </button>
          ))}
        </div>

        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-muted-foreground">Gestión de Usuarios</h2>
          <span className="text-xs text-primary font-semibold">{users.length} registrados</span>
        </div>
        <div className="space-y-2">
          {users.map(u => {
            const role = roleColors[u.role] || roleColors.guardia;
            return (
              <div key={u.id} className="bg-card rounded-xl p-3 shadow-card flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <span className="text-xs font-bold text-primary">{u.nombre.split(' ').map(n => n[0]).join('')}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-foreground truncate">{u.nombre}</p>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-muted-foreground font-mono">{u.empleado}</span>
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${role.cls}`}>{role.label}</span>
                  </div>
                </div>
                <button
                  onClick={() => removeUser(u.id, u.nombre)}
                  className="p-2 rounded-lg text-muted-foreground hover:text-emergency hover:bg-emergency/10 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      <BottomNav />
    </div>
  );
};

export default AdminDashboard;
