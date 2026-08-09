CREATE TABLE IF NOT EXISTS public.branding (
  id BOOLEAN PRIMARY KEY DEFAULT true,
  logo_url TEXT,
  primary_hsl TEXT NOT NULL DEFAULT '0 82% 52%',
  primary_glow_hsl TEXT NOT NULL DEFAULT '0 88% 62%',
  accent_hsl TEXT NOT NULL DEFAULT '0 82% 52%',
  background_hsl TEXT NOT NULL DEFAULT '0 0% 6%',
  card_hsl TEXT NOT NULL DEFAULT '0 0% 10%',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT branding_singleton CHECK (id)
);

GRANT SELECT ON public.branding TO anon;
GRANT SELECT, INSERT, UPDATE ON public.branding TO authenticated;
GRANT ALL ON public.branding TO service_role;

ALTER TABLE public.branding ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "branding_read_all" ON public.branding;
CREATE POLICY "branding_read_all" ON public.branding FOR SELECT USING (true);

DROP POLICY IF EXISTS "branding_admin_insert" ON public.branding;
CREATE POLICY "branding_admin_insert" ON public.branding FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "branding_admin_update" ON public.branding;
CREATE POLICY "branding_admin_update" ON public.branding FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.branding (id) VALUES (true) ON CONFLICT (id) DO NOTHING;