import { supabase } from '@/integrations/supabase/client';
import { compressImage } from '@/lib/image-compress';
import { getDeviceInfo } from '@/lib/device-info';

/**
 * Registro de sesión con validación fotográfica
 * ---------------------------------------------
 * Cada inicio y cierre de sesión del guardia queda registrado con:
 * foto tomada en vivo (nunca de galería), fecha/hora, usuario,
 * coordenadas GPS + precisión e información del dispositivo.
 */

export type SesionEvento = 'login' | 'logout';

export interface SesionRegistro {
  id: string;
  user_id: string;
  evento: SesionEvento;
  foto_url: string | null;
  lat: number | null;
  lng: number | null;
  precision_metros: number | null;
  ubicacion_error: string | null;
  dispositivo: Record<string, unknown> | null;
  created_at: string;
}

export interface PosicionCapturada {
  lat: number | null;
  lng: number | null;
  precision: number | null;
  error: string | null;
}

/** Obtiene ubicación con precisión; nunca lanza, describe el error si falla. */
export function capturarUbicacion(): Promise<PosicionCapturada> {
  if (!('geolocation' in navigator)) {
    return Promise.resolve({ lat: null, lng: null, precision: null, error: 'Dispositivo sin GPS' });
  }
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          precision: typeof pos.coords.accuracy === 'number' ? Math.round(pos.coords.accuracy) : null,
          error: null,
        }),
      (err) =>
        resolve({
          lat: null,
          lng: null,
          precision: null,
          error:
            err.code === err.PERMISSION_DENIED
              ? 'Permiso de ubicación denegado'
              : err.code === err.TIMEOUT
                ? 'Tiempo de espera agotado al obtener ubicación'
                : 'Ubicación no disponible',
        }),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    );
  });
}

/** Sube la foto de sesión al bucket privado `evidencias` y devuelve su ruta. */
export async function subirFotoSesion(userId: string, evento: SesionEvento, blob: Blob): Promise<string | null> {
  try {
    const comprimida = await compressImage(blob, { maxWidth: 1024, quality: 0.7 });
    const path = `${userId}/sesiones/${evento}-${Date.now()}.jpg`;
    const { error } = await supabase.storage
      .from('evidencias')
      .upload(path, comprimida, { contentType: 'image/jpeg', upsert: false });
    if (error) throw error;
    return path;
  } catch {
    return null;
  }
}

export interface RegistrarSesionInput {
  userId: string;
  evento: SesionEvento;
  foto: Blob | null;
}

/** Registra el evento de sesión completo (foto + ubicación + dispositivo). */
export async function registrarSesion({ userId, evento, foto }: RegistrarSesionInput): Promise<void> {
  const [fotoPath, pos] = await Promise.all([
    foto ? subirFotoSesion(userId, evento, foto) : Promise.resolve(null),
    capturarUbicacion(),
  ]);

  const dispositivo = getDeviceInfo();

  await supabase.from('sesion_registros').insert({
    user_id: userId,
    evento,
    foto_url: fotoPath,
    lat: pos.lat,
    lng: pos.lng,
    precision_metros: pos.precision,
    ubicacion_error: pos.error,
    dispositivo: dispositivo as unknown as Record<string, unknown>,
  } as never);
}

export interface SesionFiltros {
  desde?: string | null; // YYYY-MM-DD
  hasta?: string | null; // YYYY-MM-DD
  userId?: string | null;
  evento?: SesionEvento | null;
}

export async function listSesionRegistros(filtros: SesionFiltros = {}): Promise<SesionRegistro[]> {
  let q = supabase
    .from('sesion_registros')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(500);
  if (filtros.desde) q = q.gte('created_at', new Date(`${filtros.desde}T00:00:00`).toISOString());
  if (filtros.hasta) q = q.lte('created_at', new Date(`${filtros.hasta}T23:59:59.999`).toISOString());
  if (filtros.userId) q = q.eq('user_id', filtros.userId);
  if (filtros.evento) q = q.eq('evento', filtros.evento);
  const { data, error } = await q;
  if (error) throw error;
  return (data as unknown as SesionRegistro[]) || [];
}

/* ------------------------------------------------------------------ */
/* Coordinación con el flujo de autenticación                          */
/* ------------------------------------------------------------------ */

const PENDING_KEY = 'defender-sesion-foto-pendiente';

/** Marca que, tras autenticarse, falta la captura fotográfica de ingreso. */
export function marcarCapturaLoginPendiente(userId: string) {
  try {
    localStorage.setItem(PENDING_KEY, userId);
  } catch {
    /* ignore */
  }
}

export function capturaLoginPendiente(userId: string): boolean {
  try {
    return localStorage.getItem(PENDING_KEY) === userId;
  } catch {
    return false;
  }
}

export function limpiarCapturaLoginPendiente() {
  try {
    localStorage.removeItem(PENDING_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * Hook de cierre de sesión: la UI registra aquí el pedido de foto para que
 * `logout()` lo ejecute antes de invalidar el token (RLS exige sesión activa).
 * Devuelve `false` si el usuario cancela el cierre de sesión.
 */
type LogoutCaptureHandler = () => Promise<boolean>;
const bus = globalThis as unknown as { __sesionLogoutCapture?: LogoutCaptureHandler | null };

export function setLogoutCaptureHandler(handler: LogoutCaptureHandler | null) {
  bus.__sesionLogoutCapture = handler;
}

export function getLogoutCaptureHandler(): LogoutCaptureHandler | null {
  return bus.__sesionLogoutCapture ?? null;
}
