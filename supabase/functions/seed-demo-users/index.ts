// Crea/reactiva usuarios demo para pruebas
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DEMOS = [
  { email: "admin.demo@defender.app",      password: "Admin123!",      role: "admin",      nombre: "Admin",      apellido: "Demo", numero_empleado: "ADM-001" },
  { email: "supervisor.demo@defender.app", password: "Supervisor123!", role: "supervisor", nombre: "Supervisor", apellido: "Demo", numero_empleado: "SUP-001" },
  { email: "guardia.demo@defender.app",    password: "Guardia123!",    role: "guardia",    nombre: "Guardia",    apellido: "Demo", numero_empleado: "GRD-001" },
  { email: "cliente.demo@defender.app",    password: "Cliente123!",    role: "cliente",    nombre: "Cliente",    apellido: "Demo", numero_empleado: "CLI-001" },
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const results: any[] = [];
  for (const d of DEMOS) {
    // Buscar existente
    const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
    const existing = list?.users.find((u) => u.email?.toLowerCase() === d.email);
    let userId = existing?.id;
    if (existing) {
      await admin.auth.admin.updateUserById(existing.id, { password: d.password, email_confirm: true });
    } else {
      const { data: created, error } = await admin.auth.admin.createUser({
        email: d.email, password: d.password, email_confirm: true,
        user_metadata: { nombre: d.nombre, apellido: d.apellido, numero_empleado: d.numero_empleado },
      });
      if (error) { results.push({ email: d.email, error: error.message }); continue; }
      userId = created.user!.id;
    }
    // Asegurar rol correcto
    await admin.from("user_roles").delete().eq("user_id", userId!);
    await admin.from("user_roles").insert({ user_id: userId!, role: d.role });
    // Profile fallback
    await admin.from("profiles").upsert({
      user_id: userId!, email: d.email, nombre: d.nombre, apellido: d.apellido, numero_empleado: d.numero_empleado,
    }, { onConflict: "user_id" });
    results.push({ email: d.email, password: d.password, role: d.role, ok: true });
  }
  return new Response(JSON.stringify({ users: results }, null, 2), {
    headers: { ...cors, "Content-Type": "application/json" },
  });
});
