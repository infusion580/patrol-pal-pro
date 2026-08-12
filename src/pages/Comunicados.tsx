/**
 * Módulo de Comunicados
 * ---------------------
 * - Admin y supervisor: crear, editar, adjuntar imagen, definir prioridad,
 *   programar la publicación o publicar de inmediato (notifica a los guardias).
 * - Guardia y demás roles: consultan los comunicados publicados y su lectura
 *   queda registrada con fecha y hora.
 */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Megaphone, Plus, Send, Trash2, Pencil, Image as ImageIcon, Clock, CheckCircle2, Eye } from 'lucide-react';
import { toast } from 'sonner';
import BottomNav from '@/components/BottomNav';
import { SignedImg } from '@/components/SignedImg';
import { useAuth } from '@/lib/auth-context';
import {
  Comunicado,
  ComunicadoPrioridad,
  ESTADO_LABEL,
  PRIORIDADES,
  actualizarComunicado,
  conteoLecturas,
  crearComunicado,
  eliminarComunicado,
  formatFecha,
  listarComunicados,
  marcarLeido,
  misLecturas,
  prioridadStyle,
  publicarComunicado,
  subirImagenComunicado,
} from '@/lib/comunicados';

const emptyForm = {
  titulo: '',
  contenido: '',
  prioridad: 'normal' as ComunicadoPrioridad,
  imagen_url: null as string | null,
  publicar_at: '',
};

