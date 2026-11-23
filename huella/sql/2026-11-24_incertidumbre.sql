-- Ajuste de la incertidumbre de una línea de actividad respecto al catálogo (origen del dato, ±% del dato y del factor, justificación)
alter table public.hc_actividad add column if not exists incertidumbre jsonb;
