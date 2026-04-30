-- 1. Add tipo_turno to servicios
ALTER TABLE public.servicios
  ADD COLUMN IF NOT EXISTS tipo_turno text NOT NULL DEFAULT '12h'
  CHECK (tipo_turno IN ('12h','24h','corrido'));

-- 2. Asistencias table
CREATE TABLE IF NOT EXISTS public.asistencias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guardia_id uuid NOT NULL,
  servicio_id uuid,
  turno_id uuid,
  tipo_turno text NOT NULL CHECK (tipo_turno IN ('12h','24h','corrido')),
  inicio timestamptz NOT NULL DEFAULT now(),
  fin timestamptz,
  fin_esperado timestamptz,
  duracion_minutos integer,
  status text NOT NULL DEFAULT 'activo' CHECK (status IN ('activo','completo','incompleto')),
  observaciones text DEFAULT '',
  auto_generado boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_asistencias_servicio_inicio ON public.asistencias(servicio_id, inicio);
CREATE INDEX IF NOT EXISTS idx_asistencias_guardia_inicio ON public.asistencias(guardia_id, inicio);
CREATE INDEX IF NOT EXISTS idx_asistencias_status ON public.asistencias(status);

ALTER TABLE public.asistencias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Guards manage own asistencias"
  ON public.asistencias FOR ALL TO authenticated
  USING (auth.uid() = guardia_id)
  WITH CHECK (auth.uid() = guardia_id);

CREATE POLICY "Supervisors manage all asistencias"
  ON public.asistencias FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'supervisor'::app_role))
  WITH CHECK (has_role(auth.uid(), 'supervisor'::app_role));

CREATE POLICY "Admins manage all asistencias"
  ON public.asistencias FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_asistencias_updated_at
  BEFORE UPDATE ON public.asistencias
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Faltas table
CREATE TABLE IF NOT EXISTS public.faltas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guardia_id uuid NOT NULL,
  servicio_id uuid,
  fecha date NOT NULL DEFAULT CURRENT_DATE,
  tipo_turno_esperado text CHECK (tipo_turno_esperado IN ('12h','24h','corrido')),
  motivo text NOT NULL DEFAULT 'no inicio turno',
  detalle text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_faltas_servicio_fecha ON public.faltas(servicio_id, fecha);
CREATE INDEX IF NOT EXISTS idx_faltas_guardia_fecha ON public.faltas(guardia_id, fecha);

ALTER TABLE public.faltas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Guards view own faltas"
  ON public.faltas FOR SELECT TO authenticated
  USING (auth.uid() = guardia_id);

CREATE POLICY "Supervisors manage faltas"
  ON public.faltas FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'supervisor'::app_role))
  WITH CHECK (has_role(auth.uid(), 'supervisor'::app_role));

CREATE POLICY "Admins manage faltas"
  ON public.faltas FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));