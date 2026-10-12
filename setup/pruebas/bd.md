# Comprobaciones de la base de Mundi

Para después de ejecutar `setup/migraciones/2026-10-12-mundi.sql`. Comprueban que solo tú ves y tocas tus pinchos y tus
fotos, que nadie más entra (ni sin sesión, ni con otra cuenta del proyecto) y que la tabla rechaza datos malos
(Contrato «BD» de `docs/contratos.md`).

## 1. En el SQL Editor de Supabase

Pega TODO el bloque y pulsa **Run**. No cambia nada: simula las sesiones, crea un pincho y una foto de prueba y al
final lo deshace todo. «Yo» es la primera persona de `mundi_personas`. Si Supabase avisa de «operaciones
destructivas», confirma: se deshacen al terminar.

```sql
create or replace function pg_temp.probar_mundi()
returns table (prueba text, esperado text, obtenido text, resultado text)
language plpgsql
as $$
declare
  yo       text;
  yo_id    uuid;
  otro_id  uuid := gen_random_uuid();
  p1       uuid;
  foto     text;
  foto_ok  boolean := false;
  n        int;
  t        text;
  b        boolean;
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
  select case when c.relrowsecurity then 'sí' else 'no' end into t
    from pg_class c where c.oid = 'public.mundi_pinchos'::regclass;
  r := array_append(r, 'RLS en mundi_pinchos|sí|' || t);
  select case when c.relrowsecurity then 'sí' else 'no' end into t
    from pg_class c where c.oid = 'public.mundi_personas'::regclass;
  r := array_append(r, 'RLS en mundi_personas|sí|' || t);
  select count(*)::text into t from pg_policies p
    where p.schemaname = 'public' and p.tablename = 'mundi_pinchos';
  r := array_append(r, 'Políticas de los pinchos|4|' || t);
  select count(*)::text into t from pg_policies p
    where p.schemaname = 'storage' and p.tablename = 'objects' and p.policyname like 'mundi %';
  r := array_append(r, 'Políticas de las fotos|3|' || t);
  select coalesce((select case when x.public then 'público' else 'privado' end
                   from storage.buckets x where x.id = 'mundi-fotos'), 'no existe') into t;
  r := array_append(r, 'Almacén mundi-fotos|privado|' || t);

  begin
    -- Sin sesión
    perform set_config('request.jwt.claims', '{"role": "anon"}', true);
    perform set_config('role', 'anon', true);
    begin
      select count(*) into n from public.mundi_pinchos;
      t := n || ' filas';
    exception when insufficient_privilege then t := 'rechazado';
      when others then t := 'error ' || sqlstate || ': ' || sqlerrm;
    end;
    r := array_append(r, 'Sin sesión, lee los pinchos|rechazado|' || t);
    begin
      select public.mundi_es_persona() into b;
      t := b::text;
    exception when insufficient_privilege then t := 'rechazado';
      when others then t := 'error ' || sqlstate || ': ' || sqlerrm;
    end;
    r := array_append(r, 'Sin sesión, mundi_es_persona()|rechazado|' || t);
    perform set_config('role', 'none', true);

    -- Yo
    perform set_config('request.jwt.claims',
      json_build_object('role', 'authenticated', 'sub', yo_id, 'email', yo)::text, true);
    perform set_config('role', 'authenticated', true);
    select public.mundi_es_persona() into b;
    r := array_append(r, 'Yo, mundi_es_persona()|true|' || b::text);
    insert into public.mundi_pinchos (nombre, pais, lat, lon, fecha)
      values ('Prueba Madrid', 'ES', 40.4168, -3.7038, '2026-07-01') returning id into p1;
    select case when dueno = yo_id then 'yo' else dueno::text end into t
      from public.mundi_pinchos where id = p1;
    r := array_append(r, 'Creo un pincho: dueño|yo|' || t);
    select case when relato = '' and fotos = '{}' then 'vacíos' else 'no' end into t
      from public.mundi_pinchos where id = p1;
    r := array_append(r, 'Relato y fotos por defecto|vacíos|' || t);
    select count(*) into n from public.mundi_pinchos where id = p1;
    r := array_append(r, 'Veo mi pincho|1 filas|' || n || ' filas');
    begin
      insert into public.mundi_pinchos (dueno, nombre, lat, lon) values (otro_id, 'prueba: ajeno', 40.0, -3.0);
      t := 'lo guardó';
    exception when insufficient_privilege then t := 'rechazado';
      when others then t := 'error ' || sqlstate || ': ' || sqlerrm;
    end;
    r := array_append(r, 'Creo un pincho a nombre de otro|rechazado|' || t);
    begin
      update public.mundi_pinchos set dueno = otro_id where id = p1;
      t := 'lo cambió';
    exception when insufficient_privilege then t := 'rechazado';
      when others then t := 'error ' || sqlstate || ': ' || sqlerrm;
    end;
    r := array_append(r, 'Paso mi pincho a otro|rechazado|' || t);
    begin
      insert into public.mundi_pinchos (nombre, lat, lon) values ('prueba: lat mala', 100, -3.0);
      t := 'lo guardó';
    exception when check_violation then t := 'rechazado';
      when others then t := 'error ' || sqlstate || ': ' || sqlerrm;
    end;
    r := array_append(r, 'Latitud fuera de rango|rechazado|' || t);
    begin
      insert into public.mundi_pinchos (nombre, pais, lat, lon) values ('prueba: país', 'es', 40.0, -3.0);
      t := 'lo guardó';
    exception when check_violation then t := 'rechazado';
      when others then t := 'error ' || sqlstate || ': ' || sqlerrm;
    end;
    r := array_append(r, 'País en minúsculas|rechazado|' || t);
    begin
      insert into public.mundi_pinchos (nombre, lat, lon) values ('   ', 40.0, -3.0);
      t := 'lo guardó';
    exception when check_violation then t := 'rechazado';
      when others then t := 'error ' || sqlstate || ': ' || sqlerrm;
    end;
    r := array_append(r, 'Nombre vacío|rechazado|' || t);
    begin
      insert into public.mundi_pinchos (nombre, lat, lon, fotos)
        values ('prueba: fotos', 40.0, -3.0, array_fill('x'::text, array[31]));
      t := 'lo guardó';
    exception when check_violation then t := 'rechazado';
      when others then t := 'error ' || sqlstate || ': ' || sqlerrm;
    end;
    r := array_append(r, 'Más de 30 fotos|rechazado|' || t);
    begin
      insert into public.mundi_pinchos (nombre, lat, lon, relato) values ('prueba: relato', 40.0, -3.0, repeat('a', 4001));
      t := 'lo guardó';
    exception when check_violation then t := 'rechazado';
      when others then t := 'error ' || sqlstate || ': ' || sqlerrm;
    end;
    r := array_append(r, 'Relato de más de 4000|rechazado|' || t);
    foto := yo_id::text || '/' || p1::text || '/prueba.jpg';
    begin
      insert into storage.objects (bucket_id, name) values ('mundi-fotos', foto);
      t := 'la subió';
      foto_ok := true;
    exception when others then t := 'error ' || sqlstate || ': ' || sqlerrm;
    end;
    r := array_append(r, 'Subo una foto a mi carpeta|la subió|' || t);
    begin
      insert into storage.objects (bucket_id, name) values ('mundi-fotos', otro_id::text || '/x/prueba.jpg');
      t := 'la subió';
    exception when insufficient_privilege then t := 'rechazado';
      when others then t := 'error ' || sqlstate || ': ' || sqlerrm;
    end;
    r := array_append(r, 'Subo una foto a otra carpeta|rechazado|' || t);
    select count(*) into n from storage.objects where bucket_id = 'mundi-fotos' and name = foto;
    r := array_append(r, 'Veo mi foto|1 filas|' || n || ' filas');
    perform set_config('role', 'none', true);

    -- Alguien con cuenta pero fuera de mundi_personas (p. ej., otra persona de la App de avisos)
    perform set_config('request.jwt.claims',
      json_build_object('role', 'authenticated', 'sub', otro_id, 'email', 'nadie@ejemplo.com')::text, true);
    perform set_config('role', 'authenticated', true);
    select public.mundi_es_persona() into b;
    r := array_append(r, 'Fuera de la lista, mundi_es_persona()|false|' || b::text);
    select count(*) into n from public.mundi_pinchos;
    r := array_append(r, 'Fuera de la lista, lee pinchos|0 filas|' || n || ' filas');
    begin
      insert into public.mundi_pinchos (nombre, lat, lon) values ('prueba: intruso', 40.0, -3.0);
      t := 'lo guardó';
    exception when insufficient_privilege then t := 'rechazado';
      when others then t := 'error ' || sqlstate || ': ' || sqlerrm;
    end;
    r := array_append(r, 'Fuera de la lista, crea|rechazado|' || t);
    begin
      select count(*) into n from public.mundi_personas;
      t := n || ' filas';
    exception when insufficient_privilege then t := 'rechazado';
      when others then t := 'error ' || sqlstate || ': ' || sqlerrm;
    end;
    r := array_append(r, 'Con sesión, lee mundi_personas|rechazado|' || t);
    if foto_ok then
      select count(*) into n from storage.objects where bucket_id = 'mundi-fotos' and name = foto;
      t := n || ' filas';
    else
      t := 'sin probar: no se pudo subir la foto de prueba';
    end if;
    r := array_append(r, 'Fuera de la lista, ve mi foto|0 filas|' || t);
    perform set_config('role', 'none', true);

    -- Otra persona de la lista (simulada): no ve ni toca lo mío
    insert into public.mundi_personas (correo) values ('otra@ejemplo.com');
    perform set_config('request.jwt.claims',
      json_build_object('role', 'authenticated', 'sub', otro_id, 'email', 'otra@ejemplo.com')::text, true);
    perform set_config('role', 'authenticated', true);
    select count(*) into n from public.mundi_pinchos where id = p1;
    r := array_append(r, 'Otra de la lista, ve mi pincho|0 filas|' || n || ' filas');
    update public.mundi_pinchos set nombre = 'prueba: cambiado' where id = p1;
    get diagnostics n = row_count;
    r := array_append(r, 'Otra de la lista, cambia mi pincho|0 filas|' || n || ' filas');
    delete from public.mundi_pinchos where id = p1;
    get diagnostics n = row_count;
    r := array_append(r, 'Otra de la lista, borra mi pincho|0 filas|' || n || ' filas');
    if foto_ok then
      select count(*) into n from storage.objects where bucket_id = 'mundi-fotos' and name = foto;
      t := n || ' filas';
    else
      t := 'sin probar: no se pudo subir la foto de prueba';
    end if;
    r := array_append(r, 'Otra de la lista, ve mi foto|0 filas|' || t);
    begin
      insert into storage.objects (bucket_id, name)
        values ('mundi-fotos', yo_id::text || '/' || p1::text || '/intrusa.jpg');
      t := 'la subió';
    exception when insufficient_privilege then t := 'rechazado';
      when others then t := 'error ' || sqlstate || ': ' || sqlerrm;
    end;
    r := array_append(r, 'Otra de la lista, sube a mi carpeta|rechazado|' || t);
    perform set_config('role', 'none', true);

    -- Yo borro mi pincho
    perform set_config('request.jwt.claims',
      json_build_object('role', 'authenticated', 'sub', yo_id, 'email', yo)::text, true);
    perform set_config('role', 'authenticated', true);
    delete from public.mundi_pinchos where id = p1;
    get diagnostics n = row_count;
    r := array_append(r, 'Borro mi pincho|1 filas|' || n || ' filas');
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
from pg_temp.probar_mundi() group by resultado;
```

