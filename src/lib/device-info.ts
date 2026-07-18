/**
 * Extrae información básica del dispositivo/navegador para auditoría.
 * Se anexa a notificaciones (login, turnos, rondines, reportes, etc.)
 * para que quede constancia desde qué equipo se generó el evento.
 */
export interface DeviceInfo {
  label: string;      // Etiqueta legible: "iPhone · Safari"
  device: string;     // Móvil / Tablet / Escritorio
  os: string;         // iOS / Android / Windows / macOS / Linux
  browser: string;    // Chrome / Safari / Firefox / Edge
  platform: string;   // Modelo si UA lo expone (iPhone, Pixel, etc.)
  ua: string;         // User-agent original
}

function detectOS(ua: string): { os: string; platform: string } {
  if (/iPhone/i.test(ua)) return { os: 'iOS', platform: 'iPhone' };
  if (/iPad/i.test(ua)) return { os: 'iPadOS', platform: 'iPad' };
  if (/Android/i.test(ua)) {
    const m = ua.match(/Android[^;]*;\s*([^)]+?)\s+Build/i) || ua.match(/;\s*([^;)]+)\)\s+AppleWebKit/i);
    return { os: 'Android', platform: (m?.[1] || 'Android').trim() };
  }
  if (/Windows NT/i.test(ua)) return { os: 'Windows', platform: 'PC' };
  if (/Mac OS X/i.test(ua)) return { os: 'macOS', platform: 'Mac' };
  if (/Linux/i.test(ua)) return { os: 'Linux', platform: 'Linux' };
  return { os: 'Desconocido', platform: 'Desconocido' };
}

function detectBrowser(ua: string): string {
  if (/Edg\//i.test(ua)) return 'Edge';
  if (/OPR\//i.test(ua)) return 'Opera';
  if (/Chrome\//i.test(ua) && !/Chromium/i.test(ua)) return 'Chrome';
  if (/Firefox\//i.test(ua)) return 'Firefox';
  if (/Safari\//i.test(ua) && /Version\//i.test(ua)) return 'Safari';
  return 'Navegador';
}

function detectDeviceType(ua: string): string {
  if (/iPad|Tablet/i.test(ua)) return 'Tablet';
  if (/Mobi|iPhone|Android.*Mobile/i.test(ua)) return 'Móvil';
  return 'Escritorio';
}

export function getDeviceInfo(): DeviceInfo {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const { os, platform } = detectOS(ua);
  const browser = detectBrowser(ua);
  const device = detectDeviceType(ua);
  const label = `${device} · ${platform} · ${os} · ${browser}`;
  return { label, device, os, browser, platform, ua };
}
