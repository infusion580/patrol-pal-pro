/**
 * Administración del Cuadro de Honor
 * ----------------------------------
 * Admin y supervisor pueden registrar reconocimientos (guardia, posición,
 * periodo y motivo), publicarlos —lo que notifica a todos los guardias y
 * genera un anuncio en Comunicados— y eliminarlos.
 *
 * El bono NO lo decide una persona: el sistema lo otorga únicamente al guardia
 * en la posición #1 que además tenga el 100% de sus metas cumplidas.
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Trophy, Send, Trash2, Plus, BadgeCheck } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import BottomNav from '@/components/BottomNav';
import {
  BONOS_SUGERIDOS,
  Reconocimiento,
  crearReconocimiento,
  eliminarReconocimiento,
  esElegibleBono,
  formatMoneda,
  listarReconocimientos,
  obtenerCumplimiento,
  periodoActual,
  publicarReconocimiento,
} from '@/lib/reconocimientos';

interface PerfilLite {
  user_id: string;
  nombre: string;
  apellido: string;
  numero_empleado: string;
}

const Reconocimientos = () => {
  const navigate = useNavigate();
  const [items, setItems] = useState<Reconocimiento[]>([]);
  const [guardias, setGuardias] = useState<PerfilLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [guardiaId, setGuardiaId] = useState('');
  const [posicion, setPosicion] = useState(1);
  const [periodo, setPeriodo] = useState(periodoActual());
  const [motivo, setMotivo] = useState('');
  const [bono, setBono] = useState<string>('1000');

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const [recs, roles] = await Promise.all([
        listarReconocimientos(),
        supabase.from('user_roles').select('user_id').eq('role', 'guardia'),
      ]);
      const ids = (roles.data || []).map((r) => r.user_id);
      let profs: PerfilLite[] = [];
      if (ids.length) {
        const { data } = await supabase
          .from('profiles')
          .select('user_id,nombre,apellido,numero_empleado')
          .in('user_id', ids)
          .order('nombre');
        profs = (data || []) as PerfilLite[];
      }
      setItems(recs);
      setGuardias(profs);
    } catch (e) {
      toast.error('No se pudo cargar el Cuadro de Honor');
    } finally {
      setLoading(false);
    }
  };

  const nombreGuardia = (id: string) => {
    const p = guardias.find((g) => g.user_id === id);
    return p ? `${p.nombre} ${p.apellido}` : 'Guardia';
  };

  const handleCrear = async () => {
    if (!guardiaId) return toast.error('Selecciona un guardia');
    if (!motivo.trim()) return toast.error('Escribe el motivo del reconocimiento');
    setSaving(true);
    try {
      await crearReconocimiento({
        guardia_id: guardiaId,
        posicion,
        periodo: periodo.trim() || periodoActual(),
        motivo: motivo.trim(),
        bono: Number(bono) || 0,
      });
      toast.success('Reconocimiento registrado');
      setMotivo('');
      setGuardiaId('');
      await load();
    } catch (e) {
      toast.error('No se pudo registrar');
    } finally {
      setSaving(false);
    }
  };

  const handlePublicar = async (id: string) => {
    try {
      await publicarReconocimiento(id);
      toast.success('Publicado y notificado a todos los guardias');
      await load();
    } catch {
      toast.error('No se pudo publicar');
    }
  };

  const handleEliminar = async (id: string) => {
    try {
      await eliminarReconocimiento(id);
      setItems((prev) => prev.filter((i) => i.id !== id));
    } catch {
      toast.error('No se pudo eliminar');
    }
  };

  return (
    <div className="min-h-dvh bg-background pb-24">
      <div className="bg-gradient-to-br from-warning via-warning/80 to-destructive text-warning-foreground px-4 pt-12 pb-6 rounded-b-3xl">
        <div className="max-w-lg mx-auto">
          <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm opacity-80 mb-2">
            <ArrowLeft className="w-4 h-4" /> Regresar
          </button>
          <div className="flex items-center gap-2">
            <Trophy className="w-7 h-7" />
            <div>
              <h1 className="text-xl font-display font-bold">Cuadro de Honor</h1>
              <p className="text-xs opacity-80">Reconocimientos y bonos</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 -mt-4 space-y-4">
        <div className="bg-card rounded-xl p-4 shadow-card space-y-3">
          <h2 className="font-semibold text-sm text-foreground flex items-center gap-2">
            <Plus className="w-4 h-4 text-primary" /> Nuevo reconocimiento
          </h2>

          <div>
            <label className="text-xs text-muted-foreground">Guardia reconocido</label>
            <select
              value={guardiaId}
              onChange={(e) => setGuardiaId(e.target.value)}
              className="w-full mt-1 h-11 rounded-lg border border-border bg-background px-3 text-sm"
            >
              <option value="">Selecciona…</option>
              {guardias.map((g) => (
                <option key={g.user_id} value={g.user_id}>
                  {g.nombre} {g.apellido} · #{g.numero_empleado}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground">Posición</label>
              <input
                type="number"
                min={1}
                value={posicion}
                onChange={(e) => setPosicion(Math.max(1, Number(e.target.value) || 1))}
                className="w-full mt-1 h-11 rounded-lg border border-border bg-background px-3 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Periodo</label>
              <input
                value={periodo}
                onChange={(e) => setPeriodo(e.target.value)}
                placeholder="Agosto 2026"
                className="w-full mt-1 h-11 rounded-lg border border-border bg-background px-3 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-muted-foreground">Motivo / reconocimiento</label>
            <textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              rows={3}
              placeholder="Cumplió el 100% de sus metas de rondines y reportes"
              className="w-full mt-1 rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="text-xs text-muted-foreground">Bono económico</label>
            {posicion === 1 ? (
              <>
                <div className="flex gap-2 mt-1">
                  {BONOS_SUGERIDOS.map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setBono(String(m))}
                      className={`flex-1 h-10 rounded-lg text-sm font-semibold border transition-colors ${
                        Number(bono) === m
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'border-border text-muted-foreground'
                      }`}
                    >
                      {formatMoneda(m)}
                    </button>
                  ))}
                </div>
                <input
                  type="number"
                  min={0}
                  value={bono}
                  onChange={(e) => setBono(e.target.value)}
                  placeholder="Otro monto autorizado"
                  className="w-full mt-2 h-11 rounded-lg border border-border bg-background px-3 text-sm"
                />
              </>
            ) : (
              <p className="text-xs text-muted-foreground mt-1">
                Solo el primer lugar recibe bono, por haber cumplido sus metas.
              </p>
            )}
          </div>

          <button
            onClick={handleCrear}
            disabled={saving}
            className="w-full h-12 rounded-lg bg-primary text-primary-foreground font-semibold text-sm disabled:opacity-60"
          >
            {saving ? 'Guardando…' : 'Registrar reconocimiento'}
          </button>
        </div>

        <div className="space-y-2">
          <h2 className="font-semibold text-sm text-foreground">Reconocimientos</h2>
          {loading ? (
            <div className="bg-card rounded-xl p-8 shadow-card text-center">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
            </div>
          ) : items.length === 0 ? (
            <div className="bg-card rounded-xl p-6 shadow-card text-center text-sm text-muted-foreground">
              Aún no hay reconocimientos registrados.
            </div>
          ) : (
            items.map((r) => (
              <div key={r.id} className="bg-card rounded-xl p-3 shadow-card space-y-2">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-warning/15 text-warning flex items-center justify-center font-bold">
                    #{r.posicion}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-foreground truncate">{nombreGuardia(r.guardia_id)}</p>
                    <p className="text-[11px] text-muted-foreground">{r.periodo}</p>
                    <p className="text-xs text-foreground mt-1">{r.motivo}</p>
                    {r.bono > 0 && (
                      <p className="text-xs font-bold text-success mt-1">Bono: {formatMoneda(r.bono)}</p>
                    )}
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {r.publicado
                        ? `Publicado el ${new Date(r.publicado_at || r.updated_at).toLocaleString('es-MX')}`
                        : 'Borrador sin publicar'}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  {r.publicado ? (
                    <span className="flex-1 h-9 rounded-lg bg-success/10 text-success text-xs font-semibold flex items-center justify-center gap-1">
                      <BadgeCheck className="w-4 h-4" /> Publicado
                    </span>
                  ) : (
                    <button
                      onClick={() => handlePublicar(r.id)}
                      className="flex-1 h-9 rounded-lg bg-primary text-primary-foreground text-xs font-semibold flex items-center justify-center gap-1"
                    >
                      <Send className="w-4 h-4" /> Publicar y notificar
                    </button>
                  )}
                  <button
                    onClick={() => handleEliminar(r.id)}
                    className="h-9 px-3 rounded-lg bg-destructive/10 text-destructive text-xs font-semibold flex items-center gap-1"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <BottomNav />
    </div>
  );
};

export default Reconocimientos;
