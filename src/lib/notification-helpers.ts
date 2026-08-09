import { supabase } from '@/integrations/supabase/client';
import { queuedInsert } from './offline-queue';
import { sendPushTo } from './push-notifications';
import { getDeviceInfo } from './device-info';

type NotifType = 'turno_inicio' | 'turno_fin' | 'rondin' | 'zona' | 'incidencia' | 'emergencia' | 'reporte' | 'sesion' | 'visita' | 'relevo_pendiente';

interface NotifParams {
  tipo: NotifType;
  mensaje: string;
  guardia_id: string;
  supervisor_id?: string | null;
  foto_url?: string | null;
  metadata?: Record<string, any> | null;
}

function fechaHoraLarga() {
  const now = new Date();
  const fecha = now.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
  const hora = now.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
  return { fecha, hora, iso: now.toISOString() };
}

/**
 * Notifications are fire-and-forget log entries — safe to route through
 * the offline queue so a guard's shift/rondín events are never lost when
 * connectivity blips. The queue replays them automatically on reconnect.
 */
export async function createNotification(params: NotifParams) {
  // Anexa dispositivo desde el que se genera el evento (auditoría).
  const dev = getDeviceInfo();
  const mensajeConDispositivo = `${params.mensaje}\nDispositivo: ${dev.label}`;
  const metadata = { ...(params.metadata || {}), dispositivo: dev };
  await queuedInsert('notificaciones', {
    tipo: params.tipo,
    mensaje: mensajeConDispositivo,
    guardia_id: params.guardia_id,
    supervisor_id: params.supervisor_id || null,
    foto_url: params.foto_url || null,
    metadata,
  });
  // Fire OS-level push in parallel to any subscribed device of the same
  // guard (and the supervisor if targeted). Fire-and-forget: any failure
  // here is logged, never surfaced to the caller.
  const targets = [params.guardia_id, params.supervisor_id].filter(Boolean) as string[];
  const title = mensajeConDispositivo.split('\n')[0] || 'Defender';
  const body = mensajeConDispositivo.split('\n').slice(1).join(' · ').slice(0, 300);
  void sendPushTo(targets, title, body, '/notificaciones');
}

/**
 * Registra el inicio de sesión de un usuario e incluye el dispositivo usado.
 * Se dispara desde el auth-context al iniciar sesión correctamente.
 */
export async function notifySesionInicio(userId: string, userNombre: string) {
  const { fecha, hora } = fechaHoraLarga();
  const mensaje = `🔐 INICIO DE SESIÓN\nUsuario: ${userNombre}\nFecha: ${fecha}\nHora: ${hora}`;
  await createNotification({
    tipo: 'sesion',
    mensaje,
    guardia_id: userId,
    metadata: { usuario: userNombre },
  });
}

export async function notifyTurnoInicio(guardiaId: string, guardiaNombre: string, servicioNombre?: string) {
  const { fecha, hora, iso } = fechaHoraLarga();
  const mensaje = `🟢 INICIO DE TURNO\nEmpleado: ${guardiaNombre}\nServicio: ${servicioNombre || 'N/A'}\nFecha: ${fecha}\nHora: ${hora}`;
  await createNotification({
    tipo: 'turno_inicio',
    mensaje,
    guardia_id: guardiaId,
    metadata: { guardia: guardiaNombre, servicio: servicioNombre || null, fecha: iso },
  });
}

export async function notifyTurnoFin(guardiaId: string, guardiaNombre: string, servicioNombre?: string, statusTurno?: string) {
  const { fecha, hora, iso } = fechaHoraLarga();
  const mensaje = `🔴 FIN DE TURNO\nEmpleado: ${guardiaNombre}\nServicio: ${servicioNombre || 'N/A'}\nFecha: ${fecha}\nHora: ${hora}${statusTurno ? `\nEstatus: ${statusTurno}` : ''}`;
  await createNotification({
    tipo: 'turno_fin',
    mensaje,
    guardia_id: guardiaId,
    metadata: { guardia: guardiaNombre, servicio: servicioNombre || null, fecha: iso, status: statusTurno || null },
  });
}

