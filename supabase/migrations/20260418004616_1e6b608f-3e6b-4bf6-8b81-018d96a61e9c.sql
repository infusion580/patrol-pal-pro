-- Metas diarias por servicio (rondines + reportes)
CREATE TABLE public.metas_servicio (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  servicio_id UUID NOT NULL REFERENCES public.servicios(id) ON DELETE CASCADE,
  rondines_diarios INTEGER NOT NULL DEFAULT 4,
  reportes_diarios INTEGER NOT NULL DEFAULT 1,
  hora_inicio TIME NOT NULL DEFAULT '08:00',
  hora_fin TIME NOT NULL DEFAULT '20:00',
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(servicio_id)
);

ALTER TABLE public.metas_servicio ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can read metas"
  ON public.metas_servicio FOR SELECT TO authenticated USING (true);

CREATE POLICY "Supervisors can manage metas"
  ON public.metas_servicio FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'supervisor'::app_role))
  WITH CHECK (has_role(auth.uid(), 'supervisor'::app_role));

CREATE POLICY "Admins can manage metas"
  ON public.metas_servicio FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_metas_servicio_updated
  BEFORE UPDATE ON public.metas_servicio
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Cuadro de honor: registros diarios cuando un guardia cumple su meta
CREATE TABLE public.cuadro_honor (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  guardia_id UUID NOT NULL,
  servicio_id UUID REFERENCES public.servicios(id) ON DELETE SET NULL,
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  rondines_completados INTEGER NOT NULL DEFAULT 0,
  reportes_completados INTEGER NOT NULL DEFAULT 0,
  rondines_meta INTEGER NOT NULL DEFAULT 0,
  reportes_meta INTEGER NOT NULL DEFAULT 0,
  puntos INTEGER NOT NULL DEFAULT 0,
  insignias TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(guardia_id, fecha)
);

ALTER TABLE public.cuadro_honor ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view cuadro_honor"
  ON public.cuadro_honor FOR SELECT TO authenticated USING (true);

CREATE POLICY "Guards can insert own cuadro_honor"
  ON public.cuadro_honor FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = guardia_id);

CREATE POLICY "Guards can update own cuadro_honor"
  ON public.cuadro_honor FOR UPDATE TO authenticated
  USING (auth.uid() = guardia_id);

CREATE POLICY "Admins can manage cuadro_honor"
  ON public.cuadro_honor FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_cuadro_honor_fecha ON public.cuadro_honor(fecha DESC);
CREATE INDEX idx_cuadro_honor_guardia ON public.cuadro_honor(guardia_id);