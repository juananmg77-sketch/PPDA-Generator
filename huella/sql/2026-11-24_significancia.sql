-- Evaluación de la significancia de las emisiones indirectas (ISO 14064-1, 5.2.3 y anexo H)
alter table public.hc_organizaciones add column if not exists config_significancia jsonb;
alter table public.hc_exclusiones add column if not exists evidencia_url text;

create table if not exists public.hc_plantillas_subcategorias (
  id uuid primary key default gen_random_uuid(),
  sector text not null,
  categoria smallint not null check (categoria between 3 and 6),
  codigo text not null,
  nombre text not null,
  descripcion text,
  orden int not null default 0,
  activa boolean not null default true,
  unique (sector, codigo)
);
create table if not exists public.hc_configuracion (
  clave text primary key,
  valor jsonb not null,
  updated_at timestamptz not null default now()
);
create table if not exists public.hc_evaluaciones_significancia (
  id uuid primary key default gen_random_uuid(),
  inventario_id uuid not null references public.hc_inventarios(id) on delete cascade,
  categoria smallint not null check (categoria between 3 and 6),
  codigo text not null,
  nombre text not null,
  magnitud_pct numeric check (magnitud_pct is null or magnitud_pct >= 0),
  influencia text check (influencia in ('alta','media','baja')),
  datos text check (datos in ('buenos','parciales','no_disponibles')),
  requisitos boolean,
  resultado text check (resultado in ('significativa','no_significativa')),
  justificacion text,
  cuantificada boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (inventario_id, codigo)
);

alter table public.hc_plantillas_subcategorias enable row level security;
alter table public.hc_configuracion enable row level security;
alter table public.hc_evaluaciones_significancia enable row level security;

create policy hc_plt_ver on public.hc_plantillas_subcategorias for select to authenticated using (public.hc_rol() is not null);
create policy hc_plt_gestionar on public.hc_plantillas_subcategorias for all to authenticated using (public.hc_es_admin()) with check (public.hc_es_admin());
create policy hc_cfg_ver on public.hc_configuracion for select to authenticated using (public.hc_rol() is not null);
create policy hc_cfg_gestionar on public.hc_configuracion for all to authenticated using (public.hc_es_admin()) with check (public.hc_es_admin());
create policy hc_eval_ver on public.hc_evaluaciones_significancia for select to authenticated using (public.hc_puede_org(public.hc_org_de_inventario(inventario_id)));
create policy hc_eval_gestionar on public.hc_evaluaciones_significancia for all to authenticated using (public.hc_es_gestor(public.hc_org_de_inventario(inventario_id))) with check (public.hc_es_gestor(public.hc_org_de_inventario(inventario_id)));

create trigger hc_eval_audit after insert or update or delete on public.hc_evaluaciones_significancia for each row execute function public.hc_auditar();
create trigger hc_eval_cerrado before insert or update or delete on public.hc_evaluaciones_significancia for each row execute function public.hc_bloquear_cerrado();

insert into public.hc_plantillas_subcategorias (sector, categoria, codigo, nombre, orden) values
  ('hoteles',3,'3.1','Transporte de mercancías (aguas arriba)',1),
  ('hoteles',3,'3.2','Desplazamientos de los empleados al trabajo',2),
  ('hoteles',3,'3.3','Transporte de clientes (llegada y salida de los huéspedes)',3),
  ('hoteles',3,'3.4','Viajes de negocios',4),
  ('hoteles',4,'4.1','Alimentos y bebidas',5),
  ('hoteles',4,'4.2','Otros bienes y servicios comprados',6),
  ('hoteles',4,'4.3','Bienes de capital',7),
  ('hoteles',4,'4.4','Residuos generados',8),
  ('hoteles',4,'4.5','Agua',9),
  ('hoteles',4,'4.6','Lavandería externalizada',10),
  ('hoteles',5,'5.1','Uso de los productos y servicios ofrecidos a los clientes',11),
  ('hoteles',5,'5.2','Final de vida de los productos suministrados',12),
  ('hoteles',6,'6.1','Otras fuentes de emisiones indirectas',13)
on conflict (sector, codigo) do nothing;
insert into public.hc_configuracion (clave, valor) values ('declaracion', '{"programa": "Decreto 48/2021 del Registro balear de huella de carbono", "norma": "ISO 14064-1:2018", "a": "La organización declara que este inventario de GEI del año {anio} se ha elaborado conforme a la norma {norma} y a los requisitos del {programa}.", "b": "La organización declara que este inventario de GEI del año {anio} se ha elaborado conforme a los requisitos del {programa}, siguiendo la metodología de {norma}.", "falta": "No se declara la conformidad con {norma} porque la evaluación de la significancia de las emisiones indirectas no está completa: {motivos}."}'::jsonb) on conflict (clave) do nothing;

-- «No aplica»: exclusión directa de una subcategoría con justificación, sin valorar los criterios
alter table public.hc_evaluaciones_significancia add column if not exists metodo text not null default 'criterios' check (metodo in ('criterios','no_aplica'));
