-- ========================
-- SERVICIOS & CHECKPOINTS
-- ========================
CREATE TABLE public.servicios (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre TEXT NOT NULL,
  cliente TEXT NOT NULL DEFAULT '',
  direccion TEXT NOT NULL DEFAULT '',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.checkpoints (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  servicio_id UUID NOT NULL REFERENCES public.servicios(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  ubicacion TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ========================
-- RONDINES (patrol rounds)
-- ========================
CREATE TABLE public.rondines (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  guardia_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  servicio_id UUID REFERENCES public.servicios(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'activo' CHECK (status IN ('activo', 'completado', 'cancelado')),
  checkin_at TIMESTAMPTZ,
  checkout_at TIMESTAMPTZ,
  checkin_lat DOUBLE PRECISION,
  checkin_lng DOUBLE PRECISION,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.rondin_scans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  rondin_id UUID NOT NULL REFERENCES public.rondines(id) ON DELETE CASCADE,
  checkpoint_id UUID NOT NULL REFERENCES public.checkpoints(id) ON DELETE CASCADE,
  scanned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION
);

-- ========================
-- REPORTES DE TURNO
-- ========================
CREATE TABLE public.reportes_turno (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  guardia_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  incidencias TEXT NOT NULL DEFAULT '',
  actividades TEXT NOT NULL DEFAULT '',
  observaciones TEXT NOT NULL DEFAULT '',
  firmado BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'pendiente' CHECK (status IN ('pendiente', 'aprobado', 'retroalimentacion')),
  retroalimentacion TEXT,
  revisado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ========================
-- CHAT MESSAGES (supervisor)
-- ========================
CREATE TABLE public.chat_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  receiver_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ========================
-- CHAT RH (confidential)
-- ========================
CREATE TABLE public.chat_rh (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  topic TEXT NOT NULL,
  folio TEXT NOT NULL,
  message TEXT NOT NULL,
  sender TEXT NOT NULL CHECK (sender IN ('user', 'rh')),
  confidential BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ========================
-- EMERGENCIAS
-- ========================
CREATE TABLE public.emergencias (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  guardia_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL DEFAULT 'emergencia',
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  atendida BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ========================
-- RLS POLICIES
-- ========================

-- Servicios: supervisors & admins can CRUD, guards can read
ALTER TABLE public.servicios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone authenticated can read servicios" ON public.servicios FOR SELECT TO authenticated USING (true);
CREATE POLICY "Supervisors can manage servicios" ON public.servicios FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'supervisor')) WITH CHECK (public.has_role(auth.uid(), 'supervisor'));
CREATE POLICY "Admins can manage servicios" ON public.servicios FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Checkpoints
ALTER TABLE public.checkpoints ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone authenticated can read checkpoints" ON public.checkpoints FOR SELECT TO authenticated USING (true);
CREATE POLICY "Supervisors can manage checkpoints" ON public.checkpoints FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'supervisor')) WITH CHECK (public.has_role(auth.uid(), 'supervisor'));
CREATE POLICY "Admins can manage checkpoints" ON public.checkpoints FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Rondines
ALTER TABLE public.rondines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Guards can manage own rondines" ON public.rondines FOR ALL TO authenticated USING (auth.uid() = guardia_id) WITH CHECK (auth.uid() = guardia_id);
CREATE POLICY "Supervisors can view all rondines" ON public.rondines FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'supervisor'));
CREATE POLICY "Admins can view all rondines" ON public.rondines FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Rondin Scans
ALTER TABLE public.rondin_scans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own rondin scans" ON public.rondin_scans FOR ALL TO authenticated 
  USING (EXISTS (SELECT 1 FROM public.rondines WHERE id = rondin_id AND guardia_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.rondines WHERE id = rondin_id AND guardia_id = auth.uid()));
CREATE POLICY "Supervisors can view all scans" ON public.rondin_scans FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'supervisor'));
CREATE POLICY "Admins can view all scans" ON public.rondin_scans FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Reportes de turno
ALTER TABLE public.reportes_turno ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Guards can manage own reportes" ON public.reportes_turno FOR ALL TO authenticated USING (auth.uid() = guardia_id) WITH CHECK (auth.uid() = guardia_id);
CREATE POLICY "Supervisors can view and update reportes" ON public.reportes_turno FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'supervisor'));
CREATE POLICY "Supervisors can update reportes" ON public.reportes_turno FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'supervisor'));
CREATE POLICY "Admins can view all reportes" ON public.reportes_turno FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update all reportes" ON public.reportes_turno FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Chat messages
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can see own messages" ON public.chat_messages FOR SELECT TO authenticated USING (auth.uid() = sender_id OR auth.uid() = receiver_id);
CREATE POLICY "Users can send messages" ON public.chat_messages FOR INSERT TO authenticated WITH CHECK (auth.uid() = sender_id);
CREATE POLICY "Users can update own sent read status" ON public.chat_messages FOR UPDATE TO authenticated USING (auth.uid() = receiver_id);

-- Chat RH
ALTER TABLE public.chat_rh ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own rh chats" ON public.chat_rh FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can view all rh chats" ON public.chat_rh FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Emergencias
ALTER TABLE public.emergencias ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Guards can create emergencias" ON public.emergencias FOR INSERT TO authenticated WITH CHECK (auth.uid() = guardia_id);
CREATE POLICY "Guards can view own emergencias" ON public.emergencias FOR SELECT TO authenticated USING (auth.uid() = guardia_id);
CREATE POLICY "Supervisors can view all emergencias" ON public.emergencias FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'supervisor'));
CREATE POLICY "Admins can manage all emergencias" ON public.emergencias FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ========================
-- TRIGGERS
-- ========================
CREATE TRIGGER update_servicios_updated_at BEFORE UPDATE ON public.servicios FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_reportes_turno_updated_at BEFORE UPDATE ON public.reportes_turno FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();