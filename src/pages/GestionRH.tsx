import { useState, useEffect } from 'react';
import { ArrowLeft, Plus, DollarSign, Calendar, Clock, CheckCircle2, XCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth-context';
import BottomNav from '@/components/BottomNav';

interface GuardProfile {
  user_id: string;
  nombre: string;
  apellido: string;
  numero_empleado: string;
}

interface RegistroRH {
  id: string;
  guardia_id: string;
  tipo: string;
  fecha: string;
  fecha_fin: string | null;
  monto: number | null;
  nota: string;
  status: string;
  created_at: string;
  guardia_nombre?: string;
}

/**
 * Tipos de registro de RH.
 * `vacaciones`, `incapacidad` y `permiso` son ausencias justificadas: cuando el
 * registro queda APROBADO, los días cubiertos dejan de contar como falta en el
 * Reporte de Asistencias.
 */
const tipoConfig: Record<string, { label: string; icon: any; color: string }> = {
  turno_extra: { label: 'Turno Extra', icon: Clock, color: 'text-primary' },
  prestamo: { label: 'Préstamo', icon: DollarSign, color: 'text-warning' },
  vacaciones: { label: 'Vacaciones', icon: Calendar, color: 'text-success' },
  incapacidad: { label: 'Incapacidad', icon: Calendar, color: 'text-emergency' },
  permiso: { label: 'Permiso', icon: Calendar, color: 'text-secondary' },
};

/** Tipos que generan ausencia justificada (requieren rango de fechas). */
const TIPOS_AUSENCIA = ['vacaciones', 'incapacidad', 'permiso'];


const statusConfig: Record<string, { label: string; cls: string }> = {
  pendiente: { label: 'Pendiente', cls: 'bg-warning/10 text-warning' },
  aprobado: { label: 'Aprobado', cls: 'bg-success/10 text-success' },
  rechazado: { label: 'Rechazado', cls: 'bg-emergency/10 text-emergency' },
};

const GestionRH = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [guardias, setGuardias] = useState<GuardProfile[]>([]);
  const [registros, setRegistros] = useState<RegistroRH[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    guardia_id: '',
    tipo: 'turno_extra',
    fecha: new Date().toISOString().split('T')[0],
    fecha_fin: '',
    monto: '',
    nota: '',
  });

  useEffect(() => { loadData(); }, []);

  // Realtime: refresh when registros_rh changes
  useEffect(() => {
    const channel = supabase
      .channel('registros-rh-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'registros_rh' }, () => {
        loadData();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const loadData = async () => {
    const [{ data: roles }, { data: profiles }, { data: regs }] = await Promise.all([
      supabase.from('user_roles').select('user_id').eq('role', 'guardia'),
      supabase.from('profiles').select('user_id, nombre, apellido, numero_empleado'),
      supabase.from('registros_rh' as any).select('*').order('created_at', { ascending: false }).limit(50),
    ]);

    const guardiaIds = new Set(roles?.map(r => r.user_id) || []);
    const guards = (profiles || []).filter(p => guardiaIds.has(p.user_id));
    setGuardias(guards);

    const profileMap = new Map((profiles || []).map(p => [p.user_id, `${p.nombre} ${p.apellido}`]));
    setRegistros((regs || []).map((r: any) => ({
      ...r,
      guardia_nombre: profileMap.get(r.guardia_id) || 'Guardia',
    })));

    if (guards.length > 0 && !form.guardia_id) {
      setForm(f => ({ ...f, guardia_id: guards[0].user_id }));
    }
    setLoading(false);
  };

  const handleSubmit = async () => {
    if (!form.guardia_id || !user) return;

    const payload: any = {
      guardia_id: form.guardia_id,
      tipo: form.tipo,
      fecha: form.fecha,
      fecha_fin: form.fecha_fin || null,
      monto: form.tipo === 'prestamo' && form.monto ? parseFloat(form.monto) : null,
      nota: form.nota,
      created_by: user.id,
      status: (user.role === 'admin') ? 'aprobado' : 'pendiente',
    };

    const { error } = await supabase.from('registros_rh' as any).insert(payload);
    if (error) {
      toast({ title: 'Error', description: 'No se pudo guardar el registro.', variant: 'destructive' });
      return;
    }
    toast({ title: 'Registro guardado', description: `${tipoConfig[form.tipo]?.label} registrado correctamente.` });
    setShowForm(false);
    setForm(f => ({ ...f, nota: '', monto: '', fecha_fin: '' }));
    loadData();
  };

  const updateStatus = async (id: string, newStatus: string) => {
    const { error } = await supabase.from('registros_rh' as any).update({ status: newStatus }).eq('id', id);
    if (error) {
      toast({ title: 'Error', description: 'No se pudo actualizar.', variant: 'destructive' });
      return;
    }
    toast({ title: 'Estatus actualizado' });
    loadData();
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
        <div className="max-w-lg mx-auto">
          <button onClick={() => navigate('/dashboard')} className="flex items-center gap-1 text-sm opacity-80 mb-2">
            <ArrowLeft className="w-4 h-4" /> Regresar
          </button>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-display font-bold">Gestión RH</h1>
              <p className="text-sm opacity-70 mt-1">Turnos extra, préstamos, vacaciones, incapacidades y permisos</p>
            </div>
            <Button size="sm" variant="secondary" onClick={() => setShowForm(!showForm)} className="gap-1">
              <Plus className="w-4 h-4" /> Nuevo
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 -mt-4 space-y-3">
        {showForm && (
          <div className="bg-card rounded-xl p-4 shadow-card space-y-3 animate-slide-up">
            <h3 className="text-sm font-semibold text-foreground">Nuevo Registro</h3>

            <div>
              <label className="text-[10px] font-semibold text-muted-foreground block mb-1">Guardia</label>
              <select
                value={form.guardia_id}
                onChange={e => setForm(f => ({ ...f, guardia_id: e.target.value }))}
                className="w-full h-9 rounded-lg border border-border bg-background px-3 text-sm text-foreground"
              >
                {guardias.map(g => (
                  <option key={g.user_id} value={g.user_id}>{g.nombre} {g.apellido} ({g.numero_empleado})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[10px] font-semibold text-muted-foreground block mb-1">Tipo</label>
              <select
                value={form.tipo}
                onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}
                className="w-full h-9 rounded-lg border border-border bg-background px-3 text-sm text-foreground"
              >
                <option value="turno_extra">Turno Extra</option>
                <option value="prestamo">Préstamo</option>
                <option value="vacaciones">Vacaciones</option>
                <option value="incapacidad">Incapacidad</option>
                <option value="permiso">Permiso</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] font-semibold text-muted-foreground block mb-1">Fecha</label>
                <Input type="date" value={form.fecha} onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))} className="h-9 text-sm" />
              </div>
              {TIPOS_AUSENCIA.includes(form.tipo) && (
                <div>
                  <label className="text-[10px] font-semibold text-muted-foreground block mb-1">Fecha Fin</label>
                  <Input type="date" value={form.fecha_fin} onChange={e => setForm(f => ({ ...f, fecha_fin: e.target.value }))} className="h-9 text-sm" />
                </div>
              )}
            </div>

            {form.tipo === 'prestamo' && (
              <div>
                <label className="text-[10px] font-semibold text-muted-foreground block mb-1">Monto ($)</label>
                <Input type="number" step="0.01" placeholder="0.00" value={form.monto} onChange={e => setForm(f => ({ ...f, monto: e.target.value }))} className="h-9 text-sm" />
              </div>
            )}

            <div>
              <label className="text-[10px] font-semibold text-muted-foreground block mb-1">Nota</label>
              <Input placeholder="Observaciones..." value={form.nota} onChange={e => setForm(f => ({ ...f, nota: e.target.value }))} className="h-9 text-sm" />
            </div>

            <div className="flex gap-2">
              <Button size="sm" onClick={handleSubmit} className="flex-1">Guardar</Button>
              <Button size="sm" variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
            </div>
          </div>
        )}

        <h2 className="text-sm font-semibold text-muted-foreground">Registros Recientes</h2>

        {registros.length === 0 && (
          <div className="bg-card rounded-xl p-8 shadow-card text-center">
            <Calendar className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Sin registros aún</p>
          </div>
        )}

        {registros.map(reg => {
          const cfg = tipoConfig[reg.tipo] || tipoConfig.turno_extra;
          const st = statusConfig[reg.status] || statusConfig.pendiente;
          const Icon = cfg.icon;
          const isAdmin = user?.role === 'admin';
          const isPending = reg.status === 'pendiente';

          return (
            <div key={reg.id} className="bg-card rounded-xl p-4 shadow-card">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-accent flex items-center justify-center shrink-0">
                  <Icon className={`w-5 h-5 ${cfg.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-foreground">{cfg.label}</p>
                  <p className="text-xs text-muted-foreground">{reg.guardia_nombre}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {reg.fecha}{reg.fecha_fin ? ` → ${reg.fecha_fin}` : ''}
                    {reg.monto ? ` • $${reg.monto}` : ''}
                  </p>
                  {reg.nota && <p className="text-[10px] text-muted-foreground italic mt-0.5">{reg.nota}</p>}
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${st.cls}`}>{st.label}</span>
                  {isAdmin && isPending && (
                    <div className="flex gap-1 mt-1">
                      <button onClick={() => updateStatus(reg.id, 'aprobado')} className="p-1 rounded bg-success/10 hover:bg-success/20 transition-colors">
                        <CheckCircle2 className="w-3.5 h-3.5 text-success" />
                      </button>
                      <button onClick={() => updateStatus(reg.id, 'rechazado')} className="p-1 rounded bg-emergency/10 hover:bg-emergency/20 transition-colors">
                        <XCircle className="w-3.5 h-3.5 text-emergency" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <BottomNav />
    </div>
  );
};

export default GestionRH;
