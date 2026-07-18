
DROP POLICY IF EXISTS "Anyone can view avatars" ON storage.objects;
CREATE POLICY "Authenticated can view avatars"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'avatars');
