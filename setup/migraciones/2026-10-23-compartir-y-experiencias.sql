-- Migración 2026-10-23: MUNDI, COMPARTIR EL MAPA Y LAS EXPERIENCIAS.
-- (1) Cada persona de Mundi puede compartir su mapa entero, en solo lectura, con otras personas de Mundi que ella
--     elija por su correo, y quitarles el permiso cuando quiera: verán sus pinchos y sus fotos, sin poder cambiar nada.
-- (2) Cada lugar puede llevar una valoración (1 a 5) y una lista de experiencias (comer, dormir, visitar, hacer,
--     consejo) que solo escribe su dueño.
-- Contrato de datos: docs/contratos.md, apartado «BD — compartir el mapa y experiencias (añadido)».
-- Requiere las migraciones anteriores. Se puede ejecutar más de una vez. No comparte nada por sí sola (la lista de
-- permisos empieza vacía), así que no cambia lo que ve nadie hasta que alguien comparta desde la app nueva.
-- No hay nada que rellenar: se pega entera y se pulsa Run. Tiene que salir `mundi_compartir` = PASA.

-- 0. Freno
do $$
begin
  if not exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'mundi_pinchos' and column_name = 'estado') then
    raise exception 'Faltan las migraciones del 13/10 (no existe mundi_pinchos.estado).';
  end if;
end $$;

