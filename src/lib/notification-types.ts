/**
 * Clasificación central de alertas
 * --------------------------------
 * Única fuente de verdad para el tipo, categoría, severidad, icono y sonido
 * de cada notificación. Toda pantalla que muestre alertas debe leer de aquí
 * para que el criterio sea consistente en la app.
 */
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  ClipboardList,
  Clock,
  DoorOpen,
  FileText,
  HandCoins,
  LogIn,
  LogOut,
  MapPin,
  MapPinOff,
  Megaphone,
  Shield,
  ShieldCheck,
  Trophy,
  UserX,
  type LucideIcon,
} from 'lucide-react';

export type NotifSeveridad = 'critica' | 'alta' | 'media' | 'info';
export type NotifCategoria = 'emergencia' | 'operacion' | 'novedades' | 'turnos' | 'visitas' | 'accesos' | 'sistema';

export interface NotifMeta {
  label: string;
  icon: LucideIcon;
  color: string;
  bgColor: string;
  categoria: NotifCategoria;
  severidad: NotifSeveridad;
}

export const CATEGORIA_LABEL: Record<NotifCategoria, string> = {
  emergencia: 'Emergencias',
  operacion: 'Operación',
  novedades: 'Novedades',
  turnos: 'Turnos',
  visitas: 'Visitas',
  accesos: 'Accesos',
  sistema: 'Sistema',
};

export const SEVERIDAD_LABEL: Record<NotifSeveridad, string> = {
  critica: 'Crítica',
  alta: 'Alta',
  media: 'Media',
  info: 'Informativa',
};

export const SEVERIDAD_STYLE: Record<NotifSeveridad, string> = {
  critica: 'bg-emergency/15 text-emergency',
  alta: 'bg-warning/15 text-warning',
  media: 'bg-primary/10 text-primary',
  info: 'bg-muted text-muted-foreground',
};

const FALLBACK: NotifMeta = {
  label: 'Alerta',
  icon: Bell,
  color: 'text-muted-foreground',
  bgColor: 'bg-muted',
  categoria: 'sistema',
  severidad: 'info',
};

export const NOTIF_TYPES: Record<string, NotifMeta> = {
  emergencia: {
    label: 'Emergencia', icon: Shield, color: 'text-emergency', bgColor: 'bg-emergency/10',
    categoria: 'emergencia', severidad: 'critica',
  },
  zona: {
    label: 'Salida de Zona', icon: MapPin, color: 'text-emergency', bgColor: 'bg-emergency/10',
    categoria: 'emergencia', severidad: 'critica',
  },
  sin_ubicacion: {
    label: 'Guardia sin ubicación', icon: MapPinOff, color: 'text-emergency', bgColor: 'bg-emergency/10',
    categoria: 'emergencia', severidad: 'alta',
  },
  novedad_importante: {
    label: 'Novedad Importante', icon: AlertTriangle, color: 'text-emergency', bgColor: 'bg-emergency/10',
    categoria: 'novedades', severidad: 'alta',
  },
  novedad: {
    label: 'Novedad', icon: ClipboardList, color: 'text-primary', bgColor: 'bg-primary/10',
    categoria: 'novedades', severidad: 'info',
  },
  incidencia: {
    label: 'Incidencia', icon: AlertTriangle, color: 'text-emergency', bgColor: 'bg-emergency/10',
    categoria: 'emergencia', severidad: 'alta',
  },
  sesion_en_turno: {
    label: 'Cierre de sesión en turno', icon: UserX, color: 'text-emergency', bgColor: 'bg-emergency/10',
    categoria: 'emergencia', severidad: 'alta',
  },
  relevo_pendiente: {
    label: 'Relevo Pendiente', icon: Clock, color: 'text-warning', bgColor: 'bg-warning/10',
    categoria: 'turnos', severidad: 'alta',
  },
  turno_inicio: {
    label: 'Inicio de Turno', icon: CheckCircle2, color: 'text-success', bgColor: 'bg-success/10',
    categoria: 'turnos', severidad: 'info',
  },
  turno_fin: {
    label: 'Fin de Turno', icon: Clock, color: 'text-warning', bgColor: 'bg-warning/10',
    categoria: 'turnos', severidad: 'media',
  },
  rondin: {
    label: 'Rondín', icon: MapPin, color: 'text-primary', bgColor: 'bg-primary/10',
    categoria: 'operacion', severidad: 'media',
  },
  rondin_alarma: {
    label: 'Comienzo de rondín', icon: Clock, color: 'text-warning', bgColor: 'bg-warning/10',
    categoria: 'operacion', severidad: 'alta',
  },
  reporte: {
    label: 'Reporte', icon: FileText, color: 'text-primary', bgColor: 'bg-primary/10',
    categoria: 'operacion', severidad: 'media',
  },
  visita: {
    label: 'Visita', icon: DoorOpen, color: 'text-primary', bgColor: 'bg-primary/10',
    categoria: 'visitas', severidad: 'media',
  },
  validacion_puesto: {
    label: 'Validación de puesto', icon: ShieldCheck, color: 'text-success', bgColor: 'bg-success/10',
    categoria: 'turnos', severidad: 'info',
  },
  validacion_puesto_fallida: {
    label: 'Validación de puesto fuera de área', icon: MapPinOff, color: 'text-emergency', bgColor: 'bg-emergency/10',
    categoria: 'turnos', severidad: 'alta',
  },
  sesion: {
    label: 'Sesión', icon: LogIn, color: 'text-muted-foreground', bgColor: 'bg-muted',
    categoria: 'accesos', severidad: 'info',
  },
  sesion_cierre: {
    label: 'Cierre de Sesión', icon: LogOut, color: 'text-muted-foreground', bgColor: 'bg-muted',
    categoria: 'accesos', severidad: 'info',
  },
  comunicado: {
    label: 'Comunicado', icon: Megaphone, color: 'text-primary', bgColor: 'bg-primary/10',
    categoria: 'sistema', severidad: 'media',
  },
  reconocimiento: {
    label: 'Cuadro de Honor', icon: Trophy, color: 'text-warning', bgColor: 'bg-warning/10',
    categoria: 'sistema', severidad: 'info',
  },
  prestamo: {
    label: 'Préstamo', icon: HandCoins, color: 'text-success', bgColor: 'bg-success/10',
    categoria: 'sistema', severidad: 'media',
  },
};

export function getNotifMeta(tipo?: string | null): NotifMeta {
  return (tipo && NOTIF_TYPES[tipo]) || FALLBACK;
}
