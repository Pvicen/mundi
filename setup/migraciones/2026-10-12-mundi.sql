-- Migración 2026-10-12: MUNDI, LA BASE.
-- Los pinchos de los viajes y el almacén de sus fotos, en el mismo proyecto de Supabase que la App
-- de avisos. Todo lleva el prefijo «mundi» y no toca nada de la App de avisos.
--
-- Contrato de datos: docs/contratos.md, apartado «BD».
--
-- ⚠️ Antes de ejecutar: pon TU correo (el de tu cuenta, Authentication → Users) en el paso 1, una
-- sola línea. Se puede ejecutar más de una vez.
-- Después: setup/pruebas/bd.md (todo tiene que salir PASA).

-- 1. Quién puede usar Mundi
create table if not exists public.mundi_personas (
  correo text primary key check (correo = lower(correo)),
  creado_en timestamptz not null default now()
);

insert into public.mundi_personas (correo)
select v.correo from (values (lower('TU_CORREO@ejemplo.com'))) as v(correo)
where v.correo not like '%@ejemplo.com'
on conflict (correo) do nothing;

-- Freno: si nadie de la lista tiene cuenta, no se sigue (se deshace todo)
do $$
begin
  if not exists (
    select 1 from auth.users u
    join public.mundi_personas p on p.correo = lower(u.email)
  ) then
    raise exception 'Pon en el paso 1 el correo de tu cuenta (Authentication → Users) y vuelve a ejecutar.';
  end if;
end $$;

-- Sin políticas: desde la app y la API no se lee ni se escribe
alter table public.mundi_personas enable row level security;
revoke all on public.mundi_personas from anon, authenticated;

-- ¿La sesión es de alguien de la lista? (security definer: lee la lista sin pasar por su RLS)
create or replace function public.mundi_es_persona()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.mundi_personas
    where correo = lower(coalesce(auth.jwt()->>'email', ''))
  );
$$;

revoke execute on function public.mundi_es_persona() from public, anon;
grant execute on function public.mundi_es_persona() to authenticated;

-- 2. Los pinchos
create table if not exists public.mundi_pinchos (
  id uuid primary key default gen_random_uuid(),
  dueno uuid not null default auth.uid() references auth.users (id) on delete cascade,
  nombre text not null check (char_length(btrim(nombre)) between 1 and 80),
  pais text check (pais ~ '^[A-Z]{2}$'),
  lat double precision not null check (lat between -90 and 90),
  lon double precision not null check (lon between -180 and 180),
  fecha date,
  relato text not null default '' check (char_length(relato) <= 4000),
  fotos text[] not null default '{}' check (cardinality(fotos) <= 30),
  creado_en timestamptz not null default now()
);
create index if not exists mundi_pinchos_dueno on public.mundi_pinchos (dueno);

alter table public.mundi_pinchos enable row level security;

drop policy if exists "mundi ver mis pinchos" on public.mundi_pinchos;
create policy "mundi ver mis pinchos" on public.mundi_pinchos for select to authenticated
  using (dueno = (select auth.uid()) and (select public.mundi_es_persona()));

drop policy if exists "mundi crear mis pinchos" on public.mundi_pinchos;
create policy "mundi crear mis pinchos" on public.mundi_pinchos for insert to authenticated
  with check (dueno = (select auth.uid()) and (select public.mundi_es_persona()));

drop policy if exists "mundi editar mis pinchos" on public.mundi_pinchos;
create policy "mundi editar mis pinchos" on public.mundi_pinchos for update to authenticated
  using (dueno = (select auth.uid()) and (select public.mundi_es_persona()))
  with check (dueno = (select auth.uid()) and (select public.mundi_es_persona()));

drop policy if exists "mundi borrar mis pinchos" on public.mundi_pinchos;
create policy "mundi borrar mis pinchos" on public.mundi_pinchos for delete to authenticated
  using (dueno = (select auth.uid()) and (select public.mundi_es_persona()));

-- Sin sesión, nada; con sesión, lo que dejen las políticas de arriba
revoke all on public.mundi_pinchos from anon;
grant select, insert, update, delete on public.mundi_pinchos to authenticated;

-- 3. El almacén de las fotos: privado, solo JPEG, hasta 5 MB
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('mundi-fotos', 'mundi-fotos', false, 5242880, array['image/jpeg'])
on conflict (id) do nothing;

-- Cada uno, solo en su carpeta: <su auth.uid()>/<id del pincho>/<nombre>.jpg
drop policy if exists "mundi ver mis fotos" on storage.objects;
create policy "mundi ver mis fotos" on storage.objects for select to authenticated
  using (
    bucket_id = 'mundi-fotos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and (select public.mundi_es_persona())
  );

drop policy if exists "mundi subir mis fotos" on storage.objects;
create policy "mundi subir mis fotos" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'mundi-fotos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and (select public.mundi_es_persona())
  );

drop policy if exists "mundi borrar mis fotos" on storage.objects;
create policy "mundi borrar mis fotos" on storage.objects for delete to authenticated
  using (
    bucket_id = 'mundi-fotos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and (select public.mundi_es_persona())
  );

notify pgrst, 'reload schema';

-- Comprobación: tiene que salir una fila con PASA (la prueba completa está en setup/pruebas/bd.md)
select case when
    (select c.relrowsecurity from pg_class c where c.oid = 'public.mundi_pinchos'::regclass)
    and (select c.relrowsecurity from pg_class c where c.oid = 'public.mundi_personas'::regclass)
    and (select count(*) from pg_policies p
         where p.schemaname = 'public' and p.tablename = 'mundi_pinchos') = 4
    and (select count(*) from pg_policies p
         where p.schemaname = 'storage' and p.tablename = 'objects' and p.policyname like 'mundi %') = 3
    and exists (select 1 from storage.buckets b where b.id = 'mundi-fotos' and not b.public)
    and not has_table_privilege('anon', 'public.mundi_pinchos', 'select')
  then 'PASA' else 'FALLA' end as mundi_bd,
  (select string_agg(correo, ', ') from public.mundi_personas) as con_acceso;
