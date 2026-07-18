
-- Configuración por cliente sobre qué secciones del reporte puede ver
CREATE TABLE public.cliente_reporte_config (
  cliente_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  show_kpi_cumplimiento BOOLEAN NOT NULL DEFAULT true,
  show_kpi_rondines BOOLEAN NOT NULL DEFAULT true,
  show_kpi_guardias BOOLEAN NOT NULL DEFAULT true,
  show_kpi_incidencias BOOLEAN NOT NULL DEFAULT true,
  show_semaforo BOOLEAN NOT NULL DEFAULT true,
  show_chart_rondines_dia BOOLEAN NOT NULL DEFAULT true,
  show_chart_rondines_servicio BOOLEAN NOT NULL DEFAULT true,
  show_chart_distribucion_turnos BOOLEAN NOT NULL DEFAULT true,
  show_lista_guardias BOOLEAN NOT NULL DEFAULT true,
  show_lista_servicios BOOLEAN NOT NULL DEFAULT true,
  show_reportes_incidencias BOOLEAN NOT NULL DEFAULT true,
  show_export_excel BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cliente_reporte_config TO authenticated;
GRANT ALL ON public.cliente_reporte_config TO service_role;

ALTER TABLE public.cliente_reporte_config ENABLE ROW LEVEL SECURITY;

-- Admin puede administrar toda la configuración
CREATE POLICY "Admin manages cliente report config"
  ON public.cliente_reporte_config FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Cliente puede leer solo su propia configuración
CREATE POLICY "Cliente reads own report config"
  ON public.cliente_reporte_config FOR SELECT
  TO authenticated
  USING (cliente_id = auth.uid());

CREATE TRIGGER update_cliente_reporte_config_updated_at
  BEFORE UPDATE ON public.cliente_reporte_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
