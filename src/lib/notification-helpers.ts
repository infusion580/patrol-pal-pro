import { supabase } from '@/integrations/supabase/client';
import { queuedInsert } from './offline-queue';
import { sendPushTo } from './push-notifications';
import { getDeviceInfo } from './device-info';

type NotifType = 'turno_inicio' | 'turno_fin' | 'rondin' | 'zona' | 'sin_ubicacion' | 'incidencia' | 'emergencia' | 'reporte' | 'sesion' | 'sesion_en_turno' | 'visita' | 'relevo_pendiente' | 'novedad' | 'novedad_importante' | 'validacion_puesto' | 'validacion_puesto_fallida';

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

/**
 * Registra el cierre de sesión de un usuario (visible para admin/supervisor
 * en la central de notificaciones). Se dispara antes de cerrar la sesión,
 * mientras el token sigue siendo válido para escribir en la base.
 */
export async function notifySesionCierre(userId: string, userNombre: string, rol?: string) {
  const { fecha, hora, iso } = fechaHoraLarga();
  const mensaje = `🚪 CIERRE DE SESIÓN\nUsuario: ${userNombre}${rol ? `\nPerfil: ${rol}` : ''}\nFecha: ${fecha}\nHora: ${hora}`;
  await createNotification({
    tipo: 'sesion',
    mensaje,
    guardia_id: userId,
    metadata: { usuario: userNombre, rol: rol || null, evento: 'logout', fecha: iso },
  });
}

/**
 * Alerta prioritaria: el usuario cerró sesión mientras tenía un turno activo.
 * Se registra como alerta para que admin/supervisor puedan dar seguimiento.
 */
