-- HS GREEN · Circularidad · fase de persistencia. Base «PPDA Plan de Desperdicio». Solo objetos NUEVOS (circ_planes).
-- Un plan por establecimiento/organización; el plan completo (ficha, indicadores, objetivos, seguimiento, requisitos) va en `plan` (jsonb).
-- Permisos como Huella: admin todo; consultor las organizaciones suyas; cliente (hc_accesos) solo lee; anon sin acceso; borrar solo admin.
create table if not exists public.circ_planes (
  id              uuid primary key default gen_random_uuid(),
  organizacion_id uuid not null references public.hc_organizaciones(id) on delete cascade,
  nombre          text not null,
  vigencia_desde  int,
  vigencia_hasta  int,
  estado          text not null default 'borrador' check (estado in ('borrador','vigente','renovado')),
  plan            jsonb not null,
  created_by      uuid references auth.users(id) on delete set null,
  updated_by      uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists circ_planes_org_idx on public.circ_planes (organizacion_id);

create or replace function public.circ_tocar() returns trigger
language plpgsql set search_path = public as $$
begin new.updated_at := now(); new.updated_by := auth.uid(); return new; end $$;
drop trigger if exists circ_planes_tocar on public.circ_planes;
create trigger circ_planes_tocar before update on public.circ_planes for each row execute function public.circ_tocar();

alter table public.circ_planes enable row level security;
revoke all on public.circ_planes from anon;
grant select, insert, update, delete on public.circ_planes to authenticated;
drop policy if exists circ_ver on public.circ_planes;
drop policy if exists circ_crear on public.circ_planes;
drop policy if exists circ_editar on public.circ_planes;
drop policy if exists circ_borrar on public.circ_planes;
create policy circ_ver    on public.circ_planes for select to authenticated using (public.hc_puede_org(organizacion_id));
create policy circ_crear  on public.circ_planes for insert to authenticated with check (public.hc_es_gestor(organizacion_id) and created_by = auth.uid());
create policy circ_editar on public.circ_planes for update to authenticated using (public.hc_es_gestor(organizacion_id)) with check (public.hc_es_gestor(organizacion_id));
create policy circ_borrar on public.circ_planes for delete to authenticated using (public.hc_es_admin());
