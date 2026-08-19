REVOKE ALL ON FUNCTION public.notificar_comunicado(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.publicar_comunicados_programados() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.publicar_comunicado(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.publicar_comunicado(uuid) TO authenticated;