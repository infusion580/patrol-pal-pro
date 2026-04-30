-- Tabla de pendientes/tareas por puesto
CREATE TABLE public.pendientes_puesto (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  servicio_id UUID NOT NULL,
  guardia_id UUID NULL,
  titulo TEXT NOT NULL,
  descripcion TEXT NOT NULL DEFAULT '',
  prioridad TEXT NOT NULL DEFAULT 'media' CHECK (prioridad IN ('baja','media','alta','critica')),
  frecuencia TEXT NOT NULL DEFAULT 'cada_turno' CHECK (frecuencia IN ('unica','cada_turno','cada_horas')),
  horas_intervalo INTEGER NULL,
  activo BOOLEAN NOT NULL DEFAULT true,
  vigencia_inicio DATE NOT NULL DEFAULT CURRENT_DATE,
  vigencia_fin DATE NULL,
  created_by UUID NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_pendientes_servicio ON public.pendientes_puesto(servicio_id);
CREATE INDEX idx_pendientes_guardia ON public.pendientes_puesto(guardia_id);
CREATE INDEX idx_pendientes_activo ON public.pendientes_puesto(activo);

ALTER TABLE public.pendientes_puesto ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view pendientes"
  ON public.pendientes_puesto FOR SELECT TO authenticated USING (true);

CREATE POLICY "Supervisors manage pendientes"
  ON public.pendientes_puesto FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'supervisor'::app_role))
  WITH CHECK (has_role(auth.uid(), 'supervisor'::app_role));

CREATE POLICY "Admins manage pendientes"
  ON public.pendientes_puesto FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_pendientes_updated_at
  BEFORE UPDATE ON public.pendientes_puesto
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Tabla de registros de cumplimiento
CREATE TABLE public.pendientes_completados (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pendiente_id UUID NOT NULL,
  guardia_id UUID NOT NULL,
  turno_id UUID NULL,
  nota TEXT NULL DEFAULT '',
  foto_url TEXT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_completados_pendiente ON public.pendientes_completados(pendiente_id);
CREATE INDEX idx_completados_guardia ON public.pendientes_completados(guardia_id);
CREATE INDEX idx_completados_created ON public.pendientes_completados(created_at);

ALTER TABLE public.pendientes_completados ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view completados"
  ON public.pendientes_completados FOR SELECT TO authenticated USING (true);

CREATE POLICY "Guards register own completados"
  ON public.pendientes_completados FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = guardia_id);

CREATE POLICY "Supervisors delete completados"
  ON public.pendientes_completados FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'supervisor'::app_role));

CREATE POLICY "Admins delete completados"
  ON public.pendientes_completados FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

ALTER PUBLICATION supabase_realtime ADD TABLE public.pendientes_puesto;
ALTER PUBLICATION supabase_realtime ADD TABLE public.pendientes_completados;