const Comunicados = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const puedeGestionar = user?.role === 'admin' || user?.role === 'supervisor';

  const [items, setItems] = useState<Comunicado[]>([]);
  const [lecturas, setLecturas] = useState<Record<string, string>>({});
  const [conteos, setConteos] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [puedeGestionar]);

  const load = async () => {
    setLoading(true);
    try {
      const [list, leidos, cnt] = await Promise.all([
        listarComunicados(!puedeGestionar),
        misLecturas(),
        puedeGestionar ? conteoLecturas() : Promise.resolve({}),
      ]);
      setItems(list);
      setLecturas(leidos);
      setConteos(cnt);
    } catch {
      toast.error('No se pudieron cargar los comunicados');
    } finally {
      setLoading(false);
    }
  };

  // Registra la lectura de los comunicados publicados que el usuario aún no abre.
  useEffect(() => {
    if (loading || puedeGestionar) return;
    const pendientes = items.filter((c) => c.estado === 'publicado' && !lecturas[c.id]);
    if (!pendientes.length) return;
    (async () => {
      for (const c of pendientes) await marcarLeido(c.id);
      setLecturas(await misLecturas());
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, items]);

  const resetForm = () => { setForm(emptyForm); setEditId(null); setShowForm(false); };

  const handleImagen = async (file: File | null) => {
    if (!file) return;
    try {
      const path = await subirImagenComunicado(file);
      setForm((f) => ({ ...f, imagen_url: path }));
      toast.success('Imagen adjuntada');
    } catch {
      toast.error('No se pudo subir la imagen');
    }
  };

  const handleGuardar = async (publicarAhora: boolean) => {
    if (!form.titulo.trim()) return toast.error('Escribe un título');
    if (!form.contenido.trim()) return toast.error('Escribe el contenido');
    setSaving(true);
    try {
      const programado = !!form.publicar_at && !publicarAhora;
      const payload = {
        titulo: form.titulo.trim(),
        contenido: form.contenido.trim(),
        prioridad: form.prioridad,
        imagen_url: form.imagen_url,
        publicar_at: form.publicar_at ? new Date(form.publicar_at).toISOString() : null,
        estado: programado ? ('programado' as const) : ('borrador' as const),
      };
      const id = editId ? (await actualizarComunicado(editId, payload), editId) : await crearComunicado(payload);
      if (publicarAhora) await publicarComunicado(id);
      toast.success(publicarAhora ? 'Publicado y notificado a los guardias' : programado ? 'Programado' : 'Guardado como borrador');
      resetForm();
      await load();
    } catch {
      toast.error('No se pudo guardar el comunicado');
    } finally {
      setSaving(false);
    }
  };

  const handleEditar = (c: Comunicado) => {
    setEditId(c.id);
    setForm({
      titulo: c.titulo,
      contenido: c.contenido,
      prioridad: c.prioridad,
      imagen_url: c.imagen_url,
      publicar_at: c.publicar_at ? new Date(c.publicar_at).toISOString().slice(0, 16) : '',
    });
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handlePublicar = async (id: string) => {
    try {
      await publicarComunicado(id);
      toast.success('Publicado y notificado a los guardias');
      await load();
    } catch {
      toast.error('No se pudo publicar');
    }
  };

  const handleEliminar = async (id: string) => {
    try {
      await eliminarComunicado(id);
      setItems((prev) => prev.filter((i) => i.id !== id));
    } catch {
      toast.error('No se pudo eliminar');
    }
  };

  const noLeidos = useMemo(
    () => items.filter((c) => c.estado === 'publicado' && !lecturas[c.id]).length,
    [items, lecturas],
  );

  return (
    <div className="min-h-dvh bg-background pb-24">
      <div className="bg-gradient-to-br from-primary via-primary/85 to-accent text-primary-foreground px-4 pt-12 pb-6 rounded-b-3xl">
        <div className="max-w-lg mx-auto">
          <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm opacity-80 mb-2">
            <ArrowLeft className="w-4 h-4" /> Regresar
          </button>
          <div className="flex items-center gap-2">
            <Megaphone className="w-7 h-7" />
            <div>
              <h1 className="text-xl font-display font-bold">Comunicados</h1>
              <p className="text-xs opacity-80">
                {puedeGestionar ? 'Crea, programa y publica avisos' : `${noLeidos} sin leer`}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 -mt-4 space-y-4">
        {puedeGestionar && !showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="w-full h-12 rounded-xl bg-card shadow-card text-sm font-semibold text-foreground flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4 text-primary" /> Nuevo comunicado
          </button>
        )}

        {puedeGestionar && showForm && (
          <div className="bg-card rounded-xl p-4 shadow-card space-y-3">
            <h2 className="font-semibold text-sm text-foreground">
              {editId ? 'Editar comunicado' : 'Nuevo comunicado'}
            </h2>

            <div>
              <label className="text-xs text-muted-foreground">Título</label>
              <input
                value={form.titulo}
                onChange={(e) => setForm({ ...form, titulo: e.target.value })}
                placeholder="Cambio de horario en el turno nocturno"
                className="w-full mt-1 h-11 rounded-lg border border-border bg-background px-3 text-sm"
              />
            </div>

            <div>
              <label className="text-xs text-muted-foreground">Contenido</label>
              <textarea
                value={form.contenido}
                onChange={(e) => setForm({ ...form, contenido: e.target.value })}
                rows={5}
                placeholder="Detalla el comunicado…"
                className="w-full mt-1 rounded-lg border border-border bg-background px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="text-xs text-muted-foreground">Prioridad</label>
              <div className="grid grid-cols-4 gap-2 mt-1">
                {PRIORIDADES.map((p) => (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => setForm({ ...form, prioridad: p.value })}
                    className={`h-10 rounded-lg text-xs font-semibold border transition-colors ${
                      form.prioridad === p.value ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs text-muted-foreground">Imagen / evidencia (opcional)</label>
              <label className="mt-1 flex items-center gap-2 h-11 rounded-lg border border-dashed border-border px-3 text-sm text-muted-foreground cursor-pointer">
                <ImageIcon className="w-4 h-4" />
                {form.imagen_url ? 'Imagen adjuntada · cambiar' : 'Adjuntar imagen'}
                <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImagen(e.target.files?.[0] ?? null)} />
              </label>
              {form.imagen_url && (
                <SignedImg bucket="evidencias" path={form.imagen_url} className="mt-2 w-full rounded-lg object-cover max-h-48" />
              )}
            </div>

            <div>
              <label className="text-xs text-muted-foreground">Programar publicación (opcional)</label>
              <input
                type="datetime-local"
                value={form.publicar_at}
                onChange={(e) => setForm({ ...form, publicar_at: e.target.value })}
                className="w-full mt-1 h-11 rounded-lg border border-border bg-background px-3 text-sm"
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                Si defines fecha y hora, el comunicado se publicará automáticamente al llegar el momento.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => handleGuardar(false)}
                disabled={saving}
                className="h-12 rounded-lg border border-border text-sm font-semibold text-foreground disabled:opacity-60"
              >
                {form.publicar_at ? 'Programar' : 'Guardar borrador'}
              </button>
              <button
                onClick={() => handleGuardar(true)}
                disabled={saving}
                className="h-12 rounded-lg bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-60 flex items-center justify-center gap-2"
              >
                <Send className="w-4 h-4" /> Publicar
              </button>
            </div>
            <button onClick={resetForm} className="w-full text-xs text-muted-foreground">Cancelar</button>
          </div>
        )}

        <div className="space-y-2">
          <h2 className="font-semibold text-sm text-foreground">
            {puedeGestionar ? 'Todos los comunicados' : 'Comunicados recibidos'}
          </h2>

          {loading && <p className="text-sm text-muted-foreground">Cargando…</p>}
          {!loading && !items.length && (
            <p className="text-sm text-muted-foreground">No hay comunicados por el momento.</p>
          )}

          {items.map((c) => (
            <article key={c.id} className="bg-card rounded-xl p-4 shadow-card space-y-2">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-semibold text-sm text-foreground">{c.titulo}</h3>
                <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${prioridadStyle(c.prioridad)}`}>
                  {PRIORIDADES.find((p) => p.value === c.prioridad)?.label}
                </span>
              </div>

              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{c.contenido}</p>

              {c.imagen_url && (
                <SignedImg bucket="evidencias" path={c.imagen_url} className="w-full rounded-lg object-cover max-h-56" />
              )}

              <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> {ESTADO_LABEL[c.estado]}
                </span>
                <span>Autor: {c.autor_nombre || '—'}</span>
                {c.estado === 'publicado' && <span>Publicado: {formatFecha(c.publicado_at)}</span>}
                {c.estado === 'programado' && (
                  <span className="inline-flex items-center gap-1">
                    <Clock className="w-3 h-3" /> Programado: {formatFecha(c.publicar_at)}
                  </span>
                )}
                {puedeGestionar && (
                  <span className="inline-flex items-center gap-1">
                    <Eye className="w-3 h-3" /> {conteos[c.id] || 0} lecturas
                  </span>
                )}
                {!puedeGestionar && lecturas[c.id] && <span>Leído: {formatFecha(lecturas[c.id])}</span>}
              </div>

              {puedeGestionar && (
                <div className="flex gap-2 pt-1">
                  {c.estado !== 'publicado' && (
                    <button
                      onClick={() => handlePublicar(c.id)}
                      className="flex-1 h-10 rounded-lg bg-primary text-primary-foreground text-xs font-semibold inline-flex items-center justify-center gap-1"
                    >
                      <Send className="w-3.5 h-3.5" /> Publicar
                    </button>
                  )}
                  <button
                    onClick={() => handleEditar(c)}
                    className="flex-1 h-10 rounded-lg border border-border text-xs font-semibold text-foreground inline-flex items-center justify-center gap-1"
                  >
                    <Pencil className="w-3.5 h-3.5" /> Editar
                  </button>
                  <button
                    onClick={() => handleEliminar(c.id)}
                    className="h-10 px-3 rounded-lg border border-border text-xs text-emergency"
                    aria-label="Eliminar comunicado"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )}
            </article>
          ))}
        </div>
      </div>

      <BottomNav />
    </div>
  );
};

export default Comunicados;
