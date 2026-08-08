import { useEffect, useState } from 'react';
import { ArrowLeft, Plus, Trash2, Power, ClipboardList, CheckCircle2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/hooks/use-toast';
import BottomNav from '@/components/BottomNav';

interface Servicio { id: string; nombre: string; }
interface Guardia { id: string; nombre: string; empleado: string; }

interface Pendiente {
  id: string;
  servicio_id: string;
  guardia_id: string | null;
  titulo: string;
  descripcion: string;
  prioridad: 'baja' | 'media' | 'alta' | 'critica';
  frecuencia: 'unica' | 'cada_turno' | 'cada_horas';
  horas_intervalo: number | null;
  activo: boolean;
  vigencia_inicio: string;
  vigencia_fin: string | null;
}

const prioridadCls: Record<string, string> = {
  critica: 'bg-emergency/10 text-emergency',
  alta: 'bg-warning/10 text-warning',
  media: 'bg-primary/10 text-primary',
  baja: 'bg-muted text-muted-foreground',
};

const PendientesPuesto = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const [servicios, setServicios] = useState<Servicio[]>([]);
  const [guardias, setGuardias] = useState<Guardia[]>([]);
  const [selectedServicio, setSelectedServicio] = useState<string>('');
  const [items, setItems] = useState<Pendiente[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  // Form state
  const [titulo, setTitulo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [prioridad, setPrioridad] = useState<'baja' | 'media' | 'alta' | 'critica'>('media');
  const [frecuencia, setFrecuencia] = useState<'unica' | 'cada_turno' | 'cada_horas'>('cada_turno');
  const [horasIntervalo, setHorasIntervalo] = useState<number>(2);
  const [guardiaEspecifico, setGuardiaEspecifico] = useState<string>('');
  const [vigenciaFin, setVigenciaFin] = useState<string>('');

  useEffect(() => { loadInicial(); }, []);
  useEffect(() => { if (selectedServicio) loadItems(); }, [selectedServicio]);

  const loadInicial = async () => {
    const [{ data: srvs }, { data: profiles }, { data: roles }] = await Promise.all([
      supabase.from('servicios').select('id, nombre').order('nombre'),
      supabase.from('profiles').select('user_id, nombre, apellido, numero_empleado'),
      supabase.from('user_roles').select('user_id, role').eq('role', 'guardia'),
    ]);
    setServicios(srvs || []);
    if (srvs && srvs.length > 0) setSelectedServicio(srvs[0].id);

    const guardiaIds = new Set((roles || []).map((r) => r.user_id));
    const list: Guardia[] = (profiles || [])
      .filter((p) => guardiaIds.has(p.user_id))
      .map((p) => ({
        id: p.user_id,
        nombre: `${p.nombre} ${p.apellido}`.trim(),
        empleado: p.numero_empleado,
      }));
    setGuardias(list);
    setLoading(false);
  };

  const loadItems = async () => {
    const { data } = await supabase
      .from('pendientes_puesto' as any)
      .select('*')
      .eq('servicio_id', selectedServicio)
      .order('created_at', { ascending: false });
    setItems((data as any[]) || []);
  };

  const resetForm = () => {
    setTitulo('');
    setDescripcion('');
    setPrioridad('media');
    setFrecuencia('cada_turno');
    setHorasIntervalo(2);
    setGuardiaEspecifico('');
    setVigenciaFin('');
    setShowForm(false);
  };

  const crear = async () => {
    if (!selectedServicio || !titulo.trim() || !user) {
      toast({ title: 'Faltan datos', description: 'Título y servicio son obligatorios.', variant: 'destructive' });
      return;
    }
    const { error } = await supabase.from('pendientes_puesto' as any).insert({
      servicio_id: selectedServicio,
      guardia_id: guardiaEspecifico || null,
      titulo: titulo.trim(),
      descripcion: descripcion.trim(),
      prioridad,
      frecuencia,
      horas_intervalo: frecuencia === 'cada_horas' ? horasIntervalo : null,
      vigencia_fin: vigenciaFin || null,
      created_by: user.id,
    } as any);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: '✅ Pendiente creado' });
    resetForm();
    loadItems();
  };

  const toggleActivo = async (p: Pendiente) => {
    await supabase.from('pendientes_puesto' as any).update({ activo: !p.activo } as any).eq('id', p.id);
    loadItems();
  };

  const eliminar = async (id: string) => {
    if (!confirm('¿Eliminar este pendiente? Se borrarán también sus registros de cumplimiento.')) return;
    await supabase.from('pendientes_completados' as any).delete().eq('pendiente_id', id);
    await supabase.from('pendientes_puesto' as any).delete().eq('id', id);
    toast({ title: 'Eliminado' });
    loadItems();
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
          <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm opacity-80 mb-2">
            <ArrowLeft className="w-4 h-4" /> Regresar
          </button>
          <h1 className="text-xl font-display font-bold flex items-center gap-2">
            <ClipboardList className="w-5 h-5" /> Pendientes del puesto
          </h1>
          <p className="text-sm opacity-70 mt-1">Tareas que el guardia debe cumplir en cada servicio.</p>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 -mt-4">
        <div className="bg-card rounded-xl p-4 shadow-card mb-4">
          <label className="text-xs font-semibold text-muted-foreground mb-2 block">Servicio</label>
          <select
            value={selectedServicio}
            onChange={(e) => setSelectedServicio(e.target.value)}
            className="w-full h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground"
          >
            {servicios.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
          </select>
        </div>

        {!showForm ? (
          <Button onClick={() => setShowForm(true)} className="w-full mb-4">
            <Plus className="w-4 h-4 mr-2" /> Nuevo pendiente
          </Button>
        ) : (
          <div className="bg-card rounded-xl p-4 shadow-card mb-4 space-y-3">
            <h3 className="font-display font-bold text-sm">Nuevo pendiente</h3>

            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">Título *</label>
              <input
                type="text"
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                placeholder="Ej. Revisar puerta 5"
                className="w-full h-9 rounded-lg border border-border bg-background px-3 text-sm"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">Descripción</label>
              <textarea
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                placeholder="Detalles, instrucciones, ubicación específica..."
                rows={2}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm resize-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">Prioridad</label>
                <select
                  value={prioridad}
                  onChange={(e) => setPrioridad(e.target.value as any)}
                  className="w-full h-9 rounded-lg border border-border bg-background px-2 text-sm"
                >
                  <option value="baja">Baja</option>
                  <option value="media">Media</option>
                  <option value="alta">Alta</option>
                  <option value="critica">Crítica</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">Frecuencia</label>
                <select
                  value={frecuencia}
                  onChange={(e) => setFrecuencia(e.target.value as any)}
                  className="w-full h-9 rounded-lg border border-border bg-background px-2 text-sm"
                >
                  <option value="unica">Una sola vez</option>
                  <option value="cada_turno">Cada turno</option>
                  <option value="cada_horas">Cada X horas</option>
                </select>
              </div>
            </div>

            {frecuencia === 'cada_horas' && (
              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">Cada cuántas horas</label>
                <input
                  type="number"
                  min={1}
                  max={24}
                  value={horasIntervalo}
                  onChange={(e) => setHorasIntervalo(Number(e.target.value))}
                  className="w-full h-9 rounded-lg border border-border bg-background px-3 text-sm"
                />
              </div>
            )}

            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">
                Asignar a un guardia específico (opcional)
              </label>
              <select
                value={guardiaEspecifico}
                onChange={(e) => setGuardiaEspecifico(e.target.value)}
                className="w-full h-9 rounded-lg border border-border bg-background px-3 text-sm"
              >
                <option value="">Todos los guardias del servicio</option>
                {guardias.map((g) => (
                  <option key={g.id} value={g.id}>{g.nombre} #{g.empleado}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">
                Vigencia hasta (opcional)
              </label>
              <input
                type="date"
                value={vigenciaFin}
                onChange={(e) => setVigenciaFin(e.target.value)}
                className="w-full h-9 rounded-lg border border-border bg-background px-3 text-sm"
              />
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={resetForm} className="flex-1">Cancelar</Button>
              <Button onClick={crear} className="flex-1">Crear</Button>
            </div>
          </div>
        )}

        <h2 className="text-sm font-semibold text-muted-foreground mb-2">
          Pendientes configurados ({items.length})
        </h2>

        {items.length === 0 && (
          <div className="bg-card rounded-xl p-6 shadow-card text-center">
            <ClipboardList className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Sin pendientes para este servicio.</p>
          </div>
        )}

        <div className="space-y-2">
          {items.map((p) => {
            const guardia = p.guardia_id ? guardias.find((g) => g.id === p.guardia_id) : null;
            return (
              <div key={p.id} className={`bg-card rounded-xl p-3 shadow-card ${!p.activo ? 'opacity-50' : ''}`}>
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <p className="font-semibold text-sm text-foreground">{p.titulo}</p>
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${prioridadCls[p.prioridad]}`}>
                        {p.prioridad.toUpperCase()}
                      </span>
                      {!p.activo && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-muted text-muted-foreground">INACTIVO</span>
                      )}
                    </div>
                    {p.descripcion && <p className="text-xs text-muted-foreground mb-1">{p.descripcion}</p>}
                    <div className="text-[10px] text-muted-foreground space-x-2">
                      <span>📅 {p.frecuencia === 'unica' ? 'Una vez' : p.frecuencia === 'cada_turno' ? 'Cada turno' : `Cada ${p.horas_intervalo}h`}</span>
                      {guardia && <span>👤 {guardia.nombre}</span>}
                      {p.vigencia_fin && <span>⏰ Hasta {new Date(p.vigencia_fin).toLocaleDateString('es-MX')}</span>}
                    </div>
                  </div>
                  <div className="flex flex-col gap-1 shrink-0">
                    <button
                      onClick={() => toggleActivo(p)}
                      className="p-1.5 rounded-lg hover:bg-accent"
                      title={p.activo ? 'Desactivar' : 'Activar'}
                    >
                      {p.activo ? <Power className="w-4 h-4 text-success" /> : <Power className="w-4 h-4 text-muted-foreground" />}
                    </button>
                    <button
                      onClick={() => eliminar(p.id)}
                      className="p-1.5 rounded-lg hover:bg-emergency/10"
                      title="Eliminar"
                    >
                      <Trash2 className="w-4 h-4 text-emergency" />
                    </button>
                  </div>
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

export default PendientesPuesto;
