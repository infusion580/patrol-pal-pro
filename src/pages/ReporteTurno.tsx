import { useState } from 'react';
import { ArrowLeft, Camera, Mic, Video, PenTool, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth-context';
import BottomNav from '@/components/BottomNav';
import EmergencyButton from '@/components/EmergencyButton';

const ReporteTurno = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const [form, setForm] = useState({
    incidencias: '',
    actividades: '',
    observaciones: '',
  });
  const [signed, setSigned] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const update = (field: string, value: string) => setForm(prev => ({ ...prev, [field]: value }));

  const handleSubmit = async () => {
    if (!signed) {
      toast({ title: 'Firma requerida', description: 'Debes firmar el reporte antes de enviarlo', variant: 'destructive' });
      return;
    }
    if (!user) return;
    setSubmitting(true);
    const { error } = await supabase.from('reportes_turno').insert({
      guardia_id: user.id,
      incidencias: form.incidencias,
      actividades: form.actividades,
      observaciones: form.observaciones,
      firmado: true,
    });
    setSubmitting(false);
    if (error) {
      console.error(error);
      toast({ title: 'Error', description: 'No se pudo enviar el reporte. Intenta de nuevo.', variant: 'destructive' });
      return;
    }
    toast({ title: '✅ Reporte enviado', description: 'Tu reporte de turno ha sido enviado al supervisor' });
    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="bg-primary text-primary-foreground px-4 pt-12 pb-6 rounded-b-3xl">
        <div className="max-w-lg mx-auto">
          <button onClick={() => navigate('/dashboard')} className="flex items-center gap-1 text-sm opacity-80 mb-2">
            <ArrowLeft className="w-4 h-4" /> Regresar
          </button>
          <h1 className="text-xl font-display font-bold">Reporte de Turno</h1>
          <p className="text-sm opacity-70 mt-1">Bitácora digital — {new Date().toLocaleDateString('es-MX')}</p>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 mt-4 space-y-4">
        <div className="bg-card rounded-xl p-4 shadow-card space-y-4">
          <div className="space-y-2">
            <Label>Incidencias</Label>
            <Textarea placeholder="Describe las incidencias ocurridas durante el turno..." value={form.incidencias} onChange={e => update('incidencias', e.target.value)} rows={3} className="text-sm" />
          </div>
          <div className="space-y-2">
            <Label>Actividades Realizadas</Label>
            <Textarea placeholder="Lista las actividades realizadas..." value={form.actividades} onChange={e => update('actividades', e.target.value)} rows={3} className="text-sm" />
          </div>
          <div className="space-y-2">
            <Label>Observaciones</Label>
            <Textarea placeholder="Observaciones adicionales..." value={form.observaciones} onChange={e => update('observaciones', e.target.value)} rows={3} className="text-sm" />
          </div>
        </div>

        <div className="bg-card rounded-xl p-4 shadow-card">
          <Label className="mb-3 block">Adjuntar Evidencias</Label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { icon: Camera, label: 'Foto' },
              { icon: Video, label: 'Video' },
              { icon: Mic, label: 'Audio' },
            ].map(item => (
              <button key={item.label} className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-accent hover:bg-accent/80 transition-colors">
                <item.icon className="w-5 h-5 text-primary" />
                <span className="text-xs font-semibold text-foreground">{item.label}</span>
              </button>
            ))}
          </div>
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
          <Send className="w-4 h-4 mr-2" /> {submitting ? 'Enviando...' : 'Enviar Reporte'}
        </Button>
      </div>

      <EmergencyButton />
      <BottomNav />
    </div>
  );
};

export default ReporteTurno;
