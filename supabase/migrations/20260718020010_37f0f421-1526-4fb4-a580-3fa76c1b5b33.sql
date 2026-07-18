
GRANT EXECUTE ON FUNCTION public.get_assigned_supervisor(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_role(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cliente_has_servicio(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.validate_registration_nip(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_registration_nip(text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.promote_user(uuid, public.app_role) TO authenticated;
