# Contratos de Mundi

El único puente entre Cajas (método C.C.D. §2): cada Caja se programa leyendo solo su Contrato y los que usa.

## BD — los datos en Supabase

Migración: `setup/migraciones/2026-10-12-mundi.sql`. Prueba: `setup/pruebas/bd.md`.
Proyecto de Supabase: el mismo de la App de avisos. Todo lo de Mundi lleva el prefijo `mundi` y no toca nada suyo.

### Tabla `mundi_pinchos` (un pincho = un lugar donde estuvo)

| Columna | Tipo | Regla |
|---|---|---|
| `id` | uuid | Lo pone la base |
| `dueno` | uuid | Lo pone la base: el `auth.uid()` de la sesión. No puede ser otro |
| `nombre` | text | De 1 a 80 caracteres sin contar los espacios de los lados |
| `pais` | text o null | Código ISO 3166-1 alfa-2 en mayúsculas (`ES`, `CL`); null si el punto no cae en ningún país |
| `lat`, `lon` | double precision | Grados WGS84: `lat` de -90 a 90 y `lon` de -180 a 180 |
| `fecha` | date o null | Día del viaje; si solo se sabe el mes, el día 1 |
| `relato` | text | `''` por defecto; hasta 4000 caracteres |
| `fotos` | text[] | `{}` por defecto; hasta 30 rutas del almacén `mundi-fotos`, en orden (la primera es la portada) |
| `creado_en` | timestamptz | Lo pone la base |

### Almacén `mundi-fotos`

- Privado. Solo `image/jpeg`, hasta 5 MB por archivo.
- Ruta de cada foto: `<dueno>/<id del pincho>/<nombre>.jpg`. La primera carpeta tiene que ser el `auth.uid()` de quien
  la sube.
- Se leen con URL firmadas (`createSignedUrl` o `createSignedUrls`); no hay URL públicas.

### Función `mundi_es_persona()` → boolean

¿La sesión es de alguien que puede usar Mundi? La Interfaz la llama con `rpc('mundi_es_persona')` al entrar; si da
`false`, la cuenta existe pero no tiene acceso a Mundi.

### Reglas

- Solo quien está en `mundi_personas` (hoy, solo Vicente) ve o toca algo, y solo lo suyo: sus pinchos y las fotos de
  su carpeta. Sin sesión, nada.
- `mundi_personas` no se lee ni se escribe desde la app ni desde la API: se rellena a mano en el SQL Editor.
- Guardar un pincho con fotos: primero se crea la fila (para tener su `id`), luego se suben las fotos y al final se
  guarda `fotos` con sus rutas.
- Borrar un pincho: primero se borran sus fotos del almacén y luego la fila (la base no borra archivos).

## Fotos — preparar una foto antes de subirla

Fichero: `fotos.js` (módulo ES, sin dependencias). Prueba: `setup/pruebas/fotos.test.mjs`.

- `prepararFoto(archivo)` → `Promise<Blob>`. `archivo` es el `File` que da `<input type="file" accept="image/*">`.
  Devuelve un JPEG (`image/jpeg`) con el lado mayor de 1600 px como mucho (nunca amplía), la orientación correcta y
  **sin metadatos**: ni EXIF ni GPS, porque se redibuja en un lienzo y solo se guardan los píxeles. Pesa menos de
  5 MB, el límite del almacén.
- Si no puede abrir la foto, la promesa se rechaza con un `Error` cuyo mensaje se puede enseñar tal cual.
- `medidasDestino(ancho, alto, maximo = 1600)` → `{ ancho, alto }`: las medidas finales, enteras y con la misma
  proporción.

## Cáscara PWA — que se instale en el teléfono

Ficheros: `manifest.webmanifest`, `sw.js` e `icons/` (`icono-192.png`, `icono-512.png` y `apple-touch-icon.png`, de
180 px).

- `index.html` enlaza el manifiesto (`<link rel="manifest" href="manifest.webmanifest">`) y el icono de iPhone
  (`<link rel="apple-touch-icon" href="icons/apple-touch-icon.png">`), y registra `./sw.js`.
- `sw.js` guarda la cáscara propia (`ASSETS`: `./`, `index.html`, `style.css`, `app.js`, `mapa.js`, `fotos.js`,
  `config.js`, el manifiesto y los iconos) y lo que se pida a los CDN (`cdn.jsdelivr.net`, `cdnjs.cloudflare.com`) y a
  Google Fonts. Red primero y caché de respaldo, para que funcione sin conexión.
- **Nunca toca lo que va a Supabase** (datos ni fotos): siempre va directo a la red.
- Convenio: si cambia un fichero de `ASSETS` o una URL de CDN, se sube el número de `CACHE` (`mundi-v1`, `mundi-v2`…).
