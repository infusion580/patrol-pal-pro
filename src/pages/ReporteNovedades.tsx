import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  Camera,
  Clock,
  Download,
  MapPin,
  Plus,
  Send,
  Trash2,
  X,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { useBranding } from '@/lib/branding';
import { generateReportPdf } from '@/lib/pdf-report';
import { SignedImg } from '@/components/SignedImg';
import BottomNav from '@/components/BottomNav';
import EmergencyButton from '@/components/EmergencyButton';
import { loadServiciosParaUsuario } from '@/lib/guardia-servicios';
import { notifyNovedad } from '@/lib/notification-helpers';
import {
  createNovedad,
  deleteNovedad,
  formatFechaHora,
  listNovedades,
  tryGetPosition,
  type NivelImportancia,
  type Novedad,
} from '@/lib/novedades';

/**
 * Reporte de Novedades (perfil Guardia)
 * ------------------------------------
 * Sustituye al antiguo "Reporte de Turno". El guardia registra tantas
 * novedades como necesite durante el día; cada una guarda fecha y hora
 * automáticas, ubicación (texto + GPS), evidencia fotográfica y nivel de
 * importancia. La pantalla muestra siempre TODAS las novedades del día
 * seleccionado, con conteos, filtro y descarga en PDF.
 * Al final del turno puede enviarse el consolidado al supervisor.
 */

const hoyISO = () => new Date().toISOString().slice(0, 10);

