
ALTER TABLE public.servicios
  ADD COLUMN IF NOT EXISTS rondin_intervalo_minutos INTEGER,
  ADD COLUMN IF NOT EXISTS rondin_tolerancia_minutos INTEGER NOT NULL DEFAULT 10;

CREATE TABLE IF NOT EXISTS public.rondin_alarmas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  servicio_id UUID NOT NULL REFERENCES public.servicios(id) ON DELETE CASCADE,
  guardia_id UUID NOT NULL,
  turno_id UUID,
  scheduled_at TIMESTAMPTZ NOT NULL,
  notified_at TIMESTAMPTZ,
  responded_at TIMESTAMPTZ,
  delay_seconds INTEGER,
  cumplido BOOLEAN NOT NULL DEFAULT false,
  falta_generada BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.rondin_alarmas TO authenticated;
GRANT ALL ON public.rondin_alarmas TO service_role;

ALTER TABLE public.rondin_alarmas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Guardia ve sus alarmas"
  ON public.rondin_alarmas FOR SELECT TO authenticated
  USING (
    guardia_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'supervisor'::app_role)
  );

CREATE POLICY "Guardia crea sus alarmas"
  ON public.rondin_alarmas FOR INSERT TO authenticated
  WITH CHECK (guardia_id = auth.uid());

CREATE POLICY "Guardia actualiza sus alarmas"
  ON public.rondin_alarmas FOR UPDATE TO authenticated
  USING (
    guardia_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'supervisor'::app_role)
  );

CREATE POLICY "Admin borra alarmas"
  ON public.rondin_alarmas FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

DROP TRIGGER IF EXISTS rondin_alarmas_updated_at ON public.rondin_alarmas;
CREATE TRIGGER rondin_alarmas_updated_at
  BEFORE UPDATE ON public.rondin_alarmas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_rondin_alarmas_guardia ON public.rondin_alarmas(guardia_id, scheduled_at DESC);
CREATE INDEX IF NOT EXISTS idx_rondin_alarmas_servicio ON public.rondin_alarmas(servicio_id, scheduled_at DESC);
