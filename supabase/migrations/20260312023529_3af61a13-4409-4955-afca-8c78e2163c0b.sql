
-- 1. Fix the handle_new_user trigger to hardcode 'guardia' role (prevent role escalation via metadata)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, nombre, apellido, numero_empleado, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nombre', ''),
    COALESCE(NEW.raw_user_meta_data->>'apellido', ''),
    COALESCE(NEW.raw_user_meta_data->>'numero_empleado', ''),
    COALESCE(NEW.email, '')
  );
  
  -- Always assign 'guardia' role regardless of what client sends
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'guardia');
  
  RETURN NEW;
END;
$$;

-- 2. Drop dangerous INSERT policy on user_roles that allows self-role-assignment
DROP POLICY IF EXISTS "Users can insert their own role" ON public.user_roles;

-- 3. Convert all RESTRICTIVE policies to PERMISSIVE across all tables

-- profiles
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
CREATE POLICY "Users can view their own profile" ON public.profiles FOR SELECT TO public USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT TO public USING (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Supervisors can view all profiles" ON public.profiles;
CREATE POLICY "Supervisors can view all profiles" ON public.profiles FOR SELECT TO public USING (has_role(auth.uid(), 'supervisor'::app_role));

DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT TO public WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE TO public USING (auth.uid() = user_id);

-- user_roles
DROP POLICY IF EXISTS "Users can view their own role" ON public.user_roles;
CREATE POLICY "Users can view their own role" ON public.user_roles FOR SELECT TO public USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
CREATE POLICY "Admins can view all roles" ON public.user_roles FOR SELECT TO public USING (has_role(auth.uid(), 'admin'::app_role));

-- chat_messages
DROP POLICY IF EXISTS "Users can see own messages" ON public.chat_messages;
CREATE POLICY "Users can see own messages" ON public.chat_messages FOR SELECT TO authenticated USING ((auth.uid() = sender_id) OR (auth.uid() = receiver_id));

DROP POLICY IF EXISTS "Users can send messages" ON public.chat_messages;
CREATE POLICY "Users can send messages" ON public.chat_messages FOR INSERT TO authenticated WITH CHECK (auth.uid() = sender_id);

DROP POLICY IF EXISTS "Users can update own sent read status" ON public.chat_messages;
CREATE POLICY "Users can update own sent read status" ON public.chat_messages FOR UPDATE TO authenticated USING (auth.uid() = receiver_id);

-- chat_rh
DROP POLICY IF EXISTS "Users can manage own rh chats" ON public.chat_rh;
CREATE POLICY "Users can manage own rh chats" ON public.chat_rh FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view all rh chats" ON public.chat_rh;
CREATE POLICY "Admins can view all rh chats" ON public.chat_rh FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- checkpoints
DROP POLICY IF EXISTS "Anyone authenticated can read checkpoints" ON public.checkpoints;
CREATE POLICY "Anyone authenticated can read checkpoints" ON public.checkpoints FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Admins can manage checkpoints" ON public.checkpoints;
CREATE POLICY "Admins can manage checkpoints" ON public.checkpoints FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Supervisors can manage checkpoints" ON public.checkpoints;
CREATE POLICY "Supervisors can manage checkpoints" ON public.checkpoints FOR ALL TO authenticated USING (has_role(auth.uid(), 'supervisor'::app_role)) WITH CHECK (has_role(auth.uid(), 'supervisor'::app_role));

-- emergencias
DROP POLICY IF EXISTS "Guards can view own emergencias" ON public.emergencias;
CREATE POLICY "Guards can view own emergencias" ON public.emergencias FOR SELECT TO authenticated USING (auth.uid() = guardia_id);

DROP POLICY IF EXISTS "Guards can create emergencias" ON public.emergencias;
CREATE POLICY "Guards can create emergencias" ON public.emergencias FOR INSERT TO authenticated WITH CHECK (auth.uid() = guardia_id);

DROP POLICY IF EXISTS "Supervisors can view all emergencias" ON public.emergencias;
CREATE POLICY "Supervisors can view all emergencias" ON public.emergencias FOR SELECT TO authenticated USING (has_role(auth.uid(), 'supervisor'::app_role));

DROP POLICY IF EXISTS "Admins can manage all emergencias" ON public.emergencias;
CREATE POLICY "Admins can manage all emergencias" ON public.emergencias FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- rondines
DROP POLICY IF EXISTS "Guards can manage own rondines" ON public.rondines;
CREATE POLICY "Guards can manage own rondines" ON public.rondines FOR ALL TO authenticated USING (auth.uid() = guardia_id) WITH CHECK (auth.uid() = guardia_id);

DROP POLICY IF EXISTS "Supervisors can view all rondines" ON public.rondines;
CREATE POLICY "Supervisors can view all rondines" ON public.rondines FOR SELECT TO authenticated USING (has_role(auth.uid(), 'supervisor'::app_role));

DROP POLICY IF EXISTS "Admins can view all rondines" ON public.rondines;
CREATE POLICY "Admins can view all rondines" ON public.rondines FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- rondin_scans
DROP POLICY IF EXISTS "Users can manage own rondin scans" ON public.rondin_scans;
CREATE POLICY "Users can manage own rondin scans" ON public.rondin_scans FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM rondines WHERE rondines.id = rondin_scans.rondin_id AND rondines.guardia_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM rondines WHERE rondines.id = rondin_scans.rondin_id AND rondines.guardia_id = auth.uid()));

