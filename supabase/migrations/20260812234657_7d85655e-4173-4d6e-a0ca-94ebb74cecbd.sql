
-- Cumplimiento de metas del guardia (0-100) en los últimos N días
CREATE OR REPLACE FUNCTION public.cumplimiento_metas_guardia(_guardia_id uuid, _dias integer DEFAULT 30)
RETURNS numeric
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT CASE
    WHEN COALESCE(SUM(rondines_meta),0) + COALESCE(SUM(reportes_meta),0) = 0 THEN 0
    ELSE LEAST(100, ROUND(
      100.0 * (
        LEAST(COALESCE(SUM(rondines_completados),0), COALESCE(SUM(rondines_meta),0)) +
        LEAST(COALESCE(SUM(reportes_completados),0), COALESCE(SUM(reportes_meta),0))
      ) / NULLIF(COALESCE(SUM(rondines_meta),0) + COALESCE(SUM(reportes_meta),0), 0)
    , 0))
  END
  FROM public.cuadro_honor
  WHERE guardia_id = _guardia_id
    AND fecha >= (CURRENT_DATE - COALESCE(_dias, 30));
$$;

GRANT EXECUTE ON FUNCTION public.cumplimiento_metas_guardia(uuid, integer) TO authenticated;

-- Publicar reconocimiento: el sistema decide el bono y crea el comunicado
CREATE OR REPLACE FUNCTION public.publicar_reconocimiento(_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _rec RECORD;
  _nombre text;
  _msg text;
  _cumpl numeric;
  _bono numeric := 0;
  _com_id uuid;
  _autor text;
BEGIN
  IF NOT (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'supervisor'::app_role)) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  SELECT * INTO _rec FROM public.reconocimientos WHERE id = _id;
  IF _rec IS NULL THEN
    RAISE EXCEPTION 'Reconocimiento no encontrado';
  END IF;

  -- El sistema decide el bono: solo posición #1 con metas al 100%
  _cumpl := public.cumplimiento_metas_guardia(_rec.guardia_id, 30);
  IF _rec.posicion = 1 AND _cumpl >= 100 THEN
    _bono := GREATEST(0, COALESCE(_rec.bono, 0));
  ELSE
    _bono := 0;
  END IF;

  UPDATE public.reconocimientos
     SET publicado = true,
         bono = _bono,
         publicado_at = COALESCE(publicado_at, now())
   WHERE id = _id;

  SELECT trim(coalesce(p.nombre,'') || ' ' || coalesce(p.apellido,'')) INTO _nombre
    FROM public.profiles p WHERE p.user_id = _rec.guardia_id;
  _nombre := coalesce(nullif(_nombre,''), 'Guardia');

  SELECT trim(coalesce(p.nombre,'') || ' ' || coalesce(p.apellido,'')) INTO _autor
    FROM public.profiles p WHERE p.user_id = auth.uid();
  _autor := coalesce(nullif(_autor,''), 'Administración');

  _msg := '🏆 Cuadro de Honor ' || _rec.periodo || ' — #' || _rec.posicion || ' ' ||
          _nombre || '. Motivo: ' || _rec.motivo ||
          CASE WHEN _bono > 0 THEN '. Bono: $' || trim(to_char(_bono, 'FM999,999,990.00')) ELSE '' END;

  INSERT INTO public.notificaciones (tipo, mensaje, guardia_id, metadata)
  SELECT 'reconocimiento', _msg, ur.user_id, jsonb_build_object(
    'reconocimiento_id', _rec.id,
    'posicion', _rec.posicion,
    'periodo', _rec.periodo,
    'bono', _bono,
    'cumplimiento', _cumpl,
    'guardia_id', _rec.guardia_id
  )
  FROM public.user_roles ur
  WHERE ur.role IN ('guardia'::app_role, 'supervisor'::app_role, 'admin'::app_role);

  -- Comunicado automático (anuncio en el módulo de Comunicados)
  INSERT INTO public.comunicados (titulo, contenido, prioridad, estado, publicado_at, autor_id, autor_nombre)
  VALUES (
    '🏆 Cuadro de Honor ' || _rec.periodo || ' — #' || _rec.posicion || ' ' || _nombre,
    _nombre || ' obtuvo el lugar #' || _rec.posicion || ' del Cuadro de Honor de ' || _rec.periodo || '.' || chr(10) ||
    'Motivo: ' || _rec.motivo || chr(10) ||
    'Cumplimiento de metas: ' || trim(to_char(_cumpl, 'FM990')) || '%' || chr(10) ||
    CASE WHEN _bono > 0
      THEN 'Bono otorgado automáticamente por cumplir el 100% de sus metas en el primer lugar: $' || trim(to_char(_bono, 'FM999,999,990.00'))
      ELSE 'Sin bono económico: el bono se otorga únicamente al primer lugar con el 100% de sus metas cumplidas.'
    END,
    CASE WHEN _bono > 0 THEN 'alta' ELSE 'normal' END,
    'publicado',
    now(),
    auth.uid(),
    _autor
  )
  RETURNING id INTO _com_id;

  PERFORM public.notificar_comunicado(_com_id);
END;
$$;
