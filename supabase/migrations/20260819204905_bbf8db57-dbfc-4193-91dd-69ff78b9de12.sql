REVOKE ALL ON FUNCTION public.prestamo_nombre(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.prestamo_comunicado_privado(uuid, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.prestamo_log(uuid, text, text, text, text, text) FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.prestamo_crear(numeric, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.prestamo_aprobar_supervisor(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.prestamo_aprobar_admin(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.prestamo_confirmar_deposito(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.prestamo_rechazar(uuid, text, text) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.prestamo_crear(numeric, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.prestamo_aprobar_supervisor(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.prestamo_aprobar_admin(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.prestamo_confirmar_deposito(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.prestamo_rechazar(uuid, text, text) TO authenticated;