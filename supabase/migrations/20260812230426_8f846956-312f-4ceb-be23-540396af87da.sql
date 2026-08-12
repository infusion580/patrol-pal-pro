CREATE TABLE public.validacion_puesto_config (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre text NOT NULL DEFAULT 'Validación de puesto',
  servicio_id uuid NOT NULL REFERENCES public.servicios(id) ON DELETE CASCADE,
  checkpoint_id uuid REFERENCES public.checkpoints(id) ON DELETE SET NULL,
  horarios time[] NOT NULL DEFAULT '{}',
  dias smallint[] NOT NULL DEFAULT '{0,1,2,3,4,5,6}',
  tolerancia_minutos integer NOT NULL DEFAULT 15,
  radio_metros integer NOT NULL DEFAULT 100,
  guardia_ids uuid[] NOT NULL DEFAULT '{}',
  activo boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.validacion_puesto_config TO authenticated;
GRANT ALL ON public.validacion_puesto_config TO service_role;
ALTER TABLE public.validacion_puesto_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff gestiona programaciones"
ON public.validacion_puesto_config FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'supervisor'))
WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'supervisor'));

CREATE POLICY "Guardias ven programaciones activas"
ON public.validacion_puesto_config FOR SELECT TO authenticated
USING (activo = true);

CREATE TRIGGER trg_validacion_puesto_config_updated
BEFORE UPDATE ON public.validacion_puesto_config
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.validaciones_puesto (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  config_id uuid REFERENCES public.validacion_puesto_config(id) ON DELETE SET NULL,
  guardia_id uuid NOT NULL,
  servicio_id uuid REFERENCES public.servicios(id) ON DELETE SET NULL,
  checkpoint_id uuid REFERENCES public.checkpoints(id) ON DELETE SET NULL,
  programado_at timestamptz NOT NULL,
  respondido_at timestamptz NOT NULL DEFAULT now(),
  foto_url text,
  lat double precision,
  lng double precision,
  precision_metros numeric,
  ubicacion_error text,
  distancia_metros numeric,
  dentro_area boolean NOT NULL DEFAULT false,
  resultado text NOT NULL DEFAULT 'valida',
  dispositivo jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX validaciones_puesto_unicas
  ON public.validaciones_puesto (config_id, guardia_id, programado_at);
CREATE INDEX validaciones_puesto_created_idx
  ON public.validaciones_puesto (created_at DESC);

GRANT SELECT, INSERT ON public.validaciones_puesto TO authenticated;
GRANT ALL ON public.validaciones_puesto TO service_role;
ALTER TABLE public.validaciones_puesto ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Guardias registran su validacion"
ON public.validaciones_puesto FOR INSERT TO authenticated
WITH CHECK (guardia_id = auth.uid());

CREATE POLICY "Guardias ven sus validaciones"
ON public.validaciones_puesto FOR SELECT TO authenticated
USING (guardia_id = auth.uid());

CREATE POLICY "Staff ve todas las validaciones"
ON public.validaciones_puesto FOR SELECT TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'supervisor'));