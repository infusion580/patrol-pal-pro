/**
 * Configuración del canal de soporte por WhatsApp.
 *
 * El reporte de fallas no se guarda en base de datos: se abre WhatsApp con un
 * mensaje pre-formateado dirigido al número de soporte configurado.
 * El número es personalizable (solo admin) y se persiste en localStorage.
 */

const STORAGE_KEY = 'defender-soporte-whatsapp';

/** Número por defecto de soporte (México, 10 dígitos + LADA país 52). */
export const DEFAULT_SOPORTE_WHATSAPP = '524426356998';

/** Deja solo dígitos y normaliza números mexicanos de 10 dígitos. */
export function normalizarNumero(raw: string): string {
  const digits = (raw || '').replace(/\D/g, '');
  if (digits.length === 10) return `52${digits}`;
  return digits;
}

/** Número de WhatsApp de soporte actualmente configurado. */
export function getSoporteWhatsapp(): string {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return normalizarNumero(saved);
  } catch {
    /* localStorage no disponible */
  }
  return DEFAULT_SOPORTE_WHATSAPP;
}

/** Guarda un nuevo número de soporte. Devuelve el número normalizado. */
export function setSoporteWhatsapp(raw: string): string {
  const num = normalizarNumero(raw);
  try {
    localStorage.setItem(STORAGE_KEY, num);
  } catch {
    /* ignore */
  }
  return num;
}

/** Formatea el número para mostrarlo (+52 442 635 6998). */
export function formatSoporteWhatsapp(num: string): string {
  const d = normalizarNumero(num);
  if (d.length === 12) return `+${d.slice(0, 2)} ${d.slice(2, 5)} ${d.slice(5, 8)} ${d.slice(8)}`;
  return `+${d}`;
}

export interface ReporteFallaContexto {
  nombre?: string;
  numeroEmpleado?: string;
  rol?: string;
  ruta?: string;
  dispositivo?: string;
}

/** Construye el mensaje de reporte de falla que se envía por WhatsApp. */
export function construirMensajeFalla(
  categoria: string,
  descripcion: string,
  ctx: ReporteFallaContexto,
): string {
  const fecha = new Date().toLocaleString('es-MX');
  return [
    '🛠️ *Reporte de falla — Defender*',
    '',
    `*Tipo:* ${categoria}`,
    `*Descripción:* ${descripcion}`,
    '',
    `*Usuario:* ${ctx.nombre || 'No identificado'}${ctx.numeroEmpleado ? ` (#${ctx.numeroEmpleado})` : ''}`,
    `*Rol:* ${ctx.rol || 'n/a'}`,
    `*Pantalla:* ${ctx.ruta || 'n/a'}`,
    `*Dispositivo:* ${ctx.dispositivo || 'n/a'}`,
    `*Fecha:* ${fecha}`,
  ].join('\n');
}

/** Genera el enlace wa.me listo para abrir. */
export function construirEnlaceWhatsapp(numero: string, mensaje: string): string {
  return `https://wa.me/${normalizarNumero(numero)}?text=${encodeURIComponent(mensaje)}`;
}