**Lo que tiene que salir:** `INFO 1` (tu correo) y `PASA 32`, sin ninguna `FALLA` ni `SIN PROBAR`. Si sale alguna,
cambia la última consulta por `select * from pg_temp.probar_mundi();` para ver cuál.

| Prueba | Esperado |
|---|---|
| RLS en las dos tablas · políticas de los pinchos · de las fotos · almacén | sí · sí · 4 · 3 · privado |
| Sin sesión, lee los pinchos · llama a `mundi_es_persona()` | rechazado · rechazado |
| Yo: `mundi_es_persona()` · dueño del pincho creado · relato y fotos por defecto · lo veo | true · yo · vacíos · 1 |
| Yo: pincho a nombre de otro · pasar el mío a otro | rechazado · rechazado |
| Yo: latitud 100 · país `es` · nombre vacío · 31 fotos · relato de 4001 | rechazado (los cinco) |
| Yo: subo una foto a mi carpeta · a otra carpeta · veo la mía | la subió · rechazado · 1 |
| Fuera de la lista: `mundi_es_persona()` · lee pinchos · crea · lee `mundi_personas` · ve mi foto | false · 0 · rechazado · rechazado · 0 |
| Otra de la lista: ve · cambia · borra mi pincho · ve mi foto · sube a mi carpeta | 0 · 0 · 0 · 0 · rechazado |
| Yo borro mi pincho | 1 |

## 2. Por la API, sin sesión

Con la clave publicable (`SUPABASE_ANON_KEY` del `config.js` de la App de avisos; es el mismo proyecto), los pinchos
no tienen que verse:

```powershell
$clave = "<SUPABASE_ANON_KEY>"
Invoke-RestMethod -Uri "https://omotdruuyufwradcxdyb.supabase.co/rest/v1/mundi_pinchos?select=id" -Headers @{ apikey = $clave }
```

Tiene que dar un error de permiso (401), no una lista.
