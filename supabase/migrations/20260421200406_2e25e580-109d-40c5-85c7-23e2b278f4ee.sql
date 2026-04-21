-- Add supervisor_asignado_id to profiles for direct guard-supervisor assignment
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS supervisor_asignado_id uuid REFERENCES public.profiles(user_id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_supervisor_asignado ON public.profiles(supervisor_asignado_id);