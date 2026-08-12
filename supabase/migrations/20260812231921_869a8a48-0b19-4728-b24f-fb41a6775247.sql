CREATE TABLE public.cliente_reportes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid NOT NULL,
  titulo text NOT NULL DEFAULT 'Reporte de servicios',
  periodo_inicio date NOT NULL,
  periodo_fin date NOT NULL,
  estado text NOT NULL DEFAULT 'borrador',
  secciones jsonb NOT NULL DEFAULT '[]'::jsonb,
  servicio_id uuid,
  autor_id uuid,
  autor_nombre text NOT NULL DEFAULT '',
  publicado_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cliente_reportes TO authenticated;
GRANT ALL ON public.cliente_reportes TO service_role;

ALTER TABLE public.cliente_reportes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins y supervisores gestionan reportes de cliente"
ON public.cliente_reportes FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'supervisor'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'supervisor'));

CREATE POLICY "Cliente ve sus reportes publicados"
ON public.cliente_reportes FOR SELECT TO authenticated
USING (cliente_id = auth.uid() AND estado = 'publicado');

CREATE TRIGGER update_cliente_reportes_updated_at
BEFORE UPDATE ON public.cliente_reportes
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_cliente_reportes_cliente ON public.cliente_reportes (cliente_id, periodo_fin DESC);