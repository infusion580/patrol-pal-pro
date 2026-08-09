import { useState, useEffect } from 'react';
import { ArrowLeft, Bell, Volume2, VolumeX } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth-context';
import BottomNav from '@/components/BottomNav';
import { SignedImg } from '@/components/SignedImg';
import { getSignedUrl } from '@/lib/storage-helpers';
import { useRealtimeTable } from '@/hooks/use-realtime';
import {
  getNotifMeta,
  CATEGORIA_LABEL,
  SEVERIDAD_LABEL,
  SEVERIDAD_STYLE,
  type NotifCategoria,
} from '@/lib/notification-types';
import { isAlertSoundEnabled, setAlertSoundEnabled, playAlertSound } from '@/lib/alert-sound';

interface Notificacion {
  id: string;
  tipo: string;
  mensaje: string;
  leida: boolean;
  created_at: string;
  guardia_nombre?: string;
  foto_url?: string | null;
}

const CATEGORIAS: NotifCategoria[] = ['emergencia', 'turnos', 'operacion', 'accesos', 'sistema'];


const Notificaciones = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [notifs, setNotifs] = useState<Notificacion[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterTipo, setFilterTipo] = useState<string>('all');
  const [soundOn, setSoundOn] = useState<boolean>(() => isAlertSoundEnabled());


  useEffect(() => { loadNotifs(); }, []);

  // Canal compartido: el gestor central evita reconexiones duplicadas
  // cuando el celular sale de suspensión.
  useRealtimeTable('notificaciones', () => loadNotifs());


  const loadNotifs = async () => {
    const { data } = await supabase
      .from('notificaciones')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    if (data && data.length > 0) {
      const guardiaIds = [...new Set(data.map(n => n.guardia_id))];
      const { data: profiles } = await supabase.from('profiles').select('user_id, nombre, apellido').in('user_id', guardiaIds);
      const nameMap = new Map((profiles || []).map(p => [p.user_id, `${p.nombre} ${p.apellido}`]));

      setNotifs(data.map((n: any) => ({
        id: n.id,
        tipo: n.tipo,
        mensaje: n.mensaje,
        leida: n.leida,
        created_at: n.created_at,
        foto_url: n.foto_url || null,
        guardia_nombre: nameMap.get(n.guardia_id) || 'Guardia',
      })));
    }
    setLoading(false);
  };

  const markRead = async (id: string) => {
    await supabase.from('notificaciones').update({ leida: true }).eq('id', id);
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, leida: true } : n));
  };

  const filtered = filterTipo === 'all'
    ? notifs
    : notifs.filter(n => getNotifMeta(n.tipo).categoria === filterTipo);

  // Sólo se muestran las categorías presentes en el historial cargado.
  const categorias = CATEGORIAS.filter(c => notifs.some(n => getNotifMeta(n.tipo).categoria === c));

  const toggleSound = () => {
    const next = !soundOn;
    setAlertSoundEnabled(next);
    setSoundOn(next);
    if (next) playAlertSound('media');
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
      <div className="bg-emergency text-primary-foreground px-4 pt-12 pb-6 rounded-b-3xl">
        <div className="max-w-lg mx-auto">
          <button onClick={() => navigate('/dashboard')} className="flex items-center gap-1 text-sm opacity-80 mb-2">
            <ArrowLeft className="w-4 h-4" /> Regresar
          </button>
          <div className="flex items-center justify-between gap-3">
            <div>
              <h1 className="text-xl font-display font-bold">Notificaciones</h1>
              <p className="text-sm opacity-70 mt-1">{notifs.filter(n => !n.leida).length} sin leer</p>
            </div>
            <button
              onClick={toggleSound}
              aria-label={soundOn ? 'Desactivar sonido de alertas' : 'Activar sonido de alertas'}
              className="flex items-center gap-1.5 rounded-full bg-primary-foreground/15 px-3 py-2 text-xs font-semibold"
            >
              {soundOn ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
              {soundOn ? 'Sonido' : 'Silencio'}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 -mt-4 space-y-3">
        {/* Filtros por categoría */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
          {['all', ...categorias].map(t => (
            <button
              key={t}
              onClick={() => setFilterTipo(t)}
              className={`px-3 py-1 rounded-full text-[10px] font-semibold whitespace-nowrap transition-colors ${
                filterTipo === t ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
              }`}
            >
              {t === 'all' ? 'Todas' : CATEGORIA_LABEL[t as NotifCategoria]}
            </button>
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="bg-card rounded-xl p-8 shadow-card text-center">
            <Bell className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Sin notificaciones</p>
          </div>
        )}

        {filtered.map(n => {
          const cfg = getNotifMeta(n.tipo);
          const Icon = cfg.icon;
          return (
            <div
              key={n.id}
              onClick={() => !n.leida && markRead(n.id)}
              className={`bg-card rounded-xl p-4 shadow-card flex items-start gap-3 cursor-pointer transition-opacity ${n.leida ? 'opacity-60' : ''}`}
            >
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${cfg.bgColor}`}>
                <Icon className={`w-4 h-4 ${cfg.color}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
                  <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${cfg.bgColor} ${cfg.color}`}>
                    {cfg.label}
                  </span>
                  <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${SEVERIDAD_STYLE[cfg.severidad]}`}>
                    {SEVERIDAD_LABEL[cfg.severidad]}
                  </span>
                  <span className="text-[9px] uppercase text-muted-foreground">
                    {CATEGORIA_LABEL[cfg.categoria]}
                  </span>
                </div>

                <p className="text-sm text-foreground whitespace-pre-line">{n.mensaje}</p>
                {n.foto_url && (
                  <button
                    onClick={async (e) => {
                      e.stopPropagation();
                      const u = await getSignedUrl('evidencias', n.foto_url);
                      if (u) window.open(u, '_blank', 'noopener,noreferrer');
                    }}
                    className="block mt-2 w-full text-left"
                  >
                    <SignedImg bucket="evidencias" path={n.foto_url} alt="Evidencia" className="w-full max-h-48 object-cover rounded-lg border border-border" loading="lazy" />
                  </button>
                )}
                <p className="text-[10px] text-muted-foreground mt-1">
                  {new Date(n.created_at).toLocaleString('es-MX', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}
                  {n.guardia_nombre && ` · ${n.guardia_nombre}`}
                </p>
              </div>
              {!n.leida && <div className="w-2.5 h-2.5 rounded-full bg-emergency shrink-0 mt-1" />}
            </div>
          );
        })}
      </div>

      <BottomNav />
    </div>
  );
};

export default Notificaciones;
