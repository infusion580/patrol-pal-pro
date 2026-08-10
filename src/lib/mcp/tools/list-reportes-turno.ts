import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, unauthenticated, fail, ok } from "../supabase";

export default defineTool({
  name: "list_reportes_turno",
  title: "Listar reportes de turno",
  description: "Lista los reportes de turno con su estado de revisión del supervisor.",
  inputSchema: {
    status: z.enum(["pendiente", "aprobado", "rechazado"]).optional().describe("Filtrar por estado de revisión."),
    limit: z.number().int().min(1).max(100).default(25),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ status, limit }, ctx) => {
    if (!ctx.isAuthenticated()) return unauthenticated();
    let q = supabaseForUser(ctx)
      .from("reportes_turno")
      .select("id, guardia_id, actividades, incidencias, observaciones, status, retroalimentacion, created_at")
      .order("created_at", { ascending: false })
      .limit(limit ?? 25);
    if (status) q = q.eq("status", status);
    const { data, error } = await q;
    return error ? fail(error.message) : ok(data);
  },
});
