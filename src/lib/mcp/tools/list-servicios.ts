import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, unauthenticated, fail, ok } from "../supabase";

export default defineTool({
  name: "list_servicios",
  title: "Listar servicios",
  description: "Lista los servicios (puestos) visibles para el usuario autenticado.",
  inputSchema: {
    limit: z.number().int().min(1).max(100).default(50).describe("Máximo de servicios a devolver."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit }, ctx) => {
    if (!ctx.isAuthenticated()) return unauthenticated();
    const { data, error } = await supabaseForUser(ctx)
      .from("servicios")
      .select("id, nombre, cliente, direccion, tipo_turno, rondin_intervalo_minutos")
      .order("nombre")
      .limit(limit ?? 50);
    return error ? fail(error.message) : ok(data);
  },
});
