
-- Add status column to profiles for guard status management
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'activo';

-- Add status options: activo, vacaciones, incapacidad, suspendido
