
-- Create visitas table
CREATE TABLE public.visitas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  guardia_id UUID NOT NULL,
  servicio_id UUID REFERENCES public.servicios(id),
  nombre_visitante TEXT NOT NULL,
  motivo TEXT NOT NULL DEFAULT '',
  foto_placa_url TEXT DEFAULT '',
  foto_ine_url TEXT DEFAULT '',
  foto_salida_url TEXT DEFAULT '',
  hora_entrada TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  hora_salida TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL DEFAULT 'dentro',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.visitas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Guards can manage own visitas" ON public.visitas FOR ALL TO authenticated
  USING (auth.uid() = guardia_id) WITH CHECK (auth.uid() = guardia_id);

CREATE POLICY "Supervisors can view all visitas" ON public.visitas FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'supervisor'::app_role));

CREATE POLICY "Admins can manage all visitas" ON public.visitas FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Storage bucket for visit photos
INSERT INTO storage.buckets (id, name, public) VALUES ('visitas', 'visitas', true);

-- Storage RLS for visitas bucket
CREATE POLICY "Authenticated users can upload visit photos" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'visitas');

CREATE POLICY "Anyone can view visit photos" ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'visitas');

CREATE POLICY "Users can delete own visit photos" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'visitas' AND (storage.foldername(name))[1] = auth.uid()::text);

ALTER PUBLICATION supabase_realtime ADD TABLE public.visitas;
