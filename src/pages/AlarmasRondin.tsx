import { useState, useEffect } from 'react';
import { ArrowLeft, AlarmClock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import BottomNav from '@/components/BottomNav';

interface ServicioAlarma {
  id: string;
  nombre: string;
  cliente: string;
  rondin_intervalo_minutos: number | null;
  rondin_tolerancia_minutos: number;
  permitir_rondin_incompleto: boolean;
}

/**
 * Módulo independiente para la programación de alarmas de rondín por servicio.
 * Separado de "Servicios" para mayor visibilidad en el panel admin/supervisor.
 */
const AlarmasRondin = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [servicios, setServicios] = useState<ServicioAlarma[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchServicios = async () => {
    const { data } = await supabase
      .from('servicios')
      .select('id, nombre, cliente, rondin_intervalo_minutos, rondin_tolerancia_minutos, permitir_rondin_incompleto')
      .order('nombre');
    setServicios(
      (data || []).map((s: any) => ({
        id: s.id,
        nombre: s.nombre,
        cliente: s.cliente,
        rondin_intervalo_minutos: s.rondin_intervalo_minutos ?? null,
        rondin_tolerancia_minutos: s.rondin_tolerancia_minutos ?? 10,
        permitir_rondin_incompleto: s.permitir_rondin_incompleto ?? false,
      })),
    );
    setLoading(false);
  };

  useEffect(() => { fetchServicios(); }, []);

  const updateAlarma = async (id: string, intervalo: number | null, tolerancia: number) => {
    const { error } = await supabase
      .from('servicios')
      .update({ rondin_intervalo_minutos: intervalo, rondin_tolerancia_minutos: tolerancia } as any)
      .eq('id', id);
    if (error) { toast({ title: 'Error', description: 'No se pudo guardar la alarma.', variant: 'destructive' }); return; }
    toast({ title: 'Programación guardada' });
    fetchServicios();
  };

  const togglePermitirIncompleto = async (id: string, permitir: boolean) => {
    const { error } = await supabase.from('servicios').update({ permitir_rondin_incompleto: permitir } as any).eq('id', id);
    if (error) { toast({ title: 'Error', description: 'No se pudo guardar la configuración.', variant: 'destructive' }); return; }
    toast({ title: permitir ? 'Se permite cerrar rondines incompletos' : 'Puntos obligatorios requeridos' });
    fetchServicios();
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
          <h1 className="text-xl font-display font-bold flex items-center gap-2">
            <AlarmClock className="w-5 h-5" /> Programación de rondines
          </h1>
          <p className="text-sm opacity-70 mt-1">Configura cada cuánto suena la alarma de rondín por servicio</p>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-4 space-y-3">
        {servicios.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">No hay servicios registrados.</p>
        )}

        {servicios.map(servicio => (
          <div key={servicio.id} className="bg-card border border-border rounded-xl p-4">
            <div className="mb-3">
              <h3 className="font-semibold text-foreground">{servicio.nombre}</h3>
              <p className="text-xs text-muted-foreground">{servicio.cliente}</p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] text-muted-foreground block mb-1">Alarma cada (minutos)</label>
                <Input
                  type="number"
                  min="0"
                  placeholder="Sin alarma"
                  defaultValue={servicio.rondin_intervalo_minutos ?? ''}
                  onBlur={e => {
                    const raw = e.target.value.trim();
                    const v = raw === '' ? null : Math.max(0, parseInt(raw) || 0);
                    const newVal = v === 0 ? null : v;
                    if (newVal !== servicio.rondin_intervalo_minutos) {
                      updateAlarma(servicio.id, newVal, servicio.rondin_tolerancia_minutos);
                    }
                  }}
                  className="h-10 text-sm"
                />
              </div>
              <div>
                <label className="text-[11px] text-muted-foreground block mb-1">Tolerancia (min)</label>
                <Input
                  type="number"
                  min="1"
                  defaultValue={servicio.rondin_tolerancia_minutos}
                  onBlur={e => {
                    const v = Math.max(1, parseInt(e.target.value) || 10);
                    if (v !== servicio.rondin_tolerancia_minutos) {
                      updateAlarma(servicio.id, servicio.rondin_intervalo_minutos, v);
                    }
                  }}
                  className="h-10 text-sm"
                />
              </div>
            </div>

            <p className="text-[11px] text-muted-foreground mt-2">
              El guardia recibe una alarma bloqueante en ese intervalo y debe responder en máximo 3 minutos.
              Si tarda más de la tolerancia, se registra el retraso y se avisa al supervisor.
            </p>

            <label className="flex items-start gap-2 bg-accent/50 rounded-lg px-3 py-2 mt-3 cursor-pointer">
              <input
                type="checkbox"
                checked={servicio.permitir_rondin_incompleto}
                onChange={e => togglePermitirIncompleto(servicio.id, e.target.checked)}
                className="mt-0.5 w-4 h-4 accent-primary"
              />
              <span className="text-[12px] text-foreground">
                Permitir cerrar rondines incompletos
                <span className="block text-[11px] text-muted-foreground">
                  Si se activa, el guardia podrá finalizar aunque falten puntos obligatorios.
                </span>
              </span>
            </label>
          </div>
        ))}
      </div>

      <BottomNav />
    </div>
  );
};

export default AlarmasRondin;
