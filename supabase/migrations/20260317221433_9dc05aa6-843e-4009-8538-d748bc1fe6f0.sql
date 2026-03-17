
-- Add lat/lng to checkpoints for GPS-based verification
ALTER TABLE public.checkpoints ADD COLUMN IF NOT EXISTS lat double precision;
ALTER TABLE public.checkpoints ADD COLUMN IF NOT EXISTS lng double precision;
ALTER TABLE public.checkpoints ADD COLUMN IF NOT EXISTS radius_metros integer NOT NULL DEFAULT 50;

-- Create HR records table for extra shifts, loans, vacations
CREATE TABLE public.registros_rh (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  guardia_id UUID NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('turno_extra', 'prestamo', 'vacaciones')),
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  fecha_fin DATE,
  monto NUMERIC,
  nota TEXT DEFAULT '',
  created_by UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pendiente' CHECK (status IN ('pendiente', 'aprobado', 'rechazado')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.registros_rh ENABLE ROW LEVEL SECURITY;

-- Supervisors can manage all HR records
CREATE POLICY "Supervisors can manage registros_rh" ON public.registros_rh
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'supervisor'::app_role))
  WITH CHECK (has_role(auth.uid(), 'supervisor'::app_role));

-- Admins can manage all HR records
CREATE POLICY "Admins can manage registros_rh" ON public.registros_rh
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Guards can view their own HR records
CREATE POLICY "Guards can view own registros_rh" ON public.registros_rh
  FOR SELECT TO authenticated
  USING (auth.uid() = guardia_id);
