import { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Camera, UserPlus, LogOut, Clock, Car, CreditCard, Eye, User, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/hooks/use-toast';
import BottomNav from '@/components/BottomNav';
import EmergencyButton from '@/components/EmergencyButton';
import { SignedImg } from '@/components/SignedImg';
import { getSignedUrl } from '@/lib/storage-helpers';

interface Visita {
  id: string;
  nombre_visitante: string;
  motivo: string;
  persona_a_visitar: string;
  area_destino: string;
  foto_placa_url: string;
  foto_ine_url: string;
  foto_salida_url: string;
  hora_entrada: string;
  hora_salida: string | null;
  status: string;
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

async function openImage(path: string, setViewImage: (u: string | null) => void) {
  const url = await getSignedUrl('visitas', path);
  if (url) setViewImage(url);
}

const Visitas = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [visitas, setVisitas] = useState<Visita[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [nombre, setNombre] = useState('');
  const [motivo, setMotivo] = useState('');
  const [personaAVisitar, setPersonaAVisitar] = useState('');
  const [areaDestino, setAreaDestino] = useState('');
  const [fotoPlaca, setFotoPlaca] = useState<File | null>(null);
  const [fotoIne, setFotoIne] = useState<File | null>(null);
  const [previewPlaca, setPreviewPlaca] = useState('');
  const [previewIne, setPreviewIne] = useState('');

  // Exit photo
  const [exitingId, setExitingId] = useState<string | null>(null);
  const [fotoSalida, setFotoSalida] = useState<File | null>(null);
  const [previewSalida, setPreviewSalida] = useState('');

  // Image viewer
  const [viewImage, setViewImage] = useState<string | null>(null);

  const placaInputRef = useRef<HTMLInputElement>(null);
  const ineInputRef = useRef<HTMLInputElement>(null);
  const salidaInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { loadVisitas(); }, [user]);

  const loadVisitas = async () => {
    if (!user) return;
    const today = new Date().toISOString().split('T')[0];
    const { data } = await supabase
      .from('visitas')
      .select('*')
      .eq('guardia_id', user.id)
      .gte('created_at', today)
      .order('hora_entrada', { ascending: false });
    setVisitas((data as any) || []);
    setLoading(false);
  };

  const handleFileChange = (file: File | undefined, type: 'placa' | 'ine' | 'salida') => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    if (type === 'placa') { setFotoPlaca(file); setPreviewPlaca(url); }
    else if (type === 'ine') { setFotoIne(file); setPreviewIne(url); }
    else { setFotoSalida(file); setPreviewSalida(url); }
  };

  const uploadPhoto = async (file: File, folder: string): Promise<string> => {
    const ext = file.name.split('.').pop() || 'jpg';
    const path = `${user!.id}/${folder}/${Date.now()}.${ext}`;
    const { uploadPhotoResilient } = await import('@/lib/offline-photo-queue');
    await uploadPhotoResilient('visitas', path, file, file.type);
    return path;
  };

  const handleRegister = async () => {
    if (!user || !nombre.trim()) {
      toast({ title: 'Falta información', description: 'Ingresa el nombre del visitante.', variant: 'destructive' });
      return;
    }
    if (!personaAVisitar.trim()) {
      toast({ title: 'Falta información', description: 'Indica a quién visita.', variant: 'destructive' });
      return;
    }
    if (!areaDestino.trim()) {
      toast({ title: 'Falta información', description: 'Indica el área o departamento al que se dirige.', variant: 'destructive' });
      return;
    }
    if (!fotoPlaca || !fotoIne) {
      toast({ title: 'Faltan fotos', description: 'Debes capturar la foto de la placa y el INE.', variant: 'destructive' });
      return;
    }


    setSubmitting(true);
    try {
      const [placaPath, inePath] = await Promise.all([
        uploadPhoto(fotoPlaca, 'placas'),
        uploadPhoto(fotoIne, 'ine'),
      ]);

      const { error } = await supabase.from('visitas').insert({
        guardia_id: user.id,
        nombre_visitante: nombre.trim(),
        motivo: motivo.trim(),
        persona_a_visitar: personaAVisitar.trim(),
        area_destino: areaDestino.trim(),
        foto_placa_url: placaPath,
        foto_ine_url: inePath,
      } as any);

      if (error) throw error;

      toast({ title: '✅ Visita registrada', description: `${nombre} ingresó correctamente.` });
      resetForm();
      loadVisitas();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
    setSubmitting(false);
  };

  const handleExit = async (visitaId: string) => {
    if (!fotoSalida) {
      toast({ title: 'Error', description: 'Captura la foto de salida.', variant: 'destructive' });
      return;
    }

    setSubmitting(true);
    try {
      const visita = visitas.find(v => v.id === visitaId);
      const salidaPath = await uploadPhoto(fotoSalida, 'salidas');
      const horaSalidaISO = new Date().toISOString();
      const { error } = await supabase.from('visitas').update({
        hora_salida: horaSalidaISO,
        foto_salida_url: salidaPath,
        status: 'salió',
      } as any).eq('id', visitaId);

      if (error) throw error;

      // Notificación única con entrada + salida
      if (visita && user) {
        try {
          const { notifyVisitaEntradaSalida } = await import('@/lib/notification-helpers');
          const { data: prof } = await supabase
            .from('profiles')
            .select('nombre, apellido')
            .eq('user_id', user.id)
            .maybeSingle();
          const guardiaNombre = prof ? `${prof.nombre ?? ''} ${prof.apellido ?? ''}`.trim() || 'Guardia' : 'Guardia';
          await notifyVisitaEntradaSalida({
            guardiaId: user.id,
            guardiaNombre,
            nombreVisitante: visita.nombre_visitante,
            personaAVisitar: visita.persona_a_visitar,
            areaDestino: visita.area_destino,
            motivo: visita.motivo,
            horaEntradaISO: visita.hora_entrada,
            horaSalidaISO,
            fotoInePath: visita.foto_ine_url,
            fotoPlacaPath: visita.foto_placa_url,
            fotoSalidaPath: salidaPath,
          });
        } catch (e) {
          console.error('notifyVisitaEntradaSalida failed', e);
          toast({ title: 'Aviso', description: 'La visita se registró, pero la notificación falló.', variant: 'destructive' });
        }
      }

      toast({ title: '✅ Salida registrada', description: 'Visita finalizada correctamente.' });
      setExitingId(null);
      setFotoSalida(null);
      setPreviewSalida('');
      loadVisitas();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
    setSubmitting(false);
  };

  const resetForm = () => {
    setShowForm(false);
    setNombre('');
    setMotivo('');
    setPersonaAVisitar('');
    setAreaDestino('');
    setFotoPlaca(null);
    setFotoIne(null);
    setPreviewPlaca('');
    setPreviewIne('');
  };

  const dentroCount = visitas.filter(v => v.status === 'dentro').length;

  if (loading) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-background pb-20">
      {/* Header */}
      <div className="text-primary-foreground px-4 pt-12 pb-6 rounded-b-3xl app-header">
        <div className="max-w-lg mx-auto">
          <button onClick={() => navigate('/dashboard')} className="flex items-center gap-1 text-sm opacity-80 mb-2">
            <ArrowLeft className="w-4 h-4" /> Regresar
          </button>
          <h1 className="text-xl font-display font-bold">Control de Visitas</h1>
          <p className="text-sm opacity-70 mt-1">{dentroCount} visitante{dentroCount !== 1 ? 's' : ''} dentro</p>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 -mt-4">
        {/* New visit button */}
        {!showForm && (
          <Button onClick={() => setShowForm(true)} className="w-full mb-4 h-12 bg-success text-success-foreground hover:bg-success/90 rounded-xl font-bold">
            <UserPlus className="w-5 h-5 mr-2" /> Registrar Visita
          </Button>
        )}

        {/* Registration form */}
        {showForm && (
          <div className="bg-card rounded-xl p-4 shadow-card mb-4 space-y-3">
            <h2 className="font-display font-bold text-sm text-foreground">Nueva Visita</h2>

            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">Nombre del visitante *</label>
              <input
                type="text"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Nombre completo"
                className="w-full h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1 flex items-center gap-1">
                <User className="w-3 h-3" /> A quién va a ver
              </label>
              <input
                type="text"
                value={personaAVisitar}
                onChange={(e) => setPersonaAVisitar(e.target.value)}
                placeholder="Nombre de la persona a visitar"
                className="w-full h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1 flex items-center gap-1">
                <Building2 className="w-3 h-3" /> A qué área
              </label>
              <input
                type="text"
                value={areaDestino}
                onChange={(e) => setAreaDestino(e.target.value)}
                placeholder="Ej: Recursos Humanos, Almacén..."
                className="w-full h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">Motivo de visita</label>
              <textarea
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder="Ej: Entrega de paquetería, reunión con..."
                rows={2}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground resize-none"
              />
            </div>

            {/* Plate photo */}
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1 flex items-center gap-1">
                <Car className="w-3 h-3" /> Foto de placa *
              </label>
              <input ref={placaInputRef} type="file" accept="image/*" capture="environment" className="hidden"
                onChange={(e) => handleFileChange(e.target.files?.[0], 'placa')} />
              {previewPlaca ? (
                <div className="relative">
                  <img src={previewPlaca} alt="Placa" className="w-full h-32 object-cover rounded-lg" />
                  <Button size="sm" variant="outline" className="absolute top-1 right-1 h-7 text-xs"
                    onClick={() => placaInputRef.current?.click()}>Cambiar</Button>
                </div>
              ) : (
                <Button variant="outline" className="w-full h-20 border-dashed" onClick={() => placaInputRef.current?.click()}>
                  <Camera className="w-5 h-5 mr-2" /> Capturar Placa
                </Button>
              )}
            </div>

            {/* INE photo */}
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1 flex items-center gap-1">
                <CreditCard className="w-3 h-3" /> Foto de INE *
              </label>
              <input ref={ineInputRef} type="file" accept="image/*" capture="environment" className="hidden"
                onChange={(e) => handleFileChange(e.target.files?.[0], 'ine')} />
              {previewIne ? (
                <div className="relative">
                  <img src={previewIne} alt="INE" className="w-full h-32 object-cover rounded-lg" />
                  <Button size="sm" variant="outline" className="absolute top-1 right-1 h-7 text-xs"
                    onClick={() => ineInputRef.current?.click()}>Cambiar</Button>
                </div>
              ) : (
                <Button variant="outline" className="w-full h-20 border-dashed" onClick={() => ineInputRef.current?.click()}>
                  <Camera className="w-5 h-5 mr-2" /> Capturar INE
                </Button>
              )}
            </div>

            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={resetForm} className="flex-1">Cancelar</Button>
              <Button onClick={handleRegister} disabled={submitting} className="flex-1">
                {submitting ? 'Registrando...' : 'Registrar Entrada'}
              </Button>
            </div>
          </div>
        )}

        {/* Active visitors */}
        {visitas.filter(v => v.status === 'dentro').length > 0 && (
          <>
            <h2 className="text-sm font-semibold text-muted-foreground mb-2">Visitantes Dentro</h2>
            <div className="space-y-2 mb-4">
              {visitas.filter(v => v.status === 'dentro').map(v => (
                <div key={v.id} className="bg-card rounded-xl p-4 shadow-card">
                  <div className="flex items-start justify-between mb-2">
                    <div className="min-w-0 flex-1 pr-2">
                      <p className="font-semibold text-sm text-foreground">{v.nombre_visitante}</p>
                      {v.persona_a_visitar && (
                        <p className="text-[11px] text-foreground/80 flex items-center gap-1 mt-0.5">
                          <User className="w-3 h-3 shrink-0" /> Visita a: <span className="font-medium">{v.persona_a_visitar}</span>
                        </p>
                      )}
                      {v.area_destino && (
                        <p className="text-[11px] text-foreground/80 flex items-center gap-1 mt-0.5">
                          <Building2 className="w-3 h-3 shrink-0" /> Área: <span className="font-medium">{v.area_destino}</span>
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground mt-0.5">{v.motivo || 'Sin motivo especificado'}</p>
                      <p className="text-[10px] text-primary flex items-center gap-1 mt-1">
                        <Clock className="w-3 h-3" />
                        Entrada: {new Date(v.hora_entrada).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    <div className="bg-success/10 px-2 py-0.5 rounded-full">
                      <span className="text-[10px] font-bold text-success">DENTRO</span>
                    </div>
                  </div>

                  {/* Thumbnails */}
                  <div className="flex gap-2 mb-3">
                    {v.foto_placa_url && (
                      <button onClick={() => openImage(v.foto_placa_url, setViewImage)} className="relative">
                        <SignedImg bucket="visitas" path={v.foto_placa_url} alt="Placa" className="w-16 h-12 object-cover rounded-md" />
                        <span className="absolute bottom-0 left-0 right-0 bg-black/60 text-[8px] text-white text-center rounded-b-md">Placa</span>
                      </button>
                    )}
                    {v.foto_ine_url && (
                      <button onClick={() => openImage(v.foto_ine_url, setViewImage)} className="relative">
                        <SignedImg bucket="visitas" path={v.foto_ine_url} alt="INE" className="w-16 h-12 object-cover rounded-md" />
                        <span className="absolute bottom-0 left-0 right-0 bg-black/60 text-[8px] text-white text-center rounded-b-md">INE</span>
                      </button>
                    )}
                  </div>

                  {/* Exit flow */}
                  {exitingId === v.id ? (
                    <div className="space-y-2">
                      <input ref={salidaInputRef} type="file" accept="image/*" capture="environment" className="hidden"
                        onChange={(e) => handleFileChange(e.target.files?.[0], 'salida')} />
                      {previewSalida ? (
                        <div className="relative">
                          <img src={previewSalida} alt="Salida" className="w-full h-24 object-cover rounded-lg" />
                          <Button size="sm" variant="outline" className="absolute top-1 right-1 h-7 text-xs"
                            onClick={() => salidaInputRef.current?.click()}>Cambiar</Button>
                        </div>
                      ) : (
                        <Button variant="outline" className="w-full h-16 border-dashed text-xs" onClick={() => salidaInputRef.current?.click()}>
                          <Camera className="w-4 h-4 mr-1" /> Capturar foto de salida
                        </Button>
                      )}
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => { setExitingId(null); setFotoSalida(null); setPreviewSalida(''); }} className="flex-1">Cancelar</Button>
                        <Button size="sm" onClick={() => handleExit(v.id)} disabled={submitting} className="flex-1 bg-emergency text-emergency-foreground">
                          {submitting ? 'Guardando...' : 'Confirmar Salida'}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => setExitingId(v.id)} className="w-full text-xs">
                      <LogOut className="w-4 h-4 mr-1" /> Registrar Salida
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </>
        )}

        {/* Completed visitors */}
        {visitas.filter(v => v.status === 'salió').length > 0 && (
          <>
            <h2 className="text-sm font-semibold text-muted-foreground mb-2">Historial de Hoy</h2>
            <div className="space-y-2">
              {visitas.filter(v => v.status === 'salió').map(v => (
                <div key={v.id} className="bg-card rounded-xl p-3 shadow-card opacity-70">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-sm text-foreground">{v.nombre_visitante}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {new Date(v.hora_entrada).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                        {' → '}
                        {v.hora_salida && new Date(v.hora_salida).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      {v.foto_placa_url && (
                        <button onClick={() => openImage(v.foto_placa_url, setViewImage)}>
                          <Eye className="w-4 h-4 text-muted-foreground" />
                        </button>
                      )}
                      <div className="bg-muted px-2 py-0.5 rounded-full">
                        <span className="text-[10px] font-semibold text-muted-foreground">SALIÓ</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {visitas.length === 0 && !showForm && (
          <div className="bg-card rounded-xl p-8 shadow-card text-center">
            <UserPlus className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No hay visitas registradas hoy</p>
          </div>
        )}
      </div>

      {/* Image viewer modal */}
      {viewImage && (
        <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4" onClick={() => setViewImage(null)}>
          <img src={viewImage} alt="Foto" className="max-w-full max-h-[80vh] object-contain rounded-lg" />
        </div>
      )}

      <EmergencyButton />
      <BottomNav />
    </div>
  );
};

export default Visitas;
