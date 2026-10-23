# Comprobaciones de la base de Mundi: compartir el mapa y experiencias

Para después de ejecutar `setup/migraciones/2026-10-23-compartir-y-experiencias.sql`. Comprueban que quien recibe
permiso ve el mapa ajeno sin poder cambiar nada, que nadie más lo ve, que solo el dueño da y quita permisos y que las
experiencias y la valoración rechazan datos malos (Contrato «BD — compartir el mapa y experiencias» de
`docs/contratos.md`).

## En el SQL Editor de Supabase

Pega TODO el bloque y pulsa **Run**. No cambia nada: simula las sesiones, crea un pincho, una foto y permisos de
prueba y al final lo deshace todo. «Yo» es la primera persona de `mundi_personas`; «otra», «tercera» y «fuera» son
correos inventados. Si Supabase avisa de «operaciones destructivas», confirma: se deshacen al terminar.

```sql
create or replace function pg_temp.probar_compartir()
returns table (prueba text, esperado text, obtenido text, resultado text)
language plpgsql
as $$
declare
  yo       text;
  yo_id    uuid;
  otra_id  uuid := gen_random_uuid();
  ter_id   uuid := gen_random_uuid();
  fue_id   uuid := gen_random_uuid();
  p1       uuid;
  foto     text;
  foto_ok  boolean := false;
  n        int;
  t        text;
  r        text[] := '{}';
begin
  select p.correo, u.id into yo, yo_id
    from public.mundi_personas p join auth.users u on lower(u.email) = p.correo
    order by p.creado_en limit 1;
  if yo is null then
    raise exception 'mundi_personas no tiene a nadie con cuenta: falta la migración 2026-10-12-mundi.sql.';
  end if;
  r := array_append(r, 'Yo|-|' || yo);

  -- Estructura
  select count(*)::text into t from pg_policies p where p.schemaname = 'public' and p.tablename = 'mundi_compartidos';
  r := array_append(r, 'Políticas de los permisos|4|' || t);
  select count(*)::text into t from pg_policies p where p.schemaname = 'public' and p.tablename = 'mundi_pinchos';
  r := array_append(r, 'Políticas de los pinchos|5|' || t);
  select count(*)::text into t from pg_policies p
    where p.schemaname = 'storage' and p.tablename = 'objects' and p.policyname like 'mundi %';
  r := array_append(r, 'Políticas de las fotos|4|' || t);

  begin
    insert into public.mundi_personas (correo) values ('otra@ejemplo.com'), ('tercera@ejemplo.com');

    -- Sin sesión
    perform set_config('request.jwt.claims', '{"role": "anon"}', true);
    perform set_config('role', 'anon', true);
    begin
      select count(*) into n from public.mundi_compartidos;
      t := n || ' filas';
    exception when insufficient_privilege then t := 'rechazado';
      when others then t := 'error ' || sqlstate || ': ' || sqlerrm;
    end;
    r := array_append(r, 'Sin sesión, lee los permisos|rechazado|' || t);
    perform set_config('role', 'none', true);

    -- Yo: un pincho con experiencias, una foto y un permiso para «otra» (y otro para «fuera», que no está en la lista)
    perform set_config('request.jwt.claims',
      json_build_object('role', 'authenticated', 'sub', yo_id, 'email', yo)::text, true);
    perform set_config('role', 'authenticated', true);
    insert into public.mundi_pinchos (nombre, pais, lat, lon, valoracion, experiencias)
      values ('Prueba Lisboa', 'PT', 38.72, -9.14, 5,
              '[{"tipo": "comer", "nombre": "Prueba tasca", "texto": "Sardinas", "estrellas": 4}]')
      returning id into p1;
    select case when valoracion = 5 and jsonb_array_length(experiencias) = 1 then 'guardadas' else 'no' end into t
      from public.mundi_pinchos where id = p1;
    r := array_append(r, 'Creo un pincho con valoración y experiencias|guardadas|' || t);
    begin
      update public.mundi_pinchos set experiencias = '[{"tipo": "otra cosa", "nombre": "x"}]' where id = p1;
      t := 'lo cambió';
    exception when check_violation then t := 'rechazado';
      when others then t := 'error ' || sqlstate || ': ' || sqlerrm;
    end;
    r := array_append(r, 'Experiencia de un tipo que no existe|rechazado|' || t);
    begin
      update public.mundi_pinchos set valoracion = 0 where id = p1;
      t := 'lo cambió';
    exception when check_violation then t := 'rechazado';
      when others then t := 'error ' || sqlstate || ': ' || sqlerrm;
    end;
    r := array_append(r, 'Valoración 0|rechazado|' || t);
    foto := yo_id::text || '/' || p1::text || '/prueba.jpg';
    begin
      insert into storage.objects (bucket_id, name) values ('mundi-fotos', foto);
      foto_ok := true;
    exception when others then null;
    end;
    insert into public.mundi_compartidos (lector, nombre) values ('otra@ejemplo.com', 'Prueba');
    select case when dueno = yo_id and dueno_correo = yo then 'yo' else 'otro' end into t
      from public.mundi_compartidos where lector = 'otra@ejemplo.com';
    r := array_append(r, 'Comparto con «otra»: remitente|yo|' || t);
    insert into public.mundi_compartidos (lector, nombre) values ('fuera@ejemplo.com', 'Prueba');
    begin
      insert into public.mundi_compartidos (lector, nombre) values (yo, 'Prueba');
      t := 'lo guardó';
    exception when insufficient_privilege then t := 'rechazado';
      when others then t := 'error ' || sqlstate || ': ' || sqlerrm;
    end;
    r := array_append(r, 'Comparto conmigo mismo|rechazado|' || t);
    begin
      insert into public.mundi_compartidos (lector, nombre) values ('no-es-un-correo', 'Prueba');
      t := 'lo guardó';
    exception when check_violation then t := 'rechazado';
      when others then t := 'error ' || sqlstate || ': ' || sqlerrm;
    end;
    r := array_append(r, 'Comparto con algo que no es un correo|rechazado|' || t);
    begin
      insert into public.mundi_compartidos (dueno_correo, lector, nombre) values ('falso@ejemplo.com', 'tercera@ejemplo.com', 'Prueba');
      t := 'lo guardó';
    exception when insufficient_privilege then t := 'rechazado';
      when others then t := 'error ' || sqlstate || ': ' || sqlerrm;
    end;
    r := array_append(r, 'Comparto con un remitente falso|rechazado|' || t);
    perform set_config('role', 'none', true);

    -- «Otra»: tiene permiso; ve, no toca
    perform set_config('request.jwt.claims',
      json_build_object('role', 'authenticated', 'sub', otra_id, 'email', 'otra@ejemplo.com')::text, true);
    perform set_config('role', 'authenticated', true);
    select count(*) into n from public.mundi_pinchos where id = p1;
    r := array_append(r, 'Otra (con permiso), ve mi pincho|1 filas|' || n || ' filas');
    select coalesce((select experiencias->0->>'nombre' from public.mundi_pinchos where id = p1), 'nada') into t;
    r := array_append(r, 'Otra, ve mis experiencias|Prueba tasca|' || t);
    update public.mundi_pinchos set nombre = 'prueba: cambiado' where id = p1;
    get diagnostics n = row_count;
    r := array_append(r, 'Otra, cambia mi pincho|0 filas|' || n || ' filas');
    delete from public.mundi_pinchos where id = p1;
    get diagnostics n = row_count;
    r := array_append(r, 'Otra, borra mi pincho|0 filas|' || n || ' filas');
    if foto_ok then
      select count(*) into n from storage.objects where bucket_id = 'mundi-fotos' and name = foto;
      t := n || ' filas';
    else
      t := 'sin probar: no se pudo subir la foto de prueba';
    end if;
    r := array_append(r, 'Otra, ve mi foto|1 filas|' || t);
    begin
      insert into storage.objects (bucket_id, name) values ('mundi-fotos', yo_id::text || '/' || p1::text || '/intrusa.jpg');
      t := 'la subió';
    exception when insufficient_privilege then t := 'rechazado';
      when others then t := 'error ' || sqlstate || ': ' || sqlerrm;
    end;
    r := array_append(r, 'Otra, sube a mi carpeta|rechazado|' || t);
    select count(*) into n from public.mundi_compartidos;
    r := array_append(r, 'Otra, ve los permisos (solo el suyo)|1 filas|' || n || ' filas');
    begin
      insert into public.mundi_compartidos (dueno, dueno_correo, lector, nombre)
        values (yo_id, yo, 'tercera@ejemplo.com', 'Prueba');
      t := 'lo guardó';
    exception when insufficient_privilege then t := 'rechazado';
      when others then t := 'error ' || sqlstate || ': ' || sqlerrm;
    end;
    r := array_append(r, 'Otra, comparte mi mapa con «tercera»|rechazado|' || t);
    delete from public.mundi_compartidos where dueno = yo_id;
    get diagnostics n = row_count;
    r := array_append(r, 'Otra, borra mis permisos|0 filas|' || n || ' filas');
    update public.mundi_compartidos set lector = 'tercera@ejemplo.com' where dueno = yo_id;
    get diagnostics n = row_count;
    r := array_append(r, 'Otra, cambia mis permisos|0 filas|' || n || ' filas');
    perform set_config('role', 'none', true);

    -- «Tercera»: en la lista, sin permiso
    perform set_config('request.jwt.claims',
      json_build_object('role', 'authenticated', 'sub', ter_id, 'email', 'tercera@ejemplo.com')::text, true);
    perform set_config('role', 'authenticated', true);
    select count(*) into n from public.mundi_pinchos where id = p1;
    r := array_append(r, 'Tercera (sin permiso), ve mi pincho|0 filas|' || n || ' filas');
    if foto_ok then
      select count(*) into n from storage.objects where bucket_id = 'mundi-fotos' and name = foto;
      t := n || ' filas';
    else
      t := 'sin probar: no se pudo subir la foto de prueba';
    end if;
    r := array_append(r, 'Tercera, ve mi foto|0 filas|' || t);
    select count(*) into n from public.mundi_compartidos;
    r := array_append(r, 'Tercera, ve los permisos|0 filas|' || n || ' filas');
    perform set_config('role', 'none', true);

    -- «Fuera»: tiene permiso pero no está en la lista de Mundi
    perform set_config('request.jwt.claims',
      json_build_object('role', 'authenticated', 'sub', fue_id, 'email', 'fuera@ejemplo.com')::text, true);
    perform set_config('role', 'authenticated', true);
    select count(*) into n from public.mundi_pinchos where id = p1;
    r := array_append(r, 'Fuera de la lista con permiso, ve mi pincho|0 filas|' || n || ' filas');
    perform set_config('role', 'none', true);

    -- Yo quito el permiso a «otra»: deja de ver
    perform set_config('request.jwt.claims',
      json_build_object('role', 'authenticated', 'sub', yo_id, 'email', yo)::text, true);
    perform set_config('role', 'authenticated', true);
    select count(*) into n from public.mundi_compartidos where dueno = yo_id;
    r := array_append(r, 'Yo veo mis permisos|2 filas|' || n || ' filas');
    delete from public.mundi_compartidos where dueno = yo_id and lector = 'otra@ejemplo.com';
    get diagnostics n = row_count;
    r := array_append(r, 'Quito el permiso a «otra»|1 filas|' || n || ' filas');
    perform set_config('role', 'none', true);
    perform set_config('request.jwt.claims',
      json_build_object('role', 'authenticated', 'sub', otra_id, 'email', 'otra@ejemplo.com')::text, true);
    perform set_config('role', 'authenticated', true);
    select count(*) into n from public.mundi_pinchos where id = p1;
    r := array_append(r, 'Otra, sin permiso ya, ve mi pincho|0 filas|' || n || ' filas');
    if foto_ok then
      select count(*) into n from storage.objects where bucket_id = 'mundi-fotos' and name = foto;
      t := n || ' filas';
    else
      t := 'sin probar: no se pudo subir la foto de prueba';
    end if;
    r := array_append(r, 'Otra, sin permiso ya, ve mi foto|0 filas|' || t);
    perform set_config('role', 'none', true);

    raise exception using errcode = 'PRB01', message = 'fin de la prueba';
  exception when sqlstate 'PRB01' then
    null;  -- aquí se deshace todo lo del bloque
  end;

  return query
    select split_part(u.x, '|', 1), split_part(u.x, '|', 2), split_part(u.x, '|', 3),
           case
             when split_part(u.x, '|', 2) = '-' then 'INFO'
             when split_part(u.x, '|', 3) like 'sin probar%' then 'SIN PROBAR'
             when split_part(u.x, '|', 3) = split_part(u.x, '|', 2) then 'PASA'
             else 'FALLA'
           end
    from unnest(r) with ordinality as u(x, i)
    order by u.i;
end;
$$;

select resultado, count(*) as cuantas, string_agg(prueba, ' / ') as pruebas
from pg_temp.probar_compartir() group by resultado;
```

