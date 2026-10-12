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
- Borrar un pincho: primero se borran sus fotos del almacén (las que cita la fila y todo lo que haya en su carpeta
  `<dueno>/<id>/`) y luego la fila (la base no borra archivos).

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

## Mapa — el mapamundi

Fichero: `mapa.js` (módulo ES). Prueba: `setup/pruebas/mapa.test.mjs` y, en el navegador, `setup/pruebas/mapa.html`.
Necesita los globales `d3` (7.9.0) y `topojson` (3.0.2), cargados antes desde cdnjs. La geometría (Natural Earth a
1:50 millones, `world-atlas@2.0.2/countries-50m.json`) la descarga él desde jsdelivr.

- `crearMapa(contenedor, { alTocarPincho, alTocarPunto })` → `Promise<mapa>`. El mapa llena el `contenedor` (un
  elemento con tamaño), se adapta si cambia de tamaño y empieza mostrando el mundo entero (en un teléfono en vertical,
  de alto, y se arrastra a los lados). Si no puede descargar la geometría, la promesa se rechaza con un `Error` cuyo
  mensaje se puede enseñar tal cual.
- `mapa.pintar(pinchos, { resaltar } = {})`: pinta los pinchos y colorea los países visitados. Cada pincho es un
  objeto con, al menos, `{ id, nombre, lat, lon, pais }` (las filas de `mundi_pinchos` valen tal cual). Sustituye lo
  pintado antes. Los pinchos que en pantalla quedan cerca se agrupan en un círculo con el número; al acercar, se
  separan. `resaltar` es el `id` de un pincho que entra con animación (el recién guardado).
- `mapa.encuadrar()`: ajusta la vista para que se vean todos los pinchos (la vista inicial si no hay).
- `mapa.irA(lat, lon)`: se acerca a ese punto.
- `mapa.marcarPunto(lat, lon)`: pone un pincho gris provisional (el que se está creando); `mapa.marcarPunto(null)` lo
  quita.
- `mapa.paisEn(lat, lon)` → código ISO 3166-1 alfa-2 (`ES`) o `null` si el punto no cae en ningún país.
- **Toques:** en un pincho → `alTocarPincho(pincho)`, con el mismo objeto que se pasó a `pintar`; en un grupo → el mapa
  se acerca a sus pinchos; en el mapa, fuera de los pinchos → `alTocarPunto({ lat, lon, pais })`, con `lat` y `lon` en
  grados (5 decimales) y `pais` como en `paisEn`. Arrastrar o hacer zoom no cuenta como toque. Fuera de la esfera
  del mundo no avisa.
- **Colores:** toma las variables CSS de la página si existen (`--mar`, `--tierra`, `--tierra-borde`, `--visitado`,
  `--visitado-borde`, `--pin`, `--tinta`, `--tinta-2`, `--tinta-3`, `--sup`, `--grat`) y, si no, los de la demo. Sus
  clases empiezan por `mm-`, para no chocar con las de la Interfaz.

## Interfaz — la app

Ficheros: `index.html`, `app.js`, `style.css` y `config.js`. Usa los Contratos BD, Fotos, Mapa y Cáscara PWA.

- **`config.js`** (módulo ES), solo lo público: `SUPABASE_URL` y `SUPABASE_CLAVE` (la clave publicable). Es el
  proyecto de la App de avisos.
- **Librerías**, con versión fijada y SRI: d3 7.9.0 y topojson 3.0.2 (cdnjs) y supabase-js 2.112.4 (jsdelivr).
- **Sesión:** correo y contraseña de la cuenta de Supabase. Se guarda aparte de la de la App de avisos (clave
  `mundi-sesion`), y «Salir» cierra solo la de este dispositivo.
- **Buscar un lugar y nombrar un punto:** Nominatim de OpenStreetMap, sin cuenta. Solo se le envía el texto buscado
  (al pulsar Buscar) o las coordenadas del punto elegido.
- **Capa de datos:** todo lo que va a Supabase pasa por un objeto `datos` con esta forma (la de ejemplo la imita):
  - `sesion()` → `{ id, correo }` o `null`; `entrar(correo, clave)` → `{ id, correo }` (lanza `Error`); `salir()`.
  - `esPersona()` → boolean (la función `mundi_es_persona`).
  - `listar()` → pinchos; `crear(fila)` → pincho; `actualizar(id, campos)` → pincho; `borrar(id)`.
  - `subirFoto(ruta, blob)`; `urlsFirmadas(rutas)` → `{ [ruta]: url }`; `quitarFotos(rutas)`; `fotosEn(carpeta)` →
    las rutas de los archivos de esa carpeta del almacén.
- **Guardar** espera a que terminen de prepararse las fotos elegidas: mientras tanto, el botón está desactivado.
- **Datos de ejemplo:** en `localhost` con `?ejemplo`, `datos` es `crearDatosEjemplo()` de
  `setup/pruebas/datos-ejemplo.js`: pinchos inventados en memoria, sin Supabase. Fuera de `localhost`, `?ejemplo` no
  hace nada.
