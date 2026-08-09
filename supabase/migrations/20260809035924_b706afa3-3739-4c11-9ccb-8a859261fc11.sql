CREATE TABLE public.numeros_emergencia (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  label text NOT NULL,
  descripcion text NOT NULL DEFAULT '',
  numero text NOT NULL,
  orden integer NOT NULL DEFAULT 0,
  activo boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.numeros_emergencia TO authenticated;
GRANT ALL ON public.numeros_emergencia TO service_role;

ALTER TABLE public.numeros_emergencia ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados pueden ver numeros de emergencia"
ON public.numeros_emergencia FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins pueden crear numeros de emergencia"
ON public.numeros_emergencia FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins pueden editar numeros de emergencia"
ON public.numeros_emergencia FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins pueden borrar numeros de emergencia"
ON public.numeros_emergencia FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_numeros_emergencia_updated
BEFORE UPDATE ON public.numeros_emergencia
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.numeros_emergencia (label, descripcion, numero, orden) VALUES
  ('911', 'Emergencias', '911', 1),
  ('Policía', 'Policía Local', '911', 2),
  ('P. Civil', 'Protección Civil', '911', 3);