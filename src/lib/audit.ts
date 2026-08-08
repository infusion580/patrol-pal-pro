/**
 * Client-side helper to append entries to the immutable audit log.
 *
 * The `audit_log` table is append-only: the database blocks UPDATE and DELETE
 * with a trigger, and only admins can read it. Database-level changes to
 * critical tables (servicios, checkpoints, guardia_servicios, user_roles,
 * registration_nips) are recorded automatically by triggers; this helper is
 * for *application-level* events that have no direct table mutation, such as
 * logins, report approvals, exports, or client-side errors.
 *
 * Never throws — auditing must not break a user flow.
 */

import { supabase } from '@/integrations/supabase/client';
import { getDeviceInfo } from '@/lib/device-info';

export type AuditAction =
  | 'login'
  | 'logout'
  | 'export'
  | 'aprobacion_reporte'
  | 'retroalimentacion_reporte'
  | 'client_error'
  | string;

export interface AuditEntry {
  accion: AuditAction;
  tabla: string;
  registroId?: string | null;
  datos?: Record<string, unknown> | null;
}

export async function logAudit({ accion, tabla, registroId, datos }: AuditEntry): Promise<void> {
  try {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth?.user) return; // only authenticated users can append

    await supabase.from('audit_log' as any).insert({
      actor_id: auth.user.id,
      actor_email: auth.user.email ?? null,
      accion,
      tabla,
      registro_id: registroId ?? null,
      datos_despues: (datos ?? null) as any,
      dispositivo: getDeviceInfo() as any,
    } as any);
  } catch {
    // Auditing is best-effort; swallow failures.
  }
}
