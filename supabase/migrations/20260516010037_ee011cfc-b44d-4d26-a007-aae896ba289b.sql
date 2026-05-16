CREATE OR REPLACE FUNCTION public.validate_registration_nip(_code text)
RETURNS app_role
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _nip RECORD;
BEGIN
  SELECT * INTO _nip FROM public.registration_nips
   WHERE upper(trim(code)) = upper(trim(_code));

  IF _nip IS NULL THEN
    RAISE EXCEPTION 'NIP inválido';
  END IF;
  IF _nip.used THEN
    RAISE EXCEPTION 'NIP ya utilizado';
  END IF;
  IF _nip.expires_at IS NOT NULL AND _nip.expires_at < now() THEN
    RAISE EXCEPTION 'NIP vencido';
  END IF;

  RETURN _nip.role;
END;
$$;

GRANT EXECUTE ON FUNCTION public.validate_registration_nip(text) TO anon, authenticated;