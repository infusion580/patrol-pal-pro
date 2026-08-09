import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useNavigate } from 'react-router-dom';
import { Users, CheckCircle2, AlertTriangle, MapPin, FileText, BarChart3, Settings, Trash2, Shield, UserCog, Bell, Eye, Target, Trophy, ClipboardList, KeyRound, SlidersHorizontal, ShieldCheck, Palette, HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import BottomNav from '@/components/BottomNav';
import UnreadMessagesBanner from '@/components/UnreadMessagesBanner';
import { useBrandLogo } from '@/lib/branding';

interface GuardiaServicio {
  servicio_id: string;
  es_principal: boolean;
}

interface UserItem {
  id: string;
  nombre: string;
  empleado: string;
  role: string;
  email: string;
  servicio_asignado_id: string | null;
  supervisor_asignado_id: string | null;
  status: string;
  servicios: GuardiaServicio[];
  clienteServicios: string[]; // servicio_ids assigned as client
}

const AdminDashboard = () => {
  const logoDefender = useBrandLogo();
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
    const [{ data: profiles }, { data: roles }, { data: srvs }, { data: gsrv }, { data: csrv }] = await Promise.all([
      supabase.from('profiles').select('*'),
      supabase.from('user_roles').select('*'),
      supabase.from('servicios').select('id, nombre').order('nombre'),
      supabase.from('guardia_servicios' as any).select('guardia_id, servicio_id, es_principal'),
      supabase.from('cliente_servicios' as any).select('cliente_id, servicio_id'),
    ]);

    const roleMap = new Map(roles?.map(r => [r.user_id, r.role]));
    const serviciosByGuardia = new Map<string, GuardiaServicio[]>();
    (gsrv as any[] | null)?.forEach(row => {
      const list = serviciosByGuardia.get(row.guardia_id) || [];
      list.push({ servicio_id: row.servicio_id, es_principal: row.es_principal });
      serviciosByGuardia.set(row.guardia_id, list);
    });
    const serviciosByCliente = new Map<string, string[]>();
    (csrv as any[] | null)?.forEach(row => {
      const list = serviciosByCliente.get(row.cliente_id) || [];
      list.push(row.servicio_id);
      serviciosByCliente.set(row.cliente_id, list);
    });

    if (profiles) {
      setUsers(profiles.map(p => ({
        id: p.user_id,
        nombre: `${p.nombre} ${p.apellido}`,
        empleado: p.numero_empleado,
        role: roleMap.get(p.user_id) || 'guardia',
        email: p.email,
        servicio_asignado_id: (p as any).servicio_asignado_id || null,
        supervisor_asignado_id: (p as any).supervisor_asignado_id || null,
        status: (p as any).status || 'activo',
        servicios: serviciosByGuardia.get(p.user_id) || [],
        clienteServicios: serviciosByCliente.get(p.user_id) || [],
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

  const addServicioToGuardia = async (guardiaId: string, servicioId: string, esPrincipalSiPrimero: boolean) => {
    if (!servicioId) return;
    const guard = users.find(u => u.id === guardiaId);
    const yaTiene = guard?.servicios.some(s => s.servicio_id === servicioId);
    if (yaTiene) {
      toast({ title: 'Ya está asignado', description: 'Ese servicio ya está en la lista.' });
      return;
    }
    const debeSerPrincipal = esPrincipalSiPrimero && (guard?.servicios.length || 0) === 0;
    const { error } = await supabase
      .from('guardia_servicios' as any)
      .insert({
        guardia_id: guardiaId,
        servicio_id: servicioId,
        es_principal: debeSerPrincipal,
        created_by: user?.id,
      } as any);
    if (error) {
      toast({ title: 'Error', description: 'No se pudo asignar el servicio.', variant: 'destructive' });
      return;
    }
    toast({ title: 'Servicio agregado' });
    loadData();
  };

  const removeServicioFromGuardia = async (guardiaId: string, servicioId: string) => {
    const { error } = await supabase
      .from('guardia_servicios' as any)
      .delete()
      .eq('guardia_id', guardiaId)
      .eq('servicio_id', servicioId);
    if (error) {
      toast({ title: 'Error', description: 'No se pudo quitar el servicio.', variant: 'destructive' });
      return;
    }
    toast({ title: 'Servicio quitado' });
    loadData();
  };

  const setServicioPrincipal = async (guardiaId: string, servicioId: string) => {
    // 1) Desmarcar cualquier principal previo para evitar violar el índice único parcial
    const { error: unsetErr } = await supabase
      .from('guardia_servicios' as any)
      .update({ es_principal: false } as any)
      .eq('guardia_id', guardiaId)
      .eq('es_principal', true);
    if (unsetErr) {
      toast({ title: 'Error', description: 'No se pudo actualizar el principal.', variant: 'destructive' });
      return;
    }
    // 2) Marcar el nuevo principal
    const { error } = await supabase
      .from('guardia_servicios' as any)
      .update({ es_principal: true } as any)
      .eq('guardia_id', guardiaId)
      .eq('servicio_id', servicioId);
    if (error) {
      toast({ title: 'Error', description: 'No se pudo marcar como principal.', variant: 'destructive' });
      return;
    }
    toast({ title: 'Servicio principal actualizado' });
    loadData();
  };

  const assignSupervisor = async (userId: string, supervisorId: string | null) => {
    const { error } = await supabase
      .from('profiles')
      .update({ supervisor_asignado_id: supervisorId } as any)
      .eq('user_id', userId);
    if (error) {
      toast({ title: 'Error', description: 'No se pudo asignar el supervisor.', variant: 'destructive' });
      return;
    }
    toast({ title: 'Supervisor asignado' });
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
    cliente: { label: 'Cliente', cls: 'bg-warning/10 text-warning' },
  };

  const addServicioToCliente = async (clienteId: string, servicioId: string) => {
    if (!servicioId) return;
    const { error } = await supabase.from('cliente_servicios' as any).insert({
      cliente_id: clienteId, servicio_id: servicioId, created_by: user?.id,
    } as any);
    if (error) { toast({ title: 'Error', description: 'No se pudo asignar.', variant: 'destructive' }); return; }
    toast({ title: 'Servicio asignado al cliente' });
    loadData();
  };
  const removeServicioFromCliente = async (clienteId: string, servicioId: string) => {
    const { error } = await supabase.from('cliente_servicios' as any).delete()
      .eq('cliente_id', clienteId).eq('servicio_id', servicioId);
    if (error) { toast({ title: 'Error', variant: 'destructive' }); return; }
    toast({ title: 'Servicio quitado del cliente' });
    loadData();
  };

  const statusColors: Record<string, { label: string; cls: string }> = {
    activo: { label: 'Activo', cls: 'bg-success/10 text-success' },
    vacaciones: { label: 'Vacaciones', cls: 'bg-primary/10 text-primary' },
    incapacidad: { label: 'Incapacidad', cls: 'bg-warning/10 text-warning' },
    suspendido: { label: 'Suspendido', cls: 'bg-emergency/10 text-emergency' },
  };

  if (loading) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-background pb-20">
      <div className="text-primary-foreground px-4 pt-12 pb-6 rounded-b-3xl app-header">
        <div className="max-w-lg mx-auto flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-xs uppercase tracking-[0.18em] text-primary font-bold">Panel Administrador</p>
            <h1 className="text-2xl font-display font-bold uppercase truncate">{user?.nombre} {user?.apellido}</h1>
            <p className="text-xs opacity-70 mt-1 font-mono">#{user?.numeroEmpleado}</p>
          </div>
          <div className="shrink-0 flex items-center">
            <img
              src={logoDefender}
              alt="Defender Seguridad Privada"
              className="w-auto object-contain drop-shadow-[0_4px_12px_hsl(0_82%_52%/0.45)]"
              style={{ height: 'clamp(2rem, 7vw, 3rem)' }}
            />
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 -mt-4 space-y-4">
        <UnreadMessagesBanner />
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
            { icon: BarChart3, label: 'Estadísticas', path: '/estadisticas' },
            { icon: FileText, label: 'Reportes', path: '/reportes-supervisor' },
            { icon: Bell, label: 'Alertas', path: '/notificaciones' },
            { icon: UserCog, label: 'Gestión RH', path: '/gestion-rh' },
            { icon: Target, label: 'Metas', path: '/metas' },
            { icon: Trophy, label: 'Cuadro Honor', path: '/cuadro-honor' },
            { icon: ClipboardList, label: 'Asistencias', path: '/reporte-asistencias' },
            { icon: ClipboardList, label: 'Pendientes', path: '/pendientes' },
            { icon: KeyRound, label: 'NIPs', path: '/nips' },
            { icon: SlidersHorizontal, label: 'Reporte Cliente', path: '/cliente-reporte-config' },
            { icon: ShieldCheck, label: 'Auditoría', path: '/auditoria' },
            { icon: Palette, label: 'Identidad', path: '/identidad' },
            { icon: HelpCircle, label: 'Soporte', path: '/soporte-config' },

          ].map(a => (
            <button
              key={a.label}
              onClick={() => navigate(a.path)}
              aria-label={a.label}
              className="bg-card rounded-xl p-3 shadow-card flex flex-col items-center justify-center gap-1.5 min-h-[64px] hover:shadow-elevated transition-shadow active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <a.icon className="w-5 h-5 text-primary" aria-hidden="true" />
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
                    <p className="text-[11px] text-muted-foreground truncate">{u.email}</p>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] text-muted-foreground font-mono">{u.empleado}</span>
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${role.cls}`}>{role.label}</span>
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${(statusColors[u.status] || statusColors.activo).cls}`}>
                        {(statusColors[u.status] || statusColors.activo).label}
                      </span>
                    </div>
                  </div>
                  <button onClick={() => navigate(`/actividad-guardia?id=${u.id}&name=${encodeURIComponent(u.nombre)}`)} className="p-2 rounded-lg text-muted-foreground hover:text-success hover:bg-success/10 transition-colors" title="Ver actividad">
                    <Eye className="w-4 h-4" />
                  </button>
                  <button onClick={() => setEditingUser(isEditing ? null : u.id)} className="p-2 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors">
                    <UserCog className="w-4 h-4" />
                  </button>
                  <button onClick={() => removeUser(u.id, u.nombre)} className="p-2 rounded-lg text-muted-foreground hover:text-emergency hover:bg-emergency/10 transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {(() => {
                  const asignados = u.role === 'cliente'
                    ? u.clienteServicios.map(sid => servicios.find(s => s.id === sid)?.nombre).filter(Boolean) as string[]
                    : u.role === 'guardia'
                      ? u.servicios.map(gs => {
                          const nombre = servicios.find(s => s.id === gs.servicio_id)?.nombre;
                          return nombre ? (gs.es_principal ? `★ ${nombre}` : nombre) : null;
                        }).filter(Boolean) as string[]
                      : u.servicio_asignado_id
                        ? [servicios.find(s => s.id === u.servicio_asignado_id)?.nombre].filter(Boolean) as string[]
                        : [];
                  if (u.role === 'admin') return null;
                  return (
                    <div className="mt-2 pl-13 flex flex-wrap gap-1">
                      {asignados.length === 0 ? (
                        <span className="text-[10px] text-muted-foreground italic">Sin servicios asignados</span>
                      ) : asignados.map((nombre, i) => (
                        <span key={i} className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                          {nombre}
                        </span>
                      ))}
                    </div>
                  );
                })()}



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
                        <option value="cliente">Cliente</option>
                      </select>
                    </div>
                    {u.role === 'guardia' ? (
                      <div>
                        <label className="text-[10px] font-semibold text-muted-foreground block mb-1">
                          Servicios Asignados
                        </label>
                        <div className="space-y-1.5 mb-2">
                          {u.servicios.length === 0 && (
                            <p className="text-xs text-muted-foreground italic">Sin servicios asignados</p>
                          )}
                          {u.servicios.map(gs => {
                            const srv = servicios.find(s => s.id === gs.servicio_id);
                            return (
                              <div key={gs.servicio_id} className="flex items-center gap-2 bg-accent/40 rounded-lg px-2 py-1.5">
                                <span className="text-xs flex-1 truncate text-foreground">{srv?.nombre || 'Servicio eliminado'}</span>
                                {gs.es_principal ? (
                                  <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-primary/15 text-primary">Principal</span>
                                ) : (
                                  <button
                                    onClick={() => setServicioPrincipal(u.id, gs.servicio_id)}
                                    className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground hover:bg-primary/15 hover:text-primary"
                                    title="Marcar como principal"
                                  >
                                    Marcar
                                  </button>
                                )}
                                <button
                                  onClick={() => removeServicioFromGuardia(u.id, gs.servicio_id)}
                                  className="text-emergency hover:text-emergency/80"
                                  title="Quitar"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            );
                          })}
                        </div>
                        <select
                          value=""
                          onChange={(e) => { if (e.target.value) addServicioToGuardia(u.id, e.target.value, true); }}
                          className="w-full h-9 rounded-lg border border-border bg-background px-3 text-sm text-foreground"
                        >
                          <option value="">+ Agregar servicio…</option>
                          {servicios
                            .filter(s => !u.servicios.some(gs => gs.servicio_id === s.id))
                            .map(s => (
                              <option key={s.id} value={s.id}>{s.nombre}</option>
                            ))}
                        </select>
                      </div>
                    ) : u.role === 'cliente' ? (
                      <div>
                        <label className="text-[10px] font-semibold text-muted-foreground block mb-1">
                          Servicios Visibles para el Cliente
                        </label>
                        <div className="space-y-1.5 mb-2">
                          {u.clienteServicios.length === 0 && (
                            <p className="text-xs text-muted-foreground italic">Sin servicios asignados</p>
                          )}
                          {u.clienteServicios.map(sid => {
                            const srv = servicios.find(s => s.id === sid);
                            return (
                              <div key={sid} className="flex items-center gap-2 bg-accent/40 rounded-lg px-2 py-1.5">
                                <span className="text-xs flex-1 truncate text-foreground">{srv?.nombre || 'Servicio eliminado'}</span>
                                <button
                                  onClick={() => removeServicioFromCliente(u.id, sid)}
                                  className="text-emergency hover:text-emergency/80"
                                  title="Quitar"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            );
                          })}
                        </div>
                        <select
                          value=""
                          onChange={(e) => { if (e.target.value) addServicioToCliente(u.id, e.target.value); }}
                          className="w-full h-9 rounded-lg border border-border bg-background px-3 text-sm text-foreground"
                        >
                          <option value="">+ Agregar servicio…</option>
                          {servicios
                            .filter(s => !u.clienteServicios.includes(s.id))
                            .map(s => (
                              <option key={s.id} value={s.id}>{s.nombre}</option>
                            ))}
                        </select>
                      </div>
                    ) : (
                      <div>
                        <label className="text-[10px] font-semibold text-muted-foreground block mb-1">Servicio Asignado</label>
                        <select
                          value={u.servicio_asignado_id || ''}
                          onChange={async (e) => {
                            const val = e.target.value || null;
                            await supabase.from('profiles').update({ servicio_asignado_id: val } as any).eq('user_id', u.id);
                            toast({ title: 'Servicio asignado' });
                            loadData();
                          }}
                          className="w-full h-9 rounded-lg border border-border bg-background px-3 text-sm text-foreground"
                        >
                          <option value="">Sin asignar</option>
                          {servicios.map(s => (
                            <option key={s.id} value={s.id}>{s.nombre}</option>
                          ))}
                        </select>
                      </div>
                    )}
                    {u.role === 'guardia' && (
                      <div>
                        <label className="text-[10px] font-semibold text-muted-foreground block mb-1">Supervisor Asignado</label>
                        <select
                          value={u.supervisor_asignado_id || ''}
                          onChange={(e) => assignSupervisor(u.id, e.target.value || null)}
                          className="w-full h-9 rounded-lg border border-border bg-background px-3 text-sm text-foreground"
                        >
                          <option value="">Sin asignar</option>
                          {users.filter(s => s.role === 'supervisor').map(s => (
                            <option key={s.id} value={s.id}>{s.nombre}</option>
                          ))}
                        </select>
                      </div>
                    )}
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
