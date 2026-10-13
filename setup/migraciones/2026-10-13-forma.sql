-- Migración 2026-10-13: MUNDI, EL CONTORNO DE CADA LUGAR.
-- Cada pincho puede guardar la forma real del lugar (la ciudad, la isla…) para pintarla en el mapa en vez del país
-- entero. Contrato de datos: docs/contratos.md, apartado «BD» (columna `forma`).
-- Requiere 2026-10-12-mundi.sql. Se puede ejecutar más de una vez y no rompe la app publicada (no pide la columna).
-- No hay nada que rellenar: se pega entera y se pulsa Run. Tiene que salir `mundi_forma` = PASA.

-- 0. Freno
do $$
begin
  if to_regclass('public.mundi_pinchos') is null then
    raise exception 'Falta la migración 2026-10-12-mundi.sql (no existe public.mundi_pinchos).';
  end if;
end $$;

-- 1. La columna: un polígono GeoJSON ([lon, lat]) de hasta 100 KB, o null (el mapa pinta una mancha)
alter table public.mundi_pinchos add column if not exists forma jsonb;

alter table public.mundi_pinchos drop constraint if exists mundi_pinchos_forma_check;
alter table public.mundi_pinchos add constraint mundi_pinchos_forma_check check (
  forma is null or (
    jsonb_typeof(forma) = 'object'
    and forma->>'type' in ('Polygon', 'MultiPolygon')
    and jsonb_typeof(forma->'coordinates') = 'array'
    and octet_length(forma::text) <= 100000
  )
);

-- 2. Comprobación de la regla: un punto y una forma demasiado grande se rechazan (lo de prueba se deshace)
do $$
declare
  yo uuid;
begin
  select u.id into yo from auth.users u join public.mundi_personas p on p.correo = lower(u.email) limit 1;
  begin
    insert into public.mundi_pinchos (dueno, nombre, lat, lon, forma)
      values (yo, 'prueba: punto', 0, 0, '{"type": "Point", "coordinates": [0, 0]}');
    raise exception 'La columna forma aceptó un punto: revisa la regla.';
  exception when check_violation then
    null;
  end;
  begin
    insert into public.mundi_pinchos (dueno, nombre, lat, lon, forma)
      values (yo, 'prueba: grande', 0, 0,
        jsonb_build_object('type', 'Polygon', 'coordinates', jsonb_build_array(repeat('x', 100001))));
    raise exception 'La columna forma aceptó más de 100 KB: revisa la regla.';
  exception when check_violation then
    null;
  end;
end $$;

notify pgrst, 'reload schema';

-- Comprobación: tiene que salir una fila con PASA
select case when
    exists (select 1 from information_schema.columns
            where table_schema = 'public' and table_name = 'mundi_pinchos' and column_name = 'forma'
              and data_type = 'jsonb')
    and exists (select 1 from pg_constraint where conname = 'mundi_pinchos_forma_check')
    and (select count(*) from pg_policies p where p.schemaname = 'public' and p.tablename = 'mundi_pinchos') = 4
  then 'PASA' else 'FALLA' end as mundi_forma;
