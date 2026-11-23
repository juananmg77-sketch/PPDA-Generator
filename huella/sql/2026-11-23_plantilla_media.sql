-- Plantilla media del año por centro (trabajadores), para el ratio de emisiones por trabajador. Opcional: 0 = sin indicar.
alter table public.hc_inventario_centros
  add column if not exists plantilla_media numeric not null default 0 check (plantilla_media >= 0);
comment on column public.hc_inventario_centros.plantilla_media is 'Plantilla media del año del centro o de su empresa (listado de la Seguridad Social); 0 = sin indicar.';
