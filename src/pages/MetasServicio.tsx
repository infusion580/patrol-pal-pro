import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Target, Save } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import BottomNav from '@/components/BottomNav';

interface ServicioRow {
  id: string;
  nombre: string;
  cliente: string;
}
interface MetaRow {
  rondines_diarios: number;
  reportes_diarios: number;
  hora_inicio: string;
  hora_fin: string;
}

const MetasServicio = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [servicios, setServicios] = useState<ServicioRow[]>([]);
  const [metas, setMetas] = useState<Record<string, MetaRow>>({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    if (user.role !== 'admin' && user.role !== 'supervisor') {
      navigate('/dashboard');
      return;
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const load = async () => {
    setLoading(true);
    const { data: svcs } = await supabase.from('servicios').select('id,nombre,cliente').order('nombre');
    const { data: metasData } = await supabase.from('metas_servicio').select('*');
    const map: Record<string, MetaRow> = {};
    (metasData || []).forEach((m: any) => {
      map[m.servicio_id] = {
        rondines_diarios: m.rondines_diarios,
        reportes_diarios: m.reportes_diarios,
        hora_inicio: m.hora_inicio?.slice(0, 5) || '08:00',
        hora_fin: m.hora_fin?.slice(0, 5) || '20:00',
      };
    });
    (svcs || []).forEach(s => {
      if (!map[s.id]) {
        map[s.id] = { rondines_diarios: 4, reportes_diarios: 1, hora_inicio: '08:00', hora_fin: '20:00' };
      }
    });
    setServicios(svcs || []);
    setMetas(map);
    setLoading(false);
  };

  const updateField = (svcId: string, field: keyof MetaRow, value: string | number) => {
    setMetas(prev => ({ ...prev, [svcId]: { ...prev[svcId], [field]: value } }));
  };

  const save = async (svcId: string) => {
    setSavingId(svcId);
    const m = metas[svcId];
    const { error } = await supabase
      .from('metas_servicio')
      .upsert(
        {
          servicio_id: svcId,
          rondines_diarios: Number(m.rondines_diarios),
          reportes_diarios: Number(m.reportes_diarios),
          hora_inicio: m.hora_inicio,
          hora_fin: m.hora_fin,
          created_by: user?.id,
        },
        { onConflict: 'servicio_id' }
      );
    setSavingId(null);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Meta guardada' });
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
      <div className="text-primary-foreground px-4 pt-12 pb-6 rounded-b-3xl app-header">
        <div className="max-w-lg mx-auto">
          <button onClick={() => navigate('/dashboard')} className="flex items-center gap-1 text-sm opacity-80 mb-2">
            <ArrowLeft className="w-4 h-4" /> Regresar
          </button>
          <div className="flex items-center gap-2">
            <Target className="w-6 h-6" />
            <div>
              <h1 className="text-xl font-display font-bold">Metas por Servicio</h1>
              <p className="text-sm opacity-70">Define rondines y reportes diarios</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 -mt-4 space-y-3">
        {servicios.length === 0 && (
          <div className="bg-card rounded-xl p-8 shadow-card text-center">
            <p className="text-sm text-muted-foreground">No hay servicios registrados.</p>
            <Button size="sm" className="mt-3" onClick={() => navigate('/servicios')}>Crear servicio</Button>
          </div>
        )}

        {servicios.map(s => {
          const m = metas[s.id];
          return (
            <div key={s.id} className="bg-card rounded-xl p-4 shadow-card space-y-3">
              <div>
                <p className="font-semibold text-sm text-foreground">{s.nombre}</p>
                <p className="text-xs text-muted-foreground">{s.cliente}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Rondines/día</Label>
                  <Input type="number" min="0" value={m.rondines_diarios} onChange={e => updateField(s.id, 'rondines_diarios', e.target.value)} className="h-9" />
                </div>
                <div>
                  <Label className="text-xs">Reportes/día</Label>
                  <Input type="number" min="0" value={m.reportes_diarios} onChange={e => updateField(s.id, 'reportes_diarios', e.target.value)} className="h-9" />
                </div>
                <div>
                  <Label className="text-xs">Hora inicio</Label>
                  <Input type="time" value={m.hora_inicio} onChange={e => updateField(s.id, 'hora_inicio', e.target.value)} className="h-9" />
                </div>
                <div>
                  <Label className="text-xs">Hora fin</Label>
                  <Input type="time" value={m.hora_fin} onChange={e => updateField(s.id, 'hora_fin', e.target.value)} className="h-9" />
                </div>
              </div>
              <Button size="sm" onClick={() => save(s.id)} disabled={savingId === s.id} className="w-full gap-1">
                <Save className="w-4 h-4" />{savingId === s.id ? 'Guardando...' : 'Guardar meta'}
              </Button>
            </div>
          );
        })}
      </div>

      <BottomNav />
    </div>
  );
};

export default MetasServicio;
