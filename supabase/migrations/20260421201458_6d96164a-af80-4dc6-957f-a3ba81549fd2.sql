-- Many-to-many: guardia <-> servicios with one optional "principal"
CREATE TABLE IF NOT EXISTS public.guardia_servicios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guardia_id uuid NOT NULL,
  servicio_id uuid NOT NULL REFERENCES public.servicios(id) ON DELETE CASCADE,
  es_principal boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid,
  UNIQUE (guardia_id, servicio_id)
);

CREATE INDEX IF NOT EXISTS idx_guardia_servicios_guardia ON public.guardia_servicios(guardia_id);
CREATE INDEX IF NOT EXISTS idx_guardia_servicios_servicio ON public.guardia_servicios(servicio_id);

-- Only one principal per guardia
CREATE UNIQUE INDEX IF NOT EXISTS idx_guardia_servicios_one_principal
  ON public.guardia_servicios(guardia_id)
  WHERE es_principal = true;

ALTER TABLE public.guardia_servicios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage guardia_servicios"
ON public.guardia_servicios
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Supervisors manage guardia_servicios"
ON public.guardia_servicios
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'supervisor'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'supervisor'::app_role));

CREATE POLICY "Guards view own guardia_servicios"
ON public.guardia_servicios
FOR SELECT
TO authenticated
USING (auth.uid() = guardia_id);

-- Trigger: when a row is marked principal, also sync profiles.servicio_asignado_id
CREATE OR REPLACE FUNCTION public.sync_servicio_principal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.es_principal = true THEN
    -- Unset other principals for the same guard
    UPDATE public.guardia_servicios
      SET es_principal = false
      WHERE guardia_id = NEW.guardia_id
        AND id <> NEW.id
        AND es_principal = true;

    -- Mirror to profiles
    UPDATE public.profiles
      SET servicio_asignado_id = NEW.servicio_id, updated_at = now()
      WHERE user_id = NEW.guardia_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guardia_servicios_principal ON public.guardia_servicios;
CREATE TRIGGER trg_guardia_servicios_principal
AFTER INSERT OR UPDATE OF es_principal ON public.guardia_servicios
FOR EACH ROW
EXECUTE FUNCTION public.sync_servicio_principal();

-- When a principal row is deleted, clear profiles.servicio_asignado_id
CREATE OR REPLACE FUNCTION public.clear_servicio_principal_on_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.es_principal = true THEN
    UPDATE public.profiles
      SET servicio_asignado_id = NULL, updated_at = now()
      WHERE user_id = OLD.guardia_id
        AND servicio_asignado_id = OLD.servicio_id;
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_guardia_servicios_principal_del ON public.guardia_servicios;
CREATE TRIGGER trg_guardia_servicios_principal_del
AFTER DELETE ON public.guardia_servicios
FOR EACH ROW
EXECUTE FUNCTION public.clear_servicio_principal_on_delete();

-- Backfill: copy current profiles.servicio_asignado_id into guardia_servicios as principal
INSERT INTO public.guardia_servicios (guardia_id, servicio_id, es_principal)
SELECT p.user_id, p.servicio_asignado_id, true
FROM public.profiles p
JOIN public.user_roles ur ON ur.user_id = p.user_id
WHERE p.servicio_asignado_id IS NOT NULL
  AND ur.role = 'guardia'
ON CONFLICT (guardia_id, servicio_id) DO UPDATE SET es_principal = true;