import { useState, useEffect, useCallback } from 'react';
import { StickyNote, AlertTriangle, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/hooks/use-toast';
import { loadServiciosParaUsuario } from '@/lib/guardia-servicios';
import { cargarNotasPendientes, marcarNotaLeida, NotaRelevo } from '@/lib/notas-relevo';

/**
 * Muestra al guardia entrante las notas que dejó el turno anterior en sus
 * servicios asignados. Al confirmar, la nota queda marcada como leída.
 */
const NotaRelevoEntrante = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [notas, setNotas] = useState<NotaRelevo[]>([]);

  const cargar = useCallback(async () => {
    if (!user) return;
    const servicios = await loadServiciosParaUsuario(user.id, user.role);
    const ids = servicios.map((s: any) => s.id).filter(Boolean);
    setNotas(await cargarNotasPendientes(ids, user.id));
  }, [user]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const confirmar = async (nota: NotaRelevo) => {
    if (!user) return;
    await marcarNotaLeida(nota.id, user.id);
    setNotas((prev) => prev.filter((n) => n.id !== nota.id));
    toast({ title: 'Nota confirmada', description: 'Se registró que recibiste el relevo.' });
  };

  if (notas.length === 0) return null;

  return (
    <div className="space-y-3 mb-4">
      {notas.map((nota) => (
        <div
          key={nota.id}
          className={`rounded-xl p-4 shadow-card border ${
            nota.importante ? 'bg-warning/10 border-warning/40' : 'bg-card border-border'
          }`}
        >
          <div className="flex items-center gap-2 mb-2">
            {nota.importante ? (
              <AlertTriangle className="w-5 h-5 text-warning" />
            ) : (
              <StickyNote className="w-5 h-5 text-primary" />
            )}
            <h3 className="font-display font-bold text-sm text-foreground">
              Nota del relevo anterior
            </h3>
          </div>

          <p className="text-[11px] text-muted-foreground mb-2">
            {nota.autor_nombre || 'Guardia saliente'} •{' '}
            {new Date(nota.created_at).toLocaleString('es-MX', {
              day: '2-digit',
              month: 'short',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </p>

          {nota.pendientes && (
            <div className="mb-2">
              <p className="text-[11px] font-semibold text-muted-foreground">Pendientes</p>
              <p className="text-sm text-foreground whitespace-pre-wrap">{nota.pendientes}</p>
            </div>
          )}

          {nota.instrucciones && (
            <div className="mb-3">
              <p className="text-[11px] font-semibold text-muted-foreground">Instrucciones importantes</p>
              <p className="text-sm text-foreground whitespace-pre-wrap">{nota.instrucciones}</p>
            </div>
          )}

          <Button size="sm" onClick={() => confirmar(nota)} className="w-full">
            <Check className="w-4 h-4 mr-2" /> Entendido, recibí el relevo
          </Button>
        </div>
      ))}
    </div>
  );
};

export default NotaRelevoEntrante;
