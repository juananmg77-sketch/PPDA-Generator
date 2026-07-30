-- ============================================================
-- PPDA GENERATOR — Supabase Schema
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- ============================================================

-- ============================================================
-- 1. PERFILES DE USUARIO (extiende auth.users)
-- ============================================================
create table public.profiles (
  id          uuid references auth.users on delete cascade primary key,
  email       text unique not null,
  full_name   text,
  role        text not null default 'consultor'
                check (role in ('admin', 'consultor', 'viewer')),
  active      boolean not null default true,
  created_at  timestamptz default now()
);

-- Trigger: crear perfil automáticamente al registrar usuario
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.email)
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- ============================================================
-- 2. PLANES (tabla principal)
-- ============================================================
create table public.plans (
  id              uuid default gen_random_uuid() primary key,
  plan_id         text unique not null,

  -- Ámbito
  scope           text not null default 'individual'
                    check (scope in ('individual', 'corporate')),

  -- Identificación (indexada para búsquedas rápidas)
  hotel_name      text not null,          -- nombreComercial o razonSocial sociedad
  razon_social    text,                   -- Razón social legal
  cif             text,
  categoria       text,                   -- '4 estrellas', etc.
  municipio       text,
  provincia       text,

  -- Dimensionamiento
  num_habitaciones  int,
  num_empleados     int,
  num_hoteles       int default 1,        -- Para planes corporativos

  -- Plan
  version           text not null default 'V1',
  version_num       int  not null default 1,
  baseline_year     text,
  periodo_plan      text,
  fecha_visita      date,
  consultor         text,
  objetivo_reduccion int,                 -- % reducción objetivo global
  num_objetivos     int default 0,        -- Objetivos SMART seleccionados

  -- Auditoría
  created_by    uuid references public.profiles(id),
  updated_by    uuid references public.profiles(id),
  created_at    timestamptz default now(),
  updated_at    timestamptz default now(),

  -- Estado del plan
  estado  text not null default 'Borrador'
            check (estado in ('Borrador', 'Activo', 'En revisión', 'Archivado')),

  -- JSON completo (fuente de verdad)
  data    jsonb not null
);

-- Índices para consultas frecuentes
create index idx_plans_hotel_name    on public.plans using gin (to_tsvector('spanish', hotel_name));
create index idx_plans_provincia     on public.plans (provincia);
create index idx_plans_updated_at    on public.plans (updated_at desc);
create index idx_plans_consultor     on public.plans (consultor);
create index idx_plans_estado        on public.plans (estado);
create index idx_plans_data_gin      on public.plans using gin (data);


-- ============================================================
-- 3. HISTORIAL DE VERSIONES (automático vía trigger)
-- ============================================================
create table public.plan_history (
  id          uuid default gen_random_uuid() primary key,
  plan_id     text not null references public.plans(plan_id) on delete cascade,
  version     text not null,
  version_num int  not null,
  saved_by    uuid references public.profiles(id),
  saved_at    timestamptz default now(),
  data        jsonb not null
);

create index idx_plan_history_plan_id on public.plan_history (plan_id, version_num desc);

-- Trigger: guardar versión anterior automáticamente al actualizar
create or replace function public.save_plan_version()
returns trigger language plpgsql security definer as $$
begin
  if (TG_OP = 'UPDATE' and old.version_num is distinct from new.version_num) then
    insert into public.plan_history (plan_id, version, version_num, saved_by, data)
    values (old.plan_id, old.version, old.version_num, new.updated_by, old.data);
  end if;
  new.updated_at = now();
  return new;
end;
$$;

create trigger on_plan_updated
  before update on public.plans
  for each row execute procedure public.save_plan_version();


-- ============================================================
-- 4. ROW LEVEL SECURITY
-- ============================================================

alter table public.profiles    enable row level security;
alter table public.plans       enable row level security;
alter table public.plan_history enable row level security;

-- profiles: cada usuario ve todos los perfiles activos (necesario para el selector de consultor)
create policy "profiles_select" on public.profiles
  for select to authenticated using (true);

create policy "profiles_update_own" on public.profiles
  for update to authenticated using (auth.uid() = id);

-- plans: todos los autenticados pueden CRUD (sistema corporativo compartido)
create policy "plans_select" on public.plans
  for select to authenticated using (true);

create policy "plans_insert" on public.plans
  for insert to authenticated with check (true);

create policy "plans_update" on public.plans
  for update to authenticated using (true);

create policy "plans_delete" on public.plans
  for delete to authenticated
  using (
    -- Solo el creador o un admin puede borrar
    created_by = auth.uid()
    or exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- plan_history: solo lectura para todos, escritura solo vía trigger
create policy "history_select" on public.plan_history
  for select to authenticated using (true);

create policy "history_insert" on public.plan_history
  for insert to authenticated with check (true);


-- ============================================================
-- 5. VISTA RESUMEN (útil para listados y dashboards)
-- ============================================================
create or replace view public.plans_summary as
select
  p.id,
  p.plan_id,
  p.scope,
  p.hotel_name,
  p.razon_social,
  p.provincia,
  p.municipio,
  p.categoria,
  p.version,
  p.version_num,
  p.estado,
  p.baseline_year,
  p.periodo_plan,
  p.consultor,
  p.num_habitaciones,
  p.num_empleados,
  p.num_hoteles,
  p.num_objetivos,
  p.objetivo_reduccion,
  p.created_at,
  p.updated_at,
  pr.full_name as consultor_nombre,
  pr.email     as consultor_email,
  (select count(*) from public.plan_history h where h.plan_id = p.plan_id) as num_versiones
from public.plans p
left join public.profiles pr on pr.email = p.consultor
order by p.updated_at desc;