**Lo que tiene que salir:** `INFO 1` (tu correo) y `PASA 29`, sin ninguna `FALLA` ni `SIN PROBAR`. Si sale alguna,
cambia la última consulta por `select * from pg_temp.probar_compartir();` para ver cuál.

| Prueba | Esperado |
|---|---|
| Políticas de los permisos · de los pinchos · de las fotos | 4 · 5 · 4 |
| Sin sesión, lee los permisos | rechazado |
| Yo: pincho con valoración y experiencias · tipo que no existe · valoración 0 | guardadas · rechazado · rechazado |
| Yo: comparto con «otra» (remitente) · conmigo mismo · con algo que no es un correo · con remitente falso | yo · rechazado · rechazado · rechazado |
| Otra (con permiso): ve mi pincho · mis experiencias · lo cambia · lo borra · ve mi foto · sube a mi carpeta | 1 · Prueba tasca · 0 · 0 · 1 · rechazado |
| Otra: ve los permisos · comparte mi mapa · borra mis permisos · los cambia | 1 · rechazado · 0 · 0 |
| Tercera (sin permiso): ve mi pincho · mi foto · los permisos | 0 · 0 · 0 |
| Fuera de la lista con permiso: ve mi pincho | 0 |
| Yo: veo mis permisos · quito el de «otra» · ella ya no ve mi pincho ni mi foto | 2 · 1 · 0 · 0 |
