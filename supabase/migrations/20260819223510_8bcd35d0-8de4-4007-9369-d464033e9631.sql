-- 1. chat_messages: only the "read" flag may change
CREATE OR REPLACE FUNCTION public.chat_messages_only_read_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.sender_id IS DISTINCT FROM OLD.sender_id
     OR NEW.receiver_id IS DISTINCT FROM OLD.receiver_id
     OR NEW.message IS DISTINCT FROM OLD.message
     OR NEW.created_at IS DISTINCT FROM OLD.created_at
     OR NEW.id IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION 'Solo se permite actualizar el estado de lectura del mensaje';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_chat_messages_only_read ON public.chat_messages;
CREATE TRIGGER trg_chat_messages_only_read
BEFORE UPDATE ON public.chat_messages
FOR EACH ROW EXECUTE FUNCTION public.chat_messages_only_read_update();

DROP POLICY IF EXISTS "Receivers can mark messages read" ON public.chat_messages;
CREATE POLICY "Receivers can mark messages read"
ON public.chat_messages FOR UPDATE TO authenticated
USING (auth.uid() = receiver_id)
WITH CHECK (auth.uid() = receiver_id);

REVOKE UPDATE ON public.chat_messages FROM authenticated;
GRANT UPDATE (read) ON public.chat_messages TO authenticated;

-- 2. validacion_puesto_config: restrict guard reads
CREATE OR REPLACE FUNCTION public.guardia_has_servicio(_user_id uuid, _servicio_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.guardia_servicios
    WHERE guardia_id = _user_id AND servicio_id = _servicio_id
  )
$$;
REVOKE ALL ON FUNCTION public.guardia_has_servicio(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.guardia_has_servicio(uuid, uuid) TO authenticated;

DROP POLICY IF EXISTS "Guardias ven programaciones activas" ON public.validacion_puesto_config;
CREATE POLICY "Guardias ven sus programaciones activas"
ON public.validacion_puesto_config FOR SELECT TO authenticated
USING (
  activo = true
  AND (
    auth.uid() = ANY (guardia_ids)
    OR (
      COALESCE(array_length(guardia_ids, 1), 0) = 0
      AND public.guardia_has_servicio(auth.uid(), servicio_id)
    )
  )
);

-- 3. Revoke execute on internal SECURITY DEFINER functions
REVOKE ALL ON FUNCTION public.delete_email(text, bigint) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enqueue_email(text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.read_email_batch(text, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.email_queue_dispatch() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.email_queue_wake() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.cliente_has_guardia(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.cumplimiento_metas_guardia(uuid, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.log_audit_event(text, text, text, jsonb, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.publicar_reconocimiento(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cliente_has_guardia(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cumplimiento_metas_guardia(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_audit_event(text, text, text, jsonb, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.publicar_reconocimiento(uuid) TO authenticated;

-- 4. Fixed search_path on email queue helpers
ALTER FUNCTION public.delete_email(text, bigint) SET search_path = pg_catalog, public, pgmq;
ALTER FUNCTION public.enqueue_email(text, jsonb) SET search_path = pg_catalog, public, pgmq;
ALTER FUNCTION public.move_to_dlq(text, text, bigint, jsonb) SET search_path = pg_catalog, public, pgmq;
ALTER FUNCTION public.read_email_batch(text, integer, integer) SET search_path = pg_catalog, public, pgmq;