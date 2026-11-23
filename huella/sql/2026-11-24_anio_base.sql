-- Año base por organización (vinculado a un inventario o manual), reglas de recálculo configurables y decisión documentada por inventario
alter table public.hc_organizaciones add column if not exists anio_base_def jsonb;
alter table public.hc_organizaciones add column if not exists config_recalculo jsonb;
alter table public.hc_inventarios add column if not exists recalculo_base jsonb;
