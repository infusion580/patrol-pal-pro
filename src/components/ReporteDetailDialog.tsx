import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FileText, Clock, CheckCircle2, AlertTriangle, Image as ImageIcon } from 'lucide-react';
import { useState } from 'react';

interface ReporteDetail {
  id: string;
  guardia_nombre?: string;
  actividades: string;
  incidencias: string;
  observaciones: string;
  status: string;
  firmado: boolean;
  retroalimentacion?: string | null;
  created_at: string;
}

interface Props {
  reporte: ReporteDetail | null;
  open: boolean;
  onClose: () => void;
}

const statusMap: Record<string, { label: string; cls: string }> = {
  pendiente: { label: 'Pendiente', cls: 'bg-warning/10 text-warning' },
  aprobado: { label: 'Aprobado', cls: 'bg-success/10 text-success' },
  retroalimentacion: { label: 'Requiere cambios', cls: 'bg-destructive/10 text-destructive' },
};

function extractEvidenceUrls(text: string): string[] {
  const match = text.match(/\[Evidencias adjuntas: (.+?)\]/);
  if (!match) return [];
  return match[1].split(', ').filter(u => u.startsWith('http'));
}

function cleanObservaciones(text: string): string {
  return text.replace(/\n?\n?\[Evidencias adjuntas: .+?\]/, '').trim();
}

const ReporteDetailDialog = ({ reporte, open, onClose }: Props) => {
  const [viewImage, setViewImage] = useState<string | null>(null);

  if (!reporte) return null;

  const evidencias = extractEvidenceUrls(reporte.observaciones || '');
  const obsClean = cleanObservaciones(reporte.observaciones || '');
  const st = statusMap[reporte.status] || statusMap.pendiente;

  return (
    <>
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              Reporte de Turno
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Header info */}
            <div className="flex items-center justify-between">
              <div>
                {reporte.guardia_nombre && (
                  <p className="font-semibold text-sm text-foreground">{reporte.guardia_nombre}</p>
                )}
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {new Date(reporte.created_at).toLocaleString('es-MX', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
              <span className={`text-xs font-semibold px-2 py-1 rounded-full ${st.cls}`}>{st.label}</span>
            </div>

            {/* Actividades */}
            {reporte.actividades && (
              <div className="bg-accent rounded-lg p-3">
                <p className="text-[10px] font-semibold text-muted-foreground mb-1">ACTIVIDADES</p>
                <p className="text-sm text-foreground whitespace-pre-wrap">{reporte.actividades}</p>
              </div>
            )}

            {/* Incidencias */}
            {reporte.incidencias && (
              <div className="bg-destructive/5 rounded-lg p-3 border border-destructive/20">
                <p className="text-[10px] font-semibold text-destructive mb-1 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> INCIDENCIAS
                </p>
                <p className="text-sm text-foreground whitespace-pre-wrap">{reporte.incidencias}</p>
              </div>
            )}

            {/* Observaciones */}
            {obsClean && (
              <div className="bg-accent rounded-lg p-3">
                <p className="text-[10px] font-semibold text-muted-foreground mb-1">OBSERVACIONES</p>
                <p className="text-sm text-foreground whitespace-pre-wrap">{obsClean}</p>
              </div>
            )}

            {/* Evidencias */}
            {evidencias.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold text-muted-foreground mb-2 flex items-center gap-1">
                  <ImageIcon className="w-3 h-3" /> EVIDENCIAS ({evidencias.length})
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {evidencias.map((url, i) => (
                    <button key={i} onClick={() => setViewImage(url)} className="rounded-lg overflow-hidden border border-border">
                      <img src={url} alt={`Evidencia ${i + 1}`} className="w-full h-28 object-cover" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Retroalimentacion */}
            {reporte.retroalimentacion && (
              <div className="bg-primary/5 rounded-lg p-3 border border-primary/20">
                <p className="text-[10px] font-semibold text-primary mb-1">RETROALIMENTACIÓN</p>
                <p className="text-sm text-foreground italic whitespace-pre-wrap">{reporte.retroalimentacion}</p>
              </div>
            )}

            {/* Firma */}
            <div className="flex items-center gap-2 pt-2 border-t border-border">
              <CheckCircle2 className={`w-4 h-4 ${reporte.firmado ? 'text-success' : 'text-muted-foreground'}`} />
              <span className="text-xs text-muted-foreground">{reporte.firmado ? 'Firmado digitalmente' : 'Sin firma'}</span>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Fullscreen image viewer */}
      {viewImage && (
        <div className="fixed inset-0 bg-black/80 z-[200] flex items-center justify-center p-4" onClick={() => setViewImage(null)}>
          <img src={viewImage} alt="Evidencia" className="max-w-full max-h-[80vh] object-contain rounded-lg" />
        </div>
      )}
    </>
  );
};

export default ReporteDetailDialog;
