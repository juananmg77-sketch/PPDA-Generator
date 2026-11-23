alter table public.hc_exclusiones add column if not exists categoria_iso smallint check (categoria_iso between 1 and 6);
