import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  Camera,
  CheckCircle2,
  Clock,
  MapPin,
  Plus,
  RefreshCw,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { SignedImg } from '@/components/SignedImg';
import BottomNav from '@/components/BottomNav';
import {
  DIAS_LABEL,
  RESULTADO_LABEL,
  deleteConfig,
  horaCorta,
  listConfigs,
  listValidaciones,
  periodoDelDia,
  saveConfig,
  type ValidacionConfig,
  type ValidacionRegistro,
} from '@/lib/validacion-puesto';

const MapView = lazy(() => import('@/components/MapView'));

/**
 * Alertas programadas de asistencia / validación de puesto (admin y supervisor).
 * Pestaña 1: programar horarios, días, frecuencia, guardias y punto esperado.
 * Pestaña 2: consultar cada validación con foto, ubicación y resultado.
 */

const hoyISO = () => new Date().toISOString().slice(0, 10);
const hace7ISO = () => new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);

interface Servicio { id: string; nombre: string }
interface Checkpoint { id: string; nombre: string; servicio_id: string }
interface Guardia { user_id: string; nombre: string }
/** Horario capturado en formato 12 h con AM (día) / PM (noche). */
interface HorarioForm { hora: string; minuto: string; meridiano: 'AM' | 'PM' }

/** Convierte 12 h + AM/PM a "HH:MM:SS" de 24 h. Devuelve null si es inválido. */
function a24(h: HorarioForm): string | null {
  const hora = Number(h.hora);
  const min = Number(h.minuto);
  if (!Number.isFinite(hora) || hora < 1 || hora > 12) return null;
  if (!Number.isFinite(min) || min < 0 || min > 59) return null;
  let hh = hora % 12;
  if (h.meridiano === 'PM') hh += 12;
  return `${String(hh).padStart(2, '0')}:${String(min).padStart(2, '0')}:00`;
}


