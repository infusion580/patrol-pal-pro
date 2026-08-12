CREATE TABLE public.comunicados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo text NOT NULL,
  contenido text NOT NULL,
  prioridad text NOT NULL DEFAULT 'normal',
  imagen_url text,
  estado text NOT NULL DEFAULT 'borrador',
  publicar_at timestamptz,
  publicado_at timestamptz,
  autor_id uuid,
  autor_nombre text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT comunicados_prioridad_check CHECK (prioridad IN ('baja','normal','alta','urgente')),
  CONSTRAINT comunicados_estado_check CHECK (estado IN ('borrador','programado','publicado'))
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.comunicados TO authenticated;
GRANT ALL ON public.comunicados TO service_role;
ALTER TABLE public.comunicados ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins y supervisores gestionan comunicados"
ON public.comunicados FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'supervisor'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'supervisor'::app_role));

CREATE POLICY "Todos ven comunicados publicados"
ON public.comunicados FOR SELECT TO authenticated
USING (estado = 'publicado');

CREATE TRIGGER trg_comunicados_updated_at
BEFORE UPDATE ON public.comunicados
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.comunicado_lecturas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comunicado_id uuid NOT NULL REFERENCES public.comunicados(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  leido_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (comunicado_id, user_id)
);

GRANT SELECT, INSERT ON public.comunicado_lecturas TO authenticated;
GRANT ALL ON public.comunicado_lecturas TO service_role;
ALTER TABLE public.comunicado_lecturas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuarios registran su lectura"
ON public.comunicado_lecturas FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuarios ven su lectura"
ON public.comunicado_lecturas FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins y supervisores ven todas las lecturas"
ON public.comunicado_lecturas FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'supervisor'::app_role));

CREATE OR REPLACE FUNCTION public.notificar_comunicado(_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _c RECORD;
BEGIN
  SELECT * INTO _c FROM public.comunicados WHERE id = _id;
  IF _c IS NULL THEN RETURN; END IF;

  INSERT INTO public.notificaciones (tipo, mensaje, guardia_id, foto_url, metadata)
  SELECT 'comunicado',
         '📢 ' || _c.titulo,
         ur.user_id,
         _c.imagen_url,
         jsonb_build_object(
           'comunicado_id', _c.id,
           'prioridad', _c.prioridad,
           'autor', _c.autor_nombre
         )
  FROM public.user_roles ur
  WHERE ur.role IN ('guardia'::app_role, 'supervisor'::app_role, 'admin'::app_role);
END;
$$;

CREATE OR REPLACE FUNCTION public.publicar_comunicado(_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _estado text;
BEGIN
  IF NOT (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'supervisor'::app_role)) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  SELECT estado INTO _estado FROM public.comunicados WHERE id = _id;
  IF _estado IS NULL THEN RAISE EXCEPTION 'Comunicado no encontrado'; END IF;
  IF _estado = 'publicado' THEN RETURN; END IF;

  UPDATE public.comunicados
     SET estado = 'publicado', publicado_at = now()
   WHERE id = _id;

  PERFORM public.notificar_comunicado(_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.publicar_comunicados_programados()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _row RECORD;
  _n integer := 0;
BEGIN
  FOR _row IN
    SELECT id FROM public.comunicados
     WHERE estado = 'programado'
       AND publicar_at IS NOT NULL
       AND publicar_at <= now()
  LOOP
    UPDATE public.comunicados
       SET estado = 'publicado', publicado_at = now()
     WHERE id = _row.id;
    PERFORM public.notificar_comunicado(_row.id);
    _n := _n + 1;
  END LOOP;
  RETURN _n;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.notificar_comunicado(uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.publicar_comunicados_programados() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.publicar_comunicado(uuid) FROM anon;

DO $$
BEGIN
  PERFORM cron.unschedule('publicar-comunicados-programados');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  PERFORM cron.schedule('publicar-comunicados-programados', '*/5 * * * *', $cron$ SELECT public.publicar_comunicados_programados(); $cron$);
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'No se pudo programar el cron de comunicados: %', SQLERRM;
END $$;