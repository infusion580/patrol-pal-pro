/**
 * Configuración del canal de soporte por WhatsApp.
 *
 * El reporte de fallas no se guarda en base de datos: se abre WhatsApp con un
 * mensaje pre-formateado dirigido al número de soporte configurado.
 *
 * El número vive en la tabla `branding` (columna `soporte_whatsapp`), por lo que
 * el administrador lo puede actualizar y el cambio aplica para todos los usuarios.
 * Se mantiene una copia en localStorage para poder pintar la UI al instante y
 * para que siga funcionando sin conexión.
 */

import { supabase } from '@/integrations/supabase/client';

const STORAGE_KEY = 'defender-soporte-whatsapp';

/** Número por defecto de soporte (México, 10 dígitos + LADA país 52). */
export const DEFAULT_SOPORTE_WHATSAPP = '524426356998';

/** Deja solo dígitos y normaliza números mexicanos de 10 dígitos. */
export function normalizarNumero(raw: string): string {
  const digits = (raw || '').replace(/\D/g, '');
  if (digits.length === 10) return `52${digits}`;
  return digits;
}

/** Número cacheado localmente (lectura síncrona para el primer render). */
export function getSoporteWhatsapp(): string {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return normalizarNumero(saved);
  } catch {
    /* localStorage no disponible */
  }
  return DEFAULT_SOPORTE_WHATSAPP;
}

/** Lee el número vigente desde la base y refresca la caché local. */
export async function fetchSoporteWhatsapp(): Promise<string> {
  try {
    const { data } = await supabase
      .from('branding')
      .select('soporte_whatsapp')
      .maybeSingle();
    const num = normalizarNumero(data?.soporte_whatsapp || '');
    if (num.length >= 11) {
      try {
        localStorage.setItem(STORAGE_KEY, num);
      } catch {
        /* ignore */
      }
      return num;
    }
  } catch {
    /* sin conexión: se usa la caché */
  }
  return getSoporteWhatsapp();
}

/**
 * Guarda un nuevo número de soporte en la base (solo admin por RLS).
 * Devuelve el número normalizado.
 */
export async function setSoporteWhatsapp(raw: string): Promise<string> {
  const num = normalizarNumero(raw);
  if (num.length < 11) return num;

  const { error } = await supabase
    .from('branding')
    .update({ soporte_whatsapp: num })
    .eq('id', true);
  if (error) throw error;

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

/** True si el dispositivo es móvil (ahí conviene abrir la app nativa). */
function esMovil(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent);
}

/**
 * Enlace de WhatsApp.
 *
 * `wa.me` redirige a `api.whatsapp.com`, dominio que muchas redes corporativas
 * y algunos navegadores bloquean ("api.whatsapp.com rechazó la conexión").
 * Por eso en escritorio se usa directamente `web.whatsapp.com`, que no pasa por
 * ese redireccionamiento, y en móvil el esquema `wa.me` que abre la app.
 */
export function construirEnlaceWhatsapp(numero: string, mensaje: string): string {
  const n = normalizarNumero(numero);
  const texto = encodeURIComponent(mensaje);
  if (esMovil()) return `https://wa.me/${n}?text=${texto}`;
  return `https://web.whatsapp.com/send?phone=${n}&text=${texto}&type=phone_number&app_absent=0`;
}

/** Enlace alterno (app instalada en escritorio / esquema nativo). */
export function construirEnlaceWhatsappAlterno(numero: string, mensaje: string): string {
  const n = normalizarNumero(numero);
  return `whatsapp://send?phone=${n}&text=${encodeURIComponent(mensaje)}`;
}
