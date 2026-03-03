import { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useNavigate } from 'react-router-dom';
import { Users, CheckCircle2, AlertTriangle, Clock, MapPin, FileText, BarChart3, Settings, Trash2, Shield, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import BottomNav from '@/components/BottomNav';

const allUsers = [
  { id: '1', nombre: 'Carlos López', empleado: 'EMP001', role: 'guardia', sitio: 'Plaza Central', activo: true },
  { id: '2', nombre: 'Pedro Martínez', empleado: 'EMP002', role: 'guardia', sitio: 'Torre Norte', activo: true },
  { id: '3', nombre: 'Ana Rodríguez', empleado: 'EMP003', role: 'guardia', sitio: 'Parque Industrial', activo: true },
  { id: '4', nombre: 'Luis Hernández', empleado: 'EMP004', role: 'guardia', sitio: 'Centro Comercial', activo: false },
  { id: '5', nombre: 'María García', empleado: 'SUP001', role: 'supervisor', sitio: 'Zona Norte', activo: true },
  { id: '6', nombre: 'Jorge Ramírez', empleado: 'SUP002', role: 'supervisor', sitio: 'Zona Sur', activo: true },
];

const AdminDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [users, setUsers] = useState(allUsers);

  const removeUser = (id: string, nombre: string) => {
    setUsers(prev => prev.filter(u => u.id !== id));
    toast({ title: 'Usuario eliminado', description: nombre });
  };

  const metrics = [
    { icon: Users, label: 'Total Usuarios', value: users.length.toString(), color: 'text-primary' },
    { icon: Shield, label: 'Guardias', value: users.filter(u => u.role === 'guardia').length.toString(), color: 'text-success' },
    { icon: CheckCircle2, label: 'Rondines Hoy', value: '47', color: 'text-secondary' },
    { icon: AlertTriangle, label: 'Incidencias', value: '3', color: 'text-emergency' },
    { icon: Clock, label: 'Tiempo Resp.', value: '2.1m', color: 'text-warning' },
    { icon: TrendingUp, label: 'Cumplimiento', value: '91%', color: 'text-success' },
  ];

  const roleColors: Record<string, { label: string; cls: string }> = {
    guardia: { label: 'Guardia', cls: 'bg-primary/10 text-primary' },
    supervisor: { label: 'Supervisor', cls: 'bg-secondary/10 text-secondary' },
    admin: { label: 'Admin', cls: 'bg-emergency/10 text-emergency' },
  };

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
        {/* Metrics */}
        <div className="bg-card rounded-xl p-4 shadow-card grid grid-cols-3 gap-3">
          {metrics.map(m => (
            <div key={m.label} className="flex flex-col items-center text-center gap-1">
              <div className="w-9 h-9 rounded-lg bg-accent flex items-center justify-center">
                <m.icon className={`w-4 h-4 ${m.color}`} />
              </div>
              <p className="text-lg font-bold text-foreground leading-tight">{m.value}</p>
              <p className="text-[9px] text-muted-foreground leading-tight">{m.label}</p>
            </div>
          ))}
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-4 gap-2">
          {[
            { icon: Settings, label: 'Servicios', path: '/servicios' },
            { icon: MapPin, label: 'Mapa', path: '/mapa' },
            { icon: BarChart3, label: 'Métricas', path: '/metricas' },
            { icon: FileText, label: 'Reportes', path: '/reportes-supervisor' },
          ].map(a => (
            <button
              key={a.label}
              onClick={() => navigate(a.path)}
              className="bg-card rounded-xl p-3 shadow-card flex flex-col items-center gap-1.5 hover:shadow-elevated transition-shadow active:scale-[0.98]"
            >
              <a.icon className="w-5 h-5 text-primary" />
              <span className="text-[10px] font-semibold text-foreground">{a.label}</span>
            </button>
          ))}
        </div>

        {/* Users Management */}
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
                <div className="flex items-center gap-1">
                  <span className={`w-2 h-2 rounded-full ${u.activo ? 'bg-success' : 'bg-muted-foreground'}`} />
                  <button
                    onClick={() => removeUser(u.id, u.nombre)}
                    className="p-2 rounded-lg text-muted-foreground hover:text-emergency hover:bg-emergency/10 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
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
