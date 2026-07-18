import { useState, useEffect } from 'react';
import { ArrowLeft, CheckCircle2, XCircle, Clock, FileText, MessageCircle, Eye, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useNavigate, Navigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { notifyReporteAprobado, notifyReporteRetro } from '@/lib/notification-helpers';
import BottomNav from '@/components/BottomNav';
import ReporteDetailDialog from '@/components/ReporteDetailDialog';

interface Report {
  id: string;
  guardia: string;
  guardia_id: string;
  fecha: string;
  status: string;
  incidencias: string;
  actividades: string;
  observaciones: string;
  firmado: boolean;
  retroalimentacion: string | null;
  created_at: string;
}

const statusConfig: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  pendiente: { label: 'Pendiente', color: 'text-warning', bg: 'bg-warning/10', icon: Clock },
  aprobado: { label: 'Aprobado', color: 'text-success', bg: 'bg-success/10', icon: CheckCircle2 },
  retroalimentacion: { label: 'Requiere cambios', color: 'text-emergency', bg: 'bg-emergency/10', icon: MessageCircle },
};

const ReportesSupervisor = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const [filter, setFilter] = useState<'todos' | 'pendiente' | 'aprobado'>('todos');
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState<any>(null);
  const [feedbackDialogOpen, setFeedbackDialogOpen] = useState(false);
  const [feedbackReportId, setFeedbackReportId] = useState<string | null>(null);
  const [feedbackText, setFeedbackText] = useState('');
  const [sendingFeedback, setSendingFeedback] = useState(false);

  useEffect(() => { loadReports(); }, []);

  const loadReports = async () => {
    const { data } = await supabase
      .from('reportes_turno')
      .select('*')
      .order('created_at', { ascending: false });

    if (data) {
      const guardIds = [...new Set(data.map(r => r.guardia_id))];
      const { data: profiles } = guardIds.length > 0
        ? await supabase.from('profiles').select('user_id, nombre, apellido').in('user_id', guardIds)
        : { data: [] };
      const profileMap = new Map((profiles || []).map(p => [p.user_id, `${p.nombre} ${p.apellido}`] as const));

      setReports(data.map(r => ({
        id: r.id,
        guardia: profileMap.get(r.guardia_id) || 'Guardia',
        guardia_id: r.guardia_id,
        fecha: new Date(r.created_at).toLocaleDateString('es-MX'),
        status: r.status,
        incidencias: r.incidencias,
        actividades: r.actividades,
        observaciones: r.observaciones,
        firmado: r.firmado,
        retroalimentacion: r.retroalimentacion,
        created_at: r.created_at,
      })));
    }
    setLoading(false);
  };

  const handleApprove = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await supabase.from('reportes_turno').update({ status: 'aprobado', revisado_por: user?.id }).eq('id', id);
    toast({ title: '✅ Reporte aprobado' });
    loadReports();
  };

  const openFeedbackDialog = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setFeedbackReportId(id);
    setFeedbackText('');
    setFeedbackDialogOpen(true);
  };

  const handleSendFeedback = async () => {
    if (!feedbackReportId || !feedbackText.trim()) return;
    setSendingFeedback(true);
    await supabase.from('reportes_turno').update({
      status: 'retroalimentacion',
      revisado_por: user?.id,
      retroalimentacion: feedbackText.trim(),
    }).eq('id', feedbackReportId);
    toast({ title: '📝 Retroalimentación enviada' });
    setFeedbackDialogOpen(false);
    setSendingFeedback(false);
    loadReports();
  };

  const openReport = (report: Report) => {
    setSelectedReport({
      ...report,
      guardia_nombre: report.guardia,
    });
  };

  const filtered = filter === 'todos' ? reports : reports.filter(r => r.status === filter);
  const pendingCount = reports.filter(r => r.status === 'pendiente').length;

  // Role guard: guards cannot approve/feedback reports
  if (user && user.role !== 'supervisor' && user.role !== 'admin') {
    return <Navigate to="/dashboard" replace />;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="text-primary-foreground px-4 pt-12 pb-6 rounded-b-3xl app-header">
        <div className="max-w-lg mx-auto">
          <button onClick={() => navigate('/dashboard')} className="flex items-center gap-1 text-sm opacity-80 mb-2">
            <ArrowLeft className="w-4 h-4" /> Regresar
          </button>
          <h1 className="text-xl font-display font-bold">Reportes de Turno</h1>
          <p className="text-sm opacity-70 mt-1">{pendingCount} pendientes de revisión</p>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 -mt-4">
        <div className="bg-card rounded-xl p-2 shadow-card mb-4 flex gap-1">
          {(['todos', 'pendiente', 'aprobado'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)} className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-colors ${filter === f ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
              {f === 'todos' ? 'Todos' : f === 'pendiente' ? 'Pendientes' : 'Aprobados'}
            </button>
          ))}
        </div>

        <div className="space-y-3">
          {filtered.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">No hay reportes</p>
          )}
          {filtered.map(report => {
            const status = statusConfig[report.status] || statusConfig.pendiente;
            const StatusIcon = status.icon;
            return (
              <button key={report.id} onClick={() => openReport(report)} className="w-full text-left bg-card rounded-xl p-4 shadow-card hover:shadow-elevated transition-shadow">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-semibold text-sm text-foreground">{report.guardia}</p>
                    <p className="text-xs text-muted-foreground">{report.fecha}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-semibold px-2 py-1 rounded-full ${status.bg} ${status.color} flex items-center gap-1`}>
                      <StatusIcon className="w-3 h-3" />
                      {status.label}
                    </span>
                    <Eye className="w-4 h-4 text-primary" />
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
                  <FileText className="w-3 h-3" />
                  <span>{report.incidencias ? 'Con incidencias' : 'Sin incidencias'}</span>
                </div>

                {report.actividades && (
                  <p className="text-xs text-foreground line-clamp-2 mb-3">{report.actividades}</p>
                )}

                {report.retroalimentacion && report.status === 'retroalimentacion' && (
                  <div className="bg-emergency/5 border border-emergency/20 rounded-lg p-2 mb-3">
                    <p className="text-xs font-semibold text-emergency mb-1">Retroalimentación:</p>
                    <p className="text-xs text-foreground">{report.retroalimentacion}</p>
                  </div>
                )}

                {report.status === 'pendiente' && (
                  <div className="flex gap-2">
                    <Button size="sm" className="flex-1 h-9 text-xs bg-success text-success-foreground hover:bg-success/90" onClick={(e) => handleApprove(report.id, e)}>
                      <CheckCircle2 className="w-3 h-3 mr-1" /> Aprobar
                    </Button>
                    <Button size="sm" variant="outline" className="flex-1 h-9 text-xs" onClick={(e) => openFeedbackDialog(report.id, e)}>
                      <MessageCircle className="w-3 h-3 mr-1" /> Retroalimentar
                    </Button>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <Dialog open={feedbackDialogOpen} onOpenChange={setFeedbackDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageCircle className="w-5 h-5 text-primary" />
              Escribir retroalimentación
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Describe los cambios o correcciones que el guardia debe realizar en su reporte.
            </p>
            <Textarea
              placeholder="Ej: Falta detallar la hora exacta de la incidencia reportada en el acceso principal..."
              value={feedbackText}
              onChange={(e) => setFeedbackText(e.target.value)}
              rows={4}
              maxLength={1000}
            />
            <p className="text-xs text-muted-foreground text-right">{feedbackText.length}/1000</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFeedbackDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSendFeedback} disabled={!feedbackText.trim() || sendingFeedback}>
              <Send className="w-4 h-4 mr-1" />
              {sendingFeedback ? 'Enviando...' : 'Enviar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ReporteDetailDialog reporte={selectedReport} open={!!selectedReport} onClose={() => setSelectedReport(null)} />
      <BottomNav />
    </div>
  );
};

export default ReportesSupervisor;
