ALTER TABLE public.notificaciones 
  ADD COLUMN IF NOT EXISTS foto_url TEXT,
  ADD COLUMN IF NOT EXISTS metadata JSONB;