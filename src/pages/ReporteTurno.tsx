import { useState, useRef, useEffect } from 'react';
import { ArrowLeft, Camera, Mic, Video, PenTool, Send, X, ImageIcon, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth-context';
import BottomNav from '@/components/BottomNav';
import NovedadesTurno from '@/components/NovedadesTurno';
import EmergencyButton from '@/components/EmergencyButton';

const ReporteTurno = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({
    incidencias: '',
    actividades: '',
    observaciones: '',
  });
  const [signed, setSigned] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [evidencias, setEvidencias] = useState<Array<{ file: File; preview: string }>>([]);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  // Reporte pendiente de corrección: si el supervisor lo marcó con
  // retroalimentación, precargamos el contenido y hacemos UPDATE en lugar de INSERT.
  const [correctingId, setCorrectingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from('reportes_turno')
        .select('id, incidencias, actividades, observaciones, retroalimentacion')
        .eq('guardia_id', user.id)
        .eq('status', 'retroalimentacion')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data) {
        setCorrectingId(data.id);
        setFeedback(data.retroalimentacion);
        setForm({
          incidencias: data.incidencias || '',
          actividades: data.actividades || '',
          observaciones: data.observaciones || '',
        });
      }
    })();
  }, [user]);

  const update = (field: string, value: string) => setForm((prev) => ({ ...prev, [field]: value }));

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const newFiles = Array.from(files).map(file => ({
      file,
      preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : '',
    }));
    setEvidencias(prev => [...prev, ...newFiles]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeFile = (index: number) => {
    setEvidencias(prev => {
      const copy = [...prev];
      if (copy[index].preview) URL.revokeObjectURL(copy[index].preview);
      copy.splice(index, 1);
      return copy;
    });
  };

  const uploadEvidencias = async (): Promise<string[]> => {
    if (!user || evidencias.length === 0) return [];
    const paths: string[] = [];
    for (const ev of evidencias) {
      const ext = ev.file.name.split('.').pop();
      const path = `${user.id}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await supabase.storage.from('evidencias').upload(path, ev.file);
      if (!error) paths.push(path);
    }
    return paths;
  };

  const handleSubmit = async () => {
    if (!signed) {
      toast({ title: 'Firma requerida', description: 'Debes firmar el reporte antes de enviarlo', variant: 'destructive' });
      return;
    }
    if (!user) return;
    setSubmitting(true);

    // Upload evidence files
    setUploadingFiles(true);
    const evidenciaUrls = await uploadEvidencias();
    setUploadingFiles(false);

    const observacionesConEvidencia = evidenciaUrls.length > 0
      ? `${form.observaciones}\n\n[Evidencias adjuntas: ${evidenciaUrls.join(', ')}]`
      : form.observaciones;

    // Si estamos corrigiendo un reporte con retroalimentación, actualizamos
    // el registro existente y lo devolvemos a estado "pendiente" para que el
    // supervisor lo revise de nuevo. Si no, creamos un reporte nuevo.
    const payload = {
      incidencias: form.incidencias,
      actividades: form.actividades,
      observaciones: observacionesConEvidencia,
      firmado: true,
    };
    const { error } = correctingId
      ? await supabase.from('reportes_turno').update({
          ...payload,
          status: 'pendiente',
          retroalimentacion: null,
        }).eq('id', correctingId).eq('guardia_id', user.id)
      : await supabase.from('reportes_turno').insert({ ...payload, guardia_id: user.id });
    setSubmitting(false);
    if (error) {
      toast({ title: 'Error', description: 'No se pudo enviar el reporte. Intenta de nuevo.', variant: 'destructive' });
      return;
    }
    toast({
      title: correctingId ? '✅ Correcciones enviadas' : '✅ Reporte enviado',
      description: correctingId
        ? 'El supervisor revisará tu reporte corregido.'
        : 'Tu reporte de turno ha sido enviado al supervisor',
    });
    navigate('/dashboard');
  };

  return (
    <div className="min-h-dvh bg-background pb-20">
      <div className="text-primary-foreground px-4 pt-12 pb-6 rounded-b-3xl app-header">
        <div className="max-w-lg mx-auto">
          <button onClick={() => navigate('/dashboard')} className="flex items-center gap-1 text-sm opacity-80 mb-2">
            <ArrowLeft className="w-4 h-4" /> Regresar
          </button>
          <h1 className="text-xl font-display font-bold">
            {correctingId ? 'Corregir Reporte' : 'Reporte de Turno'}
          </h1>
          <p className="text-sm opacity-70 mt-1">Bitácora digital — {new Date().toLocaleDateString('es-MX')}</p>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 mt-4 space-y-4">
        {correctingId && feedback && (
          <div className="bg-emergency/10 border border-emergency/30 rounded-xl p-4 flex gap-3">
            <AlertCircle className="w-5 h-5 text-emergency shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-emergency mb-1">Retroalimentación del supervisor</p>
              <p className="text-sm text-foreground whitespace-pre-wrap">{feedback}</p>
              <p className="text-xs text-muted-foreground mt-2">Corrige tu reporte y envíalo de nuevo.</p>
            </div>
          </div>
        )}
        <div className="bg-card rounded-xl p-4 shadow-card space-y-4">
          <div className="space-y-2">
            <Label>Incidencias</Label>
            <Textarea placeholder="Describe las incidencias ocurridas durante el turno..." value={form.incidencias} onChange={(e) => update('incidencias', e.target.value)} rows={3} className="text-sm" />
          </div>
          <div className="space-y-2">
            <Label>Actividades Realizadas</Label>
            <Textarea placeholder="Lista las actividades realizadas..." value={form.actividades} onChange={(e) => update('actividades', e.target.value)} rows={3} className="text-sm" />
          </div>
          <div className="space-y-2">
            <Label>Observaciones</Label>
            <Textarea placeholder="Observaciones adicionales..." value={form.observaciones} onChange={(e) => update('observaciones', e.target.value)} rows={3} className="text-sm" />
          </div>
        </div>

        <NovedadesTurno />

        <div className="bg-card rounded-xl p-4 shadow-card">
          <Label className="mb-3 block">Adjuntar Evidencias</Label>
          <input ref={fileInputRef} type="file" accept="image/*,video/*,audio/*" multiple className="hidden" onChange={handleFileSelect} />
          <div className="grid grid-cols-3 gap-2">
            <button onClick={() => { if (fileInputRef.current) { fileInputRef.current.accept = 'image/*'; fileInputRef.current.click(); } }} className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-accent hover:bg-accent/80 transition-colors">
              <Camera className="w-5 h-5 text-primary" />
              <span className="text-xs font-semibold text-foreground">Foto</span>
            </button>
            <button onClick={() => { if (fileInputRef.current) { fileInputRef.current.accept = 'video/*'; fileInputRef.current.click(); } }} className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-accent hover:bg-accent/80 transition-colors">
              <Video className="w-5 h-5 text-primary" />
              <span className="text-xs font-semibold text-foreground">Video</span>
            </button>
            <button onClick={() => { if (fileInputRef.current) { fileInputRef.current.accept = 'audio/*'; fileInputRef.current.click(); } }} className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-accent hover:bg-accent/80 transition-colors">
              <Mic className="w-5 h-5 text-primary" />
              <span className="text-xs font-semibold text-foreground">Audio</span>
            </button>
          </div>

          {evidencias.length > 0 && (
            <div className="mt-3 space-y-2">
              {evidencias.map((ev, i) => (
                <div key={i} className="flex items-center gap-2 bg-accent rounded-lg p-2">
                  {ev.preview ? (
                    <img src={ev.preview} alt="" className="w-10 h-10 rounded object-cover" />
                  ) : (
                    <div className="w-10 h-10 rounded bg-muted flex items-center justify-center">
                      <ImageIcon className="w-5 h-5 text-muted-foreground" />
                    </div>
                  )}
                  <span className="text-xs text-foreground flex-1 truncate">{ev.file.name}</span>
                  <button onClick={() => removeFile(i)} className="p-1 text-muted-foreground hover:text-emergency">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-card rounded-xl p-4 shadow-card">
          <Label className="mb-3 block">Firma Digital</Label>
          <button
            onClick={() => setSigned(!signed)}
            className={`w-full h-24 rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-2 transition-colors ${
              signed ? 'border-success bg-success/5' : 'border-border hover:border-primary/50'
            }`}
          >
            <PenTool className={`w-6 h-6 ${signed ? 'text-success' : 'text-muted-foreground'}`} />
            <span className={`text-sm font-semibold ${signed ? 'text-success' : 'text-muted-foreground'}`}>
              {signed ? '✅ Firmado' : 'Toca para firmar'}
            </span>
          </button>
        </div>

        <Button onClick={handleSubmit} className="w-full h-12 text-base font-semibold" disabled={submitting}>
          <Send className="w-4 h-4 mr-2" /> {submitting ? (uploadingFiles ? 'Subiendo evidencias...' : 'Enviando...') : correctingId ? 'Reenviar Reporte' : 'Enviar Reporte'}
        </Button>
      </div>

      <EmergencyButton />
      <BottomNav />
    </div>
  );
};

export default ReporteTurno;
