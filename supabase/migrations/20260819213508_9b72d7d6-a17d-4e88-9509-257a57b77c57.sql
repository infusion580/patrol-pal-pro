DROP POLICY IF EXISTS "Historial visible con el prestamo" ON public.prestamo_historial;
CREATE POLICY "Historial visible solo a involucrados"
ON public.prestamo_historial FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.prestamos p
    WHERE p.id = prestamo_historial.prestamo_id
      AND (
        p.guardia_id = auth.uid()
        OR public.has_role(auth.uid(), 'admin'::app_role)
        OR (
          public.has_role(auth.uid(), 'supervisor'::app_role)
          AND (p.supervisor_id = auth.uid() OR public.get_assigned_supervisor(p.guardia_id) = auth.uid())
        )
      )
  )
);

DROP POLICY IF EXISTS "Autor o guardia del servicio pueden actualizar nota" ON public.notas_relevo;
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
WITH CHECK (
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