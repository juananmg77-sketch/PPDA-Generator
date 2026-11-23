-- PROYECTO HS SUITE (tcywohajqmnfdwfuvwfk), no el del PPDA. FUNCIÓN NUEVA: no modifica ni borra nada existente.
-- Igual que hsgreen_buscar_hoteles pero devolviendo además latitud y longitud. La original queda intacta para cualquier otra aplicación.
create or replace function public.hsgreen_buscar_hoteles_v2(p_token text, p_texto text default null, p_cadena text default null, p_id uuid default null, p_limit integer default 50)
 returns table(id uuid, codigo_hotel text, nombre_hotel text, cadena_hotelera text, titular text, cif text, pais text, ccaa text, isla text, municipio text, direccion_completa text, num_habitaciones integer, num_plazas integer, activo boolean, latitud double precision, longitud double precision)
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  ok boolean;
  v_texto text := translate(lower(trim(coalesce(p_texto, ''))), 'áéíóúüñàèìòù', 'aeiouunaeiou');
  v_cadena text := translate(lower(trim(coalesce(p_cadena, ''))), 'áéíóúüñàèìòù', 'aeiouunaeiou');
  v_lim int := least(greatest(coalesce(p_limit, 50), 1), 200);
begin
  select (a.token_sha256 = encode(sha256(convert_to(coalesce(p_token, ''), 'utf8')), 'hex')) into ok from public.hsgreen_acceso a where a.id = 1;
  if not coalesce(ok, false) then raise exception 'no autorizado' using errcode = '28000'; end if;
  if p_id is null and length(v_texto) < 2 and length(v_cadena) < 2 then raise exception 'criterio de búsqueda insuficiente' using errcode = '22023'; end if;

  return query
  select h.id, h.codigo_hotel::text, h.nombre_hotel::text, h.cadena_hotelera::text, h.titular::text, h.cif::text, h.pais::text, h.ccaa::text, h.isla::text,
         h.municipio::text, h.direccion_completa, h.num_habitaciones, h.num_plazas, h.activo, h.latitud::double precision, h.longitud::double precision
  from public.hoteles h
  where (p_id is null or h.id = p_id)
    and (v_cadena = '' or translate(lower(coalesce(h.cadena_hotelera, '')), 'áéíóúüñàèìòù', 'aeiouunaeiou') = v_cadena)
    and (v_texto = '' or not exists (
      select 1 from unnest(regexp_split_to_array(v_texto, '\s+')) w
      where w <> '' and position(w in translate(lower(concat_ws(' ', h.nombre_hotel, h.codigo_hotel, h.cadena_hotelera, h.titular, h.municipio, h.cif)), 'áéíóúüñàèìòù', 'aeiouunaeiou')) = 0))
  order by coalesce(h.activo, true) desc, h.nombre_hotel
  limit v_lim;
end $function$;

revoke all on function public.hsgreen_buscar_hoteles_v2(text, text, text, uuid, integer) from public;
grant execute on function public.hsgreen_buscar_hoteles_v2(text, text, text, uuid, integer) to postgres, anon, authenticated, service_role;
