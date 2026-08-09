import { useEffect, useState } from 'react';
import { AlertTriangle, MapPinOff, Phone, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/hooks/use-toast';
import { notifySinUbicacion } from '@/lib/notification-helpers';

const EmergencyButton = () => {
  const [showPanel, setShowPanel] = useState(false);
  const [activated, setActivated] = useState(false);
  // Cuando el GPS falla el guardia no es ubicable: se avisa en pantalla y se
  // levanta una alerta para supervisión.
  const [sinUbicacion, setSinUbicacion] = useState<string | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();

  const handleEmergency = async () => {
    if (!user) return;

    let lat: number | null = null;
    let lng: number | null = null;
    let motivoSinUbicacion: string | null = null;
    try {
      if (!navigator.geolocation) throw new Error('unsupported');
      const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
      navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 8000, enableHighAccuracy: true })
      );
      lat = pos.coords.latitude;
      lng = pos.coords.longitude;
      setSinUbicacion(null);
    } catch (err: any) {
      motivoSinUbicacion =
        err?.code === 1 ? 'Permiso de ubicación denegado' :
        err?.code === 3 ? 'Tiempo de espera agotado (sin señal GPS)' :
        err?.message === 'unsupported' ? 'Dispositivo sin soporte de ubicación' :
        'GPS desactivado o ubicación no disponible';
      setSinUbicacion(motivoSinUbicacion);
    }

    await supabase.from('emergencias').insert({
      guardia_id: user.id,
      tipo: 'emergencia',
      lat,
      lng
    });

    if (motivoSinUbicacion) {
      const { data: perfil } = await supabase
        .from('profiles')
        .select('nombre, apellido')
        .eq('user_id', user.id)
        .maybeSingle();
      const nombre = perfil ? `${perfil.nombre} ${perfil.apellido}`.trim() : 'Guardia';
      await notifySinUbicacion(user.id, nombre, motivoSinUbicacion);
    }

    setActivated(true);
    toast({
      title: '🚨 EMERGENCIA ACTIVADA',
      description: motivoSinUbicacion ?
      `Alerta enviada SIN ubicación: ${motivoSinUbicacion}. Se notificó a supervisión.` :
      'Se ha notificado al supervisor y registrado tu ubicación.',
      variant: 'destructive'
    });
    setTimeout(() => setActivated(false), 5000);
  };

  // Los números de llamada directa se administran desde el módulo Soporte del
  // panel de admin (tabla `numeros_emergencia`), así pueden variar por estado.
  const [emergencyNumbers, setEmergencyNumbers] = useState<
    { label: string; desc: string; number: string }[]
  >([]);

  useEffect(() => {
    if (!showPanel) return;
    let activo = true;
    supabase
      .from('numeros_emergencia')
      .select('label, descripcion, numero')
      .eq('activo', true)
      .order('orden', { ascending: true })
      .then(({ data }) => {
        if (!activo) return;
        setEmergencyNumbers(
          (data || []).map((n: any) => ({ label: n.label, desc: n.descripcion, number: n.numero })),
        );
      });
    return () => {
      activo = false;
    };
  }, [showPanel]);

  return (
    <>
      <button
        onClick={() => setShowPanel(true)}
        className="fixed bottom-20 right-4 z-40 w-16 h-16 rounded-full text-emergency-foreground flex items-center justify-center shadow-emergency animate-pulse-emergency active:scale-95 transition-transform bg-secondary">
        
        <AlertTriangle className="w-7 h-7" />
      </button>

      {showPanel &&
      <div className="fixed inset-0 z-50 bg-foreground/50 flex items-end justify-center" onClick={() => setShowPanel(false)}>
          <div
            className="bg-card w-full max-w-lg rounded-t-2xl p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] animate-slide-up overflow-y-auto max-h-[85dvh] overscroll-contain"
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-display font-bold text-foreground">🚨 Emergencia</h2>
                <p className="text-xs text-muted-foreground">Emite la alarma o llama a un número directo</p>
              </div>
              <button onClick={() => setShowPanel(false)} className="text-muted-foreground">
                <X className="w-6 h-6" />
              </button>
            </div>

            {sinUbicacion &&
          <div className="mb-4 flex items-start gap-3 rounded-xl border border-emergency/30 bg-emergency/10 p-3">
                <MapPinOff className="w-5 h-5 text-emergency shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-emergency">No eres ubicable</p>
                  <p className="text-xs text-muted-foreground">{sinUbicacion}. Activa el GPS y los permisos de ubicación; se avisó a supervisión.</p>
                </div>
              </div>
          }

            <Button
            onClick={handleEmergency}
            className={`w-full h-20 text-xl font-bold rounded-xl mb-6 ${
            activated ?
            'bg-success text-success-foreground' :
            'bg-emergency text-emergency-foreground hover:bg-emergency/90'}`
            }>
            
              {activated ? '✅ Alerta Enviada — Ayuda en camino' : '🚨 ACTIVAR ALERTA DE EMERGENCIA'}
            </Button>

            <p className="text-sm font-semibold text-muted-foreground mb-3">O llama directamente:</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
              {emergencyNumbers.map((num) =>
            <a key={num.label} href={`tel:${num.number}`} className="flex flex-col items-center justify-center text-center gap-1 p-3 min-h-[84px] rounded-xl bg-accent hover:bg-accent/80 transition-colors">
                  <Phone className="w-5 h-5 text-primary" />
                  <span className="text-sm font-bold text-foreground leading-tight break-words">{num.label}</span>
                  <span className="text-[10px] text-muted-foreground leading-tight break-words">{num.desc}</span>
                  <span className="text-[10px] font-semibold text-primary">{num.number}</span>
                </a>
            )}
            </div>

            <p className="text-xs text-muted-foreground text-center">
              Las llamadas se registran automáticamente en el sistema
            </p>
          </div>
        </div>
      }
    </>);

};

export default EmergencyButton;