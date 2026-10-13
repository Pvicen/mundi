-- Migración 2026-10-13 (b): MUNDI, EL CONTORNO SE COMPRUEBA ENTERO.
-- La regla de `forma` de 2026-10-13-forma-y-miniatura.sql miraba solo el tipo y que `coordinates` fuera una lista: un
-- contorno sin coordenadas o con un polígono nulo pasaba. Ahora se comprueba entero: Polygon o MultiPolygon, con
-- anillos de al menos 4 puntos [lon, lat] numéricos y en rango, y hasta 100 KB (Contrato «BD» de docs/contratos.md;
-- la misma regla que `formaValida` de mapa.js).
-- Requiere 2026-10-13-forma-y-miniatura.sql. Se puede ejecutar más de una vez y no rompe la app publicada.
-- No hay nada que rellenar: se pega entera y se pulsa Run. Tiene que salir `mundi_forma_estricta` = PASA.

-- 0. Freno
do $$
begin
  if not exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'mundi_pinchos' and column_name = 'forma') then
    raise exception 'Falta la migración 2026-10-13-forma-y-miniatura.sql (no existe mundi_pinchos.forma).';
  end if;
end $$;

-- 1. ¿Un polígono de GeoJSON bien formado? (cada CASE comprueba en orden: nunca mide algo que no sea una lista)
create or replace function public.mundi_poligono_valido(pol jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case
    when jsonb_typeof(pol) is distinct from 'array' then false
    when jsonb_array_length(pol) = 0 then false
    else not exists (
      select 1 from jsonb_array_elements(pol) as anillo(valor)
      where case
        when jsonb_typeof(anillo.valor) is distinct from 'array' then true
        when jsonb_array_length(anillo.valor) < 4 then true
        else exists (
          select 1 from jsonb_array_elements(anillo.valor) as punto(valor)
          where case
            when jsonb_typeof(punto.valor) is distinct from 'array' then true
            when jsonb_array_length(punto.valor) < 2 then true
            when jsonb_typeof(punto.valor -> 0) is distinct from 'number' then true
            when jsonb_typeof(punto.valor -> 1) is distinct from 'number' then true
            else abs((punto.valor ->> 0)::float8) > 180 or abs((punto.valor ->> 1)::float8) > 90
          end)
      end)
  end
$$;

-- 2. ¿Un contorno válido para `forma`? (null vale: el mapa pinta una mancha)
create or replace function public.mundi_forma_valida(f jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case
    when f is null then true
    when jsonb_typeof(f) is distinct from 'object' then false
    when octet_length(f::text) > 100000 then false
    when f ->> 'type' = 'Polygon' then public.mundi_poligono_valido(f -> 'coordinates')
    when f ->> 'type' = 'MultiPolygon' then
      case
        when jsonb_typeof(f -> 'coordinates') is distinct from 'array' then false
        when jsonb_array_length(f -> 'coordinates') = 0 then false
        else not exists (
          select 1 from jsonb_array_elements(f -> 'coordinates') as pol(valor)
          where not public.mundi_poligono_valido(pol.valor))
      end
    else false
  end
$$;

-- 3. La regla nueva sustituye a la anterior (si algún pincho no la cumple, se avisa y no se cambia nada)
do $$
begin
  if exists (select 1 from public.mundi_pinchos where not public.mundi_forma_valida(forma)) then
    raise exception 'Hay pinchos con un contorno que no vale: avisa a Claude antes de seguir.';
  end if;
end $$;

alter table public.mundi_pinchos drop constraint if exists mundi_pinchos_forma_check;
alter table public.mundi_pinchos add constraint mundi_pinchos_forma_check check (public.mundi_forma_valida(forma));

-- 4. Comprobación de la regla: lo que no vale se rechaza y un contorno bueno entra (todo lo de prueba se deshace)
do $$
declare
  yo uuid;
  malas jsonb[] := array[
    '{"type": "Polygon"}',
    '{"type": "MultiPolygon", "coordinates": [null]}',
    '{"type": "Polygon", "coordinates": []}',
    '{"type": "Polygon", "coordinates": [[[0, 0], [1, 0], [0, 0]]]}',
    '{"type": "Polygon", "coordinates": [[["a", 0], [1, 0], [1, 1], ["a", 0]]]}',
    '{"type": "Polygon", "coordinates": [[[200, 0], [1, 0], [1, 1], [200, 0]]]}',
    '{"type": "Point", "coordinates": [0, 0]}'
  ]::jsonb[];
  mala jsonb;
begin
  select u.id into yo from auth.users u join public.mundi_personas p on p.correo = lower(u.email) limit 1;
  foreach mala in array malas loop
    begin
      insert into public.mundi_pinchos (dueno, nombre, lat, lon, forma) values (yo, 'prueba: forma', 0, 0, mala);
      raise exception 'La columna forma aceptó un contorno que no vale: %', mala;
    exception when check_violation then
      null;
    end;
  end loop;
  begin
    insert into public.mundi_pinchos (dueno, nombre, lat, lon, forma)
      values (yo, 'prueba: forma buena', 0, 0, '{"type": "Polygon", "coordinates": [[[0, 0], [1, 0], [1, 1], [0, 0]]]}');
    raise exception using errcode = 'PRB01', message = 'deshacer';
  exception when sqlstate 'PRB01' then
    null;
  end;
end $$;

notify pgrst, 'reload schema';

-- Comprobación: tiene que salir una fila con PASA
select case when
    to_regprocedure('public.mundi_forma_valida(jsonb)') is not null
    and exists (select 1 from pg_constraint where conname = 'mundi_pinchos_forma_check'
                and pg_get_constraintdef(oid) like '%mundi_forma_valida%')
    and public.mundi_forma_valida('{"type": "Polygon", "coordinates": [[[0, 0], [1, 0], [1, 1], [0, 0]]]}')
    and not public.mundi_forma_valida('{"type": "MultiPolygon", "coordinates": [null]}')
  then 'PASA' else 'FALLA' end as mundi_forma_estricta;
