-- 6.2 Audit log: no direct client inserts; force server-side identity
DROP POLICY IF EXISTS "Authenticated can append audit log" ON public.audit_log;
REVOKE INSERT ON public.audit_log FROM authenticated;

CREATE OR REPLACE FUNCTION public.log_audit_event(
  _accion text,
  _tabla text,
  _registro_id text DEFAULT NULL,
  _datos jsonb DEFAULT NULL,
  _dispositivo jsonb DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _email text;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  SELECT u.email INTO _email FROM auth.users u WHERE u.id = _uid;

  INSERT INTO public.audit_log (actor_id, actor_email, accion, tabla, registro_id, datos_despues, dispositivo)
  VALUES (_uid, _email, left(coalesce(_accion, 'desconocido'), 100), left(coalesce(_tabla, 'app'), 100), left(_registro_id, 200), _datos, _dispositivo);
END;
$$;

REVOKE ALL ON FUNCTION public.log_audit_event(text, text, text, jsonb, jsonb) FROM public;
GRANT EXECUTE ON FUNCTION public.log_audit_event(text, text, text, jsonb, jsonb) TO authenticated;

-- 6.3 Chat: column-level update, only the read flag
REVOKE UPDATE ON public.chat_messages FROM authenticated;
GRANT UPDATE ("read") ON public.chat_messages TO authenticated;