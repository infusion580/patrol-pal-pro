import { useState, useEffect } from 'react';
import { ArrowLeft, Bell, AlertTriangle, CheckCircle2, MapPin, Clock, Shield, Filter } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth-context';
import BottomNav from '@/components/BottomNav';

interface Notificacion {
  id: string;
  tipo: string;
  mensaje: string;
  leida: boolean;
  created_at: string;
  guardia_nombre?: string;
  foto_url?: string | null;
}

const tipoConfig: Record<string, { icon: typeof Bell; color: string; bgColor: string; label: string }> = {
  zona: { icon: MapPin, color: 'text-emergency', bgColor: 'bg-emergency/10', label: 'Salida de Zona' },
  turno_inicio: { icon: CheckCircle2, color: 'text-success', bgColor: 'bg-success/10', label: 'Inicio de Turno' },
  turno_fin: { icon: Clock, color: 'text-warning', bgColor: 'bg-warning/10', label: 'Fin de Turno' },
  rondin: { icon: MapPin, color: 'text-primary', bgColor: 'bg-primary/10', label: 'Rondín' },
  incidencia: { icon: AlertTriangle, color: 'text-emergency', bgColor: 'bg-emergency/10', label: 'Incidencia' },
  emergencia: { icon: Shield, color: 'text-emergency', bgColor: 'bg-emergency/10', label: 'Emergencia' },
};

const Notificaciones = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [notifs, setNotifs] = useState<Notificacion[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterTipo, setFilterTipo] = useState<string>('all');

  useEffect(() => { loadNotifs(); }, []);

  useEffect(() => {
    const channel = supabase
      .channel('notificaciones-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notificaciones' }, () => {
        loadNotifs();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

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

  const filtered = filterTipo === 'all' ? notifs : notifs.filter(n => n.tipo === filterTipo);
  const tipos = ['all', ...new Set(notifs.map(n => n.tipo))];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="bg-emergency text-primary-foreground px-4 pt-12 pb-6 rounded-b-3xl">
        <div className="max-w-lg mx-auto">
          <button onClick={() => navigate('/dashboard')} className="flex items-center gap-1 text-sm opacity-80 mb-2">
            <ArrowLeft className="w-4 h-4" /> Regresar
          </button>
          <h1 className="text-xl font-display font-bold">Notificaciones</h1>
          <p className="text-sm opacity-70 mt-1">{notifs.filter(n => !n.leida).length} sin leer</p>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 -mt-4 space-y-3">
        {/* Filters */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
          {tipos.map(t => (
            <button
              key={t}
              onClick={() => setFilterTipo(t)}
              className={`px-3 py-1 rounded-full text-[10px] font-semibold whitespace-nowrap transition-colors ${
                filterTipo === t ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
              }`}
            >
              {t === 'all' ? 'Todas' : tipoConfig[t]?.label || t}
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
          const cfg = tipoConfig[n.tipo] || tipoConfig.zona;
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
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${cfg.bgColor} ${cfg.color}`}>
                    {cfg.label}
                  </span>
                </div>
                <p className="text-sm text-foreground whitespace-pre-line">{n.mensaje}</p>
                <p className="text-[10px] text-muted-foreground mt-1">
                  {new Date(n.created_at).toLocaleString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
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
