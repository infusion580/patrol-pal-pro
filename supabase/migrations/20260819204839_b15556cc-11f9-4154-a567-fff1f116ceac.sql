-- ============ Comunicados privados ============
ALTER TABLE public.comunicados ADD COLUMN IF NOT EXISTS destinatario_id uuid;
CREATE INDEX IF NOT EXISTS idx_comunicados_destinatario ON public.comunicados(destinatario_id);

DROP POLICY IF EXISTS "Todos ven comunicados publicados" ON public.comunicados;
DROP POLICY IF EXISTS "Clientes view comunicados publicados" ON public.comunicados;
DROP POLICY IF EXISTS "Admins y supervisores gestionan comunicados" ON public.comunicados;

CREATE POLICY "Ver comunicados publicados o dirigidos a mi"
ON public.comunicados FOR SELECT TO authenticated
USING (
  estado = 'publicado'
  AND (destinatario_id IS NULL OR destinatario_id = auth.uid())
);

CREATE POLICY "Admins gestionan comunicados"
ON public.comunicados FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Supervisores gestionan comunicados generales"
ON public.comunicados FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'supervisor'::app_role) AND (destinatario_id IS NULL OR destinatario_id = auth.uid()))
WITH CHECK (public.has_role(auth.uid(), 'supervisor'::app_role) AND destinatario_id IS NULL);

-- ============ Préstamos ============
CREATE SEQUENCE IF NOT EXISTS public.prestamo_folio_seq;

CREATE TABLE IF NOT EXISTS public.prestamos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  folio text NOT NULL UNIQUE,
  guardia_id uuid NOT NULL,
  supervisor_id uuid,
  monto numeric(12,2) NOT NULL CHECK (monto > 0),
  motivo text NOT NULL DEFAULT '',
  observaciones text NOT NULL DEFAULT '',
  estado text NOT NULL DEFAULT 'pendiente_supervisor',
  rechazo_motivo text,
  rechazo_comentario text,
  aprobado_supervisor_por uuid,
  aprobado_supervisor_at timestamptz,
  aprobado_admin_por uuid,
  aprobado_admin_at timestamptz,
  depositado_por uuid,
  depositado_at timestamptz,
  rechazado_por uuid,
  rechazado_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.prestamos TO authenticated;
GRANT ALL ON public.prestamos TO service_role;
ALTER TABLE public.prestamos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Guardia ve sus prestamos"
ON public.prestamos FOR SELECT TO authenticated
USING (guardia_id = auth.uid());

CREATE POLICY "Supervisor ve prestamos de sus guardias"
ON public.prestamos FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'supervisor'::app_role)
  AND (supervisor_id = auth.uid() OR public.get_assigned_supervisor(guardia_id) = auth.uid())
);

CREATE POLICY "Admin ve todos los prestamos"
ON public.prestamos FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Guardia crea su solicitud"
ON public.prestamos FOR INSERT TO authenticated
WITH CHECK (guardia_id = auth.uid() AND estado = 'pendiente_supervisor');

CREATE TRIGGER trg_prestamos_updated_at
BEFORE UPDATE ON public.prestamos
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.prestamo_historial (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prestamo_id uuid NOT NULL REFERENCES public.prestamos(id) ON DELETE CASCADE,
  actor_id uuid,
  actor_nombre text NOT NULL DEFAULT '',
  actor_rol text NOT NULL DEFAULT '',
  accion text NOT NULL,
  estado_anterior text,
  estado_nuevo text,
  comentario text,
  motivo text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.prestamo_historial TO authenticated;
GRANT ALL ON public.prestamo_historial TO service_role;
ALTER TABLE public.prestamo_historial ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Historial visible con el prestamo"
ON public.prestamo_historial FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.prestamos p WHERE p.id = prestamo_id));

