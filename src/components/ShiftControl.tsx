import { useState, useEffect } from 'react';
import { Clock, LogIn, LogOut, UserCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/hooks/use-toast';

interface Turno {
  id: string;
  inicio: string;
  status: string;
}

const ShiftControl = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [activeTurno, setActiveTurno] = useState<Turno | null>(null);
  const [loading, setLoading] = useState(true);
  const [showHandoff, setShowHandoff] = useState(false);
  const [guardiaEntrante, setGuardiaEntrante] = useState('');
  const [comentario, setComentario] = useState('');
  const [servicios, setServicios] = useState<Array<{ id: string; nombre: string }>>([]);
  const [selectedServicio, setSelectedServicio] = useState<string>('');

  useEffect(() => {
    if (!user) return;
    loadActiveTurno();
    loadServicios();
  }, [user]);

  const loadActiveTurno = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('turnos')
      .select('id, inicio, status')
      .eq('guardia_id', user.id)
      .eq('status', 'activo')
      .maybeSingle();
    setActiveTurno(data);
    setLoading(false);
  };

  const loadServicios = async () => {
    const { data } = await supabase.from('servicios').select('id, nombre').order('nombre');
    if (data) {
      setServicios(data);
      if (data.length > 0) setSelectedServicio(data[0].id);
    }
  };

  const startShift = async () => {
    if (!user) return;
    const { data, error } = await supabase.from('turnos').insert({
      guardia_id: user.id,
      servicio_id: selectedServicio || null,
    } as any).select('id, inicio, status').single();

    if (!error && data) {
      setActiveTurno(data);
      toast({ title: '✅ Turno iniciado', description: 'Tu turno ha sido registrado exitosamente.' });
    }
  };

  const endShift = async () => {
    if (!activeTurno || !user) return;
    const { error } = await supabase.from('turnos').update({
      fin: new Date().toISOString(),
      status: 'completado',
      comentario_cambio: comentario,
      guardia_entrante: guardiaEntrante,
    } as any).eq('id', activeTurno.id);

    if (!error) {
      setActiveTurno(null);
      setShowHandoff(false);
      setComentario('');
      setGuardiaEntrante('');
      toast({ title: '✅ Cambio de turno', description: 'Tu turno ha sido finalizado y el cambio registrado.' });
    }
  };

  if (loading) return null;

  const elapsed = activeTurno
    ? Math.floor((Date.now() - new Date(activeTurno.inicio).getTime()) / 60000)
    : 0;
  const hrs = Math.floor(elapsed / 60);
  const mins = elapsed % 60;

  return (
    <div className="bg-card rounded-xl p-4 shadow-card mb-4">
      <div className="flex items-center gap-2 mb-3">
        <Clock className="w-5 h-5 text-primary" />
        <h3 className="font-display font-bold text-sm text-foreground">Control de Turno</h3>
      </div>

      {activeTurno ? (
        <>
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-xs text-muted-foreground">Turno activo desde</p>
              <p className="text-sm font-semibold text-foreground">
                {new Date(activeTurno.inicio).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
            <div className="bg-success/10 px-3 py-1 rounded-full">
              <p className="text-xs font-bold text-success">{hrs}h {mins}m</p>
            </div>
          </div>

          {!showHandoff ? (
            <Button
              onClick={() => setShowHandoff(true)}
              className="w-full bg-emergency text-emergency-foreground hover:bg-emergency/90"
            >
              <LogOut className="w-4 h-4 mr-2" /> Finalizar Turno / Cambio de Guardia
            </Button>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">
                  <UserCheck className="w-3 h-3 inline mr-1" />
                  ¿Quién se queda? (guardia entrante)
                </label>
                <input
                  type="text"
                  value={guardiaEntrante}
                  onChange={(e) => setGuardiaEntrante(e.target.value)}
                  placeholder="Nombre del guardia que entra"
                  className="w-full h-9 rounded-lg border border-border bg-background px-3 text-sm text-foreground"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">Comentario de cambio</label>
                <textarea
                  value={comentario}
                  onChange={(e) => setComentario(e.target.value)}
                  placeholder="Novedades, pendientes, observaciones..."
                  rows={2}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground resize-none"
                />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setShowHandoff(false)} className="flex-1">Cancelar</Button>
                <Button onClick={endShift} className="flex-1 bg-emergency text-emergency-foreground hover:bg-emergency/90">
                  Confirmar Cambio
                </Button>
              </div>
            </div>
          )}
        </>
      ) : (
        <>
          {servicios.length > 1 && (
            <div className="mb-3">
              <label className="text-xs text-muted-foreground block mb-1">Servicio</label>
              <select
                value={selectedServicio}
                onChange={(e) => setSelectedServicio(e.target.value)}
                className="w-full h-9 rounded-lg border border-border bg-background px-3 text-sm text-foreground"
              >
                {servicios.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
              </select>
            </div>
          )}
          <Button onClick={startShift} className="w-full bg-success text-success-foreground hover:bg-success/90">
            <LogIn className="w-4 h-4 mr-2" /> Iniciar Turno
          </Button>
        </>
      )}
    </div>
  );
};

export default ShiftControl;
