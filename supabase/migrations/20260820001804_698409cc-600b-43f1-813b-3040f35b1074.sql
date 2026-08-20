-- 1) Avatares: lectura pública explícita (bucket público, sólo esa carpeta)
DROP POLICY IF EXISTS "Avatars publicly readable" ON storage.objects;
CREATE POLICY "Avatars publicly readable"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'avatars');

-- 2) Comunicados: los supervisores sólo administran los que ellos crearon
DROP POLICY IF EXISTS "Supervisores gestionan comunicados generales" ON public.comunicados;

CREATE POLICY "Supervisores crean comunicados generales"
ON public.comunicados FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'supervisor'::app_role)
  AND autor_id = auth.uid()
);

CREATE POLICY "Supervisores ven sus comunicados"
ON public.comunicados FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'supervisor'::app_role)
  AND autor_id = auth.uid()
);

CREATE POLICY "Supervisores editan sus comunicados"
ON public.comunicados FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'supervisor'::app_role)
  AND autor_id = auth.uid()
)
WITH CHECK (
  has_role(auth.uid(), 'supervisor'::app_role)
  AND autor_id = auth.uid()
);

CREATE POLICY "Supervisores borran sus comunicados"
ON public.comunicados FOR DELETE
TO authenticated
USING (
  has_role(auth.uid(), 'supervisor'::app_role)
  AND autor_id = auth.uid()
);

-- 3) email_send_state: sólo el backend interno. Sin privilegios para anon/authenticated.
REVOKE ALL ON public.email_send_state FROM anon, authenticated;
GRANT ALL ON public.email_send_state TO service_role;

DROP POLICY IF EXISTS "Deny client access to email send state" ON public.email_send_state;
CREATE POLICY "Deny client access to email send state"
ON public.email_send_state
AS RESTRICTIVE
FOR ALL
TO anon, authenticated
USING (false)
WITH CHECK (false);