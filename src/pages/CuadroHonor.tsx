import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Trophy, Medal, Crown, Star } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { INSIGNIA_META } from '@/lib/goals-helpers';
import BottomNav from '@/components/BottomNav';

type Tab = 'hoy' | 'semana' | 'mes';

interface RegistroHonor {
  id: string;
  guardia_id: string;
  fecha: string;
  rondines_completados: number;
  reportes_completados: number;
  puntos: number;
  insignias: string[];
}

interface PerfilLite {
  user_id: string;
  nombre: string;
  apellido: string;
  numero_empleado: string;
  avatar_url: string | null;
}

interface Ranked {
  perfil: PerfilLite | undefined;
  totalPuntos: number;
  diasCumplidos: number;
  insignias: Set<string>;
}

const CuadroHonor = () => {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('hoy');
  const [registros, setRegistros] = useState<RegistroHonor[]>([]);
  const [perfiles, setPerfiles] = useState<PerfilLite[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
  }, [tab]);

  const load = async () => {
    setLoading(true);
    const today = new Date();
    let startDate = new Date(today);
    if (tab === 'semana') startDate.setDate(today.getDate() - 6);
    else if (tab === 'mes') startDate.setDate(today.getDate() - 29);
    const startISO = startDate.toISOString().split('T')[0];

    const { data: regs } = await supabase
      .from('cuadro_honor')
      .select('*')
      .gte('fecha', startISO)
      .order('puntos', { ascending: false });

    const guardiaIds = Array.from(new Set((regs || []).map(r => r.guardia_id)));
    let profs: PerfilLite[] = [];
    if (guardiaIds.length > 0) {
      const { data } = await supabase
        .from('profiles')
        .select('user_id,nombre,apellido,numero_empleado,avatar_url')
        .in('user_id', guardiaIds);
      profs = (data || []) as PerfilLite[];
    }
    setRegistros((regs || []) as RegistroHonor[]);
    setPerfiles(profs);
    setLoading(false);
  };

  // Build ranking
  const ranked: Ranked[] = (() => {
    const map = new Map<string, Ranked>();
    registros.forEach(r => {
      const existing = map.get(r.guardia_id);
      const perfil = perfiles.find(p => p.user_id === r.guardia_id);
      if (existing) {
        existing.totalPuntos += r.puntos;
        existing.diasCumplidos += 1;
        r.insignias.forEach(i => existing.insignias.add(i));
      } else {
        map.set(r.guardia_id, {
          perfil,
          totalPuntos: r.puntos,
          diasCumplidos: 1,
          insignias: new Set(r.insignias),
        });
      }
    });
    return Array.from(map.values()).sort((a, b) => b.totalPuntos - a.totalPuntos);
  })();

  const podiumIcon = (i: number) => {
    if (i === 0) return <Crown className="w-6 h-6 text-warning" />;
    if (i === 1) return <Medal className="w-6 h-6 text-muted-foreground" />;
    if (i === 2) return <Medal className="w-6 h-6 text-destructive/70" />;
    return <Star className="w-5 h-5 text-muted-foreground" />;
  };

  return (
    <div className="min-h-dvh bg-background pb-20">
      <div className="bg-gradient-to-br from-warning via-warning/80 to-destructive text-warning-foreground px-4 pt-12 pb-6 rounded-b-3xl">
        <div className="max-w-lg mx-auto">
          <button onClick={() => navigate('/dashboard')} className="flex items-center gap-1 text-sm opacity-80 mb-2">
            <ArrowLeft className="w-4 h-4" /> Regresar
          </button>
          <div className="flex items-center gap-2">
            <Trophy className="w-7 h-7" />
            <div>
              <h1 className="text-xl font-display font-bold">Cuadro de Honor</h1>
              <p className="text-xs opacity-80">Reconocimiento al desempeño</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 -mt-4">
        <div className="bg-card rounded-xl p-1 shadow-card flex gap-1 mb-4">
          {(['hoy', 'semana', 'mes'] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2 text-xs font-semibold rounded-lg capitalize transition-colors ${
                tab === t ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="bg-card rounded-xl p-8 shadow-card text-center">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        ) : ranked.length === 0 ? (
          <div className="bg-card rounded-xl p-8 shadow-card text-center">
            <Trophy className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Aún no hay guardias en el cuadro de honor.</p>
            <p className="text-xs text-muted-foreground mt-1">¡Cumple tu meta diaria para entrar!</p>
          </div>
        ) : (
          <div className="space-y-2">
            {ranked.map((r, i) => {
              const isTop3 = i < 3;
              return (
                <div
                  key={r.perfil?.user_id || i}
                  className={`rounded-xl p-3 shadow-card flex items-center gap-3 ${
                    isTop3 ? 'bg-gradient-to-r from-warning/10 to-card border border-warning/30' : 'bg-card'
                  }`}
                >
                  <div className="w-10 flex flex-col items-center">
                    {podiumIcon(i)}
                    <span className="text-[10px] font-bold text-muted-foreground">#{i + 1}</span>
                  </div>
                  {r.perfil?.avatar_url ? (
                    <img src={r.perfil.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                      {r.perfil?.nombre?.[0] || '?'}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-foreground truncate">
                      {r.perfil ? `${r.perfil.nombre} ${r.perfil.apellido}` : 'Guardia'}
                    </p>
                    <p className="text-[10px] text-muted-foreground font-mono">#{r.perfil?.numero_empleado}</p>
                    {r.insignias.size > 0 && (
                      <div className="flex gap-0.5 mt-1 flex-wrap">
                        {Array.from(r.insignias).slice(0, 4).map(key => (
                          <span key={key} title={INSIGNIA_META[key]?.label} className="text-sm">
                            {INSIGNIA_META[key]?.emoji}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-display font-bold text-foreground">{r.totalPuntos}</p>
                    <p className="text-[10px] text-muted-foreground">pts</p>
                    <p className="text-[10px] text-success font-semibold">{r.diasCumplidos} día{r.diasCumplidos !== 1 ? 's' : ''}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
};

export default CuadroHonor;
