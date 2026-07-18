
-- 1) reportes_turno
DROP POLICY IF EXISTS "Guards can manage own reportes" ON public.reportes_turno;
CREATE POLICY "Guards can insert own reportes"
  ON public.reportes_turno FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = guardia_id);
CREATE POLICY "Guards can view own reportes"
  ON public.reportes_turno FOR SELECT TO authenticated
  USING (auth.uid() = guardia_id);

-- 2) chat_messages: prevent tampering on UPDATE
DROP POLICY IF EXISTS "Users can update own sent read status" ON public.chat_messages;
CREATE POLICY "Receivers can mark messages read"
  ON public.chat_messages FOR UPDATE TO authenticated
  USING (auth.uid() = receiver_id)
  WITH CHECK (
    auth.uid() = receiver_id
    AND sender_id   = (SELECT c.sender_id   FROM public.chat_messages c WHERE c.id = chat_messages.id)
    AND receiver_id = (SELECT c.receiver_id FROM public.chat_messages c WHERE c.id = chat_messages.id)
    AND message     = (SELECT c.message     FROM public.chat_messages c WHERE c.id = chat_messages.id)
  );

-- 3) Scope broad authenticated-true SELECT policies
DROP POLICY IF EXISTS "Anyone authenticated can read servicios" ON public.servicios;
CREATE POLICY "Guards read assigned servicios"
  ON public.servicios FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.guardia_servicios gs WHERE gs.servicio_id = servicios.id AND gs.guardia_id = auth.uid()));

DROP POLICY IF EXISTS "Anyone authenticated can read checkpoints" ON public.checkpoints;
CREATE POLICY "Guards read checkpoints of assigned servicios"
  ON public.checkpoints FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.guardia_servicios gs WHERE gs.servicio_id = checkpoints.servicio_id AND gs.guardia_id = auth.uid()));

DROP POLICY IF EXISTS "Anyone authenticated can read metas" ON public.metas_servicio;
CREATE POLICY "Guards read metas of assigned servicios"
  ON public.metas_servicio FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.guardia_servicios gs WHERE gs.servicio_id = metas_servicio.servicio_id AND gs.guardia_id = auth.uid()));
CREATE POLICY "Supervisors read all metas"
  ON public.metas_servicio FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'supervisor'::app_role));
CREATE POLICY "Admins read all metas"
  ON public.metas_servicio FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Clientes read metas of their servicios"
  ON public.metas_servicio FOR SELECT TO authenticated
  USING (public.cliente_has_servicio(auth.uid(), servicio_id));

DROP POLICY IF EXISTS "Anyone authenticated can view pendientes" ON public.pendientes_puesto;
CREATE POLICY "Guards view pendientes of assigned servicios"
  ON public.pendientes_puesto FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.guardia_servicios gs WHERE gs.servicio_id = pendientes_puesto.servicio_id AND gs.guardia_id = auth.uid()));
CREATE POLICY "Clientes view pendientes of their servicios"
  ON public.pendientes_puesto FOR SELECT TO authenticated
  USING (public.cliente_has_servicio(auth.uid(), servicio_id));

DROP POLICY IF EXISTS "Anyone authenticated can view completados" ON public.pendientes_completados;
CREATE POLICY "Guards view own completados"
  ON public.pendientes_completados FOR SELECT TO authenticated
  USING (auth.uid() = guardia_id);
CREATE POLICY "Supervisors view all completados"
  ON public.pendientes_completados FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'supervisor'::app_role));
CREATE POLICY "Admins view all completados"
  ON public.pendientes_completados FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Clientes view completados of their servicios"
  ON public.pendientes_completados FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.pendientes_puesto pp
    WHERE pp.id = pendientes_completados.pendiente_id
      AND public.cliente_has_servicio(auth.uid(), pp.servicio_id)
  ));

DROP POLICY IF EXISTS "Anyone authenticated can view cuadro_honor" ON public.cuadro_honor;
CREATE POLICY "Guards view own cuadro_honor"
  ON public.cuadro_honor FOR SELECT TO authenticated
  USING (auth.uid() = guardia_id);
CREATE POLICY "Supervisors view all cuadro_honor"
  ON public.cuadro_honor FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'supervisor'::app_role));
CREATE POLICY "Clientes view cuadro_honor of their servicios"
  ON public.cuadro_honor FOR SELECT TO authenticated
  USING (public.cliente_has_servicio(auth.uid(), servicio_id));

-- 4) Storage policies (buckets already made private via tool)
DROP POLICY IF EXISTS "Anyone authenticated can view evidencias" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view visit photos" ON storage.objects;
DROP POLICY IF EXISTS "Pendientes fotos publicly readable" ON storage.objects;

CREATE POLICY "Evidencias readable by owner or staff"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'evidencias'
    AND (
      (storage.foldername(name))[1] = (auth.uid())::text
      OR public.has_role(auth.uid(), 'supervisor'::app_role)
      OR public.has_role(auth.uid(), 'admin'::app_role)
    )
  );

CREATE POLICY "Visitas photos readable by owner or staff"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'visitas'
    AND (
      (storage.foldername(name))[1] = (auth.uid())::text
      OR public.has_role(auth.uid(), 'supervisor'::app_role)
      OR public.has_role(auth.uid(), 'admin'::app_role)
    )
  );

CREATE POLICY "Pendientes fotos readable by owner or staff"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'pendientes'
    AND (
      (storage.foldername(name))[1] = (auth.uid())::text
      OR public.has_role(auth.uid(), 'supervisor'::app_role)
      OR public.has_role(auth.uid(), 'admin'::app_role)
    )
  );

-- 5) Revoke EXECUTE on internal helpers (postgres role still runs them inside policies)
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_user_role(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cliente_has_servicio(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_assigned_supervisor(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.promote_user(uuid, app_role) FROM PUBLIC, anon;