export async function notifySesionCierreEnTurno(
  userId: string,
  userNombre: string,
  servicioNombre?: string,
  inicioTurno?: string,
) {
  const { fecha, hora, iso } = fechaHoraLarga();
  const desde = inicioTurno
    ? new Date(inicioTurno).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })
    : 'N/A';
  const mensaje = `⚠️ CIERRE DE SESIÓN CON TURNO ACTIVO\nEmpleado: ${userNombre}\nServicio: ${servicioNombre || 'N/A'}\nTurno iniciado: ${desde}\nFecha: ${fecha}\nHora: ${hora}`;
  await createNotification({
    tipo: 'sesion_en_turno',
    mensaje,
    guardia_id: userId,
    metadata: {
      usuario: userNombre,
      evento: 'logout_en_turno',
      servicio: servicioNombre || null,
      inicio_turno: inicioTurno || null,
      fecha: iso,
    },
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

/**
 * Alerta cuando no se puede obtener la ubicación del guardia (GPS apagado,
 * permiso denegado o señal perdida) al intentar usar el módulo de emergencias.
 */
export async function notifySinUbicacion(
  guardiaId: string,
  guardiaNombre: string,
  motivo: string,
  contexto = 'Módulo de emergencias',
) {
  const { fecha, hora } = fechaHoraLarga();
  const mensaje = `📍 GUARDIA NO UBICABLE\nGuardia: ${guardiaNombre}\nMotivo: ${motivo}\nContexto: ${contexto}\nFecha: ${fecha}\nHora: ${hora}`;
  await createNotification({
    tipo: 'sin_ubicacion',
    mensaje,
    guardia_id: guardiaId,
    metadata: { motivo, contexto },
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
 * Alerta al momento de registrar la ENTRADA de un visitante.
 * La salida genera después su propia alerta con el resumen completo.
 */
export async function notifyVisitaEntrada(params: {
  guardiaId: string;
  guardiaNombre: string;
  nombreVisitante: string;
  personaAVisitar?: string | null;
  areaDestino?: string | null;
  motivo?: string | null;
  fotoInePath?: string | null;
  fotoPlacaPath?: string | null;
}) {
  const { fecha, hora, iso } = fechaHoraLarga();
  const mensaje =
    `🚪 ENTRADA DE VISITA\n` +
    `Visitante: ${params.nombreVisitante}\n` +
    (params.personaAVisitar ? `Visita a: ${params.personaAVisitar}\n` : '') +
    (params.areaDestino ? `Área: ${params.areaDestino}\n` : '') +
    (params.motivo ? `Motivo: ${params.motivo}\n` : '') +
    `Guardia: ${params.guardiaNombre}\n` +
    `Fecha: ${fecha}\n` +
    `Hora: ${hora}`;

  await createNotification({
    tipo: 'visita',
    mensaje,
    guardia_id: params.guardiaId,
    foto_url: params.fotoInePath || params.fotoPlacaPath || null,
    metadata: {
      evento: 'entrada',
      visitante: params.nombreVisitante,
      persona_a_visitar: params.personaAVisitar || null,
      area_destino: params.areaDestino || null,
      motivo: params.motivo || null,
      hora_entrada: iso,
      foto_ine: params.fotoInePath || null,
      foto_placa: params.fotoPlacaPath || null,
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

/**
 * Alerta por una novedad registrada en el reporte de turno.
 * Las novedades marcadas como IMPORTANTE llegan al supervisor asignado
 * del guardia y quedan visibles para administración con fecha y hora.
 */
export async function notifyNovedad(params: {
  guardiaId: string;
  guardiaNombre: string;
  descripcion: string;
  importante: boolean;
  servicioNombre?: string | null;
  ubicacion?: string | null;
  lat?: number | null;
  lng?: number | null;
  fotoPath?: string | null;
}) {
  const { fecha, hora, iso } = fechaHoraLarga();

  // Supervisor asignado al guardia (si existe) para dirigir la alerta.
  let supervisorId: string | null = null;
  try {
    const { data } = await supabase
      .from('profiles')
      .select('supervisor_asignado_id')
      .eq('user_id', params.guardiaId)
      .maybeSingle();
    supervisorId = (data as any)?.supervisor_asignado_id || null;
  } catch { /* sin supervisor asignado */ }

  const mensaje =
    (params.importante ? '⚠️ NOVEDAD IMPORTANTE\n' : '📝 NOVEDAD DE TURNO\n') +
    `Guardia: ${params.guardiaNombre}\n` +
    (params.servicioNombre ? `Servicio: ${params.servicioNombre}\n` : '') +
    `Fecha: ${fecha}\n` +
    `Hora: ${hora}\n` +
    (params.ubicacion ? `Ubicación: ${params.ubicacion}\n` : '') +
    (params.lat && params.lng ? `Coordenadas: ${params.lat.toFixed(5)}, ${params.lng.toFixed(5)}\n` : '') +
    `Novedad: ${params.descripcion}`;

  await createNotification({
    tipo: params.importante ? 'novedad_importante' : 'novedad',
    mensaje,
    guardia_id: params.guardiaId,
    supervisor_id: supervisorId,
    foto_url: params.fotoPath || null,
    metadata: {
      guardia: params.guardiaNombre,
      servicio: params.servicioNombre || null,
      importancia: params.importante ? 'importante' : 'normal',
      ubicacion: params.ubicacion || null,
      lat: params.lat ?? null,
      lng: params.lng ?? null,
      fecha: iso,
    },
  });
}

/**
 * Alerta programada de validación de puesto: informa al supervisor asignado y
 * a la administración con foto, coordenadas, precisión y resultado del cotejo
 * contra el punto esperado del servicio.
 */
export async function notifyValidacionPuesto(params: {
  guardiaId: string;
  guardiaNombre: string;
  servicioNombre?: string | null;
  puntoNombre?: string | null;
  programado: Date;
  resultado: 'valida' | 'fuera_area' | 'sin_ubicacion';
  distancia: number | null;
  lat: number | null;
  lng: number | null;
  precision: number | null;
  fotoUrl?: string | null;
}) {
  const { fecha, hora, iso } = fechaHoraLarga();
  const programadaTxt = params.programado.toLocaleTimeString('es-MX', {
    hour: '2-digit', minute: '2-digit', hour12: true,
  });
  const estado =
    params.resultado === 'valida'
      ? '✅ EN SU PUESTO'
      : params.resultado === 'fuera_area'
        ? '⚠️ FUERA DEL ÁREA ASIGNADA'
        : '⚠️ SIN UBICACIÓN GPS';

  const mensaje =
    `${estado} — VALIDACIÓN DE PUESTO\n` +
    `Empleado: ${params.guardiaNombre}\n` +
    `Servicio: ${params.servicioNombre || 'N/A'}\n` +
    `Punto esperado: ${params.puntoNombre || 'N/A'}\n` +
    `Hora programada: ${programadaTxt}\n` +
    `Fecha: ${fecha}\nHora de respuesta: ${hora}\n` +
    `Ubicación: ${params.lat?.toFixed(6) ?? 'N/A'}, ${params.lng?.toFixed(6) ?? 'N/A'}` +
    `${params.precision != null ? ` (±${params.precision}m)` : ''}` +
    `${params.distancia != null ? `\nDistancia al punto: ${params.distancia}m` : ''}`;

  // El supervisor asignado recibe la alerta directamente; la administración la
  // ve en el centro de alertas y en el módulo de validaciones.
  let supervisorId: string | null = null;
  try {
    const { data } = await supabase.rpc('get_assigned_supervisor', { _user_id: params.guardiaId });
    supervisorId = (data as string | null) || null;
  } catch {
    supervisorId = null;
  }

  await createNotification({
    tipo: params.resultado === 'valida' ? 'validacion_puesto' : 'validacion_puesto_fallida',
    mensaje,
    guardia_id: params.guardiaId,
    supervisor_id: supervisorId,
    foto_url: params.fotoUrl || null,
    metadata: {
      evento: 'validacion_puesto',
      guardia: params.guardiaNombre,
      servicio: params.servicioNombre || null,
      punto: params.puntoNombre || null,
      programado: params.programado.toISOString(),
      resultado: params.resultado,
      distancia_metros: params.distancia,
      lat: params.lat,
      lng: params.lng,
      precision_metros: params.precision,
      fecha: iso,
    },
  });
}