export async function notifyRondinCheckIn(guardiaId: string, guardiaNombre: string, servicioNombre?: string) {
  const { fecha, hora, iso } = fechaHoraLarga();
  const mensaje = `📍 CHECK-IN DE RONDÍN\nEmpleado: ${guardiaNombre}\nServicio: ${servicioNombre || 'N/A'}\nFecha: ${fecha}\nHora: ${hora}`;
  await createNotification({
    tipo: 'rondin',
    mensaje,
    guardia_id: guardiaId,
    metadata: { evento: 'checkin', guardia: guardiaNombre, servicio: servicioNombre || null, fecha: iso },
  });
}

export async function notifyRondinPunto(
  guardiaId: string,
  guardiaNombre: string,
  puntoNombre: string,
  servicioNombre?: string,
  fotoUrl?: string | null,
) {
  const { fecha, hora, iso } = fechaHoraLarga();
  const mensaje = `📸 PUNTO DE RONDÍN VERIFICADO\nEmpleado: ${guardiaNombre}\nServicio: ${servicioNombre || 'N/A'}\nPunto: ${puntoNombre}\nFecha: ${fecha}\nHora: ${hora}`;
  await createNotification({
    tipo: 'rondin',
    mensaje,
    guardia_id: guardiaId,
    foto_url: fotoUrl || null,
    metadata: { evento: 'punto', guardia: guardiaNombre, servicio: servicioNombre || null, punto: puntoNombre, fecha: iso },
  });
}

export async function notifyRondinCheckOut(
  guardiaId: string,
  guardiaNombre: string,
  servicioNombre: string | undefined,
  reporte: string,
  puntosEscaneados: number,
  puntosTotales: number,
) {
  const { fecha, hora, iso } = fechaHoraLarga();
  const mensaje = `✅ CHECK-OUT DE RONDÍN\nEmpleado: ${guardiaNombre}\nServicio: ${servicioNombre || 'N/A'}\nPuntos: ${puntosEscaneados}/${puntosTotales}\nFecha: ${fecha}\nHora: ${hora}\n\nReporte:\n${reporte}`;
  await createNotification({
    tipo: 'rondin',
    mensaje,
    guardia_id: guardiaId,
    metadata: {
      evento: 'checkout',
      guardia: guardiaNombre,
      servicio: servicioNombre || null,
      reporte,
      puntos_escaneados: puntosEscaneados,
      puntos_totales: puntosTotales,
      fecha: iso,
    },
  });
}

// Backwards-compatible alias
export const notifyRondinRegistro = notifyRondinCheckIn;

export async function notifyZonaExit(
  guardiaId: string,
  guardiaNombre: string,
  distancia: number,
  radioPermitido: number,
  zonaAsignada?: string,
  lat?: number,
  lng?: number,
) {
  const hora = new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
  const fecha = new Date().toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
  const mensaje = `⚠️ SALIDA DE ZONA — ${fecha} ${hora}\nGuardia: ${guardiaNombre}\nZona asignada: ${zonaAsignada || 'N/A'}\nDistancia detectada: ${Math.round(distancia)}m (radio: ${radioPermitido}m)\nUbicación: ${lat?.toFixed(6) || 'N/A'}, ${lng?.toFixed(6) || 'N/A'}\nEstatus: Pendiente de seguimiento`;

  await createNotification({
    tipo: 'zona',
    mensaje,
    guardia_id: guardiaId,
  });
}

export async function notifyIncidencia(guardiaId: string, guardiaNombre: string, descripcion: string) {
  const hora = new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
  await createNotification({
    tipo: 'incidencia',
    mensaje: `🚨 Incidencia registrada por ${guardiaNombre} a las ${hora}: ${descripcion}`,
    guardia_id: guardiaId,
  });
}

/**
 * Notifica al guardia que su reporte de turno fue aprobado por el supervisor.
 */
export async function notifyReporteAprobado(guardiaId: string, supervisorId: string | null, fechaReporte: string) {
  const { fecha, hora } = fechaHoraLarga();
  await createNotification({
    tipo: 'reporte',
    mensaje: `✅ REPORTE APROBADO\nTu reporte del ${fechaReporte} fue aprobado.\nFecha revisión: ${fecha}\nHora: ${hora}`,
    guardia_id: guardiaId,
    supervisor_id: supervisorId,
  });
}

