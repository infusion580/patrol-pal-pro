-- 1. Tabla de NIPs de registro
CREATE TABLE public.registration_nips (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  role app_role NOT NULL,
  label TEXT NOT NULL DEFAULT '',
  used BOOLEAN NOT NULL DEFAULT false,
  used_by UUID,
  used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_registration_nips_code ON public.registration_nips(code) WHERE used = false;

ALTER TABLE public.registration_nips ENABLE ROW LEVEL SECURITY;

-- Solo admins gestionan NIPs
CREATE POLICY "Admins manage registration_nips"
ON public.registration_nips FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- 2. Función SECURITY DEFINER para consumir un NIP
CREATE OR REPLACE FUNCTION public.consume_registration_nip(_code TEXT, _user_id UUID)
RETURNS app_role
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _nip RECORD;
BEGIN
  -- Validar que el caller es el propio usuario
  IF auth.uid() IS NULL OR auth.uid() <> _user_id THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  SELECT * INTO _nip FROM public.registration_nips
   WHERE upper(trim(code)) = upper(trim(_code))
   FOR UPDATE;

  IF _nip IS NULL THEN
    RAISE EXCEPTION 'NIP inválido';
  END IF;
  IF _nip.used THEN
    RAISE EXCEPTION 'NIP ya utilizado';
  END IF;
  IF _nip.expires_at IS NOT NULL AND _nip.expires_at < now() THEN
    RAISE EXCEPTION 'NIP vencido';
  END IF;

  UPDATE public.registration_nips
     SET used = true, used_by = _user_id, used_at = now()
   WHERE id = _nip.id;

  -- Asignar el rol al usuario (reemplaza cualquier rol previo)
  DELETE FROM public.user_roles WHERE user_id = _user_id;
  INSERT INTO public.user_roles (user_id, role) VALUES (_user_id, _nip.role);

  RETURN _nip.role;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.consume_registration_nip(TEXT, UUID) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.consume_registration_nip(TEXT, UUID) TO authenticated;
