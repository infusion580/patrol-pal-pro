import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth-context';
import SessionPhotoCapture from '@/components/SessionPhotoCapture';
import {
  capturaLoginPendiente,
  limpiarCapturaLoginPendiente,
  registrarSesion,
  setLogoutCaptureHandler,
  type SesionEvento,
} from '@/lib/sesion-registros';

/**
 * Puerta de validación fotográfica de sesión (solo guardias).
 * - Al iniciar sesión: bloquea la app hasta tomar la foto de ingreso.
 * - Al cerrar sesión: `logout()` espera aquí la foto de salida.
 */
export function SessionCaptureGate() {
  const { user } = useAuth();
  const [evento, setEvento] = useState<SesionEvento | null>(null);
  const logoutResolver = useRef<((ok: boolean) => void) | null>(null);

  const esGuardia = user?.role === 'guardia';

  // Captura de ingreso pendiente tras autenticarse.
  useEffect(() => {
    if (esGuardia && user && capturaLoginPendiente(user.id)) setEvento('login');
  }, [esGuardia, user]);

  // Captura de cierre: expone el handler que `logout()` invoca.
  useEffect(() => {
    if (!esGuardia) {
      setLogoutCaptureHandler(null);
      return;
    }
    setLogoutCaptureHandler(
      () =>
        new Promise<boolean>((resolve) => {
          logoutResolver.current = resolve;
          setEvento('logout');
        }),
    );
    return () => setLogoutCaptureHandler(null);
  }, [esGuardia]);

  const handleConfirm = useCallback(
    async (foto: Blob) => {
      if (!user || !evento) return;
      try {
        await registrarSesion({ userId: user.id, evento, foto });
      } catch {
        toast.error('No se pudo guardar el registro completo de sesión');
      }
      if (evento === 'login') {
        limpiarCapturaLoginPendiente();
        toast.success('Ingreso validado con fotografía y ubicación');
      } else {
        logoutResolver.current?.(true);
        logoutResolver.current = null;
      }
      setEvento(null);
    },
    [evento, user],
  );

  const handleCancel = useCallback(() => {
    if (evento === 'logout') {
      logoutResolver.current?.(false);
      logoutResolver.current = null;
      setEvento(null);
    }
  }, [evento]);

  if (!evento || !user) return null;

  return (
    <SessionPhotoCapture
      evento={evento}
      nombre={`${user.nombre} ${user.apellido}`.trim() || user.email}
      onConfirm={handleConfirm}
      onCancel={evento === 'logout' ? handleCancel : undefined}
    />
  );
}

export default SessionCaptureGate;
