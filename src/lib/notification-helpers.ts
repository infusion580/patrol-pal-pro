import { supabase } from '@/integrations/supabase/client';

type NotifType = 'turno_inicio' | 'turno_fin' | 'rondin' | 'zona' | 'incidencia' | 'emergencia';

interface NotifParams {
  tipo: NotifType;
  mensaje: string;
  guardia_id: string;
  supervisor_id?: string | null;
}

export async function createNotification(params: NotifParams) {
  const { error } = await supabase.from('notificaciones').insert({
    tipo: params.tipo,
    mensaje: params.mensaje,
    guardia_id: params.guardia_id,
    supervisor_id: params.supervisor_id || null,
  });
  if (error) console.error('Error creating notification:', error);
}

export async function notifyTurnoInicio(guardiaId: string, guardiaNombre: string) {
  const hora = new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
  await createNotification({
    tipo: 'turno_inicio',
    mensaje: `🟢 ${guardiaNombre} inició su turno a las ${hora}.`,
    guardia_id: guardiaId,
  });
}

export async function notifyTurnoFin(guardiaId: string, guardiaNombre: string) {
  const hora = new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
  await createNotification({
    tipo: 'turno_fin',
    mensaje: `🔴 ${guardiaNombre} finalizó su turno a las ${hora}.`,
    guardia_id: guardiaId,
  });
}

export async function notifyRondinRegistro(guardiaId: string, guardiaNombre: string, servicioNombre?: string) {
  const hora = new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
  await createNotification({
    tipo: 'rondin',
    mensaje: `📍 ${guardiaNombre} registró un rondín${servicioNombre ? ` en ${servicioNombre}` : ''} a las ${hora}.`,
    guardia_id: guardiaId,
  });
}

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
