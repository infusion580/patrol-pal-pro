import { useState } from 'react';
import { ArrowLeft, CheckCircle2, XCircle, Clock, FileText, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import BottomNav from '@/components/BottomNav';

const reports = [
  { id: 1, guardia: 'Carlos López', fecha: '03/03/2026', turno: 'Matutino', status: 'pendiente', incidencias: 0 },
  { id: 2, guardia: 'Pedro Martínez', fecha: '03/03/2026', turno: 'Vespertino', status: 'pendiente', incidencias: 1 },
  { id: 3, guardia: 'Ana Rodríguez', fecha: '02/03/2026', turno: 'Nocturno', status: 'aprobado', incidencias: 0 },
  { id: 4, guardia: 'Luis Hernández', fecha: '02/03/2026', turno: 'Matutino', status: 'retroalimentacion', incidencias: 2 },
];

const statusConfig: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  pendiente: { label: 'Pendiente', color: 'text-warning', bg: 'bg-warning/10', icon: Clock },
  aprobado: { label: 'Aprobado', color: 'text-success', bg: 'bg-success/10', icon: CheckCircle2 },
  retroalimentacion: { label: 'Requiere cambios', color: 'text-emergency', bg: 'bg-emergency/10', icon: MessageCircle },
};

const ReportesSupervisor = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [filter, setFilter] = useState<'todos' | 'pendiente' | 'aprobado'>('todos');

  const filtered = filter === 'todos' ? reports : reports.filter(r => r.status === filter);

  const handleApprove = (id: number) => {
    toast({ title: '✅ Reporte aprobado', description: `Reporte #${id} ha sido aprobado` });
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="bg-primary text-primary-foreground px-4 pt-12 pb-6 rounded-b-3xl">
        <div className="max-w-lg mx-auto">
          <button onClick={() => navigate('/dashboard')} className="flex items-center gap-1 text-sm opacity-80 mb-2">
            <ArrowLeft className="w-4 h-4" /> Regresar
          </button>
          <h1 className="text-xl font-display font-bold">Reportes de Turno</h1>
          <p className="text-sm opacity-70 mt-1">{reports.filter(r => r.status === 'pendiente').length} pendientes de revisión</p>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 -mt-4">
        {/* Filters */}
        <div className="bg-card rounded-xl p-2 shadow-card mb-4 flex gap-1">
          {(['todos', 'pendiente', 'aprobado'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-colors ${
                filter === f ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {f === 'todos' ? 'Todos' : f === 'pendiente' ? 'Pendientes' : 'Aprobados'}
            </button>
          ))}
        </div>

        {/* Reports */}
        <div className="space-y-3">
          {filtered.map(report => {
            const status = statusConfig[report.status];
            const StatusIcon = status.icon;
            return (
              <div key={report.id} className="bg-card rounded-xl p-4 shadow-card">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-semibold text-sm text-foreground">{report.guardia}</p>
                    <p className="text-xs text-muted-foreground">{report.fecha} — Turno {report.turno}</p>
                  </div>
                  <span className={`text-xs font-semibold px-2 py-1 rounded-full ${status.bg} ${status.color} flex items-center gap-1`}>
                    <StatusIcon className="w-3 h-3" />
                    {status.label}
                  </span>
                </div>

                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
                  <FileText className="w-3 h-3" />
                  <span>{report.incidencias} incidencia(s)</span>
                </div>

                {report.status === 'pendiente' && (
                  <div className="flex gap-2">
                    <Button size="sm" className="flex-1 h-9 text-xs bg-success text-success-foreground hover:bg-success/90" onClick={() => handleApprove(report.id)}>
                      <CheckCircle2 className="w-3 h-3 mr-1" /> Aprobar
                    </Button>
                    <Button size="sm" variant="outline" className="flex-1 h-9 text-xs">
                      <MessageCircle className="w-3 h-3 mr-1" /> Retroalimentar
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <BottomNav />
    </div>
  );
};

export default ReportesSupervisor;