const ReporteNovedades = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const { logoUrl, colors } = useBranding();
  const fileRef = useRef<HTMLInputElement>(null);

  const [fecha, setFecha] = useState(hoyISO());
  const [novedades, setNovedades] = useState<Novedad[]>([]);
  const [loading, setLoading] = useState(true);
  const [soloImportantes, setSoloImportantes] = useState(false);

  // Formulario de nueva novedad
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [descripcion, setDescripcion] = useState('');
  const [ubicacion, setUbicacion] = useState('');
  const [foto, setFoto] = useState<{ file: File; preview: string } | null>(null);
  const [servicio, setServicio] = useState<{ id: string; nombre: string } | null>(null);

  // Envío del consolidado al supervisor (flujo de validación existente)
  const [enviando, setEnviando] = useState(false);
  const [observaciones, setObservaciones] = useState('');
  const [correctingId, setCorrectingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const items = await listNovedades({ desde: fecha, hasta: fecha, guardiaId: user.id });
      setNovedades(items);
    } catch {
      toast({ title: 'Error', description: 'No se pudieron cargar las novedades.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [user, fecha, toast]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const servicios = await loadServiciosParaUsuario(user.id, user.role).catch(() => []);
      if (servicios[0]) setServicio({ id: servicios[0].id, nombre: servicios[0].nombre });

      const { data } = await supabase
        .from('reportes_turno')
        .select('id, observaciones, retroalimentacion')
        .eq('guardia_id', user.id)
        .eq('status', 'retroalimentacion')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data) {
        setCorrectingId(data.id);
        setFeedback(data.retroalimentacion);
        setObservaciones(data.observaciones || '');
      }
    })();
  }, [user]);

  const visibles = useMemo(
    () => (soloImportantes ? novedades.filter((n) => n.importancia === 'importante') : novedades),
    [novedades, soloImportantes],
  );
  const importantes = useMemo(() => novedades.filter((n) => n.importancia === 'importante').length, [novedades]);

  // ---------- Captura de novedades ----------

  const handleFoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (foto) URL.revokeObjectURL(foto.preview);
    setFoto({ file, preview: URL.createObjectURL(file) });
    if (fileRef.current) fileRef.current.value = '';
  };

  const subirFoto = async (): Promise<string | null> => {
    if (!foto || !user) return null;
    const { compressImage } = await import('@/lib/image-compress');
    const { uploadPhotoResilient } = await import('@/lib/offline-photo-queue');
    const blob = await compressImage(foto.file).catch(() => foto.file);
    const path = `${user.id}/novedades/${Date.now()}.jpg`;
    await uploadPhotoResilient('evidencias', path, blob as Blob, 'image/jpeg');
    return path;
  };

  const resetForm = () => {
    if (foto) URL.revokeObjectURL(foto.preview);
    setDescripcion('');
    setUbicacion('');
    setFoto(null);
  };

  const guardar = async (nivel: NivelImportancia) => {
    if (!user) return;
    if (descripcion.trim().length < 10) {
      toast({
        title: 'Describe la novedad',
        description: 'Escribe al menos 10 caracteres explicando qué ocurrió.',
        variant: 'destructive',
      });
      return;
    }
    setSaving(true);
    try {
      const [fotoPath, pos] = await Promise.all([subirFoto(), tryGetPosition()]);
      const novedad = await createNovedad({
        guardia_id: user.id,
        servicio_id: servicio?.id || null,
        descripcion: descripcion.trim(),
        importancia: nivel,
        lat: pos?.lat ?? null,
        lng: pos?.lng ?? null,
        ubicacion_texto: ubicacion.trim() || null,
        foto_url: fotoPath,
      });

      void notifyNovedad({
        guardiaId: user.id,
        guardiaNombre: `${user.nombre} ${user.apellido}`.trim(),
        descripcion: novedad.descripcion,
        importante: nivel === 'importante',
        servicioNombre: servicio?.nombre || null,
        ubicacion: novedad.ubicacion_texto,
        lat: novedad.lat,
        lng: novedad.lng,
        fotoPath: novedad.foto_url,
      });

      toast({
        title: nivel === 'importante' ? '⚠️ Novedad importante enviada' : '✅ Novedad registrada',
        description:
          nivel === 'importante'
            ? 'Se envió la alerta al supervisor y al administrador.'
            : 'Quedó guardada en tu reporte de novedades del día.',
      });
      resetForm();
      setOpen(false);
      if (fecha === hoyISO()) setNovedades((prev) => [novedad, ...prev]);
      else void cargar();
    } catch {
      toast({ title: 'Error', description: 'No se pudo guardar la novedad.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const eliminar = async (id: string) => {
    try {
      await deleteNovedad(id);
      setNovedades((prev) => prev.filter((n) => n.id !== id));
    } catch {
      toast({ title: 'Error', description: 'No se pudo eliminar la novedad.', variant: 'destructive' });
    }
  };

  // ---------- PDF del día ----------

  const descargarPdf = async () => {
    await generateReportPdf({
      title: 'Reporte de Novedades',
      subtitle: `${user?.nombre ?? ''} ${user?.apellido ?? ''}`.trim(),
      logoUrl,
      primaryHsl: colors.primary_hsl,
      meta: [
        { label: 'Fecha', value: fecha },
        { label: 'Servicio', value: servicio?.nombre || 'Sin asignar' },
        { label: 'Total de novedades', value: String(novedades.length) },
        { label: 'Importantes', value: String(importantes) },
      ],
      sections: [
        {
          title: `Novedades del ${fecha}`,
          columns: ['Hora', 'Importancia', 'Descripción', 'Ubicación', 'Evidencia'],
          rows: novedades.map((n) => {
            const { hora } = formatFechaHora(n.created_at);
            return [
              hora,
              n.importancia === 'importante' ? 'IMPORTANTE' : 'Normal',
              n.descripcion,
              n.ubicacion_texto || (n.lat && n.lng ? `${n.lat.toFixed(5)}, ${n.lng.toFixed(5)}` : '—'),
              n.foto_url ? 'Sí' : 'No',
            ];
          }),
          emptyText: 'Sin novedades registradas en la fecha seleccionada.',
        },
      ],
      fileName: `Reporte-Novedades-${fecha}.pdf`,
      footerNote: 'Documento generado automáticamente por la plataforma.',
    });
  };

  // ---------- Consolidado al supervisor ----------

  const enviarConsolidado = async () => {
    if (!user) return;
    if (novedades.length === 0) {
      toast({
        title: 'Sin novedades',
        description: 'Registra al menos una novedad antes de enviar el reporte del turno.',
        variant: 'destructive',
      });
      return;
    }
    setEnviando(true);
    const linea = (n: Novedad) => {
      const { hora } = formatFechaHora(n.created_at);
      const ref = n.ubicacion_texto ? ` (${n.ubicacion_texto})` : '';
      return `• ${hora}${ref}: ${n.descripcion}`;
    };
    const payload = {
      incidencias: novedades.filter((n) => n.importancia === 'importante').map(linea).join('\n') || 'Sin novedades importantes.',
      actividades: novedades.filter((n) => n.importancia === 'normal').map(linea).join('\n') || 'Sin novedades normales.',
      observaciones: observaciones.trim(),
      firmado: true,
    };
    const { error } = correctingId
      ? await supabase
          .from('reportes_turno')
          .update({ ...payload, status: 'pendiente', retroalimentacion: null })
          .eq('id', correctingId)
          .eq('guardia_id', user.id)
      : await supabase.from('reportes_turno').insert({ ...payload, guardia_id: user.id });
    setEnviando(false);
    if (error) {
      toast({ title: 'Error', description: 'No se pudo enviar el reporte al supervisor.', variant: 'destructive' });
      return;
    }
    setCorrectingId(null);
    setFeedback(null);
    toast({
      title: '✅ Reporte enviado',
      description: 'El supervisor recibió el consolidado de novedades del turno.',
    });
  };

  return (
    <div className="min-h-dvh bg-background pb-24">
      <div className="text-primary-foreground px-4 pt-12 pb-6 rounded-b-3xl app-header">
        <div className="max-w-lg mx-auto">
          <button onClick={() => navigate('/dashboard')} className="flex items-center gap-1 text-sm opacity-80 mb-2">
            <ArrowLeft className="w-4 h-4" /> Regresar
          </button>
          <h1 className="text-xl font-display font-bold">Reporte de Novedades</h1>
          <p className="text-sm opacity-70 mt-1">
            Registra todas las novedades del turno — la fecha y hora se toman automáticamente.
          </p>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 mt-4 space-y-4">
        {feedback && (
          <div className="bg-emergency/10 border border-emergency/30 rounded-xl p-4 flex gap-3">
            <AlertCircle className="w-5 h-5 text-emergency shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-emergency mb-1">Retroalimentación del supervisor</p>
              <p className="text-sm text-foreground whitespace-pre-wrap">{feedback}</p>
              <p className="text-xs text-muted-foreground mt-2">Corrige o agrega novedades y reenvía el reporte.</p>
            </div>
          </div>
        )}

        {/* Resumen del día */}
        <div className="bg-card rounded-xl p-4 shadow-card space-y-3">
          <div className="flex items-end gap-2">
            <div className="flex-1 space-y-1.5">
              <Label className="text-xs">Día del reporte</Label>
              <Input type="date" value={fecha} max={hoyISO()} onChange={(e) => setFecha(e.target.value)} className="text-sm" />
            </div>
            <Button variant="outline" onClick={descargarPdf} className="h-10">
              <Download className="w-4 h-4 mr-2" /> PDF
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setSoloImportantes(false)}
              className={`rounded-xl p-3 text-left border ${!soloImportantes ? 'border-primary bg-primary/5' : 'border-border bg-accent/40'}`}
            >
              <p className="text-2xl font-bold text-foreground">{novedades.length}</p>
              <p className="text-xs text-muted-foreground">Novedades del día</p>
            </button>
            <button
              onClick={() => setSoloImportantes(true)}
              className={`rounded-xl p-3 text-left border ${soloImportantes ? 'border-emergency bg-emergency/10' : 'border-border bg-accent/40'}`}
            >
              <p className="text-2xl font-bold text-emergency">{importantes}</p>
              <p className="text-xs text-muted-foreground">Importantes</p>
            </button>
          </div>
        </div>

        {/* Nueva novedad */}
        <div className="bg-card rounded-xl p-4 shadow-card space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <Label className="text-base">Nueva novedad</Label>
              <p className="text-xs text-muted-foreground mt-0.5">Puedes registrar tantas como necesites.</p>
            </div>
            <Button size="sm" variant={open ? 'secondary' : 'default'} onClick={() => setOpen((v) => !v)}>
              {open ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            </Button>
          </div>

          {open && (
            <div className="space-y-3 border border-border rounded-xl p-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Descripción de la novedad</Label>
                <Textarea
                  rows={3}
                  className="text-sm"
                  placeholder="¿Qué ocurrió? Detalla lo sucedido."
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Ubicación (referencia)</Label>
                <Input
                  className="text-sm"
                  placeholder="Ej. Puerta 5, estacionamiento norte"
                  value={ubicacion}
                  onChange={(e) => setUbicacion(e.target.value)}
                />
                <p className="text-[11px] text-muted-foreground">Se adjuntan también las coordenadas GPS si están disponibles.</p>
              </div>

              <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFoto} />
              {foto ? (
                <div className="flex items-center gap-2 bg-accent rounded-lg p-2">
                  <img src={foto.preview} alt="Evidencia de la novedad" className="w-12 h-12 rounded object-cover" />
                  <span className="text-xs flex-1 truncate">{foto.file.name}</span>
                  <button
                    onClick={() => {
                      URL.revokeObjectURL(foto.preview);
                      setFoto(null);
                    }}
                    className="p-1 text-muted-foreground hover:text-emergency"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <Button variant="outline" className="w-full" onClick={() => fileRef.current?.click()}>
                  <Camera className="w-4 h-4 mr-2" /> Adjuntar evidencia
                </Button>
              )}

              <div className="grid grid-cols-2 gap-2">
                <Button variant="secondary" disabled={saving} onClick={() => guardar('normal')}>
                  {saving ? 'Guardando…' : 'Guardar novedad'}
                </Button>
                <Button variant="destructive" disabled={saving} onClick={() => guardar('importante')}>
                  <AlertTriangle className="w-4 h-4 mr-2" /> Importante
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground text-center">
                "Importante" envía alerta inmediata al supervisor y al administrador.
              </p>
            </div>
          )}
        </div>

        {/* Listado del día */}
        <div className="bg-card rounded-xl p-4 shadow-card space-y-3">
          <Label className="text-base">
            {soloImportantes ? 'Novedades importantes' : 'Todas las novedades'} — {fecha}
          </Label>
          {loading ? (
            <p className="text-sm text-muted-foreground">Cargando novedades…</p>
          ) : visibles.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay novedades registradas en esta fecha.</p>
          ) : (
            <div className="space-y-2">
              {visibles.map((n) => {
                const { fecha: f, hora } = formatFechaHora(n.created_at);
                const esImportante = n.importancia === 'importante';
                return (
                  <div
                    key={n.id}
                    className={`rounded-xl p-3 border ${esImportante ? 'border-emergency/40 bg-emergency/5' : 'border-border bg-accent/40'}`}
                  >
                    <div className="flex items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
                          <span className="inline-flex items-center gap-1">
                            <Clock className="w-3 h-3" /> {f} · {hora}
                          </span>
                          {esImportante && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emergency/15 text-emergency font-semibold">
                              <AlertTriangle className="w-3 h-3" /> Importante
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-foreground mt-1 whitespace-pre-wrap break-words">{n.descripcion}</p>
                        {(n.ubicacion_texto || (n.lat && n.lng)) && (
                          <p className="text-xs text-muted-foreground mt-1 inline-flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {n.ubicacion_texto || `${n.lat?.toFixed(5)}, ${n.lng?.toFixed(5)}`}
                          </p>
                        )}
                        {n.foto_url && (
                          <SignedImg
                            bucket="evidencias"
                            path={n.foto_url}
                            alt="Evidencia"
                            className="mt-2 w-24 h-24 rounded-lg object-cover"
                          />
                        )}
                      </div>
                      <button
                        onClick={() => eliminar(n.id)}
                        className="p-1 text-muted-foreground hover:text-emergency"
                        aria-label="Eliminar novedad"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Cierre del turno */}
        <div className="bg-card rounded-xl p-4 shadow-card space-y-3">
          <Label className="text-base">Enviar reporte del turno al supervisor</Label>
          <Textarea
            rows={3}
            className="text-sm"
            placeholder="Observaciones generales del turno (opcional)"
            value={observaciones}
            onChange={(e) => setObservaciones(e.target.value)}
          />
          <Button onClick={enviarConsolidado} className="w-full h-12 text-base font-semibold" disabled={enviando}>
            <Send className="w-4 h-4 mr-2" />
            {enviando ? 'Enviando…' : correctingId ? 'Reenviar reporte corregido' : 'Enviar reporte de novedades'}
          </Button>
          <p className="text-[11px] text-muted-foreground text-center">
            Se envía el consolidado de las {novedades.length} novedades del {fecha}.
          </p>
        </div>
      </div>

      <EmergencyButton />
      <BottomNav />
    </div>
  );
};

export default ReporteNovedades;
