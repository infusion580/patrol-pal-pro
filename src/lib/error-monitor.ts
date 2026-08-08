/**
 * Lightweight client error monitoring.
 *
 * Captures uncaught exceptions and unhandled promise rejections and appends
 * them to the immutable `audit_log` table (accion = 'client_error') so admins
 * can see field failures that users never report. Deliberately dependency-free
 * (no Sentry account required) and heavily throttled so a render loop can't
 * flood the database.
 */

import { logAudit } from '@/lib/audit';

const MAX_PER_SESSION = 20;
const DEDUPE_WINDOW_MS = 60_000;

let sent = 0;
const recent = new Map<string, number>();

function shouldReport(signature: string): boolean {
  if (sent >= MAX_PER_SESSION) return false;
  const now = Date.now();
  const last = recent.get(signature);
  if (last && now - last < DEDUPE_WINDOW_MS) return false;
  recent.set(signature, now);
  sent++;
  return true;
}

function report(message: string, stack?: string, source?: string) {
  const signature = `${message}::${source ?? ''}`;
  if (!shouldReport(signature)) return;
  void logAudit({
    accion: 'client_error',
    tabla: 'app',
    datos: {
      mensaje: message.slice(0, 500),
      stack: (stack || '').slice(0, 2000),
      origen: source || window.location.pathname,
      url: window.location.href,
    },
  });
}

let initialized = false;

/** Install global error handlers. Call once at app boot. */
export function initErrorMonitor() {
  if (initialized) return;
  initialized = true;

  window.addEventListener('error', (event) => {
    const err = event.error as Error | undefined;
    report(err?.message || event.message || 'Error desconocido', err?.stack, event.filename);
  });

  window.addEventListener('unhandledrejection', (event) => {
    const reason: any = event.reason;
    const message =
      typeof reason === 'string' ? reason : reason?.message || 'Promesa rechazada sin manejar';
    report(message, reason?.stack);
  });
}

/** Manually report a handled error worth investigating. */
export function reportHandledError(context: string, error: unknown) {
  const err = error as Error;
  report(`[${context}] ${err?.message || String(error)}`, err?.stack, context);
}
