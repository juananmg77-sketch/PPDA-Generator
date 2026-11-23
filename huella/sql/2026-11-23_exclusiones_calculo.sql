alter table public.hc_exclusiones
  add column if not exists calculo jsonb,
  add column if not exists certificado_path text,
  add column if not exists certificado_nombre text;
