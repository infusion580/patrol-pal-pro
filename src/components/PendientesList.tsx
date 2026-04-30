import { useEffect, useState, useCallback, useRef } from 'react';
import { ClipboardList, CheckCircle2, Circle, AlertOctagon, Repeat, Camera, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/hooks/use-toast';

interface Pendiente {
  id: string;
  servicio_id: string;
  guardia_id: string | null;
  titulo: string;
  descripcion: string;
  prioridad: 'baja' | 'media' | 'alta' | 'critica';
  frecuencia: 'unica' | 'cada_turno' | 'cada_horas';
  horas_intervalo: number | null;
  vigencia_fin: string | null;
  ultimoCompletadoAt?: string | null;
  cumplido?: boolean;
}

const prioridadStyle: Record<string, { label: string; cls: string; icon: any }> = {
  critica: { label: 'CRÍTICA', cls: 'bg-emergency/10 text-emergency border-emergency/30', icon: AlertOctagon },
  alta: { label: 'ALTA', cls: 'bg-warning/10 text-warning border-warning/30', icon: AlertOctagon },
  media: { label: 'MEDIA', cls: 'bg-primary/10 text-primary border-primary/20', icon: Circle },
  baja: { label: 'BAJA', cls: 'bg-muted text-muted-foreground border-border', icon: Circle },
};

const frecLabel = (f: string, h: number | null) =>
  f === 'unica' ? 'Una vez' : f === 'cada_turno' ? 'Cada turno' : `Cada ${h || 0}h`;

const PendientesList = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [items, setItems] = useState<Pendiente[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;

    // Buscar turno activo
    const { data: turno } = await supabase
      .from('turnos')
      .select('id, servicio_id, inicio')
      .eq('guardia_id', user.id)
      .eq('status', 'activo')
      .maybeSingle();

    if (!turno?.servicio_id) {
      setItems([]);
      setLoading(false);
      return;
    }

    const today = new Date().toISOString().split('T')[0];
    const { data: pends } = await supabase
      .from('pendientes_puesto' as any)
      .select('*')
      .eq('servicio_id', turno.servicio_id)
      .eq('activo', true)
      .lte('vigencia_inicio', today)
      .order('prioridad', { ascending: true });

    const filtered = (pends as any[] || []).filter((p) => {
      if (p.vigencia_fin && p.vigencia_fin < today) return false;
      if (p.guardia_id && p.guardia_id !== user.id) return false;
      return true;
    });

    if (filtered.length === 0) {
      setItems([]);
      setLoading(false);
      return;
    }

    // Cargar registros de completado relevantes
    const ids = filtered.map((p) => p.id);
    const { data: completados } = await supabase
      .from('pendientes_completados' as any)
      .select('pendiente_id, created_at, guardia_id')
      .in('pendiente_id', ids)
      .order('created_at', { ascending: false });

    const ahora = Date.now();
    const turnoInicioMs = turno.inicio ? new Date(turno.inicio).getTime() : 0;

    const enriched: Pendiente[] = filtered.map((p) => {
      const propios = (completados as any[] || []).filter(
        (c) => c.pendiente_id === p.id && c.guardia_id === user.id,
      );
      const ultimo = propios[0]?.created_at || null;
      const ultimoMs = ultimo ? new Date(ultimo).getTime() : 0;

      let cumplido = false;
      if (p.frecuencia === 'unica') cumplido = propios.length > 0;
      else if (p.frecuencia === 'cada_turno') cumplido = ultimoMs >= turnoInicioMs;
      else if (p.frecuencia === 'cada_horas') {
        const intervaloMs = (p.horas_intervalo || 1) * 60 * 60 * 1000;
        cumplido = ahora - ultimoMs < intervaloMs;
      }

      return { ...p, ultimoCompletadoAt: ultimo, cumplido };
    });

    // Pendientes primero, luego cumplidos
    enriched.sort((a, b) => {
      if (a.cumplido !== b.cumplido) return a.cumplido ? 1 : -1;
      const orden = ['critica', 'alta', 'media', 'baja'];
      return orden.indexOf(a.prioridad) - orden.indexOf(b.prioridad);
    });

    setItems(enriched);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    load();
    if (!user) return;
    const ch = supabase
      .channel('pendientes-guard')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pendientes_puesto' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pendientes_completados' }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, load]);

  // Estado del diálogo de cumplimiento
  const [openItem, setOpenItem] = useState<Pendiente | null>(null);
  const [nota, setNota] = useState('');
  const [foto, setFoto] = useState<File | null>(null);
  const [fotoPreview, setFotoPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const abrirCompletar = (p: Pendiente) => {
    setOpenItem(p);
    setNota('');
    setFoto(null);
    setFotoPreview(null);
  };

  const cerrar = () => {
    setOpenItem(null);
    setNota('');
    setFoto(null);
    setFotoPreview(null);
    setSubmitting(false);
  };

  const onSelectFoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      toast({ title: 'Foto muy grande', description: 'Máximo 8MB.', variant: 'destructive' });
      return;
    }
    setFoto(file);
    setFotoPreview(URL.createObjectURL(file));
  };

  const confirmar = async () => {
    if (!user || !openItem) return;
    setSubmitting(true);

    try {
      let fotoUrl = '';
      if (foto) {
        const ext = foto.name.split('.').pop() || 'jpg';
        const path = `${user.id}/${openItem.id}-${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage.from('pendientes').upload(path, foto, {
          cacheControl: '3600',
          upsert: false,
          contentType: foto.type,
        });
        if (upErr) throw upErr;
        const { data } = supabase.storage.from('pendientes').getPublicUrl(path);
        fotoUrl = data.publicUrl;
      }

      const { data: turno } = await supabase
        .from('turnos')
        .select('id')
        .eq('guardia_id', user.id)
        .eq('status', 'activo')
        .maybeSingle();

      const { error } = await supabase.from('pendientes_completados' as any).insert({
        pendiente_id: openItem.id,
        guardia_id: user.id,
        turno_id: turno?.id || null,
        nota: nota.trim(),
        foto_url: fotoUrl,
      } as any);

      if (error) throw error;

      toast({ title: '✅ Completado', description: openItem.titulo });
      cerrar();
      load();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message || 'No se pudo registrar.', variant: 'destructive' });
      setSubmitting(false);
    }
  };

  if (loading) return null;
  if (items.length === 0) return null;

  const pendientesCount = items.filter((i) => !i.cumplido).length;

  return (
    <div className="bg-card rounded-xl p-4 shadow-card mb-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <ClipboardList className="w-5 h-5 text-primary" />
          <h3 className="font-display font-bold text-sm text-foreground">Pendientes del puesto</h3>
        </div>
        <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
          {pendientesCount} pendiente{pendientesCount !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="space-y-2">
        {items.map((p) => {
          const style = prioridadStyle[p.prioridad];
          const Icon = style.icon;
          return (
            <div
              key={p.id}
              className={`border rounded-lg p-3 transition-opacity ${p.cumplido ? 'opacity-60 bg-muted/30' : 'bg-background'} ${style.cls.replace('bg-', 'border-').split(' ').find(c => c.startsWith('border-')) || 'border-border'}`}
            >
              <div className="flex items-start gap-2">
                <button
                  onClick={() => !p.cumplido && marcar(p)}
                  disabled={p.cumplido || marking === p.id}
                  className="mt-0.5 shrink-0"
                  aria-label={p.cumplido ? 'Cumplido' : 'Marcar como completado'}
                >
                  {p.cumplido ? (
                    <CheckCircle2 className="w-6 h-6 text-success" />
                  ) : (
                    <Circle className="w-6 h-6 text-muted-foreground hover:text-primary" />
                  )}
                </button>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-0.5">
                    <p className={`font-semibold text-sm text-foreground ${p.cumplido ? 'line-through' : ''}`}>
                      {p.titulo}
                    </p>
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${style.cls}`}>
                      <Icon className="w-2.5 h-2.5 inline mr-0.5" />
                      {style.label}
                    </span>
                  </div>
                  {p.descripcion && (
                    <p className="text-xs text-muted-foreground mb-1">{p.descripcion}</p>
                  )}
                  <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Repeat className="w-3 h-3" /> {frecLabel(p.frecuencia, p.horas_intervalo)}
                    </span>
                    {p.ultimoCompletadoAt && (
                      <span>
                        Última: {new Date(p.ultimoCompletadoAt).toLocaleTimeString('es-MX', {
                          hour: '2-digit', minute: '2-digit',
                        })}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default PendientesList;
