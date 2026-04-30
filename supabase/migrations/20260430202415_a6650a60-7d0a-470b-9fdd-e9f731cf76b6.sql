ALTER TABLE public.metas_servicio
ADD COLUMN IF NOT EXISTS pendientes_diarios integer NOT NULL DEFAULT 0;