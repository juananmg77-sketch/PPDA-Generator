-- ============================================================================
-- HS GREEN · Huella de carbono · fase 2: inventario, centros y facturas
-- APLICADO el 2026-11-16 en la base «PPDA Plan de Desperdicio» como migración «huella_fase2_esquema».
-- Probado con retroceso: consultor ve solo lo suyo; cliente sube facturas y propone datos solo en borrador y no confirma, cierra
-- ni borra; anon sin acceso; un inventario cerrado no admite cambios; la auditoría solo la ve el administrador.
-- Base: proyecto «PPDA Plan de Desperdicio». Solo OBJETOS NUEVOS con prefijo hc_ (no toca ninguna tabla existente).
--
-- Quién puede hacer qué (se apoya en profiles.role y en el email del token, como pesajes y donaciones):
--  · admin: todo.
--  · consultor: las organizaciones que ha creado o donde es el consultor asignado (hc_organizaciones.consultor_email).
--  · cliente (hc_accesos): ve su organización, sus centros e inventarios; sube facturas y datos de actividad solo mientras
--    el inventario está en «borrador»; no confirma, no cierra, no borra.
--  · anon: sin acceso.
-- Un inventario «cerrado» o «verificado» queda bloqueado: no se pueden modificar ni borrar sus datos.
-- Toda modificación de documentos, actividad e inventarios se anota en hc_auditoria (trazabilidad para el verificador).
-- ============================================================================

-- 1) Funciones de permiso (security definer para evitar recursión de RLS) ------------------------------------------------
create or replace function public.hc_rol() returns text
language sql stable security definer set search_path = public as $$
  select role from public.profiles where email = (auth.jwt() ->> 'email') and active limit 1
$$;

create or replace function public.hc_es_admin() returns boolean
language sql stable security definer set search_path = public as $$ select coalesce(public.hc_rol() = 'admin', false) $$;

