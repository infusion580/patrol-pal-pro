-- Trigger functions: nadie debe poder invocarlas desde la API
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.clear_servicio_principal_on_delete() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_servicio_principal() FROM PUBLIC, anon, authenticated;

-- Helpers de roles/asignaciones: solo usuarios autenticados
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.get_user_role(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_user_role(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.get_assigned_supervisor(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_assigned_supervisor(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.cliente_has_servicio(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cliente_has_servicio(uuid, uuid) TO authenticated;

-- Acciones administrativas / consumo de NIP: solo autenticados (la función valida internamente)
REVOKE EXECUTE ON FUNCTION public.promote_user(uuid, app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.promote_user(uuid, app_role) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.consume_registration_nip(text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.consume_registration_nip(text, uuid) TO authenticated;

-- validate_registration_nip permanece accesible para anon (se usa antes del signup)
-- pero blindamos para que no devuelva metadatos sensibles más allá del rol.