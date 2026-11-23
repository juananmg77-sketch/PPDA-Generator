-- Razón social, criterio de consolidación único con justificación y responsable del informe
alter table public.hc_organizaciones
  add column if not exists razon_social text,
  add column if not exists consolidacion_justificacion text,
  add column if not exists responsable_nombre text,
  add column if not exists responsable_cargo text,
  add column if not exists responsable_entidad text,
  add column if not exists responsable_email text;
alter table public.hc_organizaciones drop constraint if exists hc_organizaciones_criterio_consolidacion_check;
alter table public.hc_organizaciones alter column criterio_consolidacion drop not null;
alter table public.hc_organizaciones alter column criterio_consolidacion drop default;
update public.hc_organizaciones set criterio_consolidacion = case criterio_consolidacion when 'participacion' then 'cuota_participacion' else null end;
alter table public.hc_organizaciones add constraint hc_organizaciones_criterio_consolidacion_check check (criterio_consolidacion is null or criterio_consolidacion in ('control_operativo','control_financiero','cuota_participacion'));