/**
 * Notifica al guardia que su reporte requiere correcciones, incluyendo la
 * retroalimentación del supervisor.
 */
export async function notifyReporteRetro(
  guardiaId: string,
  supervisorId: string | null,
  fechaReporte: string,
  retroalimentacion: string,
) {
  const { fecha, hora } = fechaHoraLarga();
  const mensaje = `📝 REPORTE REQUIERE CAMBIOS\nReporte del ${fechaReporte}\nRetroalimentación: ${retroalimentacion}\nFecha revisión: ${fecha}\nHora: ${hora}`;
  await createNotification({
    tipo: 'reporte',
    mensaje,
    guardia_id: guardiaId,
    supervisor_id: supervisorId,
  });
}

/**
 * Notificación única de visita: se emite al registrar la SALIDA del visitante,
 * e incluye tanto los datos de entrada como los de salida en un solo evento.
 */
export async function notifyVisitaEntradaSalida(params: {
  guardiaId: string;
  guardiaNombre: string;
  nombreVisitante: string;
  personaAVisitar?: string | null;
  areaDestino?: string | null;
  motivo?: string | null;
  horaEntradaISO: string;
  horaSalidaISO: string;
  fotoInePath?: string | null;
  fotoPlacaPath?: string | null;
  fotoSalidaPath?: string | null;
}) {
  const fmt = (iso: string) => {
    const d = new Date(iso);
    return {
      fecha: d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }),
      hora: d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }),
    };
  };
  const ent = fmt(params.horaEntradaISO);
  const sal = fmt(params.horaSalidaISO);
  const durMin = Math.max(0, Math.round((new Date(params.horaSalidaISO).getTime() - new Date(params.horaEntradaISO).getTime()) / 60000));
  const dur = durMin >= 60 ? `${Math.floor(durMin / 60)}h ${durMin % 60}m` : `${durMin}m`;

  const mensaje =
    `🚪 VISITA REGISTRADA\n` +
    `Visitante: ${params.nombreVisitante}\n` +
    (params.personaAVisitar ? `Visita a: ${params.personaAVisitar}\n` : '') +
    (params.areaDestino ? `Área: ${params.areaDestino}\n` : '') +
    (params.motivo ? `Motivo: ${params.motivo}\n` : '') +
    `Guardia: ${params.guardiaNombre}\n` +
    `Entrada: ${ent.fecha} ${ent.hora}\n` +
    `Salida: ${sal.fecha} ${sal.hora}\n` +
    `Duración: ${dur}`;

  await createNotification({
    tipo: 'visita',
    mensaje,
    guardia_id: params.guardiaId,
    foto_url: params.fotoSalidaPath || params.fotoInePath || null,
    metadata: {
      visitante: params.nombreVisitante,
      persona_a_visitar: params.personaAVisitar || null,
      area_destino: params.areaDestino || null,
      motivo: params.motivo || null,
      hora_entrada: params.horaEntradaISO,
      hora_salida: params.horaSalidaISO,
      duracion_minutos: durMin,
      foto_ine: params.fotoInePath || null,
      foto_placa: params.fotoPlacaPath || null,
      foto_salida: params.fotoSalidaPath || null,
    },
  });
}

/**
 * Notifica a supervisores que un guardia está por terminar su turno y aún no
 * hay guardia entrante registrado. Se usa desde el cron de backend.
 */
export async function notifyRelevoPendiente(
  guardiaId: string,
  guardiaNombre: string,
  servicioNombre?: string,
  finEsperado?: string,
) {
  const hora = finEsperado
    ? new Date(finEsperado).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: true })
    : new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
  const mensaje =
    `⏰ RELEVO NO CUBIERTO\n` +
    `Empleado: ${guardiaNombre}\n` +
    `Servicio: ${servicioNombre || 'N/A'}\n` +
    `Fin esperado: ${hora}\n` +
    `No se ha registrado guardia entrante.`;
  await createNotification({
    tipo: 'relevo_pendiente',
    mensaje,
    guardia_id: guardiaId,
    metadata: { guardia: guardiaNombre, servicio: servicioNombre || null, fin_esperado: finEsperado || null },
  });
}
