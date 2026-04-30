INSERT INTO storage.buckets (id, name, public)
VALUES ('pendientes', 'pendientes', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Pendientes fotos publicly readable"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'pendientes');

CREATE POLICY "Guards upload pendientes fotos in own folder"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'pendientes'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Supervisors delete pendientes fotos"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'pendientes' AND has_role(auth.uid(), 'supervisor'::app_role));

CREATE POLICY "Admins delete pendientes fotos"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'pendientes' AND has_role(auth.uid(), 'admin'::app_role));