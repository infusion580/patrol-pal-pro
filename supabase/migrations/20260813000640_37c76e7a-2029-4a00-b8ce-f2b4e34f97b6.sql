-- 1) Nuevas banderas de visibilidad (todo visible por defecto)
ALTER TABLE public.cliente_reporte_config
  ADD COLUMN IF NOT EXISTS show_turnos_detalle boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_asistencias boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_horas_extra boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_faltas boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_notas_relevo boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_rondin_puntos boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_rondin_fotos boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_rondin_coordenadas boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_checkpoints boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_novedades boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_novedades_importantes boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_reportes_turno boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_visitas boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_visitas_detalle boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_visitas_fotos boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_pendientes boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_pendientes_cumplimiento boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_validaciones_puesto boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_validaciones_fotos boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_validaciones_ubicacion boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_sesiones boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_sesiones_fotos boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_sesiones_ubicacion boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_alertas boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_emergencias boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_comunicados boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_reconocimientos boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_metas_servicio boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_cumplimiento_guardia boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_export_pdf boolean NOT NULL DEFAULT true;

-- 2) Helper: ¿el guardia atiende algún servicio del cliente?
CREATE OR REPLACE FUNCTION public.cliente_has_guardia(_cliente_id uuid, _guardia_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.guardia_servicios gs
    JOIN public.cliente_servicios cs ON cs.servicio_id = gs.servicio_id
    WHERE gs.guardia_id = _guardia_id
      AND cs.cliente_id = _cliente_id
  )
$$;

-- 3) Lecturas de solo-consulta para el cliente, acotadas a sus servicios
CREATE POLICY "Clientes view visitas of their servicios"
ON public.visitas FOR SELECT TO authenticated
USING (servicio_id IS NOT NULL AND public.cliente_has_servicio(auth.uid(), servicio_id));

CREATE POLICY "Clientes view novedades of their servicios"
ON public.novedades FOR SELECT TO authenticated
USING (servicio_id IS NOT NULL AND public.cliente_has_servicio(auth.uid(), servicio_id));

CREATE POLICY "Clientes view faltas of their servicios"
ON public.faltas FOR SELECT TO authenticated
USING (servicio_id IS NOT NULL AND public.cliente_has_servicio(auth.uid(), servicio_id));

CREATE POLICY "Clientes view notas_relevo of their servicios"
ON public.notas_relevo FOR SELECT TO authenticated
USING (servicio_id IS NOT NULL AND public.cliente_has_servicio(auth.uid(), servicio_id));

CREATE POLICY "Clientes view validaciones of their servicios"
ON public.validaciones_puesto FOR SELECT TO authenticated
USING (servicio_id IS NOT NULL AND public.cliente_has_servicio(auth.uid(), servicio_id));

CREATE POLICY "Clientes view emergencias of their guardias"
ON public.emergencias FOR SELECT TO authenticated
USING (public.cliente_has_guardia(auth.uid(), guardia_id));

CREATE POLICY "Clientes view sesiones of their guardias"
ON public.sesion_registros FOR SELECT TO authenticated
USING (public.cliente_has_guardia(auth.uid(), user_id));

CREATE POLICY "Clientes view alertas of their guardias"
ON public.notificaciones FOR SELECT TO authenticated
USING (public.cliente_has_guardia(auth.uid(), guardia_id));

CREATE POLICY "Clientes view comunicados publicados"
ON public.comunicados FOR SELECT TO authenticated
USING (estado = 'publicado' AND public.has_role(auth.uid(), 'cliente'));

CREATE POLICY "Clientes view reconocimientos publicados"
ON public.reconocimientos FOR SELECT TO authenticated
USING (publicado = true AND public.has_role(auth.uid(), 'cliente'));