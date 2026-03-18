-- Enable realtime for rondines and registros_rh (notificaciones already added)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'rondines'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.rondines;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'registros_rh'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.registros_rh;
  END IF;
END $$;