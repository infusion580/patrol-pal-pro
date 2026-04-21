-- Allow guards to view profile of their assigned supervisor and all admins
-- so the chat contact list can render them.

CREATE POLICY "Guards can view their assigned supervisor profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  user_id IN (
    SELECT supervisor_asignado_id
    FROM public.profiles
    WHERE user_id = auth.uid()
      AND supervisor_asignado_id IS NOT NULL
  )
);

CREATE POLICY "Authenticated users can view admin profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  public.has_role(user_id, 'admin'::app_role)
);

-- Allow supervisors' assigned guards to be discoverable by them
-- (supervisors already have a "view all profiles" policy, so no extra needed there)

-- Also ensure guards can see role info for their supervisor and admins
-- user_roles already exposes own role to user; supervisors/admins can view all.
-- We need guards to see the role of their supervisor + admins.

CREATE POLICY "Guards can view assigned supervisor role"
ON public.user_roles
FOR SELECT
TO authenticated
USING (
  user_id IN (
    SELECT supervisor_asignado_id
    FROM public.profiles
    WHERE user_id = auth.uid()
      AND supervisor_asignado_id IS NOT NULL
  )
);

CREATE POLICY "Authenticated users can view admin roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (
  role = 'admin'::app_role
);