-- ============ Helpers ============
CREATE OR REPLACE FUNCTION public.prestamo_nombre(_user_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(NULLIF(trim(COALESCE(nombre,'') || ' ' || COALESCE(apellido,'')), ''), 'Usuario')
  FROM public.profiles WHERE user_id = _user_id LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.prestamo_comunicado_privado(_dest uuid, _titulo text, _mensaje text, _prioridad text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF _dest IS NULL THEN RETURN; END IF;
  INSERT INTO public.comunicados (titulo, contenido, prioridad, estado, publicado_at, autor_id, autor_nombre, destinatario_id)
  VALUES (_titulo, _mensaje, COALESCE(_prioridad,'normal'), 'publicado', now(), auth.uid(), 'Recursos Humanos', _dest);

  INSERT INTO public.notificaciones (tipo, mensaje, guardia_id, metadata)
  VALUES ('prestamo', _titulo || E'\n' || _mensaje, _dest, jsonb_build_object('privado', true));
END;
$$;

CREATE OR REPLACE FUNCTION public.prestamo_log(_prestamo_id uuid, _accion text, _antes text, _despues text, _comentario text, _motivo text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.prestamo_historial (prestamo_id, actor_id, actor_nombre, actor_rol, accion, estado_anterior, estado_nuevo, comentario, motivo)
  VALUES (_prestamo_id, auth.uid(), public.prestamo_nombre(auth.uid()),
          COALESCE(public.get_user_role(auth.uid())::text, ''), _accion, _antes, _despues, _comentario, _motivo);
END;
$$;

-- ============ Crear solicitud ============
CREATE OR REPLACE FUNCTION public.prestamo_crear(_monto numeric, _motivo text, _observaciones text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
  _sup uuid;
  _folio text;
  _id uuid;
  _nombre text;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;
  IF COALESCE(_monto,0) <= 0 THEN RAISE EXCEPTION 'El monto debe ser mayor a cero'; END IF;
  IF COALESCE(trim(_motivo),'') = '' THEN RAISE EXCEPTION 'Indica el motivo'; END IF;

  _sup := public.get_assigned_supervisor(_uid);
  _folio := 'PRE-' || to_char(now(), 'YYYYMMDD') || '-' || lpad(nextval('public.prestamo_folio_seq')::text, 4, '0');

  INSERT INTO public.prestamos (folio, guardia_id, supervisor_id, monto, motivo, observaciones)
  VALUES (_folio, _uid, _sup, _monto, trim(_motivo), COALESCE(trim(_observaciones), ''))
  RETURNING id INTO _id;

  PERFORM public.prestamo_log(_id, 'creada', NULL, 'pendiente_supervisor', NULL, NULL);

  _nombre := public.prestamo_nombre(_uid);

  PERFORM public.prestamo_comunicado_privado(
    _uid,
    'Solicitud de préstamo ' || _folio || ' recibida',
    'Tu solicitud de préstamo ha sido recibida correctamente y se encuentra pendiente de revisión.',
    'normal');

  PERFORM public.prestamo_comunicado_privado(
    _sup,
    'Nueva solicitud de préstamo ' || _folio,
    _nombre || ' solicitó un préstamo por $' || trim(to_char(_monto,'FM999,999,990.00')) || '. Motivo: ' || trim(_motivo) || '. Requiere tu revisión.',
    'alta');

  PERFORM public.prestamo_comunicado_privado(ur.user_id,
    'Nueva solicitud de préstamo ' || _folio,
    _nombre || ' solicitó un préstamo por $' || trim(to_char(_monto,'FM999,999,990.00')) || '. Motivo: ' || trim(_motivo) || '. En revisión del supervisor.',
    'normal')
  FROM public.user_roles ur WHERE ur.role = 'admin'::app_role;

  RETURN _id;
END;
$$;

-- ============ Aprobación del supervisor ============
CREATE OR REPLACE FUNCTION public.prestamo_aprobar_supervisor(_id uuid, _comentario text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _p RECORD; _nombre text;
BEGIN
  SELECT * INTO _p FROM public.prestamos WHERE id = _id FOR UPDATE;
  IF _p IS NULL THEN RAISE EXCEPTION 'Solicitud no encontrada'; END IF;
  IF _p.estado <> 'pendiente_supervisor' THEN RAISE EXCEPTION 'La solicitud no está pendiente del supervisor'; END IF;
  IF NOT (public.has_role(auth.uid(), 'admin'::app_role)
          OR (public.has_role(auth.uid(), 'supervisor'::app_role)
              AND (_p.supervisor_id = auth.uid() OR public.get_assigned_supervisor(_p.guardia_id) = auth.uid()))) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  UPDATE public.prestamos
     SET estado = 'pendiente_admin', aprobado_supervisor_por = auth.uid(), aprobado_supervisor_at = now()
   WHERE id = _id;

  PERFORM public.prestamo_log(_id, 'aprobada_supervisor', 'pendiente_supervisor', 'pendiente_admin', _comentario, NULL);

  _nombre := public.prestamo_nombre(_p.guardia_id);

  PERFORM public.prestamo_comunicado_privado(_p.guardia_id,
    'Solicitud ' || _p.folio || ' aprobada por el Supervisor',
    'Tu solicitud fue aprobada por el Supervisor y continúa en revisión administrativa.', 'normal');

  PERFORM public.prestamo_comunicado_privado(ur.user_id,
    'Solicitud ' || _p.folio || ' pendiente de aprobación administrativa',
    'La solicitud de ' || _nombre || ' por $' || trim(to_char(_p.monto,'FM999,999,990.00')) || ' fue aprobada por el supervisor y requiere tu aprobación.',
    'alta')
  FROM public.user_roles ur WHERE ur.role = 'admin'::app_role;
END;
$$;

-- ============ Aprobación del administrador ============
CREATE OR REPLACE FUNCTION public.prestamo_aprobar_admin(_id uuid, _comentario text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _p RECORD;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN RAISE EXCEPTION 'No autorizado'; END IF;
  SELECT * INTO _p FROM public.prestamos WHERE id = _id FOR UPDATE;
  IF _p IS NULL THEN RAISE EXCEPTION 'Solicitud no encontrada'; END IF;
  IF _p.estado <> 'pendiente_admin' THEN RAISE EXCEPTION 'La solicitud no está pendiente del administrador'; END IF;

  UPDATE public.prestamos
     SET estado = 'aprobado_transito', aprobado_admin_por = auth.uid(), aprobado_admin_at = now()
   WHERE id = _id;

  PERFORM public.prestamo_log(_id, 'aprobada_admin', 'pendiente_admin', 'aprobado_transito', _comentario, NULL);

  PERFORM public.prestamo_comunicado_privado(_p.guardia_id,
    'Préstamo ' || _p.folio || ' aprobado — Depósito en tránsito',
    'Tu solicitud de préstamo fue aprobada. Tu depósito se encuentra en tránsito hacia tu cuenta. El monto será descontado de tu próximo pago de nómina.',
    'alta');

  PERFORM public.prestamo_comunicado_privado(_p.supervisor_id,
    'Préstamo ' || _p.folio || ' aprobado por Administración',
    'La solicitud de ' || public.prestamo_nombre(_p.guardia_id) || ' fue aprobada. Depósito en tránsito.', 'normal');
END;
$$;

-- ============ Confirmar depósito ============
CREATE OR REPLACE FUNCTION public.prestamo_confirmar_deposito(_id uuid, _comentario text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _p RECORD;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN RAISE EXCEPTION 'Solo el administrador puede confirmar el depósito'; END IF;
  SELECT * INTO _p FROM public.prestamos WHERE id = _id FOR UPDATE;
  IF _p IS NULL THEN RAISE EXCEPTION 'Solicitud no encontrada'; END IF;
  IF _p.estado <> 'aprobado_transito' THEN RAISE EXCEPTION 'La solicitud debe estar aprobada con depósito en tránsito'; END IF;

  UPDATE public.prestamos
     SET estado = 'depositado', depositado_por = auth.uid(), depositado_at = now()
   WHERE id = _id;

  PERFORM public.prestamo_log(_id, 'depositado', 'aprobado_transito', 'depositado', _comentario, NULL);

  PERFORM public.prestamo_comunicado_privado(_p.guardia_id,
    'Préstamo ' || _p.folio || ' depositado',
    'Tu préstamo ha sido depositado correctamente. Recuerda que el monto será descontado de tu próximo pago de nómina.',
    'alta');
END;
$$;

-- ============ Rechazo ============
CREATE OR REPLACE FUNCTION public.prestamo_rechazar(_id uuid, _motivo text, _comentario text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _p RECORD; _texto text;
BEGIN
  SELECT * INTO _p FROM public.prestamos WHERE id = _id FOR UPDATE;
  IF _p IS NULL THEN RAISE EXCEPTION 'Solicitud no encontrada'; END IF;
  IF _p.estado NOT IN ('pendiente_supervisor','pendiente_admin') THEN RAISE EXCEPTION 'La solicitud ya no puede rechazarse'; END IF;
  IF COALESCE(trim(_motivo),'') = '' THEN RAISE EXCEPTION 'Selecciona un motivo de rechazo'; END IF;

  IF public.has_role(auth.uid(), 'admin'::app_role) THEN
    NULL;
  ELSIF public.has_role(auth.uid(), 'supervisor'::app_role)
    AND _p.estado = 'pendiente_supervisor'
    AND (_p.supervisor_id = auth.uid() OR public.get_assigned_supervisor(_p.guardia_id) = auth.uid()) THEN
    NULL;
  ELSE
    RAISE EXCEPTION 'No autorizado';
  END IF;

  UPDATE public.prestamos
     SET estado = 'rechazado', rechazo_motivo = trim(_motivo), rechazo_comentario = NULLIF(trim(COALESCE(_comentario,'')),''),
         rechazado_por = auth.uid(), rechazado_at = now()
   WHERE id = _id;

  PERFORM public.prestamo_log(_id, 'rechazada', _p.estado, 'rechazado', _comentario, trim(_motivo));

  _texto := trim(_motivo) || CASE WHEN COALESCE(trim(_comentario),'') <> '' THEN ' — ' || trim(_comentario) ELSE '' END;

  PERFORM public.prestamo_comunicado_privado(_p.guardia_id,
    'Solicitud de préstamo ' || _p.folio || ' rechazada',
    'Lamentamos informarte que tu solicitud de préstamo ha sido rechazada. Motivo: ' || _texto,
    'alta');
END;
$$;