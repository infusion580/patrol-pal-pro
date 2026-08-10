import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listServicios from "./tools/list-servicios";
import listAsistencias from "./tools/list-asistencias";
import listAlertas from "./tools/list-alertas";
import listVisitas from "./tools/list-visitas";
import listReportesTurno from "./tools/list-reportes-turno";
import crearPendientePuesto from "./tools/crear-pendiente-puesto";

const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "guardian-connect",
  title: "Guardian Connect",
  version: "0.1.0",
  instructions:
    "Herramientas de Defender Seguridad Privada. Consulta servicios, asistencias/turnos, alertas operativas, visitas y reportes de turno del usuario autenticado, y crea pendientes de puesto. Todas respetan los permisos (RLS) del usuario conectado.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [
    listServicios,
    listAsistencias,
    listAlertas,
    listVisitas,
    listReportesTurno,
    crearPendientePuesto,
  ],
});