const ValidacionPuesto = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [tab, setTab] = useState<'programacion' | 'registros'>('programacion');

  const [servicios, setServicios] = useState<Servicio[]>([]);
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);
  const [guardias, setGuardias] = useState<Guardia[]>([]);
  const [configs, setConfigs] = useState<ValidacionConfig[]>([]);
  const [loading, setLoading] = useState(true);

  /* -------- formulario de nueva programación -------- */
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    nombre: 'Validación de puesto',
    servicio_id: '',
    checkpoint_id: '',
    horarios: [
      { hora: '8', minuto: '00', meridiano: 'AM' },
      { hora: '2', minuto: '00', meridiano: 'PM' },
      { hora: '8', minuto: '00', meridiano: 'PM' },
    ] as HorarioForm[],

    dias: [1, 2, 3, 4, 5] as number[],
    tolerancia: 15,
    radio: 100,
    guardia_ids: [] as string[],
  });

  /* -------- filtros de registros -------- */
  const [desde, setDesde] = useState(hace7ISO());
  const [hasta, setHasta] = useState(hoyISO());
  const [fGuardia, setFGuardia] = useState('');
  const [fResultado, setFResultado] = useState('');
  const [registros, setRegistros] = useState<ValidacionRegistro[]>([]);

  useEffect(() => {
    (async () => {
      const [{ data: svc }, { data: cps }, { data: profs }] = await Promise.all([
        supabase.from('servicios').select('id, nombre').order('nombre'),
        supabase.from('checkpoints').select('id, nombre, servicio_id').order('nombre'),
        supabase.from('profiles').select('user_id, nombre, apellido').order('nombre'),
      ]);
      setServicios((svc as Servicio[]) || []);
      setCheckpoints((cps as Checkpoint[]) || []);
      setGuardias(
        ((profs as { user_id: string; nombre: string; apellido: string }[]) || []).map((p) => ({
          user_id: p.user_id,
          nombre: `${p.nombre} ${p.apellido}`.trim() || 'Sin nombre',
        })),
      );
    })();
  }, []);

  const cargarConfigs = useCallback(async () => {
    setLoading(true);
    try {
      setConfigs(await listConfigs());
    } catch {
      toast({ title: 'No se pudieron cargar las programaciones', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const cargarRegistros = useCallback(async () => {
    setLoading(true);
    try {
      setRegistros(
        await listValidaciones({
          desde,
          hasta,
          guardiaId: fGuardia || null,
          resultado: fResultado || null,
        }),
      );
    } catch {
      toast({ title: 'No se pudieron cargar las validaciones', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [desde, hasta, fGuardia, fResultado, toast]);

  useEffect(() => {
    if (tab === 'programacion') cargarConfigs();
    else cargarRegistros();
  }, [tab, cargarConfigs, cargarRegistros]);

  const nombrePorId = useMemo(
    () => Object.fromEntries(guardias.map((g) => [g.user_id, g.nombre])),
    [guardias],
  );
  const servicioPorId = useMemo(
    () => Object.fromEntries(servicios.map((s) => [s.id, s.nombre])),
    [servicios],
  );
  const checkpointPorId = useMemo(
    () => Object.fromEntries(checkpoints.map((c) => [c.id, c.nombre])),
    [checkpoints],
  );

  const toggleDia = (d: number) =>
    setForm((f) => ({
      ...f,
      dias: f.dias.includes(d) ? f.dias.filter((x) => x !== d) : [...f.dias, d].sort(),
    }));

  const toggleGuardia = (id: string) =>
    setForm((f) => ({
      ...f,
      guardia_ids: f.guardia_ids.includes(id)
        ? f.guardia_ids.filter((x) => x !== id)
        : [...f.guardia_ids, id],
    }));

  const agregarHorario = () =>
    setForm((f) => ({ ...f, horarios: [...f.horarios, { hora: '8', minuto: '00', meridiano: 'AM' }] }));

  const quitarHorario = (i: number) =>
    setForm((f) => ({ ...f, horarios: f.horarios.filter((_, idx) => idx !== i) }));

  const setHorario = (i: number, patch: Partial<HorarioForm>) =>
    setForm((f) => ({
      ...f,
      horarios: f.horarios.map((h, idx) => (idx === i ? { ...h, ...patch } : h)),
    }));

  const guardar = async () => {
    const horarios = form.horarios
      .map(a24)
      .filter((h): h is string => Boolean(h));


    if (!form.servicio_id) {
      toast({ title: 'Selecciona un servicio', variant: 'destructive' });
      return;
    }
    if (horarios.length === 0) {
      toast({ title: 'Agrega al menos un horario (formato HH:MM)', variant: 'destructive' });
      return;
    }
    if (form.dias.length === 0) {
      toast({ title: 'Selecciona los días de aplicación', variant: 'destructive' });
      return;
    }

    try {
      await saveConfig({
        nombre: form.nombre.trim() || 'Validación de puesto',
        servicio_id: form.servicio_id,
        checkpoint_id: form.checkpoint_id || null,
        horarios,
        dias: form.dias,
        tolerancia_minutos: Number(form.tolerancia) || 15,
        radio_metros: Number(form.radio) || 100,
        guardia_ids: form.guardia_ids,
        activo: true,
      });
      toast({ title: 'Programación guardada' });
      setShowForm(false);
      cargarConfigs();
    } catch {
      toast({ title: 'No se pudo guardar', variant: 'destructive' });
    }
  };

  const toggleActivo = async (c: ValidacionConfig) => {
    try {
      await saveConfig({ id: c.id, servicio_id: c.servicio_id, activo: !c.activo });
      cargarConfigs();
    } catch {
      toast({ title: 'No se pudo actualizar', variant: 'destructive' });
    }
  };

  const eliminar = async (id: string) => {
    try {
      await deleteConfig(id);
      cargarConfigs();
    } catch {
      toast({ title: 'No se pudo eliminar', variant: 'destructive' });
    }
  };

  const puntosMapa = useMemo(
    () =>
      registros
        .filter((r) => r.lat != null && r.lng != null)
        .map((r) => ({
          id: r.id,
          nombre: `${nombrePorId[r.guardia_id] || 'Guardia'} · ${RESULTADO_LABEL[r.resultado] || r.resultado}`,
          status: r.dentro_area ? 'activo' : 'alerta',
          lat: r.lat as number,
          lng: r.lng as number,
        })),
    [registros, nombrePorId],
  );

  const checkpointsDelServicio = checkpoints.filter((c) => c.servicio_id === form.servicio_id);

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="app-header flex items-center gap-3 px-4 py-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} aria-label="Volver">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-lg font-bold">Validación de puesto</h1>
          <p className="text-xs text-muted-foreground">Alertas programadas de asistencia y confirmación en sitio</p>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-2 px-4 pt-3">
        <Button variant={tab === 'programacion' ? 'default' : 'outline'} onClick={() => setTab('programacion')} className="h-11">
          <Clock className="mr-2 h-4 w-4" /> Programación
        </Button>
        <Button variant={tab === 'registros' ? 'default' : 'outline'} onClick={() => setTab('registros')} className="h-11">
          <ShieldCheck className="mr-2 h-4 w-4" /> Validaciones
        </Button>
      </div>

      <main className="space-y-4 p-4">
        {tab === 'programacion' && (
          <>
            <Button className="w-full" onClick={() => setShowForm((v) => !v)}>
              <Plus className="mr-2 h-4 w-4" /> {showForm ? 'Cancelar' : 'Nueva programación'}
            </Button>

            {showForm && (
              <section className="space-y-3 rounded-xl border border-border bg-card p-4 shadow-card">
                <div>
                  <Label className="text-xs">Nombre</Label>
                  <Input value={form.nombre} onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))} />
                </div>

                <div>
                  <Label className="text-xs">Servicio</Label>
                  <select
                    value={form.servicio_id}
                    onChange={(e) => setForm((f) => ({ ...f, servicio_id: e.target.value, checkpoint_id: '' }))}
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="">Selecciona…</option>
                    {servicios.map((s) => (
                      <option key={s.id} value={s.id}>{s.nombre}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <Label className="text-xs">Punto / puesto donde debe encontrarse</Label>
                  <select
                    value={form.checkpoint_id}
                    onChange={(e) => setForm((f) => ({ ...f, checkpoint_id: e.target.value }))}
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="">Sin punto específico (solo foto y GPS)</option>
                    {checkpointsDelServicio.map((c) => (
                      <option key={c.id} value={c.id}>{c.nombre}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">Horarios de validación</Label>
                    <Button type="button" size="sm" variant="outline" onClick={agregarHorario} className="h-8">
                      <Plus className="mr-1 h-3.5 w-3.5" /> Agregar
                    </Button>
                  </div>
                  <div className="mt-2 space-y-2">
                    {form.horarios.map((h, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <Input
                          type="number"
                          min={1}
                          max={12}
                          value={h.hora}
                          onChange={(e) => setHorario(i, { hora: e.target.value })}
                          className="w-16 text-center"
                          aria-label="Hora"
                        />
                        <span className="text-sm font-semibold">:</span>
                        <Input
                          type="number"
                          min={0}
                          max={59}
                          value={h.minuto}
                          onChange={(e) => setHorario(i, { minuto: e.target.value })}
                          className="w-16 text-center"
                          aria-label="Minutos"
                        />
                        <select
                          value={h.meridiano}
                          onChange={(e) => setHorario(i, { meridiano: e.target.value as 'AM' | 'PM' })}
                          className="h-10 rounded-md border border-input bg-background px-2 text-sm"
                          aria-label="AM o PM"
                        >
                          <option value="AM">AM (día)</option>
                          <option value="PM">PM (noche)</option>
                        </select>
                        {form.horarios.length > 1 && (
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            onClick={() => quitarHorario(i)}
                            aria-label="Quitar horario"
                          >
                            <Trash2 className="h-4 w-4 text-emergency" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    La frecuencia se define por la cantidad de horarios del día.
                  </p>
                </div>


                <div>
                  <Label className="text-xs">Días de aplicación</Label>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {DIAS_LABEL.map((d, i) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => toggleDia(i)}
                        className={`h-9 w-12 rounded-md border text-xs font-semibold ${
                          form.dias.includes(i)
                            ? 'border-primary bg-primary text-primary-foreground'
                            : 'border-border bg-background text-muted-foreground'
                        }`}
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Tolerancia (min)</Label>
                    <Input
                      type="number"
                      min={1}
                      value={form.tolerancia}
                      onChange={(e) => setForm((f) => ({ ...f, tolerancia: Number(e.target.value) }))}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Radio permitido (m)</Label>
                    <Input
                      type="number"
                      min={10}
                      value={form.radio}
                      onChange={(e) => setForm((f) => ({ ...f, radio: Number(e.target.value) }))}
                    />
                  </div>
                </div>

                <div>
                  <Label className="text-xs">Guardias (vacío = todos los del servicio)</Label>
                  <div className="mt-1 max-h-48 space-y-1 overflow-y-auto rounded-md border border-border p-2">
                    {guardias.map((g) => (
                      <label key={g.user_id} className="flex cursor-pointer items-center gap-2 text-xs">
                        <input
                          type="checkbox"
                          className="h-4 w-4 accent-primary"
                          checked={form.guardia_ids.includes(g.user_id)}
                          onChange={() => toggleGuardia(g.user_id)}
                        />
                        {g.nombre}
                      </label>
                    ))}
                  </div>
                </div>

                <Button className="w-full" onClick={guardar}>Guardar programación</Button>
              </section>
            )}

            {!loading && configs.length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">Sin programaciones registradas.</p>
            )}

            {configs.map((c) => (
              <article key={c.id} className="rounded-xl border border-border bg-card p-4 shadow-card">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{c.nombre}</p>
                    <p className="text-xs text-muted-foreground">
                      {servicioPorId[c.servicio_id] || 'Servicio'}
                      {c.checkpoint_id ? ` · ${checkpointPorId[c.checkpoint_id] || 'Punto'}` : ' · Sin punto'}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button size="sm" variant={c.activo ? 'default' : 'outline'} onClick={() => toggleActivo(c)}>
                      {c.activo ? 'Activa' : 'Inactiva'}
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => eliminar(c.id)} aria-label="Eliminar">
                      <Trash2 className="h-4 w-4 text-emergency" />
                    </Button>
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {c.horarios.map((h) => {
                    const periodo = periodoDelDia(h);
                    return (
                      <span key={h} className="rounded bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                        {horaCorta(h)}
                        <span className={`ml-1.5 inline-block h-1.5 w-1.5 rounded-full ${periodo === 'día' ? 'bg-warning' : 'bg-primary'}`} aria-hidden="true" />
                        <span className="ml-1 text-[10px] font-normal uppercase text-muted-foreground">{periodo}</span>
                      </span>
                    );
                  })}
                </div>
                <p className="mt-2 text-[11px] text-muted-foreground">
                  Días: {c.dias.map((d) => DIAS_LABEL[d]).join(', ')} · Tolerancia {c.tolerancia_minutos} min · Radio {c.radio_metros} m
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Guardias: {c.guardia_ids.length === 0
                    ? 'Todos los del servicio'
                    : c.guardia_ids.map((g) => nombrePorId[g] || 'Guardia').join(', ')}
                </p>
              </article>
            ))}
          </>
        )}

        {tab === 'registros' && (
          <>
            <section className="rounded-xl border border-border bg-card p-4 shadow-card">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Desde</Label>
                  <Input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">Hasta</Label>
                  <Input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">Guardia</Label>
                  <select
                    value={fGuardia}
                    onChange={(e) => setFGuardia(e.target.value)}
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="">Todos</option>
                    {guardias.map((g) => (
                      <option key={g.user_id} value={g.user_id}>{g.nombre}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label className="text-xs">Resultado</Label>
                  <select
                    value={fResultado}
                    onChange={(e) => setFResultado(e.target.value)}
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="">Todos</option>
                    <option value="valida">En su puesto</option>
                    <option value="fuera_area">Fuera del área</option>
                    <option value="sin_ubicacion">Sin ubicación</option>
                  </select>
                </div>
              </div>
              <Button variant="outline" className="mt-3 w-full" onClick={cargarRegistros} disabled={loading}>
                <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Actualizar
              </Button>
            </section>

            {puntosMapa.length > 0 && (
              <section className="overflow-hidden rounded-xl border border-border bg-card shadow-card">
                <Suspense fallback={<div className="h-72 animate-pulse bg-muted" />}>
                  <MapView guards={puntosMapa} />
                </Suspense>
              </section>
            )}

            {!loading && registros.length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">Sin validaciones en el periodo.</p>
            )}

            {registros.map((r) => {
              const prog = new Date(r.programado_at);
              const resp = new Date(r.respondido_at);
              const ok = r.resultado === 'valida';
              return (
                <article key={r.id} className="rounded-xl border border-border bg-card p-4 shadow-card">
                  <div className="flex items-start gap-3">
                    {r.foto_url ? (
                      <SignedImg
                        bucket="evidencias"
                        path={r.foto_url}
                        alt="Fotografía de validación"
                        className="h-20 w-20 rounded-lg object-cover"
                        fallback={<div className="flex h-20 w-20 items-center justify-center rounded-lg bg-muted"><Camera className="h-5 w-5 text-muted-foreground" /></div>}
                      />
                    ) : (
                      <div className="flex h-20 w-20 items-center justify-center rounded-lg bg-muted">
                        <Camera className="h-5 w-5 text-muted-foreground" />
                      </div>
                    )}

                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        {ok ? (
                          <CheckCircle2 className="h-4 w-4 text-success" />
                        ) : (
                          <AlertTriangle className="h-4 w-4 text-emergency" />
                        )}
                        <span className={`text-sm font-semibold ${ok ? 'text-success' : 'text-emergency'}`}>
                          {RESULTADO_LABEL[r.resultado] || r.resultado}
                        </span>
                      </div>
                      <p className="text-sm">{nombrePorId[r.guardia_id] || r.guardia_id}</p>
                      <p className="text-xs text-muted-foreground">
                        {servicioPorId[r.servicio_id || ''] || 'Servicio'}
                        {r.checkpoint_id ? ` · ${checkpointPorId[r.checkpoint_id] || 'Punto'}` : ''}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Programada: {prog.toLocaleDateString('es-MX')} {prog.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: true })}{' '}
                        <span className="rounded bg-muted px-1 py-0 text-[10px] uppercase">{periodoDelDia(`${prog.getHours().toString().padStart(2, '0')}:${prog.getMinutes().toString().padStart(2, '0')}`)}</span>
                        {' · '}Respuesta: {resp.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: true })}{' '}
                        <span className="rounded bg-muted px-1 py-0 text-[10px] uppercase">{periodoDelDia(`${resp.getHours().toString().padStart(2, '0')}:${resp.getMinutes().toString().padStart(2, '0')}`)}</span>
                      </p>
                      <p className="flex items-center gap-1 text-xs text-muted-foreground">
                        <MapPin className="h-3.5 w-3.5" />
                        {r.lat != null && r.lng != null
                          ? `${r.lat.toFixed(5)}, ${r.lng.toFixed(5)}${r.precision_metros ? ` (±${r.precision_metros} m)` : ''}`
                          : r.ubicacion_error || 'Sin ubicación'}
                      </p>
                      {r.distancia_metros != null && (
                        <p className="text-xs text-muted-foreground">
                          Distancia al punto: {Math.round(Number(r.distancia_metros))} m ·{' '}
                          {r.dentro_area ? 'Dentro del área esperada' : 'Fuera del área esperada'}
                        </p>
                      )}
                      {r.lat != null && r.lng != null && (
                        <a
                          href={`https://www.openstreetmap.org/?mlat=${r.lat}&mlon=${r.lng}#map=17/${r.lat}/${r.lng}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-block text-xs font-medium text-primary underline"
                        >
                          Ver en mapa
                        </a>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </>
        )}
      </main>

      <BottomNav />
    </div>
  );
};

export default ValidacionPuesto;
