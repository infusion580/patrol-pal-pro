CREATE TABLE public.novedades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guardia_id uuid NOT NULL,
  servicio_id uuid REFERENCES public.servicios(id) ON DELETE SET NULL,
  turno_id uuid,
  descripcion text NOT NULL,
  importancia text NOT NULL DEFAULT 'normal',
  lat double precision,
  lng double precision,
  ubicacion_texto text,
  foto_url text,
  alerta_enviada_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_novedades_guardia_fecha ON public.novedades (guardia_id, created_at DESC);
CREATE INDEX idx_novedades_created_at ON public.novedades (created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.novedades TO authenticated;
GRANT ALL ON public.novedades TO service_role;

ALTER TABLE public.novedades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Guardias crean sus novedades"
ON public.novedades FOR INSERT TO authenticated
WITH CHECK (auth.uid() = guardia_id);

CREATE POLICY "Guardias ven sus novedades"
ON public.novedades FOR SELECT TO authenticated
USING (auth.uid() = guardia_id);

CREATE POLICY "Supervisores y admins ven todas las novedades"
ON public.novedades FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'supervisor'::app_role) OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Guardias editan sus novedades del dia"
ON public.novedades FOR UPDATE TO authenticated
USING (auth.uid() = guardia_id AND created_at::date = (now() AT TIME ZONE 'utc')::date)
WITH CHECK (auth.uid() = guardia_id);

CREATE POLICY "Guardias borran sus novedades del dia"
ON public.novedades FOR DELETE TO authenticated
USING (auth.uid() = guardia_id AND created_at::date = (now() AT TIME ZONE 'utc')::date);

CREATE TRIGGER trg_novedades_updated_at
BEFORE UPDATE ON public.novedades
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();