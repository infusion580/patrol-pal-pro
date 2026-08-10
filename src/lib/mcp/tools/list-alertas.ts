import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, unauthenticated, fail, ok } from "../supabase";

export default defineTool({
  name: "list_alertas",
  title: "Listar alertas",
  description: "Lista las notificaciones/alertas operativas más recientes (emergencias, rondines, turnos, visitas).",
  inputSchema: {
    solo_no_leidas: z.boolean().default(false).describe("Devolver únicamente alertas sin leer."),
    tipo: z.string().optional().describe("Filtrar por tipo de alerta, ej. emergencia."),
    limit: z.number().int().min(1).max(200).default(30),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ solo_no_leidas, tipo, limit }, ctx) => {
    if (!ctx.isAuthenticated()) return unauthenticated();
    let q = supabaseForUser(ctx)
      .from("notificaciones")
      .select("id, tipo, mensaje, leida, guardia_id, supervisor_id, created_at")
      .order("created_at", { ascending: false })
      .limit(limit ?? 30);
    if (solo_no_leidas) q = q.eq("leida", false);
    if (tipo) q = q.eq("tipo", tipo);
    const { data, error } = await q;
    return error ? fail(error.message) : ok(data);
  },
});
