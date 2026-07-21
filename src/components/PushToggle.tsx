/**
 * PushToggle
 * ----------
 * User-facing card that enables or disables Web Push notifications on
 * the current device. Renders a graceful message when the browser does
 * not support the API (Safari iOS < 16.4, private mode, etc.).
 */
import { useEffect, useState } from 'react';
import { Bell, BellOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { enablePush, disablePush, isPushEnabled, isPushSupported } from '@/lib/push-notifications';

function detectContext() {
  if (typeof window === 'undefined') return { supported: false, reason: '' };
  const inIframe = window.self !== window.top;
  const host = window.location.hostname;
  const isPreview =
    host.startsWith('id-preview--') ||
    host.startsWith('preview--') ||
    host.endsWith('.lovableproject.com') ||
    host.endsWith('.lovableproject-dev.com') ||
    host.endsWith('.beta.lovable.dev');
  const ua = navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
  const isStandalone =
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as any).standalone === true;

  if (inIframe || isPreview) {
    return {
      supported: false,
      reason:
        'Las notificaciones push no funcionan dentro del editor/preview de Lovable. Abre la app publicada (guardiadefender.org) en una pestaña normal.',
    };
  }
  if (!isPushSupported()) {
    if (isIOS && !isStandalone) {
      return {
        supported: false,
        reason:
          'En iPhone/iPad debes primero instalar la app: Compartir → Añadir a pantalla de inicio, y abrirla desde el ícono. Requiere iOS 16.4+.',
      };
    }
    return {
      supported: false,
      reason: 'Este navegador no soporta notificaciones push. Usa Chrome, Edge, Firefox o Safari (iOS 16.4+).',
    };
  }
  return { supported: true, reason: '' };
}

export default function PushToggle() {
  const [{ supported, reason }] = useState(detectContext);
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!supported) {
      setLoading(false);
      return;
    }
    isPushEnabled().then((v) => {
      setEnabled(v);
      setLoading(false);
    });
  }, [supported]);

  const handleEnable = async () => {
    setBusy(true);
    const res = await enablePush();
    setBusy(false);
    if (res.ok) {
      setEnabled(true);
      toast.success('Notificaciones push activadas', {
        description: 'Recibirás alertas incluso con la app cerrada.',
      });
    } else {
      toast.error('No se pudieron activar', { description: res.reason });
    }
  };

  const handleDisable = async () => {
    setBusy(true);
    await disablePush();
    setBusy(false);
    setEnabled(false);
    toast.info('Notificaciones push desactivadas');
  };

  if (loading) return null;

  return (
    <div className="bg-card rounded-xl p-4 shadow-card space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {enabled ? <Bell className="w-4 h-4 text-primary" /> : <BellOff className="w-4 h-4 text-muted-foreground" />}
          <h3 className="text-sm font-semibold">Notificaciones push</h3>
        </div>
        <span
          className={`text-xs px-2 py-0.5 rounded-full font-medium ${
            enabled ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
          }`}
        >
          {enabled ? 'Activas' : 'Desactivadas'}
        </span>
      </div>
      <p className="text-xs text-muted-foreground">
        {supported
          ? 'Recibe alertas de turno, rondín y zona en tu dispositivo aunque la app esté cerrada.'
          : reason}
      </p>
      {supported && (
        <Button
          onClick={enabled ? handleDisable : handleEnable}
          disabled={busy}
          variant={enabled ? 'outline' : 'default'}
          className="w-full"
        >
          {busy ? 'Procesando…' : enabled ? 'Desactivar en este dispositivo' : 'Activar en este dispositivo'}
        </Button>
      )}
    </div>
  );
}
