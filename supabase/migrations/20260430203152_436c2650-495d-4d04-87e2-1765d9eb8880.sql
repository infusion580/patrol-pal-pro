-- 1. Add 'cliente' to app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'cliente';

-- 2. Create cliente_servicios table (which services each client has access to)
CREATE TABLE public.cliente_servicios (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_id UUID NOT NULL,
  servicio_id UUID NOT NULL,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (cliente_id, servicio_id)
);

CREATE INDEX idx_cliente_servicios_cliente ON public.cliente_servicios(cliente_id);
CREATE INDEX idx_cliente_servicios_servicio ON public.cliente_servicios(servicio_id);

ALTER TABLE public.cliente_servicios ENABLE ROW LEVEL SECURITY;

-- Admins manage everything
CREATE POLICY "Admins manage cliente_servicios"
ON public.cliente_servicios FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Supervisors can view
CREATE POLICY "Supervisors view cliente_servicios"
ON public.cliente_servicios FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'supervisor'::app_role));

-- Clients can view their own assignments
CREATE POLICY "Clientes view own cliente_servicios"
ON public.cliente_servicios FOR SELECT TO authenticated
USING (auth.uid() = cliente_id);

-- 3. Helper function: check if user has access to a specific servicio as cliente
CREATE OR REPLACE FUNCTION public.cliente_has_servicio(_user_id uuid, _servicio_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.cliente_servicios
    WHERE cliente_id = _user_id AND servicio_id = _servicio_id
  )
$$;

-- 4. Add RLS policies so clients can READ data of their assigned services

-- servicios: clients can view their assigned servicios
CREATE POLICY "Clientes view assigned servicios"
ON public.servicios FOR SELECT TO authenticated
USING (cliente_has_servicio(auth.uid(), id));

-- profiles: clients can view profiles of guards assigned to their services
CREATE POLICY "Clientes view guards of their servicios"
ON public.profiles FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.guardia_servicios gs
    JOIN public.cliente_servicios cs ON cs.servicio_id = gs.servicio_id
    WHERE gs.guardia_id = profiles.user_id
      AND cs.cliente_id = auth.uid()
  )
);

-- guardia_servicios: clients can view assignments for their services
CREATE POLICY "Clientes view guardia_servicios of their servicios"
ON public.guardia_servicios FOR SELECT TO authenticated
USING (cliente_has_servicio(auth.uid(), servicio_id));

-- rondines: clients can view rondines of their services
CREATE POLICY "Clientes view rondines of their servicios"
ON public.rondines FOR SELECT TO authenticated
USING (servicio_id IS NOT NULL AND cliente_has_servicio(auth.uid(), servicio_id));

-- rondin_scans: clients can view scans for those rondines
CREATE POLICY "Clientes view scans of their servicios"
ON public.rondin_scans FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.rondines r
    WHERE r.id = rondin_scans.rondin_id
      AND r.servicio_id IS NOT NULL
      AND cliente_has_servicio(auth.uid(), r.servicio_id)
  )
);

-- turnos: clients can view turnos of their services
CREATE POLICY "Clientes view turnos of their servicios"
ON public.turnos FOR SELECT TO authenticated
USING (servicio_id IS NOT NULL AND cliente_has_servicio(auth.uid(), servicio_id));

-- asistencias: clients can view asistencias of their services
CREATE POLICY "Clientes view asistencias of their servicios"
ON public.asistencias FOR SELECT TO authenticated
USING (servicio_id IS NOT NULL AND cliente_has_servicio(auth.uid(), servicio_id));

-- checkpoints: clients can view checkpoints of their services
CREATE POLICY "Clientes view checkpoints of their servicios"
ON public.checkpoints FOR SELECT TO authenticated
USING (cliente_has_servicio(auth.uid(), servicio_id));

-- reportes_turno: clients can view reportes of guards in their services
CREATE POLICY "Clientes view reportes of their servicios"
ON public.reportes_turno FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.guardia_servicios gs
    JOIN public.cliente_servicios cs ON cs.servicio_id = gs.servicio_id
    WHERE gs.guardia_id = reportes_turno.guardia_id
      AND cs.cliente_id = auth.uid()
  )
);

-- pendientes_puesto: already has "Anyone authenticated can view" so clients can see them
-- pendientes_completados: already has "Anyone authenticated can view"
-- metas_servicio: already has "Anyone authenticated can read"
-- cuadro_honor: already has "Anyone authenticated can view"
