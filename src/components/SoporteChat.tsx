import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { LifeBuoy, X, Send, Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAuth } from '@/lib/auth-context';
import { getDeviceInfo } from '@/lib/device-info';
import { useToast } from '@/hooks/use-toast';
import {
  construirEnlaceWhatsapp,
  construirMensajeFalla,
  formatSoporteWhatsapp,
  getSoporteWhatsapp,
  setSoporteWhatsapp,
} from '@/lib/soporte-config';

const CATEGORIAS = [
  'No puedo iniciar turno',
  'Problema con rondines / puntos',
  'GPS o ubicación',
  'Cámara o fotos',
  'Notificaciones',
  'Sesión / acceso',
  'App lenta o se cierra',
  'Otro',
];

/**
 * Chat de soporte flotante disponible en toda la app.
 * El reporte se envía por WhatsApp al número de soporte configurado,
 * con el contexto del usuario, pantalla y dispositivo ya incluidos.
 */
const SoporteChat = () => {
  const [open, setOpen] = useState(false);
  const [editando, setEditando] = useState(false);
  const [numero, setNumero] = useState(getSoporteWhatsapp());
  const [numeroDraft, setNumeroDraft] = useState('');
  const [categoria, setCategoria] = useState(CATEGORIAS[0]);
  const [descripcion, setDescripcion] = useState('');
  const { user } = useAuth();
  const { toast } = useToast();
  const location = useLocation();

  useEffect(() => {
    setNumero(getSoporteWhatsapp());
  }, [open]);

  const esAdmin = user?.role === 'admin';

  const enviar = () => {
    const texto = descripcion.trim();
    if (texto.length < 10) {
      toast({
        title: 'Describe la falla',
        description: 'Escribe al menos 10 caracteres para que soporte pueda ayudarte.',
        variant: 'destructive',
      });
      return;
    }
    if (texto.length > 1000) {
      toast({
        title: 'Mensaje muy largo',
        description: 'Resume la falla en menos de 1000 caracteres.',
        variant: 'destructive',
      });
      return;
    }

    const mensaje = construirMensajeFalla(categoria, texto, {
      nombre: user ? `${user.nombre} ${user.apellido}` : undefined,
      numeroEmpleado: user?.numeroEmpleado,
      rol: user?.role,
      ruta: location.pathname,
      dispositivo: getDeviceInfo().label,
    });

    window.open(construirEnlaceWhatsapp(numero, mensaje), '_blank', 'noopener,noreferrer');
    setDescripcion('');
    setOpen(false);
    toast({
      title: 'Abriendo WhatsApp',
      description: 'Envía el mensaje para que soporte reciba tu reporte.',
    });
  };

  const guardarNumero = () => {
    const guardado = setSoporteWhatsapp(numeroDraft);
    if (guardado.length < 11) {
      toast({
        title: 'Número inválido',
        description: 'Incluye LADA y 10 dígitos (ej. 4426356998).',
        variant: 'destructive',
      });
      return;
    }
    setNumero(guardado);
    setEditando(false);
    toast({ title: 'Número de soporte actualizado', description: formatSoporteWhatsapp(guardado) });
  };

  return (
    <>
      {/* Botón flotante */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? 'Cerrar soporte' : 'Reportar una falla'}
        className="fixed bottom-24 right-4 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:bottom-6"
      >
        {open ? <X className="h-6 w-6" /> : <LifeBuoy className="h-6 w-6" />}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Reportar una falla"
          className="fixed bottom-44 right-4 z-50 w-[min(22rem,calc(100vw-2rem))] rounded-xl border border-border bg-card p-4 shadow-xl md:bottom-24"
        >
          <div className="mb-3 flex items-start justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold text-foreground">Reportar una falla</h2>
              <p className="text-xs text-muted-foreground">
                Se envía por WhatsApp a {formatSoporteWhatsapp(numero)}
              </p>
            </div>
            {esAdmin && (
              <Button
                variant="ghost"
                size="icon"
                aria-label="Configurar número de soporte"
                onClick={() => {
                  setNumeroDraft(numero);
                  setEditando((v) => !v);
                }}
              >
                <Settings2 className="h-4 w-4" />
              </Button>
            )}
          </div>

          {editando && esAdmin ? (
            <div className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="soporte-numero">Número de WhatsApp de soporte</Label>
                <Input
                  id="soporte-numero"
                  inputMode="tel"
                  maxLength={20}
                  value={numeroDraft}
                  onChange={(e) => setNumeroDraft(e.target.value)}
                  placeholder="4426356998"
                />
              </div>
              <div className="flex gap-2">
                <Button className="flex-1" onClick={guardarNumero}>
                  Guardar
                </Button>
                <Button variant="outline" onClick={() => setEditando(false)}>
                  Cancelar
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="soporte-categoria">Tipo de falla</Label>
                <Select value={categoria} onValueChange={setCategoria}>
                  <SelectTrigger id="soporte-categoria">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="z-[60] bg-popover">
                    {CATEGORIAS.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label htmlFor="soporte-descripcion">¿Qué pasó?</Label>
                <Textarea
                  id="soporte-descripcion"
                  rows={4}
                  maxLength={1000}
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                  placeholder="Describe la falla con el mayor detalle posible…"
                />
              </div>

              <Button className="w-full" onClick={enviar}>
                <Send className="mr-2 h-4 w-4" />
                Enviar por WhatsApp
              </Button>
              <p className="text-[11px] leading-tight text-muted-foreground">
                Se adjuntan automáticamente tu nombre, rol, pantalla actual y dispositivo.
              </p>
            </div>
          )}
        </div>
      )}
    </>
  );
};

export default SoporteChat;
