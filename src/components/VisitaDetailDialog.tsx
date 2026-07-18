import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Users, Clock, Car, CreditCard, LogOut } from 'lucide-react';
import { useState } from 'react';
import { SignedImg } from '@/components/SignedImg';
import { getSignedUrl } from '@/lib/storage-helpers';

interface VisitaDetail {
  id: string;
  nombre_visitante: string;
  motivo: string;
  foto_placa_url: string;
  foto_ine_url: string;
  foto_salida_url: string;
  hora_entrada: string;
  hora_salida: string | null;
  status: string;
  guardia_nombre?: string;
}

interface Props {
  visita: VisitaDetail | null;
  open: boolean;
  onClose: () => void;
}

const VisitaDetailDialog = ({ visita, open, onClose }: Props) => {
  const [viewImage, setViewImage] = useState<string | null>(null);

  if (!visita) return null;

  const photos = [
    { label: 'INE / Identificación', url: visita.foto_ine_url, icon: CreditCard },
    { label: 'Placa Vehicular', url: visita.foto_placa_url, icon: Car },
    { label: 'Foto de Salida', url: visita.foto_salida_url, icon: LogOut },
  ].filter(p => p.url);

  return (
    <>
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              Detalle de Visita
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Visitor info */}
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-foreground">{visita.nombre_visitante}</p>
                {visita.guardia_nombre && (
                  <p className="text-xs text-muted-foreground">Registró: {visita.guardia_nombre}</p>
                )}
              </div>
              <span className={`text-xs font-semibold px-2 py-1 rounded-full ${visita.status === 'dentro' ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'}`}>
                {visita.status === 'dentro' ? 'DENTRO' : 'SALIÓ'}
              </span>
            </div>

            {/* Times */}
            <div className="bg-accent rounded-lg p-3 space-y-1">
              <p className="text-xs text-foreground flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-primary" />
                <span className="font-semibold">Entrada:</span>
                {new Date(visita.hora_entrada).toLocaleString('es-MX', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </p>
              {visita.hora_salida && (
                <p className="text-xs text-foreground flex items-center gap-2">
                  <LogOut className="w-3.5 h-3.5 text-destructive" />
                  <span className="font-semibold">Salida:</span>
                  {new Date(visita.hora_salida).toLocaleString('es-MX', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </p>
              )}
            </div>

            {/* Motivo */}
            {visita.motivo && (
              <div className="bg-accent rounded-lg p-3">
                <p className="text-[10px] font-semibold text-muted-foreground mb-1">MOTIVO DE VISITA</p>
                <p className="text-sm text-foreground">{visita.motivo}</p>
              </div>
            )}

            {/* Photos */}
            {photos.length > 0 && (
              <div className="space-y-3">
                <p className="text-[10px] font-semibold text-muted-foreground">FOTOGRAFÍAS</p>
                {photos.map((photo, i) => {
                  const Icon = photo.icon;
                  return (
                    <div key={i}>
                      <p className="text-xs font-semibold text-foreground mb-1 flex items-center gap-1">
                        <Icon className="w-3.5 h-3.5 text-primary" /> {photo.label}
                      </p>
                      <button
                        onClick={async () => {
                          const u = await getSignedUrl('visitas', photo.url);
                          if (u) setViewImage(u);
                        }}
                        className="w-full rounded-lg overflow-hidden border border-border"
                      >
                        <SignedImg bucket="visitas" path={photo.url} alt={photo.label} className="w-full h-48 object-cover" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {viewImage && (
        <div className="fixed inset-0 bg-black/80 z-[200] flex items-center justify-center p-4" onClick={() => setViewImage(null)}>
          <img src={viewImage} alt="Foto" className="max-w-full max-h-[80vh] object-contain rounded-lg" />
        </div>
      )}
    </>
  );
};

export default VisitaDetailDialog;
