-- =========================================
-- 1. BITÁCORA DE AUDITORÍA INMUTABLE
-- =========================================
CREATE TABLE public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid,
  actor_email text,
  accion text NOT NULL,
  tabla text NOT NULL,
  registro_id text,
  datos_antes jsonb,
  datos_despues jsonb,
  dispositivo jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.audit_log TO authenticated;
GRANT ALL ON public.audit_log TO service_role;

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read audit log"
  ON public.audit_log FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated can append audit log"
  ON public.audit_log FOR INSERT TO authenticated
  WITH CHECK (true);

-- Inmutabilidad dura: no UPDATE/DELETE para nadie vía API
REVOKE UPDATE, DELETE, TRUNCATE ON public.audit_log FROM authenticated;

CREATE OR REPLACE FUNCTION public.audit_log_block_mutation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'audit_log es inmutable: no se permiten UPDATE ni DELETE';
END;
$$;

CREATE TRIGGER audit_log_no_update
  BEFORE UPDATE OR DELETE ON public.audit_log
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_block_mutation();

CREATE INDEX idx_audit_log_created_at ON public.audit_log (created_at DESC);
CREATE INDEX idx_audit_log_tabla ON public.audit_log (tabla, created_at DESC);

-- =========================================
-- 2. TRIGGER GENÉRICO DE AUDITORÍA
-- =========================================
CREATE OR REPLACE FUNCTION public.audit_row_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id text;
BEGIN
  IF (TG_OP = 'DELETE') THEN
    v_id := (to_jsonb(OLD) ->> 'id');
  ELSE
    v_id := (to_jsonb(NEW) ->> 'id');
  END IF;

  INSERT INTO public.audit_log (actor_id, accion, tabla, registro_id, datos_antes, datos_despues)
  VALUES (
    auth.uid(),
    lower(TG_OP),
    TG_TABLE_NAME,
    v_id,
    CASE WHEN TG_OP IN ('UPDATE','DELETE') THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP IN ('UPDATE','INSERT') THEN to_jsonb(NEW) ELSE NULL END
  );

  IF (TG_OP = 'DELETE') THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER audit_servicios
  AFTER INSERT OR UPDATE OR DELETE ON public.servicios
  FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();

CREATE TRIGGER audit_checkpoints
  AFTER INSERT OR UPDATE OR DELETE ON public.checkpoints
  FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();

CREATE TRIGGER audit_guardia_servicios
  AFTER INSERT OR UPDATE OR DELETE ON public.guardia_servicios
  FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();

CREATE TRIGGER audit_user_roles
  AFTER INSERT OR UPDATE OR DELETE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();

CREATE TRIGGER audit_registration_nips
  AFTER INSERT OR UPDATE OR DELETE ON public.registration_nips
  FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();

-- =========================================
-- 3. AUSENCIAS JUSTIFICADAS
-- =========================================
ALTER TABLE public.registros_rh DROP CONSTRAINT IF EXISTS registros_rh_tipo_check;
ALTER TABLE public.registros_rh ADD CONSTRAINT registros_rh_tipo_check
  CHECK (tipo = ANY (ARRAY['turno_extra','prestamo','vacaciones','incapacidad','permiso']));

CREATE OR REPLACE FUNCTION public.es_ausencia_justificada(_guardia_id uuid, _fecha date)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.registros_rh
    WHERE guardia_id = _guardia_id
      AND status = 'aprobado'
      AND tipo IN ('vacaciones','incapacidad','permiso')
      AND _fecha >= fecha
      AND _fecha <= COALESCE(fecha_fin, fecha)
  );
$$;

REVOKE ALL ON FUNCTION public.es_ausencia_justificada(uuid, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.es_ausencia_justificada(uuid, date) TO authenticated;

REVOKE ALL ON FUNCTION public.audit_row_change() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.audit_log_block_mutation() FROM PUBLIC, anon;