import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { HelpCircle, X, Send, Settings2, Copy, ExternalLink } from 'lucide-react';
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
  construirEnlaceWhatsappAlterno,
  construirMensajeFalla,
  fetchSoporteWhatsapp,
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
 *
 * Si el navegador o la red bloquean WhatsApp, se muestra un panel alterno
 * con el enlace directo y la opción de copiar el mensaje.
 */
const SoporteChat = () => {
  const [open, setOpen] = useState(false);
  const [editando, setEditando] = useState(false);
  const [numero, setNumero] = useState(getSoporteWhatsapp());
  const [numeroDraft, setNumeroDraft] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [categoria, setCategoria] = useState(CATEGORIAS[0]);
  const [descripcion, setDescripcion] = useState('');
  const [fallback, setFallback] = useState<{ mensaje: string; enlace: string } | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();
  const location = useLocation();

  useEffect(() => {
    if (!open) return;
    let activo = true;
    fetchSoporteWhatsapp().then((n) => {
      if (activo) setNumero(n);
    });
    return () => {
      activo = false;
    };
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

    const enlace = construirEnlaceWhatsapp(numero, mensaje);
    const ventana = window.open(enlace, '_blank', 'noopener,noreferrer');

    // Si el navegador bloquea la ventana (o WhatsApp no carga), dejamos el
    // respaldo visible para copiar el mensaje o abrir el enlace manualmente.
    setFallback({ mensaje, enlace });

    if (!ventana) {
      toast({
        title: 'No se pudo abrir WhatsApp',
        description: 'Usa el enlace de respaldo o copia el mensaje.',
        variant: 'destructive',
      });
      return;
    }

    toast({
      title: 'Abriendo WhatsApp',
      description: 'Envía el mensaje para que soporte reciba tu reporte.',
    });
  };

  const copiarMensaje = async () => {
    if (!fallback) return;
    try {
      await navigator.clipboard.writeText(fallback.mensaje);
      toast({ title: 'Mensaje copiado', description: 'Pégalo en WhatsApp y envíalo a soporte.' });
    } catch {
      toast({
        title: 'No se pudo copiar',
        description: 'Selecciona el texto manualmente.',
        variant: 'destructive',
      });
    }
  };

  const guardarNumero = async () => {
    setGuardando(true);
    try {
      const guardado = await setSoporteWhatsapp(numeroDraft);
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
      toast({
        title: 'Número de soporte actualizado',
        description: formatSoporteWhatsapp(guardado),
      });
    } catch {
      toast({
        title: 'No se pudo guardar',
        description: 'Solo el administrador puede cambiar el número de soporte.',
        variant: 'destructive',
      });
    } finally {
      setGuardando(false);
    }
  };

  return (
    <>
      {/* Botón flotante de ayuda */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? 'Cerrar ayuda' : 'Ayuda y reporte de fallas'}
        title="Ayuda y reporte de fallas"
        className="fixed left-3 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:left-4 sm:h-14 sm:w-14"
        style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 5.5rem)' }}
      >
        {open ? <X className="h-6 w-6" /> : <HelpCircle className="h-6 w-6" />}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Ayuda y reporte de fallas"
          className="fixed left-3 right-3 z-50 max-h-[70dvh] overflow-y-auto rounded-xl border border-border bg-card p-4 shadow-xl sm:left-4 sm:right-auto sm:w-[22rem]"
          style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 9.5rem)' }}
        >
          <div className="mb-3 flex items-start justify-between gap-2">
            <div>
              <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
                <HelpCircle className="h-4 w-4 text-primary" />
                Ayuda · Reportar una falla
              </h2>
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
                <p className="text-[11px] text-muted-foreground">
                  Aplica para todos los usuarios de la app.
                </p>
              </div>
              <div className="flex gap-2">
                <Button className="flex-1" onClick={guardarNumero} disabled={guardando}>
                  {guardando ? 'Guardando…' : 'Guardar'}
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

              {fallback && (
                <div className="space-y-2 rounded-lg border border-border bg-muted/40 p-3">
                  <p className="text-[11px] leading-tight text-muted-foreground">
                    ¿WhatsApp no abrió o tu red lo bloquea? Copia el mensaje y envíalo al{' '}
                    {formatSoporteWhatsapp(numero)}.
                  </p>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="flex-1" onClick={copiarMensaje}>
                      <Copy className="mr-2 h-4 w-4" />
                      Copiar mensaje
                    </Button>
                    <Button variant="outline" size="sm" asChild>
                      <a
                        href={construirEnlaceWhatsappAlterno(numero, fallback.mensaje)}
                        aria-label="Abrir la app de WhatsApp"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </Button>
                  </div>
                </div>
              )}

              <p className="text-[11px] leading-tight text-muted-foreground">
                Se adjuntan automáticamente tu nombre, rol, pantalla y dispositivo.
              </p>
            </div>
          )}
        </div>
      )}
    </>
  );
};

export default SoporteChat;
