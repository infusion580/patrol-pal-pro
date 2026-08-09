import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { HelpCircle, X, Send, Copy, ExternalLink } from 'lucide-react';
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
import { supabase } from '@/integrations/supabase/client';
import { getDeviceInfo } from '@/lib/device-info';
import { useToast } from '@/hooks/use-toast';
import {
  construirEnlaceWhatsapp,
  construirEnlaceWhatsappAlterno,
  construirMensajeFalla,
  fetchSoporteWhatsapp,
  formatSoporteWhatsapp,
  getSoporteWhatsapp,
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
  const [numero, setNumero] = useState(getSoporteWhatsapp());
  const [nombre, setNombre] = useState('');
  const [servicio, setServicio] = useState('');
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

  // Prellena nombre y servicio del usuario; ambos siguen siendo editables por si
  // el reporte lo levanta alguien más o desde otro puesto.
  useEffect(() => {
    if (!open || !user) return;
    let activo = true;
    setNombre((prev) => prev || `${user.nombre} ${user.apellido}`.trim());

    (async () => {
      const { data: perfil } = await supabase
        .from('profiles')
        .select('servicio_asignado_id')
        .eq('user_id', user.id)
        .maybeSingle();
      if (!perfil?.servicio_asignado_id) return;
      const { data: srv } = await supabase
        .from('servicios')
        .select('nombre, cliente')
        .eq('id', perfil.servicio_asignado_id)
        .maybeSingle();
      if (activo && srv) setServicio((prev) => prev || `${srv.nombre} (${srv.cliente})`);
    })();

    return () => {
      activo = false;
    };
  }, [open, user]);

  const enviar = () => {
    const texto = descripcion.trim();
    if (nombre.trim().length < 3) {
      toast({
        title: 'Escribe tu nombre',
        description: 'Soporte necesita saber quién reporta la falla.',
        variant: 'destructive',
      });
      return;
    }
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
      nombre: nombre.trim(),
      numeroEmpleado: user?.numeroEmpleado,
      rol: user?.role,
      servicio: servicio.trim() || undefined,
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
          </div>

          <div className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="soporte-nombre">Tu nombre</Label>
                <Input
                  id="soporte-nombre"
                  maxLength={80}
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  placeholder="Nombre y apellido"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="soporte-servicio">Servicio / puesto</Label>
                <Input
                  id="soporte-servicio"
                  maxLength={80}
                  value={servicio}
                  onChange={(e) => setServicio(e.target.value)}
                  placeholder="Ej. Plaza Norte"
                />
              </div>

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
                Se adjuntan automáticamente tu rol, servicio, pantalla y dispositivo.
              </p>
          </div>
        </div>
      )}
    </>
  );
};

export default SoporteChat;
