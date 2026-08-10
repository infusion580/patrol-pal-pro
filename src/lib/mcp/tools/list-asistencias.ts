import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, unauthenticated, fail, ok } from "../supabase";

export default defineTool({
  name: "list_asistencias",
  title: "Listar asistencias",
  description: "Lista los registros de asistencia (turnos) en un rango de fechas.",
  inputSchema: {
    desde: z.string().describe("Fecha inicial ISO, ej. 2026-08-01."),
    hasta: z.string().optional().describe("Fecha final ISO (opcional)."),
    servicio_id: z.string().uuid().optional().describe("Filtrar por servicio."),
    limit: z.number().int().min(1).max(200).default(50),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ desde, hasta, servicio_id, limit }, ctx) => {
    if (!ctx.isAuthenticated()) return unauthenticated();
    let q = supabaseForUser(ctx)
      .from("asistencias")
      .select("id, guardia_id, servicio_id, inicio, fin, fin_esperado, horas_extra, status, tipo_turno")
      .gte("inicio", desde)
      .order("inicio", { ascending: false })
      .limit(limit ?? 50);
    if (hasta) q = q.lte("inicio", hasta);
    if (servicio_id) q = q.eq("servicio_id", servicio_id);
    const { data, error } = await q;
    return error ? fail(error.message) : ok(data);
  },
});
