CREATE TABLE public.notas_relevo (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  servicio_id uuid REFERENCES public.servicios(id) ON DELETE CASCADE,
  turno_id uuid,
  autor_id uuid NOT NULL,
  autor_nombre text NOT NULL DEFAULT '',
  pendientes text NOT NULL DEFAULT '',
  instrucciones text NOT NULL DEFAULT '',
  importante boolean NOT NULL DEFAULT false,
  leida_por uuid,
  leida_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_notas_relevo_servicio_created ON public.notas_relevo (servicio_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE ON public.notas_relevo TO authenticated;
GRANT ALL ON public.notas_relevo TO service_role;

ALTER TABLE public.notas_relevo ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autor puede crear su nota de relevo"
ON public.notas_relevo FOR INSERT TO authenticated
WITH CHECK (auth.uid() = autor_id);

CREATE POLICY "Guardias del servicio pueden ver notas"
ON public.notas_relevo FOR SELECT TO authenticated
USING (
  auth.uid() = autor_id
  OR public.has_role(auth.uid(), 'supervisor'::app_role)
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.guardia_servicios gs
    WHERE gs.guardia_id = auth.uid() AND gs.servicio_id = notas_relevo.servicio_id
  )
  OR EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = auth.uid() AND p.servicio_asignado_id = notas_relevo.servicio_id
  )
);

CREATE POLICY "Autor o guardia del servicio pueden actualizar nota"
ON public.notas_relevo FOR UPDATE TO authenticated
USING (
  auth.uid() = autor_id
  OR public.has_role(auth.uid(), 'supervisor'::app_role)
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.guardia_servicios gs
    WHERE gs.guardia_id = auth.uid() AND gs.servicio_id = notas_relevo.servicio_id
  )
  OR EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = auth.uid() AND p.servicio_asignado_id = notas_relevo.servicio_id
  )
)
WITH CHECK (true);

CREATE TRIGGER trg_notas_relevo_updated_at
BEFORE UPDATE ON public.notas_relevo
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();