import { useEffect, useState, useRef } from 'react';
import { useAuth } from '@/lib/auth-context';
import { computeGuardProgress, upsertCuadroHonorIfMet, INSIGNIA_META, ProgresoDiario } from '@/lib/goals-helpers';
import { Trophy, Target, Clock, Sparkles } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import confetti from 'canvas-confetti';
import { useToast } from '@/hooks/use-toast';

const DailyProgress = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [p, setP] = useState<ProgresoDiario | null>(null);
  const celebratedRef = useRef(false);

  const load = async () => {
    if (!user) return;
    const data = await computeGuardProgress(user.id);
    setP(data);
    if (data.metaCumplida) {
      const inserted = await upsertCuadroHonorIfMet(user.id, data);
      if (inserted && !celebratedRef.current) {
        celebratedRef.current = true;
        confetti({
          particleCount: 150,
          spread: 90,
          origin: { y: 0.6 },
          colors: ['#facc15', '#22c55e', '#3b82f6', '#a855f7'],
        });
        toast({
          title: '🏆 ¡Meta diaria cumplida!',
          description: 'Has entrado al Cuadro de Honor de hoy.',
        });
      }
    }
  };

  useEffect(() => {
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  if (!p) {
    return (
      <div className="bg-card rounded-xl p-4 shadow-card mb-4 animate-pulse h-32" />
    );
  }

  const isComplete = p.metaCumplida;

  return (
    <div className={`rounded-xl p-4 shadow-card mb-4 transition-colors ${isComplete ? 'bg-gradient-to-br from-warning/20 via-card to-success/20 border-2 border-warning/50' : 'bg-card'}`}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${isComplete ? 'bg-warning text-warning-foreground' : 'bg-primary/10 text-primary'}`}>
            {isComplete ? <Trophy className="w-5 h-5" /> : <Target className="w-5 h-5" />}
          </div>
          <div>
            <h3 className="font-display font-bold text-sm text-foreground">
              {isComplete ? '¡Meta Cumplida!' : 'Tu meta de hoy'}
            </h3>
            <p className="text-[10px] text-muted-foreground flex items-center gap-1">
              <Clock className="w-3 h-3" /> {p.horaInicio} - {p.horaFin}
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-2xl font-display font-bold text-foreground leading-none">{p.porcentaje}%</p>
          <p className="text-[10px] text-muted-foreground">{p.puntos} pts</p>
        </div>
      </div>

      <Progress value={p.porcentaje} className={`h-3 mb-3 ${isComplete ? '[&>div]:bg-warning' : ''}`} />

      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="bg-background/60 rounded-lg p-2">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Rondines</p>
          <p className="text-sm font-bold text-foreground">
            {p.rondinesCompletados}<span className="text-muted-foreground font-normal">/{p.rondinesMeta}</span>
          </p>
        </div>
        <div className="bg-background/60 rounded-lg p-2">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Reportes</p>
          <p className="text-sm font-bold text-foreground">
            {p.reportesCompletados}<span className="text-muted-foreground font-normal">/{p.reportesMeta}</span>
          </p>
        </div>
      </div>

      {p.insignias.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {p.insignias.map(key => {
            const meta = INSIGNIA_META[key];
            if (!meta) return null;
            return (
              <span key={key} className={`text-[10px] font-semibold px-2 py-1 rounded-full inline-flex items-center gap-1 ${meta.color}`}>
                <span>{meta.emoji}</span>{meta.label}
              </span>
            );
          })}
        </div>
      )}

      {!isComplete && p.porcentaje > 0 && (
        <p className="text-[10px] text-muted-foreground mt-2 flex items-center gap-1">
          <Sparkles className="w-3 h-3 text-warning" /> ¡Vas muy bien! Sigue así para entrar al Cuadro de Honor.
        </p>
      )}
    </div>
  );
};

export default DailyProgress;
