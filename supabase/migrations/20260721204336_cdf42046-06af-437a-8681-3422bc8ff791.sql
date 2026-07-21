
-- 1) profiles: drop overly broad admin-visible policy
DROP POLICY IF EXISTS "Authenticated users can view admin profiles" ON public.profiles;

-- 2) user_roles: drop policy exposing admin identities
DROP POLICY IF EXISTS "Authenticated users can view admin roles" ON public.user_roles;

-- 3) storage: remove listing policy on public avatars bucket (public GET still works via /object/public/)
DROP POLICY IF EXISTS "Authenticated can view avatars" ON storage.objects;

-- 4) Tighten INSERT policies to enforce folder ownership
DROP POLICY IF EXISTS "Authenticated users can upload avatars" ON storage.objects;
CREATE POLICY "Authenticated users can upload avatars"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "Authenticated users can upload evidencias" ON storage.objects;
CREATE POLICY "Authenticated users can upload evidencias"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'evidencias'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "Authenticated users can upload visit photos" ON storage.objects;
CREATE POLICY "Authenticated users can upload visit photos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'visitas'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- 5) SECURITY DEFINER functions: revoke from PUBLIC/anon; grant only to authenticated where needed
REVOKE ALL ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_user_role(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_assigned_supervisor(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.cliente_has_servicio(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.promote_user(uuid, app_role) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.consume_registration_nip(text, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.validate_registration_nip(text) FROM PUBLIC, anon;

-- Re-grant to authenticated only (needed for RLS helpers + RPC endpoints)
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_role(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_assigned_supervisor(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cliente_has_servicio(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.promote_user(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.consume_registration_nip(text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.validate_registration_nip(text) TO authenticated;