-- 1. Las experiencias: [{ tipo, nombre, texto?, estrellas? }], hasta 30
create or replace function public.mundi_experiencias_validas(e jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case
    when jsonb_typeof(e) is distinct from 'array' then false
    when jsonb_array_length(e) > 30 then false
    when octet_length(e::text) > 200000 then false
    else not exists (
      select 1 from jsonb_array_elements(e) as x(v)
      where case
        when jsonb_typeof(x.v) is distinct from 'object' then true
        when exists (select 1 from jsonb_object_keys(x.v) as k(clave)
                     where k.clave not in ('tipo', 'nombre', 'texto', 'estrellas')) then true
        when jsonb_typeof(x.v -> 'tipo') is distinct from 'string' then true
        when (x.v ->> 'tipo') not in ('comer', 'dormir', 'visitar', 'hacer', 'consejo') then true
        when jsonb_typeof(x.v -> 'nombre') is distinct from 'string' then true
        when char_length(btrim(x.v ->> 'nombre')) not between 1 and 80 then true
        when x.v ? 'texto' and jsonb_typeof(x.v -> 'texto') is distinct from 'string' then true
        when char_length(coalesce(x.v ->> 'texto', '')) > 1000 then true
        when x.v ? 'estrellas' and jsonb_typeof(x.v -> 'estrellas') <> 'null'
          and (jsonb_typeof(x.v -> 'estrellas') is distinct from 'number' or (x.v ->> 'estrellas') !~ '^[1-5]$') then true
        else false
      end)
  end
$$;

alter table public.mundi_pinchos add column if not exists valoracion smallint;
alter table public.mundi_pinchos drop constraint if exists mundi_pinchos_valoracion_check;
alter table public.mundi_pinchos add constraint mundi_pinchos_valoracion_check check (valoracion between 1 and 5);

alter table public.mundi_pinchos add column if not exists experiencias jsonb not null default '[]'::jsonb;
alter table public.mundi_pinchos drop constraint if exists mundi_pinchos_experiencias_check;
alter table public.mundi_pinchos add constraint mundi_pinchos_experiencias_check
  check (public.mundi_experiencias_validas(experiencias));

-- 2. Los permisos: «el dueño comparte su mapa con este correo»
create table if not exists public.mundi_compartidos (
  dueno uuid not null default auth.uid() references auth.users (id) on delete cascade,
  dueno_correo text not null default lower(coalesce(auth.jwt()->>'email', '')),
  nombre text not null check (char_length(btrim(nombre)) between 1 and 40),
  lector text not null check (lector = lower(btrim(lector)) and char_length(lector) <= 254
                              and lector ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  creado_en timestamptz not null default now(),
  primary key (dueno, lector)
);
create index if not exists mundi_compartidos_lector on public.mundi_compartidos (lector);

alter table public.mundi_compartidos enable row level security;

-- Ve una fila su dueño y la persona con la que comparte (para saber qué mapas le comparten)
drop policy if exists "mundi ver compartidos" on public.mundi_compartidos;
create policy "mundi ver compartidos" on public.mundi_compartidos for select to authenticated
  using ((select public.mundi_es_persona())
         and (dueno = (select auth.uid()) or lector = (select lower(coalesce(auth.jwt()->>'email', '')))));

-- Solo el dueño comparte lo suyo, con su propio correo como remitente y nunca consigo mismo
drop policy if exists "mundi compartir mi mapa" on public.mundi_compartidos;
create policy "mundi compartir mi mapa" on public.mundi_compartidos for insert to authenticated
  with check ((select public.mundi_es_persona()) and dueno = (select auth.uid())
              and dueno_correo = (select lower(coalesce(auth.jwt()->>'email', ''))) and lector <> dueno_correo);

drop policy if exists "mundi cambiar mis compartidos" on public.mundi_compartidos;
create policy "mundi cambiar mis compartidos" on public.mundi_compartidos for update to authenticated
  using ((select public.mundi_es_persona()) and dueno = (select auth.uid()))
  with check ((select public.mundi_es_persona()) and dueno = (select auth.uid())
              and dueno_correo = (select lower(coalesce(auth.jwt()->>'email', ''))) and lector <> dueno_correo);

drop policy if exists "mundi dejar de compartir" on public.mundi_compartidos;
create policy "mundi dejar de compartir" on public.mundi_compartidos for delete to authenticated
  using ((select public.mundi_es_persona()) and dueno = (select auth.uid()));

revoke all on public.mundi_compartidos from anon;
grant select, insert, update, delete on public.mundi_compartidos to authenticated;

-- ¿El dueño de esta carpeta (su uuid en texto) comparte su mapa con la sesión? (security definer: lee los permisos sin
-- pasar por su RLS; con texto, nunca falla al convertir una carpeta que no sea un uuid)
create or replace function public.mundi_me_comparte(dueno_texto text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.mundi_compartidos c
    where c.dueno::text = dueno_texto
      and c.lector = lower(coalesce(auth.jwt()->>'email', ''))
  );
$$;

revoke execute on function public.mundi_me_comparte(text) from public, anon;
grant execute on function public.mundi_me_comparte(text) to authenticated;

-- 3. Leer lo que me comparten: los pinchos y las fotos de quien me haya dado permiso (solo leer)
drop policy if exists "mundi ver lo que me comparten" on public.mundi_pinchos;
create policy "mundi ver lo que me comparten" on public.mundi_pinchos for select to authenticated
  using ((select public.mundi_es_persona()) and public.mundi_me_comparte(dueno::text));

drop policy if exists "mundi ver fotos que me comparten" on storage.objects;
create policy "mundi ver fotos que me comparten" on storage.objects for select to authenticated
  using (
    bucket_id = 'mundi-fotos'
    and (select public.mundi_es_persona())
    and public.mundi_me_comparte((storage.foldername(name))[1])
  );

-- 4. Comprobación de las reglas de las experiencias: lo que no vale se rechaza y lo bueno entra (se deshace todo)
do $$
declare
  yo uuid;
  malas jsonb[] := array[
    '{}',
    '[1]',
    '[{"tipo": "comer"}]',
    '[{"tipo": "bailar", "nombre": "x"}]',
    '[{"tipo": "comer", "nombre": "   "}]',
    '[{"tipo": "comer", "nombre": "x", "estrellas": 6}]',
    '[{"tipo": "comer", "nombre": "x", "estrellas": 2.5}]',
    '[{"tipo": "comer", "nombre": "x", "texto": 3}]',
    '[{"tipo": "comer", "nombre": "x", "otra": 1}]'
  ]::jsonb[];
  mala jsonb;
begin
  select u.id into yo from auth.users u join public.mundi_personas p on p.correo = lower(u.email) limit 1;
  foreach mala in array malas loop
    begin
      insert into public.mundi_pinchos (dueno, nombre, lat, lon, experiencias) values (yo, 'prueba: exp', 0, 0, mala);
      raise exception 'La columna experiencias aceptó algo que no vale: %', mala;
    exception when check_violation then
      null;
    end;
  end loop;
  begin
    insert into public.mundi_pinchos (dueno, nombre, lat, lon, valoracion) values (yo, 'prueba: valoración', 0, 0, 6);
    raise exception 'La columna valoracion aceptó un 6.';
  exception when check_violation then
    null;
  end;
  begin
    insert into public.mundi_pinchos (dueno, nombre, lat, lon, valoracion, experiencias)
      values (yo, 'prueba: buena', 0, 0, 5,
              '[{"tipo": "comer", "nombre": "Café Turri", "texto": "Vistas", "estrellas": 4},
                {"tipo": "consejo", "nombre": "Ir temprano", "estrellas": null}]');
    raise exception using errcode = 'PRB01', message = 'deshacer';
  exception when sqlstate 'PRB01' then
    null;
  end;
end $$;

notify pgrst, 'reload schema';

-- Comprobación: tiene que salir una fila con PASA (la prueba completa está en setup/pruebas/bd-compartir.md)
select case when
    to_regprocedure('public.mundi_experiencias_validas(jsonb)') is not null
    and to_regprocedure('public.mundi_me_comparte(text)') is not null
    and exists (select 1 from pg_constraint where conname = 'mundi_pinchos_experiencias_check')
    and exists (select 1 from pg_constraint where conname = 'mundi_pinchos_valoracion_check')
    and (select c.relrowsecurity from pg_class c where c.oid = 'public.mundi_compartidos'::regclass)
    and (select count(*) from pg_policies p
         where p.schemaname = 'public' and p.tablename = 'mundi_compartidos') = 4
    and exists (select 1 from pg_policies p where p.schemaname = 'public' and p.tablename = 'mundi_pinchos'
                and p.policyname = 'mundi ver lo que me comparten')
    and exists (select 1 from pg_policies p where p.schemaname = 'storage' and p.tablename = 'objects'
                and p.policyname = 'mundi ver fotos que me comparten')
    and not has_table_privilege('anon', 'public.mundi_compartidos', 'select')
    and not has_function_privilege('anon', 'public.mundi_me_comparte(text)', 'execute')
  then 'PASA' else 'FALLA' end as mundi_compartir,
  (select count(*) from public.mundi_compartidos) as permisos;
