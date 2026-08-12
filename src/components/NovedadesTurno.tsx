import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Camera, Clock, MapPin, Plus, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/lib/auth-context';
import { SignedImg } from '@/components/SignedImg';
import { loadServiciosParaUsuario } from '@/lib/guardia-servicios';
import { notifyNovedad } from '@/lib/notification-helpers';
import {
  createNovedad,
  deleteNovedad,
  formatFechaHora,
  listNovedadesDelTurno,
  tryGetPosition,
  type NivelImportancia,
  type Novedad,
} from '@/lib/novedades';

/**
 * Registro de novedades del turno.
 * El guardia puede capturar varias novedades; la fecha y hora se toman
 * automáticamente del sistema (nunca las escribe el usuario).
 */
export default function NovedadesTurno() {
  const { user } = useAuth();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [novedades, setNovedades] = useState<Novedad[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);

  const [descripcion, setDescripcion] = useState('');
  const [ubicacion, setUbicacion] = useState('');
  const [importancia, setImportancia] = useState<NivelImportancia>('normal');
  const [foto, setFoto] = useState<{ file: File; preview: string } | null>(null);
  const [servicio, setServicio] = useState<{ id: string; nombre: string } | null>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const [items, servicios] = await Promise.all([
          listNovedadesDelTurno(user.id),
          loadServiciosParaUsuario(user.id, user.role),
        ]);
        setNovedades(items);
        if (servicios[0]) setServicio({ id: servicios[0].id, nombre: servicios[0].nombre });
      } catch {
        /* la lista se queda vacía si falla la carga */
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  const resetForm = () => {
    if (foto) URL.revokeObjectURL(foto.preview);
    setDescripcion('');
    setUbicacion('');
    setImportancia('normal');
    setFoto(null);
  };

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

  const guardar = async (nivel: NivelImportancia) => {
    if (!user) return;
    if (!descripcion.trim()) {
      toast({ title: 'Descripción requerida', description: 'Describe la novedad antes de guardarla.', variant: 'destructive' });
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
      setNovedades((prev) => [novedad, ...prev]);

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
            : 'Quedó guardada dentro del reporte de turno.',
      });
      resetForm();
      setOpen(false);
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

  return (
    <div className="bg-card rounded-xl p-4 shadow-card space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <Label className="text-base">Novedades del turno</Label>
          <p className="text-xs text-muted-foreground mt-0.5">
            Registra todas las novedades que ocurran. La hora se toma automáticamente.
          </p>
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
              placeholder="¿Qué ocurrió?"
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
            <p className="text-[11px] text-muted-foreground">
              Se adjuntan también las coordenadas GPS si están disponibles.
            </p>
          </div>

          <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFoto} />
          {foto ? (
            <div className="flex items-center gap-2 bg-accent rounded-lg p-2">
              <img src={foto.preview} alt="Evidencia de la novedad" className="w-12 h-12 rounded object-cover" />
              <span className="text-xs flex-1 truncate">{foto.file.name}</span>
              <button onClick={() => { URL.revokeObjectURL(foto.preview); setFoto(null); }} className="p-1 text-muted-foreground hover:text-emergency">
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
              Guardar novedad
            </Button>
            <Button
              variant="destructive"
              disabled={saving}
              onClick={() => { setImportancia('importante'); guardar('importante'); }}
            >
              <AlertTriangle className="w-4 h-4 mr-2" /> Importante
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground text-center">
            "Importante" envía alerta inmediata al supervisor y al administrador.
          </p>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">Cargando novedades…</p>
      ) : novedades.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aún no hay novedades registradas en este turno.</p>
      ) : (
        <div className="space-y-2">
          {novedades.map((n) => {
            const { fecha, hora } = formatFechaHora(n.created_at);
            const esImportante = n.importancia === 'importante';
            return (
              <div
                key={n.id}
                className={`rounded-xl p-3 border ${esImportante ? 'border-emergency/40 bg-emergency/5' : 'border-border bg-accent/40'}`}
              >
                <div className="flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1"><Clock className="w-3 h-3" /> {fecha} · {hora}</span>
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
                      <SignedImg bucket="evidencias" path={n.foto_url} alt="Evidencia" className="mt-2 w-24 h-24 rounded-lg object-cover" />
                    )}
                  </div>
                  <button onClick={() => eliminar(n.id)} className="p-1 text-muted-foreground hover:text-emergency" aria-label="Eliminar novedad">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
