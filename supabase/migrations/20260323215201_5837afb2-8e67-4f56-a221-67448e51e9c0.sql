
-- Create turnos table for shift tracking
CREATE TABLE public.turnos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  guardia_id UUID NOT NULL,
  servicio_id UUID REFERENCES public.servicios(id),
  inicio TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  fin TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL DEFAULT 'activo',
  comentario_cambio TEXT DEFAULT '',
  guardia_entrante TEXT DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.turnos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Guards can manage own turnos" ON public.turnos FOR ALL TO authenticated
  USING (auth.uid() = guardia_id) WITH CHECK (auth.uid() = guardia_id);

CREATE POLICY "Supervisors can view all turnos" ON public.turnos FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'supervisor'::app_role));

CREATE POLICY "Admins can view all turnos" ON public.turnos FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.turnos;

-- Add supervisor SELECT policy on user_roles if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'user_roles' AND policyname = 'Supervisors can view all roles'
  ) THEN
    CREATE POLICY "Supervisors can view all roles" ON public.user_roles FOR SELECT TO authenticated
      USING (has_role(auth.uid(), 'supervisor'::app_role));
  END IF;
END $$;
