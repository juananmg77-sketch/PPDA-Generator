-- ============================================================
-- PPDA GENERATOR — Tabla donaciones (REG-DON-01)
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- ============================================================

create table public.donaciones (
  id               uuid default gen_random_uuid() primary key,
  plan_id          text not null references public.plans(plan_id) on delete cascade,
  hotel_nombre     text not null,
  fecha            date not null,
  kg_donados       numeric(8,2) not null check (kg_donados > 0),
  entidad_receptora text not null,
  tipo_alimento    text,          -- descripción libre: "Excedente buffet cena", etc.
  notas            text,
  registrado_por   text,
  created_at       timestamptz default now(),
  updated_at       timestamptz default now()
);

-- Índices
create index idx_donaciones_plan_fecha
  on public.donaciones (plan_id, fecha desc);

create index idx_donaciones_hotel
  on public.donaciones (plan_id, hotel_nombre, fecha desc);

-- RLS
alter table public.donaciones enable row level security;

create policy "donaciones_select" on public.donaciones
  for select to authenticated using (true);

create policy "donaciones_insert" on public.donaciones
  for insert to authenticated with check (true);

create policy "donaciones_update" on public.donaciones
  for update to authenticated using (true);

create policy "donaciones_delete" on public.donaciones
  for delete to authenticated using (true);
