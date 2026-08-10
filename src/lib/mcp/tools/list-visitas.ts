import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, unauthenticated, fail, ok } from "../supabase";

export default defineTool({
  name: "list_visitas",
  title: "Listar visitas",
  description: "Lista el control de visitas (entradas y salidas) registradas.",
  inputSchema: {
    desde: z.string().optional().describe("Fecha inicial ISO (opcional)."),
    servicio_id: z.string().uuid().optional(),
    solo_dentro: z.boolean().default(false).describe("Solo visitantes que aún no registran salida."),
    limit: z.number().int().min(1).max(200).default(50),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ desde, servicio_id, solo_dentro, limit }, ctx) => {
    if (!ctx.isAuthenticated()) return unauthenticated();
    let q = supabaseForUser(ctx)
      .from("visitas")
      .select("id, nombre_visitante, persona_a_visitar, area_destino, motivo, hora_entrada, hora_salida, status, servicio_id")
      .order("hora_entrada", { ascending: false })
      .limit(limit ?? 50);
    if (desde) q = q.gte("hora_entrada", desde);
    if (servicio_id) q = q.eq("servicio_id", servicio_id);
    if (solo_dentro) q = q.is("hora_salida", null);
    const { data, error } = await q;
    return error ? fail(error.message) : ok(data);
  },
});
