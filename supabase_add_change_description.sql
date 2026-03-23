-- Añadir campo de descripción de cambios al historial de versiones
ALTER TABLE public.plan_history
  ADD COLUMN IF NOT EXISTS change_description text;