DROP POLICY IF EXISTS "Supervisors can view all scans" ON public.rondin_scans;
CREATE POLICY "Supervisors can view all scans" ON public.rondin_scans FOR SELECT TO authenticated USING (has_role(auth.uid(), 'supervisor'::app_role));

DROP POLICY IF EXISTS "Admins can view all scans" ON public.rondin_scans;
CREATE POLICY "Admins can view all scans" ON public.rondin_scans FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- reportes_turno
DROP POLICY IF EXISTS "Guards can manage own reportes" ON public.reportes_turno;
CREATE POLICY "Guards can manage own reportes" ON public.reportes_turno FOR ALL TO authenticated USING (auth.uid() = guardia_id) WITH CHECK (auth.uid() = guardia_id);

DROP POLICY IF EXISTS "Supervisors can view and update reportes" ON public.reportes_turno;
CREATE POLICY "Supervisors can view reportes" ON public.reportes_turno FOR SELECT TO authenticated USING (has_role(auth.uid(), 'supervisor'::app_role));

DROP POLICY IF EXISTS "Supervisors can update reportes" ON public.reportes_turno;
CREATE POLICY "Supervisors can update reportes" ON public.reportes_turno FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'supervisor'::app_role));

DROP POLICY IF EXISTS "Admins can view all reportes" ON public.reportes_turno;
CREATE POLICY "Admins can view all reportes" ON public.reportes_turno FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can update all reportes" ON public.reportes_turno;
CREATE POLICY "Admins can update all reportes" ON public.reportes_turno FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- servicios
DROP POLICY IF EXISTS "Anyone authenticated can read servicios" ON public.servicios;
CREATE POLICY "Anyone authenticated can read servicios" ON public.servicios FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Admins can manage servicios" ON public.servicios;
CREATE POLICY "Admins can manage servicios" ON public.servicios FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Supervisors can manage servicios" ON public.servicios;
CREATE POLICY "Supervisors can manage servicios" ON public.servicios FOR ALL TO authenticated USING (has_role(auth.uid(), 'supervisor'::app_role)) WITH CHECK (has_role(auth.uid(), 'supervisor'::app_role));

-- 4. Create admin-only function for role promotion
CREATE OR REPLACE FUNCTION public.promote_user(_target_user_id uuid, _new_role app_role)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Only admins can promote users';
  END IF;
  
  DELETE FROM public.user_roles WHERE user_id = _target_user_id;
  INSERT INTO public.user_roles (user_id, role) VALUES (_target_user_id, _new_role);
END;
$$;
