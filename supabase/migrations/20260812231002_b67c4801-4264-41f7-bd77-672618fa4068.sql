CREATE TABLE public.reconocimientos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guardia_id uuid NOT NULL,
  posicion integer NOT NULL DEFAULT 1,
  periodo text NOT NULL,
  motivo text NOT NULL,
  bono numeric NOT NULL DEFAULT 0,
  publicado boolean NOT NULL DEFAULT false,
  publicado_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT reconocimientos_posicion_check CHECK (posicion >= 1),
  CONSTRAINT reconocimientos_bono_check CHECK (bono >= 0 AND (posicion = 1 OR bono = 0))
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.reconocimientos TO authenticated;
GRANT ALL ON public.reconocimientos TO service_role;

ALTER TABLE public.reconocimientos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins y supervisores gestionan reconocimientos"
ON public.reconocimientos FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'supervisor'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'supervisor'::app_role));

CREATE POLICY "Todos ven reconocimientos publicados"
ON public.reconocimientos FOR SELECT TO authenticated
USING (publicado = true);

CREATE TRIGGER trg_reconocimientos_updated_at
BEFORE UPDATE ON public.reconocimientos
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.publicar_reconocimiento(_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _rec RECORD;
  _nombre text;
  _msg text;
BEGIN
  IF NOT (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'supervisor'::app_role)) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  SELECT * INTO _rec FROM public.reconocimientos WHERE id = _id;
  IF _rec IS NULL THEN
    RAISE EXCEPTION 'Reconocimiento no encontrado';
  END IF;

  UPDATE public.reconocimientos
     SET publicado = true, publicado_at = COALESCE(publicado_at, now())
   WHERE id = _id;

  SELECT trim(coalesce(p.nombre,'') || ' ' || coalesce(p.apellido,'')) INTO _nombre
    FROM public.profiles p WHERE p.user_id = _rec.guardia_id;

  _msg := '🏆 Cuadro de Honor ' || _rec.periodo || ' — #' || _rec.posicion || ' ' ||
          coalesce(nullif(_nombre,''), 'Guardia') || '. Motivo: ' || _rec.motivo ||
          CASE WHEN _rec.bono > 0 THEN '. Bono: $' || trim(to_char(_rec.bono, 'FM999,999,990.00')) ELSE '' END;

  INSERT INTO public.notificaciones (tipo, mensaje, guardia_id, metadata)
  SELECT 'reconocimiento', _msg, ur.user_id, jsonb_build_object(
    'reconocimiento_id', _rec.id,
    'posicion', _rec.posicion,
    'periodo', _rec.periodo,
    'bono', _rec.bono,
    'guardia_id', _rec.guardia_id
  )
  FROM public.user_roles ur
  WHERE ur.role IN ('guardia'::app_role, 'supervisor'::app_role, 'admin'::app_role);
END;
$$;