import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth-context';
import SessionPhotoCapture from '@/components/SessionPhotoCapture';
import {
  CAPTURA_LOGIN_EVENT,
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

  // Captura de ingreso pendiente tras autenticarse. Se revisa al montar/cambiar
  // de usuario y también cuando el login marca la captura (puede ocurrir después
  // de que el perfil ya se cargó) o al volver a la app con la captura pendiente.
  useEffect(() => {
    if (!esGuardia || !user) return;
    const revisar = () => {
      if (capturaLoginPendiente(user.id)) setEvento((prev) => prev ?? 'login');
    };
    revisar();
    window.addEventListener(CAPTURA_LOGIN_EVENT, revisar);
    window.addEventListener('focus', revisar);
    const t = window.setInterval(revisar, 2000);
    return () => {
      window.removeEventListener(CAPTURA_LOGIN_EVENT, revisar);
      window.removeEventListener('focus', revisar);
      window.clearInterval(t);
    };
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
