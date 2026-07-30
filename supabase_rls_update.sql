-- ============================================================
-- PPDA GENERATOR — Actualización RLS por roles + plan_access
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- ============================================================

-- ============================================================
-- 1. TABLA DE ACCESO DE CLIENTES A PLANES
-- ============================================================
create table if not exists public.plan_access (
  id         uuid default gen_random_uuid() primary key,
  plan_id    text not null references public.plans(plan_id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  granted_by uuid references public.profiles(id),
  granted_at timestamptz default now(),
  unique (plan_id, user_id)
);

alter table public.plan_access enable row level security;

-- Admin puede gestionar accesos
create policy "plan_access_admin" on public.plan_access
  for all to authenticated
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- Cliente puede ver sus propios accesos
create policy "plan_access_select_own" on public.plan_access
  for select to authenticated
  using (user_id = auth.uid());

-- ============================================================
-- 2. ACTUALIZAR RLS DE PLANS POR ROL
-- ============================================================

-- Borrar políticas antiguas de SELECT
drop policy if exists "plans_select" on public.plans;

-- Nueva política de SELECT según rol:
-- Admin: ve todos
-- Consultor: ve los suyos (por campo consultor o created_by)
-- Viewer/Cliente: ve los que se le han asignado en plan_access
create policy "plans_select_by_role" on public.plans
  for select to authenticated
  using (
    -- Admin ve todo
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
    or
    -- Consultor ve los planes donde aparece como consultor o los creó
    (
      exists (
        select 1 from public.profiles
        where id = auth.uid() and role = 'consultor'
      )
      and (
        consultor = (select email from public.profiles where id = auth.uid())
        or created_by = auth.uid()
      )
    )
    or
    -- Cliente ve los planes que se le han asignado explícitamente
    exists (
      select 1 from public.plan_access pa
      where pa.plan_id = plans.plan_id and pa.user_id = auth.uid()
    )
  );

-- INSERT: solo admin y consultor pueden crear planes
drop policy if exists "plans_insert" on public.plans;
create policy "plans_insert_by_role" on public.plans
  for insert to authenticated
  with check (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('admin', 'consultor')
    )
  );

-- UPDATE: admin puede todo, consultor solo los suyos
drop policy if exists "plans_update" on public.plans;
create policy "plans_update_by_role" on public.plans
  for update to authenticated
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
    or (
      exists (select 1 from public.profiles where id = auth.uid() and role = 'consultor')
      and (
        consultor = (select email from public.profiles where id = auth.uid())
        or created_by = auth.uid()
      )
    )
  );
