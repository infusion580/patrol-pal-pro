CREATE TABLE public.sesion_registros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  evento text NOT NULL CHECK (evento IN ('login','logout')),
  foto_url text,
  lat double precision,
  lng double precision,
  precision_metros numeric,
  ubicacion_error text,
  dispositivo jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.sesion_registros TO authenticated;
GRANT ALL ON public.sesion_registros TO service_role;

ALTER TABLE public.sesion_registros ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuarios registran sus propias sesiones"
ON public.sesion_registros FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuarios ven sus propios registros de sesion"
ON public.sesion_registros FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Supervisores y admins ven todos los registros de sesion"
ON public.sesion_registros FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'supervisor'::app_role));

CREATE INDEX idx_sesion_registros_user_fecha ON public.sesion_registros (user_id, created_at DESC);
CREATE INDEX idx_sesion_registros_fecha ON public.sesion_registros (created_at DESC);