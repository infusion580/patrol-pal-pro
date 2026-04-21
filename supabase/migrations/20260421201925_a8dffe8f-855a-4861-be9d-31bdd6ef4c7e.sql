-- Drop the recursive policy
DROP POLICY IF EXISTS "Guards can view their assigned supervisor profile" ON public.profiles;
DROP POLICY IF EXISTS "Guards can view assigned supervisor role" ON public.user_roles;

-- SECURITY DEFINER helper to fetch a user's assigned supervisor without triggering RLS recursion
CREATE OR REPLACE FUNCTION public.get_assigned_supervisor(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT supervisor_asignado_id
  FROM public.profiles
  WHERE user_id = _user_id
  LIMIT 1
$$;

-- Recreate policies using the helper (no recursion)
CREATE POLICY "Guards can view their assigned supervisor profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  user_id = public.get_assigned_supervisor(auth.uid())
);

CREATE POLICY "Guards can view assigned supervisor role"
ON public.user_roles
FOR SELECT
TO authenticated
USING (
  user_id = public.get_assigned_supervisor(auth.uid())
);