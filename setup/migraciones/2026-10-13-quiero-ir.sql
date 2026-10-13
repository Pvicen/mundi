-- Migración 2026-10-13: MUNDI, «QUIERO IR».
-- Cada pincho es un sitio donde estuve («visitado», el de siempre) o un sitio al que quiero ir («quiero_ir»).
-- Contrato de datos: docs/contratos.md, apartado «BD» (columna `estado`).
-- Requiere 2026-10-12-mundi.sql. Todos los pinchos que ya hay quedan como visitados. Se puede ejecutar más de una
-- vez y no rompe la app publicada (no pide la columna). No hay nada que rellenar: se pega entera y se pulsa Run.
-- Tiene que salir `mundi_quiero_ir` = PASA.

-- 0. Freno
do $$
begin
  if to_regclass('public.mundi_pinchos') is null then
    raise exception 'Falta la migración 2026-10-12-mundi.sql (no existe public.mundi_pinchos).';
  end if;
end $$;

-- 1. La columna, con «visitado» para todo lo que ya existe
alter table public.mundi_pinchos add column if not exists estado text not null default 'visitado';

alter table public.mundi_pinchos drop constraint if exists mundi_pinchos_estado_check;
alter table public.mundi_pinchos add constraint mundi_pinchos_estado_check
  check (estado in ('visitado', 'quiero_ir'));

-- 2. Comprobación de la regla: otro valor se rechaza (lo de prueba se deshace)
do $$
declare
  yo uuid;
begin
  select u.id into yo from auth.users u join public.mundi_personas p on p.correo = lower(u.email) limit 1;
  begin
    insert into public.mundi_pinchos (dueno, nombre, lat, lon, estado) values (yo, 'prueba: estado', 0, 0, 'otro');
    raise exception 'La columna estado aceptó un valor que no vale: revisa la regla.';
  exception when check_violation then
    null;
  end;
end $$;

notify pgrst, 'reload schema';

-- Comprobación: tiene que salir una fila con PASA
select case when
    exists (select 1 from information_schema.columns
            where table_schema = 'public' and table_name = 'mundi_pinchos' and column_name = 'estado'
              and is_nullable = 'NO' and column_default like '''visitado''%')
    and exists (select 1 from pg_constraint where conname = 'mundi_pinchos_estado_check')
    and not exists (select 1 from public.mundi_pinchos where estado not in ('visitado', 'quiero_ir'))
  then 'PASA' else 'FALLA' end as mundi_quiero_ir;
