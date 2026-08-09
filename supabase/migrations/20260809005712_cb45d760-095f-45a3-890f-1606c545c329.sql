CREATE POLICY "Admins pueden leer respaldos"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'backups' AND public.has_role(auth.uid(), 'admin'::app_role));