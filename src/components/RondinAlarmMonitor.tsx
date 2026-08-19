import { useEffect, useState } from 'react';
import { Clock, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useRondinAlarm } from '@/hooks/use-rondin-alarm';

/**
 * Alarma de rondín (lado guardia).
 * Cuando llega la hora programada bloquea la pantalla —esté donde esté el
 * guardia—, suena, deja la alerta en el módulo de notificaciones y da un
 * máximo de 3 minutos para iniciar el rondín.
 */
const RondinAlarmMonitor = () => {
  const { alarma, aceptar, limiteMin } = useRondinAlarm();
  const [restante, setRestante] = useState(limiteMin * 60);

  useEffect(() => {
    if (!alarma) return;
    const calc = () => {
      const pasado = Math.floor((Date.now() - new Date(alarma.notified_at).getTime()) / 1000);
      setRestante(Math.max(0, limiteMin * 60 - pasado));
    };
    calc();
    const id = window.setInterval(calc, 1000);
    return () => window.clearInterval(id);
  }, [alarma, limiteMin]);

  if (!alarma) return null;

  const mm = String(Math.floor(restante / 60)).padStart(2, '0');
  const ss = String(restante % 60).padStart(2, '0');
  const urgente = restante <= 60;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/95 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm space-y-5 rounded-2xl border border-warning/40 bg-card p-6 text-center shadow-xl">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-warning/15">
          <Clock className="h-8 w-8 text-warning" />
        </div>

        <div className="space-y-1">
          <h2 className="text-xl font-bold">Comienzo de rondín</h2>
          <p className="flex items-center justify-center gap-1 text-sm text-muted-foreground">
            <MapPin className="h-4 w-4" /> {alarma.servicio_nombre}
          </p>
        </div>

        <div className="space-y-1">
          <p className={`font-mono text-4xl font-bold tabular-nums ${urgente ? 'text-emergency' : 'text-warning'}`}>
            {mm}:{ss}
          </p>
          <p className="text-xs text-muted-foreground">
            Debes iniciar tu rondín en máximo {limiteMin} minutos. Si no respondes se
            registrará como rondín no atendido y se notificará a tu supervisor.
          </p>
        </div>

        <Button className="h-14 w-full text-base font-semibold" onClick={aceptar}>
          Iniciar rondín ahora
        </Button>
      </div>
    </div>
  );
};

export default RondinAlarmMonitor;
