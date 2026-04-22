ALTER TABLE public.visitas
ADD COLUMN persona_a_visitar text NOT NULL DEFAULT '',
ADD COLUMN area_destino text NOT NULL DEFAULT '';