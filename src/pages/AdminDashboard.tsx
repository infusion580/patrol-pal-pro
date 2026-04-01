import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useNavigate } from 'react-router-dom';
import { Users, CheckCircle2, AlertTriangle, MapPin, FileText, BarChart3, Settings, Trash2, Shield, UserCog, Bell } from 'lucide-react';
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
  servicio_asignado_id: string | null;
  status: string;
}

const AdminDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [users, setUsers] = useState<UserItem[]>([]);
  const [servicios, setServicios] = useState<Array<{ id: string; nombre: string }>>([]);
  const [totalRondines, setTotalRondines] = useState('0');
  const [totalEmergencias, setTotalEmergencias] = useState('0');
  const [loading, setLoading] = useState(true);
  const [editingUser, setEditingUser] = useState<string | null>(null);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    const [{ data: profiles }, { data: roles }, { data: srvs }] = await Promise.all([
      supabase.from('profiles').select('*'),
      supabase.from('user_roles').select('*'),
      supabase.from('servicios').select('id, nombre').order('nombre'),
    ]);

    const roleMap = new Map(roles?.map(r => [r.user_id, r.role]));
    if (profiles) {
      setUsers(profiles.map(p => ({
        id: p.user_id,
        nombre: `${p.nombre} ${p.apellido}`,
        empleado: p.numero_empleado,
        role: roleMap.get(p.user_id) || 'guardia',
        email: p.email,
        servicio_asignado_id: (p as any).servicio_asignado_id || null,
        status: (p as any).status || 'activo',
      })));
    }
    setServicios(srvs || []);

    const today = new Date().toISOString().split('T')[0];
    const [{ count: rCount }, { count: eCount }] = await Promise.all([
      supabase.from('rondines').select('*', { count: 'exact', head: true }).gte('created_at', today),
      supabase.from('emergencias').select('*', { count: 'exact', head: true }).eq('atendida', false),
    ]);
    setTotalRondines(String(rCount || 0));
    setTotalEmergencias(String(eCount || 0));
    setLoading(false);
  };

  const removeUser = async (userId: string, nombre: string) => {
    const { error } = await supabase.from('profiles').delete().eq('user_id', userId);
    if (error) {
      toast({ title: 'Error', description: 'No se pudo eliminar el usuario.', variant: 'destructive' });
      return;
    }
    toast({ title: 'Usuario eliminado', description: nombre });
    loadData();
  };

  const changeRole = async (userId: string, newRole: string) => {
    const { error } = await supabase.rpc('promote_user', {
      _target_user_id: userId,
      _new_role: newRole as any,
    });
    if (error) {
      toast({ title: 'Error', description: 'No se pudo cambiar el rol.', variant: 'destructive' });
      return;
    }
    toast({ title: 'Rol actualizado' });
    loadData();
  };

  const assignService = async (userId: string, servicioId: string | null) => {
    const { error } = await supabase
      .from('profiles')
      .update({ servicio_asignado_id: servicioId } as any)
      .eq('user_id', userId);
    if (error) {
      toast({ title: 'Error', description: 'No se pudo asignar el servicio.', variant: 'destructive' });
      return;
    }
    toast({ title: 'Servicio asignado' });
    loadData();
  };

  const changeStatus = async (userId: string, newStatus: string) => {
    const { error } = await supabase
      .from('profiles')
      .update({ status: newStatus } as any)
      .eq('user_id', userId);
    if (error) {
      toast({ title: 'Error', description: 'No se pudo cambiar el estatus.', variant: 'destructive' });
      return;
    }
    toast({ title: 'Estatus actualizado' });
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

  const statusColors: Record<string, { label: string; cls: string }> = {
    activo: { label: 'Activo', cls: 'bg-success/10 text-success' },
    vacaciones: { label: 'Vacaciones', cls: 'bg-primary/10 text-primary' },
    incapacidad: { label: 'Incapacidad', cls: 'bg-warning/10 text-warning' },
    suspendido: { label: 'Suspendido', cls: 'bg-emergency/10 text-emergency' },
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

        <div className="grid grid-cols-3 gap-2">
          {[
            { icon: Settings, label: 'Servicios', path: '/servicios' },
            { icon: MapPin, label: 'Mapa', path: '/mapa' },
            { icon: BarChart3, label: 'Métricas', path: '/metricas' },
            { icon: FileText, label: 'Reportes', path: '/reportes-supervisor' },
            { icon: Bell, label: 'Alertas', path: '/notificaciones' },
            { icon: UserCog, label: 'Gestión RH', path: '/gestion-rh' },
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
            const isEditing = editingUser === u.id;
            return (
              <div key={u.id} className="bg-card rounded-xl p-3 shadow-card">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <span className="text-xs font-bold text-primary">{u.nombre.split(' ').map(n => n[0]).join('')}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-foreground truncate">{u.nombre}</p>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-muted-foreground font-mono">{u.empleado}</span>
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${role.cls}`}>{role.label}</span>
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${(statusColors[u.status] || statusColors.activo).cls}`}>
                        {(statusColors[u.status] || statusColors.activo).label}
                      </span>
                    </div>
                  </div>
                  <button onClick={() => setEditingUser(isEditing ? null : u.id)} className="p-2 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors">
                    <UserCog className="w-4 h-4" />
                  </button>
                  <button onClick={() => removeUser(u.id, u.nombre)} className="p-2 rounded-lg text-muted-foreground hover:text-emergency hover:bg-emergency/10 transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {isEditing && (
                  <div className="mt-3 pt-3 border-t border-border space-y-3">
                    <div>
                      <label className="text-[10px] font-semibold text-muted-foreground block mb-1">Rol</label>
                      <select
                        value={u.role}
                        onChange={(e) => changeRole(u.id, e.target.value)}
                        className="w-full h-9 rounded-lg border border-border bg-background px-3 text-sm text-foreground"
                      >
                        <option value="guardia">Guardia</option>
                        <option value="supervisor">Supervisor</option>
                        <option value="admin">Admin</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-muted-foreground block mb-1">Servicio Asignado</label>
                      <select
                        value={u.servicio_asignado_id || ''}
                        onChange={(e) => assignService(u.id, e.target.value || null)}
                        className="w-full h-9 rounded-lg border border-border bg-background px-3 text-sm text-foreground"
                      >
                        <option value="">Sin asignar</option>
                        {servicios.map(s => (
                          <option key={s.id} value={s.id}>{s.nombre}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-muted-foreground block mb-1">Estatus</label>
                      <select
                        value={u.status}
                        onChange={(e) => changeStatus(u.id, e.target.value)}
                        className="w-full h-9 rounded-lg border border-border bg-background px-3 text-sm text-foreground"
                      >
                        <option value="activo">Activo</option>
                        <option value="vacaciones">Vacaciones</option>
                        <option value="incapacidad">Incapacidad</option>
                        <option value="suspendido">Suspendido</option>
                      </select>
                    </div>
                  </div>
                )}
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
