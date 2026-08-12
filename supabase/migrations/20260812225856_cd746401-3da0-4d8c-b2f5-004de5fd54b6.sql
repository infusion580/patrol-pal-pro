ALTER TABLE public.checkpoints
  ADD COLUMN IF NOT EXISTS obligatorio boolean NOT NULL DEFAULT true;

ALTER TABLE public.servicios
  ADD COLUMN IF NOT EXISTS permitir_rondin_incompleto boolean NOT NULL DEFAULT false;

ALTER TABLE public.rondin_scans
  ADD COLUMN IF NOT EXISTS observacion text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS estado text NOT NULL DEFAULT 'sin_novedad';

ALTER TABLE public.rondin_scans
  DROP CONSTRAINT IF EXISTS rondin_scans_estado_check;
ALTER TABLE public.rondin_scans
  ADD CONSTRAINT rondin_scans_estado_check CHECK (estado IN ('sin_novedad','con_novedad'));