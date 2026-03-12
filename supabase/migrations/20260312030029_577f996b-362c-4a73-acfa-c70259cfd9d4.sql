
-- Add avatar_url column to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url text DEFAULT '';

-- Add servicio_asignado_id to profiles for guard-service assignment
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS servicio_asignado_id uuid REFERENCES public.servicios(id) ON DELETE SET NULL;

-- Create notifications table for zone exit alerts
CREATE TABLE IF NOT EXISTS public.notificaciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo text NOT NULL DEFAULT 'zona',
  mensaje text NOT NULL DEFAULT '',
  guardia_id uuid NOT NULL,
  supervisor_id uuid,
  leida boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notificaciones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Guards can view own notifications" ON public.notificaciones
  FOR SELECT TO authenticated USING (auth.uid() = guardia_id);

CREATE POLICY "Supervisors can view notifications" ON public.notificaciones
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'supervisor'::app_role));

CREATE POLICY "Admins can view all notifications" ON public.notificaciones
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated can insert notifications" ON public.notificaciones
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = guardia_id);

CREATE POLICY "Supervisors can update notifications" ON public.notificaciones
  FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'supervisor'::app_role));

-- Enable realtime for notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.notificaciones;

-- Storage bucket for avatars and evidence
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true) ON CONFLICT DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('evidencias', 'evidencias', true) ON CONFLICT DO NOTHING;

-- Storage RLS policies for avatars
CREATE POLICY "Anyone can view avatars" ON storage.objects
  FOR SELECT USING (bucket_id = 'avatars');

CREATE POLICY "Authenticated users can upload avatars" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'avatars');

CREATE POLICY "Users can update own avatars" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can delete own avatars" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Storage RLS policies for evidencias
CREATE POLICY "Anyone authenticated can view evidencias" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'evidencias');

CREATE POLICY "Authenticated users can upload evidencias" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'evidencias');

CREATE POLICY "Users can delete own evidencias" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'evidencias' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Allow admins to update profiles (for service/role assignment)
CREATE POLICY "Admins can update all profiles" ON public.profiles
  FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