create table if not exists public.hc_organizaciones (
  id                     uuid primary key default gen_random_uuid(),
  nombre                 text not null,
  cif                    text,
  direccion              text,
  cnae                   text,
  iae                    text,
  criterio_consolidacion text not null default 'control' check (criterio_consolidacion in ('control', 'participacion')),
  consultor_email        text,
  activa                 boolean not null default true,
  created_by             uuid references auth.users(id) on delete set null,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create table if not exists public.hc_accesos (
  id              uuid primary key default gen_random_uuid(),
  organizacion_id uuid not null references public.hc_organizaciones(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  created_at      timestamptz not null default now(),
  unique (organizacion_id, user_id)
);

create or replace function public.hc_es_gestor(_org uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.hc_es_admin()
      or (public.hc_rol() = 'consultor' and exists (
            select 1 from public.hc_organizaciones o
            where o.id = _org
              and (o.consultor_email = (auth.jwt() ->> 'email') or o.created_by = auth.uid())))
$$;

create or replace function public.hc_puede_org(_org uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.hc_es_gestor(_org)
      or exists (select 1 from public.hc_accesos a where a.organizacion_id = _org and a.user_id = auth.uid())
$$;

-- 2) Centros e inventarios ----------------------------------------------------------------------------------------------
create table if not exists public.hc_centros (
  id              uuid primary key default gen_random_uuid(),
  organizacion_id uuid not null references public.hc_organizaciones(id) on delete cascade,
  nombre          text not null,
  direccion       text,
  municipio       text,
  isla            text,
  en_baleares     boolean not null default true,
  latitud         numeric(9,6),
  longitud        numeric(9,6),
  unidades_alojamiento integer,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table if not exists public.hc_inventarios (
  id                uuid primary key default gen_random_uuid(),
  organizacion_id   uuid not null references public.hc_organizaciones(id) on delete cascade,
  anio              integer not null check (anio between 2007 and 2100),
  estado            text not null default 'borrador' check (estado in ('borrador', 'revision', 'cerrado', 'verificado')),
  anio_base         integer,
  indice_actividad  text not null default 'estancias',
  conjunto_factores jsonb,          -- conjunto de factores usado (con versión y notas); se fija al cerrar
  verificacion      jsonb,          -- entidad, nivel de aseguramiento, fecha, referencia del informe sellado
  cerrado_en        timestamptz,
  cerrado_por       uuid references auth.users(id) on delete set null,
  created_by        uuid references auth.users(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (organizacion_id, anio)
);

-- Datos de cada centro en cada inventario: periodo operativo e índice de actividad (centros cerrados o con apertura parcial)
create table if not exists public.hc_inventario_centros (
  inventario_id     uuid not null references public.hc_inventarios(id) on delete cascade,
  centro_id         uuid not null references public.hc_centros(id) on delete cascade,
  operativo_desde   date,
  operativo_hasta   date,
  indice_actividad  numeric not null default 0 check (indice_actividad >= 0),
  notas             text,
  primary key (inventario_id, centro_id)
);

create or replace function public.hc_org_de_inventario(_inv uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select organizacion_id from public.hc_inventarios where id = _inv
$$;

create or replace function public.hc_inventario_abierto(_inv uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select estado = 'borrador' from public.hc_inventarios where id = _inv), false)
$$;

-- 3) Facturas y datos de actividad --------------------------------------------------------------------------------------
create table if not exists public.hc_documentos (
  id              uuid primary key default gen_random_uuid(),
  inventario_id   uuid not null references public.hc_inventarios(id) on delete cascade,
  centro_id       uuid references public.hc_centros(id) on delete set null,
  tipo            text not null default 'otro'
                  check (tipo in ('electricidad', 'gas_natural', 'gasoleo', 'glp', 'combustible_vehiculo', 'refrigerante', 'otro')),
  proveedor       text,
  periodo_desde   date,
  periodo_hasta   date,
  importe         numeric,
  archivo_path    text not null,       -- ruta en el bucket hc-facturas: <organizacion>/<inventario>/<archivo>
  nombre_archivo  text,
  estado          text not null default 'subido' check (estado in ('subido', 'leido', 'revisado', 'rechazado')),
  extraccion      jsonb,               -- lectura automática propuesta (nunca es el dato final)
  revisado_por    uuid references auth.users(id) on delete set null,
  revisado_en     timestamptz,
  created_by      uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  check (periodo_hasta is null or periodo_desde is null or periodo_hasta >= periodo_desde)
);

create table if not exists public.hc_actividad (
  id                    uuid primary key default gen_random_uuid(),
  inventario_id         uuid not null references public.hc_inventarios(id) on delete cascade,
  centro_id             uuid not null references public.hc_centros(id) on delete restrict,
  documento_id          uuid references public.hc_documentos(id) on delete set null,
  categoria             text not null check (categoria in ('combustion_fija', 'combustion_movil', 'fugitiva', 'electricidad')),
  fuente                text not null default '',   -- clave del factor, gas refrigerante o vacío en electricidad
  cantidad              numeric not null check (cantidad >= 0),
  unidad                text,
  origen_electricidad   text check (origen_electricidad in ('red', 'autoconsumo', 'gdo_renovable_balear', 'gdo_otra')),
  periodo_desde         date,
  periodo_hasta         date,
  reparto_proporcion    numeric not null default 1 check (reparto_proporcion > 0 and reparto_proporcion <= 1),
  reparto_justificacion text,
  estado                text not null default 'borrador' check (estado in ('borrador', 'confirmada')),
  confirmada_por        uuid references auth.users(id) on delete set null,
  notas                 text,
  created_by            uuid references auth.users(id) on delete set null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  check (reparto_proporcion = 1 or coalesce(reparto_justificacion, '') <> ''),
  check (categoria <> 'electricidad' or origen_electricidad is not null)
);

create index if not exists hc_actividad_inv_idx on public.hc_actividad (inventario_id);
create index if not exists hc_documentos_inv_idx on public.hc_documentos (inventario_id);
create index if not exists hc_centros_org_idx on public.hc_centros (organizacion_id);

-- 4) Exclusiones, no conformidades y auditoría --------------------------------------------------------------------------
create table if not exists public.hc_exclusiones (
  id             uuid primary key default gen_random_uuid(),
  inventario_id  uuid not null references public.hc_inventarios(id) on delete cascade,
  fuente         text not null,
  porcentaje     numeric check (porcentaje >= 0),
  justificacion  text not null,
  created_at     timestamptz not null default now()
);

create table if not exists public.hc_no_conformidades (
  id             uuid primary key default gen_random_uuid(),
  inventario_id  uuid not null references public.hc_inventarios(id) on delete cascade,
  fecha          date not null default current_date,
  descripcion    text not null,
  medida         text,
  responsable    text,
  cerrada_en     date,
  created_at     timestamptz not null default now()
);

create table if not exists public.hc_auditoria (
  id         bigint generated always as identity primary key,
  tabla      text not null,
  registro   uuid,
  accion     text not null,
  usuario    uuid,
  email      text,
  datos      jsonb,
  fecha      timestamptz not null default now()
);

-- 5) Disparadores: fecha de modificación, auditoría y bloqueo de inventarios cerrados --------------------------------
create or replace function public.hc_tocar_updated_at() returns trigger
language plpgsql set search_path = public as $$
begin new.updated_at := now(); return new; end $$;

create or replace function public.hc_auditar() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.hc_auditoria (tabla, registro, accion, usuario, email, datos)
  values (tg_table_name, coalesce((to_jsonb(new) ->> 'id')::uuid, (to_jsonb(old) ->> 'id')::uuid), tg_op,
          auth.uid(), auth.jwt() ->> 'email', case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end);
  return coalesce(new, old);
end $$;

create or replace function public.hc_bloquear_cerrado() returns trigger
language plpgsql security definer set search_path = public as $$
declare _inv uuid; _estado text;
begin
  _inv := coalesce((to_jsonb(new) ->> 'inventario_id')::uuid, (to_jsonb(old) ->> 'inventario_id')::uuid);
  select estado into _estado from public.hc_inventarios where id = _inv;
  if _estado in ('cerrado', 'verificado') then
    raise exception 'El inventario está % y no admite cambios; hay que reabrirlo con registro de la causa.', _estado;
  end if;
  return coalesce(new, old);
end $$;

create or replace function public.hc_inventario_transiciones() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- un inventario cerrado o verificado solo puede cambiar de estado (reabrir) o completar la verificación
  if old.estado in ('cerrado', 'verificado') and new.estado = old.estado
     and (new.anio, new.organizacion_id, new.conjunto_factores) is distinct from (old.anio, old.organizacion_id, old.conjunto_factores) then
    raise exception 'El inventario % no admite cambios en sus datos básicos ni en sus factores.', old.estado;
  end if;
  if new.estado in ('cerrado', 'verificado') and old.estado not in ('cerrado', 'verificado') then
    if new.conjunto_factores is null then
      raise exception 'Para cerrar un inventario hay que fijar el conjunto de factores usado.';
    end if;
    new.cerrado_en := now();
    new.cerrado_por := auth.uid();
  end if;
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['hc_organizaciones', 'hc_centros', 'hc_inventarios', 'hc_documentos', 'hc_actividad'] loop
    execute format('drop trigger if exists %1$s_updated_at on public.%1$s', t);
    execute format('create trigger %1$s_updated_at before update on public.%1$s for each row execute function public.hc_tocar_updated_at()', t);
  end loop;
  foreach t in array array['hc_inventarios', 'hc_documentos', 'hc_actividad', 'hc_exclusiones', 'hc_no_conformidades'] loop
    execute format('drop trigger if exists %1$s_audit on public.%1$s', t);
    execute format('create trigger %1$s_audit after insert or update or delete on public.%1$s for each row execute function public.hc_auditar()', t);
  end loop;
  foreach t in array array['hc_documentos', 'hc_actividad', 'hc_exclusiones', 'hc_no_conformidades', 'hc_inventario_centros'] loop
    execute format('drop trigger if exists %1$s_cerrado on public.%1$s', t);
    execute format('create trigger %1$s_cerrado before insert or update or delete on public.%1$s for each row execute function public.hc_bloquear_cerrado()', t);
  end loop;
end $$;

drop trigger if exists hc_inventarios_transiciones on public.hc_inventarios;
create trigger hc_inventarios_transiciones before update on public.hc_inventarios
  for each row execute function public.hc_inventario_transiciones();

-- 6) Seguridad (RLS) ------------------------------------------------------------------------------------------------------
alter table public.hc_organizaciones    enable row level security;
alter table public.hc_accesos           enable row level security;
alter table public.hc_centros           enable row level security;
alter table public.hc_inventarios       enable row level security;
alter table public.hc_inventario_centros enable row level security;
alter table public.hc_documentos        enable row level security;
alter table public.hc_actividad         enable row level security;
alter table public.hc_exclusiones       enable row level security;
alter table public.hc_no_conformidades  enable row level security;
alter table public.hc_auditoria         enable row level security;

revoke all on public.hc_organizaciones, public.hc_accesos, public.hc_centros, public.hc_inventarios, public.hc_inventario_centros,
              public.hc_documentos, public.hc_actividad, public.hc_exclusiones, public.hc_no_conformidades, public.hc_auditoria from anon;
revoke all on public.hc_auditoria from authenticated;
grant select on public.hc_auditoria to authenticated;
grant select, insert, update, delete on public.hc_organizaciones, public.hc_accesos, public.hc_centros, public.hc_inventarios,
      public.hc_inventario_centros, public.hc_documentos, public.hc_actividad, public.hc_exclusiones, public.hc_no_conformidades to authenticated;

-- Organizaciones: gestores ven y editan; clientes solo ven la suya; crean admin y consultores
create policy hc_org_ver on public.hc_organizaciones for select to authenticated using (public.hc_puede_org(id));
create policy hc_org_crear on public.hc_organizaciones for insert to authenticated
  with check (public.hc_rol() in ('admin', 'consultor') and created_by = auth.uid());
create policy hc_org_editar on public.hc_organizaciones for update to authenticated
  using (public.hc_es_gestor(id)) with check (public.hc_es_gestor(id));
create policy hc_org_borrar on public.hc_organizaciones for delete to authenticated using (public.hc_es_admin());

-- Accesos de clientes: los gestiona el gestor de la organización; cada cliente ve el suyo
create policy hc_acc_ver on public.hc_accesos for select to authenticated using (public.hc_es_gestor(organizacion_id) or user_id = auth.uid());
create policy hc_acc_gestionar on public.hc_accesos for all to authenticated
  using (public.hc_es_gestor(organizacion_id)) with check (public.hc_es_gestor(organizacion_id));

-- Centros: ven los que acceden a la organización; editan los gestores
create policy hc_centros_ver on public.hc_centros for select to authenticated using (public.hc_puede_org(organizacion_id));
create policy hc_centros_gestionar on public.hc_centros for all to authenticated
  using (public.hc_es_gestor(organizacion_id)) with check (public.hc_es_gestor(organizacion_id));

-- Inventarios: ven los que acceden; crean y editan los gestores (el cliente no cambia el estado)
create policy hc_inv_ver on public.hc_inventarios for select to authenticated using (public.hc_puede_org(organizacion_id));
create policy hc_inv_gestionar on public.hc_inventarios for all to authenticated
  using (public.hc_es_gestor(organizacion_id)) with check (public.hc_es_gestor(organizacion_id));

create policy hc_invcen_ver on public.hc_inventario_centros for select to authenticated
  using (public.hc_puede_org(public.hc_org_de_inventario(inventario_id)));
create policy hc_invcen_gestionar on public.hc_inventario_centros for all to authenticated
  using (public.hc_es_gestor(public.hc_org_de_inventario(inventario_id)))
  with check (public.hc_es_gestor(public.hc_org_de_inventario(inventario_id)));

-- Documentos y actividad: el cliente sube y edita solo en inventarios en borrador; los gestores siempre (si no está cerrado)
create policy hc_doc_ver on public.hc_documentos for select to authenticated using (public.hc_puede_org(public.hc_org_de_inventario(inventario_id)));
create policy hc_doc_subir on public.hc_documentos for insert to authenticated
  with check (public.hc_puede_org(public.hc_org_de_inventario(inventario_id)) and created_by = auth.uid()
              and (public.hc_es_gestor(public.hc_org_de_inventario(inventario_id)) or public.hc_inventario_abierto(inventario_id)));
create policy hc_doc_editar on public.hc_documentos for update to authenticated
  using (public.hc_es_gestor(public.hc_org_de_inventario(inventario_id))
         or (public.hc_puede_org(public.hc_org_de_inventario(inventario_id)) and public.hc_inventario_abierto(inventario_id) and estado = 'subido'))
  with check (public.hc_es_gestor(public.hc_org_de_inventario(inventario_id))
         or (public.hc_puede_org(public.hc_org_de_inventario(inventario_id)) and estado = 'subido'));
create policy hc_doc_borrar on public.hc_documentos for delete to authenticated
  using (public.hc_es_gestor(public.hc_org_de_inventario(inventario_id)));

create policy hc_act_ver on public.hc_actividad for select to authenticated using (public.hc_puede_org(public.hc_org_de_inventario(inventario_id)));
create policy hc_act_crear on public.hc_actividad for insert to authenticated
  with check (public.hc_puede_org(public.hc_org_de_inventario(inventario_id)) and created_by = auth.uid()
              and (public.hc_es_gestor(public.hc_org_de_inventario(inventario_id))
                   or (public.hc_inventario_abierto(inventario_id) and estado = 'borrador')));
create policy hc_act_editar on public.hc_actividad for update to authenticated
  using (public.hc_es_gestor(public.hc_org_de_inventario(inventario_id))
         or (public.hc_puede_org(public.hc_org_de_inventario(inventario_id)) and public.hc_inventario_abierto(inventario_id) and estado = 'borrador'))
  with check (public.hc_es_gestor(public.hc_org_de_inventario(inventario_id))
              or (public.hc_puede_org(public.hc_org_de_inventario(inventario_id)) and estado = 'borrador'));
create policy hc_act_borrar on public.hc_actividad for delete to authenticated
  using (public.hc_es_gestor(public.hc_org_de_inventario(inventario_id)));

-- Exclusiones y no conformidades: solo gestores (el cliente las ve)
create policy hc_exc_ver on public.hc_exclusiones for select to authenticated using (public.hc_puede_org(public.hc_org_de_inventario(inventario_id)));
create policy hc_exc_gestionar on public.hc_exclusiones for all to authenticated
  using (public.hc_es_gestor(public.hc_org_de_inventario(inventario_id))) with check (public.hc_es_gestor(public.hc_org_de_inventario(inventario_id)));
create policy hc_nc_ver on public.hc_no_conformidades for select to authenticated using (public.hc_puede_org(public.hc_org_de_inventario(inventario_id)));
create policy hc_nc_gestionar on public.hc_no_conformidades for all to authenticated
  using (public.hc_es_gestor(public.hc_org_de_inventario(inventario_id))) with check (public.hc_es_gestor(public.hc_org_de_inventario(inventario_id)));

-- Auditoría: solo la ven los administradores y los gestores (de lo que les corresponde); nadie la modifica desde la app
create policy hc_aud_ver on public.hc_auditoria for select to authenticated using (public.hc_es_admin());

-- 7) Carpeta privada de facturas ----------------------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('hc-facturas', 'hc-facturas', false, 20971520, array['application/pdf', 'image/jpeg', 'image/png'])
on conflict (id) do nothing;

create policy "hc-facturas: ver" on storage.objects for select to authenticated
  using (bucket_id = 'hc-facturas' and public.hc_puede_org(((storage.foldername(name))[1])::uuid));
create policy "hc-facturas: subir" on storage.objects for insert to authenticated
  with check (bucket_id = 'hc-facturas' and public.hc_puede_org(((storage.foldername(name))[1])::uuid));
create policy "hc-facturas: borrar" on storage.objects for delete to authenticated
  using (bucket_id = 'hc-facturas' and public.hc_es_gestor(((storage.foldername(name))[1])::uuid));

revoke all on function public.hc_rol(), public.hc_es_admin(), public.hc_es_gestor(uuid), public.hc_puede_org(uuid),
  public.hc_org_de_inventario(uuid), public.hc_inventario_abierto(uuid) from public, anon;
grant execute on function public.hc_rol(), public.hc_es_admin(), public.hc_es_gestor(uuid), public.hc_puede_org(uuid),
  public.hc_org_de_inventario(uuid), public.hc_inventario_abierto(uuid) to authenticated;

-- 2026-11-17 · APLICADO como migración «huella_actividad_contador»: punto de suministro de cada dato (separar contadores con periodos solapados).
alter table public.hc_actividad add column if not exists contador text;
