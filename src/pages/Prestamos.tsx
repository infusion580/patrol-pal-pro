/**
 * Solicitud de Préstamos
 * ----------------------
 * Guardia: crea su solicitud y consulta el estado y la bitácora.
 * Supervisor: aprueba o rechaza las solicitudes de sus guardias.
 * Administrador: aprueba/rechaza y confirma el depósito (Aprobado ≠ Depositado).
 *
 * Las notificaciones se envían como comunicaciones PRIVADAS desde la base de
 * datos; aquí solo se disparan las acciones.
 */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, HandCoins, Plus, Info, Clock, ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from 'sonner';
import BottomNav from '@/components/BottomNav';
import { useAuth } from '@/lib/auth-context';
import {
  AVISO_CANAL, ESTADO_PRESTAMO, HORARIO_RH, MOTIVOS_RECHAZO,
  Prestamo, PrestamoHistorial, aprobarAdmin, aprobarSupervisor, avisoTiempoRespuesta,
  confirmarDeposito, crearPrestamo, formatFechaHora, formatMonto, historialPrestamo,
  listarPrestamos, rechazarPrestamo,
} from '@/lib/prestamos';

const Prestamos = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const esAdmin = user?.role === 'admin';
  const esSupervisor = user?.role === 'supervisor';
  const esGuardia = !esAdmin && !esSupervisor;

  const [items, setItems] = useState<Prestamo[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ monto: '', motivo: '', observaciones: '' });
  const [abierto, setAbierto] = useState<string | null>(null);
  const [historial, setHistorial] = useState<Record<string, PrestamoHistorial[]>>({});
  const [rechazando, setRechazando] = useState<string | null>(null);
  const [rechazo, setRechazo] = useState({ motivo: MOTIVOS_RECHAZO[0] as string, comentario: '' });

  const aviso = useMemo(() => avisoTiempoRespuesta(), [showForm]);

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [user?.id]);

  const load = async () => {
    setLoading(true);
    try {
      setItems(await listarPrestamos());
    } catch {
      toast.error('No se pudieron cargar las solicitudes');
    } finally {
      setLoading(false);
    }
  };

  const run = async (fn: () => Promise<void>, ok: string) => {
    setSaving(true);
    try {
      await fn();
      toast.success(ok);
      await load();
    } catch (e: any) {
      toast.error(e?.message || 'No se pudo completar la acción');
    } finally {
      setSaving(false);
    }
  };

  const handleCrear = async () => {
    const monto = Number(form.monto);
    if (!monto || monto <= 0) return toast.error('Indica un monto válido');
    if (!form.motivo.trim()) return toast.error('Indica el motivo del préstamo');
    await run(async () => {
      await crearPrestamo(monto, form.motivo.trim(), form.observaciones.trim());
      setForm({ monto: '', motivo: '', observaciones: '' });
      setShowForm(false);
    }, 'Solicitud enviada. Queda pendiente de revisión.');
  };

  const toggleHistorial = async (id: string) => {
    if (abierto === id) return setAbierto(null);
    setAbierto(id);
    if (!historial[id]) {
      try {
        setHistorial((h) => ({ ...h, [id]: await historialPrestamo(id) }));
      } catch { /* la bitácora es informativa */ }
    }
  };

  const handleRechazar = async (id: string) => {
    const motivo = rechazo.motivo;
    if (motivo === 'Otro' && !rechazo.comentario.trim()) return toast.error('Escribe el comentario del rechazo');
    await run(async () => {
      await rechazarPrestamo(id, motivo, rechazo.comentario.trim() || undefined);
      setRechazando(null);
      setRechazo({ motivo: MOTIVOS_RECHAZO[0], comentario: '' });
    }, 'Solicitud rechazada y notificada al guardia');
  };

  return (
    <div className="min-h-dvh bg-background pb-24">
      <div className="bg-gradient-to-br from-primary via-primary/85 to-accent text-primary-foreground px-4 pt-12 pb-6 rounded-b-3xl">
        <div className="max-w-lg mx-auto">
          <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm opacity-80 mb-2">
            <ArrowLeft className="w-4 h-4" /> Regresar
          </button>
          <div className="flex items-center gap-2">
            <HandCoins className="w-7 h-7" />
            <div>
              <h1 className="text-xl font-display font-bold">Solicitud de Préstamos</h1>
              <p className="text-xs opacity-80">
                {esGuardia ? 'Solicita y consulta el estado de tu préstamo' : 'Revisión y autorización de solicitudes'}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 -mt-4 space-y-4">
        {esGuardia && (
          <>
            <div className="bg-card rounded-xl p-4 shadow-card space-y-2">
              <p className="text-xs text-muted-foreground flex gap-2">
                <Clock className="w-4 h-4 shrink-0 text-primary" /> {HORARIO_RH}
              </p>
              {aviso && (
                <p className="text-xs font-semibold text-warning flex gap-2">
                  <Info className="w-4 h-4 shrink-0" /> {aviso}
                </p>
              )}
              <p className="text-xs text-muted-foreground flex gap-2">
                <Info className="w-4 h-4 shrink-0 text-primary" /> {AVISO_CANAL}
              </p>
            </div>

            {!showForm && (
              <button
                onClick={() => setShowForm(true)}
                className="w-full h-12 rounded-xl bg-card shadow-card text-sm font-semibold text-foreground flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4 text-primary" /> Nueva solicitud de préstamo
              </button>
            )}

            {showForm && (
              <div className="bg-card rounded-xl p-4 shadow-card space-y-3">
                <h2 className="font-semibold text-sm text-foreground">Nueva solicitud</h2>
                <div>
                  <label className="text-xs text-muted-foreground">Monto solicitado</label>
                  <input
                    type="number" inputMode="decimal" min={1}
                    value={form.monto}
                    onChange={(e) => setForm({ ...form, monto: e.target.value })}
                    placeholder="3000"
                    className="w-full mt-1 h-11 rounded-lg border border-border bg-background px-3 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Motivo</label>
                  <input
                    value={form.motivo}
                    onChange={(e) => setForm({ ...form, motivo: e.target.value })}
                    placeholder="Gastos médicos familiares"
                    className="w-full mt-1 h-11 rounded-lg border border-border bg-background px-3 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Observaciones (opcional)</label>
                  <textarea
                    rows={3}
                    value={form.observaciones}
                    onChange={(e) => setForm({ ...form, observaciones: e.target.value })}
                    className="w-full mt-1 rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  />
                </div>
                <button
                  onClick={handleCrear}
                  disabled={saving}
                  className="w-full h-12 rounded-lg bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-60"
                >
                  Enviar solicitud
                </button>
                <button onClick={() => setShowForm(false)} className="w-full text-xs text-muted-foreground">Cancelar</button>
              </div>
            )}
          </>
        )}

        <div className="space-y-2">
          <h2 className="font-semibold text-sm text-foreground">
            {esGuardia ? 'Mis solicitudes' : 'Solicitudes por revisar'}
          </h2>

          {loading && <p className="text-sm text-muted-foreground">Cargando…</p>}
          {!loading && !items.length && (
            <p className="text-sm text-muted-foreground">No hay solicitudes registradas.</p>
          )}

          {items.map((p) => {
            const est = ESTADO_PRESTAMO[p.estado];
            const puedeSupervisor = p.estado === 'pendiente_supervisor' && (esSupervisor || esAdmin);
            const puedeAdmin = p.estado === 'pendiente_admin' && esAdmin;
            const puedeDepositar = p.estado === 'aprobado_transito' && esAdmin;
            const puedeRechazar = esAdmin
              ? ['pendiente_supervisor', 'pendiente_admin'].includes(p.estado)
              : esSupervisor && p.estado === 'pendiente_supervisor';

            return (
              <article key={p.id} className="bg-card rounded-xl p-4 shadow-card space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-semibold text-sm text-foreground">{formatMonto(Number(p.monto))}</h3>
                    <p className="text-[11px] text-muted-foreground">Folio {p.folio} · {formatFechaHora(p.created_at)}</p>
                  </div>
                  <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold text-right ${est.style}`}>
                    {est.label}
                  </span>
                </div>

                {!esGuardia && <p className="text-xs text-foreground">Guardia: {p.guardia_nombre}</p>}
                <p className="text-sm text-muted-foreground">Motivo: {p.motivo}</p>
                {p.observaciones && <p className="text-xs text-muted-foreground">Obs.: {p.observaciones}</p>}
                {p.estado === 'rechazado' && (
                  <p className="text-xs text-emergency">
                    Rechazo: {p.rechazo_motivo}{p.rechazo_comentario ? ` — ${p.rechazo_comentario}` : ''}
                  </p>
                )}
                {p.estado === 'aprobado_transito' && (
                  <p className="text-xs text-muted-foreground">
                    Depósito en tránsito. El monto será descontado de tu próximo pago de nómina.
                  </p>
                )}

                {(puedeSupervisor || puedeAdmin || puedeDepositar || puedeRechazar) && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {puedeSupervisor && (
                      <button
                        onClick={() => run(() => aprobarSupervisor(p.id), 'Aprobada y enviada al Administrador')}
                        disabled={saving}
                        className="flex-1 h-10 rounded-lg bg-primary text-primary-foreground text-xs font-semibold disabled:opacity-60"
                      >
                        Aprobar (Supervisor)
                      </button>
                    )}
                    {puedeAdmin && (
                      <button
                        onClick={() => run(() => aprobarAdmin(p.id), 'Aprobada — depósito en tránsito')}
                        disabled={saving}
                        className="flex-1 h-10 rounded-lg bg-primary text-primary-foreground text-xs font-semibold disabled:opacity-60"
                      >
                        Aprobar (Administrador)
                      </button>
                    )}
                    {puedeDepositar && (
                      <button
                        onClick={() => run(() => confirmarDeposito(p.id), 'Depósito confirmado')}
                        disabled={saving}
                        className="flex-1 h-10 rounded-lg bg-success text-success-foreground text-xs font-semibold disabled:opacity-60"
                      >
                        Confirmar depósito
                      </button>
                    )}
                    {puedeRechazar && (
                      <button
                        onClick={() => setRechazando(rechazando === p.id ? null : p.id)}
                        className="h-10 px-3 rounded-lg border border-border text-xs font-semibold text-emergency"
                      >
                        Rechazar
                      </button>
                    )}
                  </div>
                )}

                {rechazando === p.id && (
                  <div className="rounded-lg border border-border p-3 space-y-2">
                    <label className="text-xs text-muted-foreground">Motivo del rechazo</label>
                    <select
                      value={rechazo.motivo}
                      onChange={(e) => setRechazo({ ...rechazo, motivo: e.target.value })}
                      className="w-full h-11 rounded-lg border border-border bg-background px-3 text-sm"
                    >
                      {MOTIVOS_RECHAZO.map((m) => <option key={m} value={m}>{m}</option>)}
                    </select>
                    <textarea
                      rows={2}
                      value={rechazo.comentario}
                      onChange={(e) => setRechazo({ ...rechazo, comentario: e.target.value })}
                      placeholder={rechazo.motivo === 'Otro' ? 'Escribe el motivo' : 'Comentario (opcional)'}
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                    />
                    <button
                      onClick={() => handleRechazar(p.id)}
                      disabled={saving}
                      className="w-full h-10 rounded-lg bg-emergency text-emergency-foreground text-xs font-semibold disabled:opacity-60"
                    >
                      Confirmar rechazo
                    </button>
                  </div>
                )}

                <button
                  onClick={() => toggleHistorial(p.id)}
                  className="text-[11px] text-muted-foreground inline-flex items-center gap-1"
                >
                  {abierto === p.id ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />} Historial
                </button>

                {abierto === p.id && (
                  <ul className="space-y-1 border-t border-border pt-2">
                    {(historial[p.id] || []).map((h) => (
                      <li key={h.id} className="text-[11px] text-muted-foreground">
                        <span className="font-semibold text-foreground">{h.accion}</span> · {h.actor_nombre} ({h.actor_rol || 'sistema'}) ·{' '}
                        {formatFechaHora(h.created_at)}
                        {h.estado_anterior && ` · ${h.estado_anterior} → ${h.estado_nuevo}`}
                        {h.motivo && ` · Motivo: ${h.motivo}`}
                        {h.comentario && ` · ${h.comentario}`}
                      </li>
                    ))}
                    {!(historial[p.id] || []).length && <li className="text-[11px] text-muted-foreground">Sin movimientos.</li>}
                  </ul>
                )}
              </article>
            );
          })}
        </div>
      </div>

      <BottomNav />
    </div>
  );
};

export default Prestamos;
