import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, unauthenticated, fail, ok } from "../supabase";

export default defineTool({
  name: "crear_pendiente_puesto",
  title: "Crear pendiente de puesto",
  description: "Crea una tarea pendiente para el guardia de un servicio (ej. revisar puerta 5 cada hora).",
  inputSchema: {
    servicio_id: z.string().uuid().describe("Servicio al que aplica la tarea."),
    titulo: z.string().trim().min(1),
    descripcion: z.string().trim().min(1),
    frecuencia: z.enum(["unica", "por_turno", "por_horas"]).default("por_turno"),
    horas_intervalo: z.number().int().min(1).max(24).optional().describe("Requerido si la frecuencia es por_horas."),
    prioridad: z.enum(["baja", "media", "alta"]).default("media"),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async (input, ctx) => {
    if (!ctx.isAuthenticated()) return unauthenticated();
    const { data, error } = await supabaseForUser(ctx)
      .from("pendientes_puesto")
      .insert({
        servicio_id: input.servicio_id,
        titulo: input.titulo,
        descripcion: input.descripcion,
        frecuencia: input.frecuencia ?? "por_turno",
        horas_intervalo: input.horas_intervalo ?? null,
        prioridad: input.prioridad ?? "media",
        created_by: ctx.getUserId(),
      })
      .select()
      .single();
    return error ? fail(error.message) : ok(data);
  },
});
