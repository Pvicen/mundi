# Contratos de Mundi

El único puente entre Cajas (método C.C.D. §2): cada Caja se programa leyendo solo su Contrato y los que usa.

## BD — los datos en Supabase

Migraciones: `setup/migraciones/2026-10-12-mundi.sql` y `2026-10-13-forma-y-miniatura.sql` y `2026-10-13-quiero-ir.sql` y `2026-10-13-forma-estricta.sql` (en orden). Prueba: `setup/pruebas/bd.md`.
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
| `forma` | jsonb o null | El contorno real del lugar (ciudad, isla…) en GeoJSON: `Polygon` o `MultiPolygon` bien formado (anillos de al menos 4 puntos `[lon, lat]` numéricos y en rango), hasta 100 KB; lo comprueba `mundi_forma_valida()`. Null si no se conoce: el mapa pinta una mancha. |
| `miniatura` | text o null | Ruta en el almacén de una copia pequeña (240 px) de la primera foto, para el mapa: `<dueno>/<id>/miniatura-<uuid>.jpg`. Tiene que empezar por la carpeta del dueño |
| `estado` | text | `visitado` (por defecto) o `quiero_ir`: un sitio al que quiere ir |
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

- `prepararFoto(archivo, lado = 1600)` → `Promise<Blob>`. `archivo` es el `File` que da `<input type="file" accept="image/*">`.
  Devuelve un JPEG (`image/jpeg`) con el lado mayor de 1600 px como mucho (nunca amplía), la orientación correcta y
  **sin metadatos**: ni EXIF ni GPS, porque se redibuja en un lienzo y solo se guardan los píxeles. Pesa menos de
  5 MB, el límite del almacén. Con `lado = LADO_MINIATURA` (240) sale la miniatura del mapa.
- Si no puede abrir la foto, la promesa se rechaza con un `Error` cuyo mensaje se puede enseñar tal cual.
- `medidasDestino(ancho, alto, maximo = 1600)` → `{ ancho, alto }`: las medidas finales, enteras y con la misma
  proporción.

## Cáscara PWA — que se instale en el teléfono

Ficheros: `manifest.webmanifest`, `sw.js` e `icons/` (`icono-192.png`, `icono-512.png` y `apple-touch-icon.png`, de
180 px).

- `index.html` enlaza el manifiesto (`<link rel="manifest" href="manifest.webmanifest">`) y el icono de iPhone
  (`<link rel="apple-touch-icon" href="icons/apple-touch-icon.png">`), y registra `./sw.js`.
- `sw.js` guarda la cáscara propia (`ASSETS`: `./`, `index.html`, `style.css`, `app.js`, `mapa.js`, `fotos.js`, `copia.js`, `puente.js`,
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
- `mapa.pintar(pinchos, { resaltar } = {})`: pinta los pinchos, colorea en suave los países visitados y, en fuerte,
  cada lugar: su `forma` (GeoJSON) o, si no tiene, una mancha de 9 km alrededor. Cada pincho es un objeto con, al
  menos, `{ id, nombre, lat, lon, pais }` (las filas de `mundi_pinchos` valen tal cual), y puede llevar `forma` y
  `portada` (la URL de una imagen). Si la `forma` no pasa `formaValida(forma)` (exportada), se pinta la mancha: un
  contorno roto nunca impide dibujar el mapa. Desde el zoom 4, un pincho con portada se dibuja como una polaroid clavada, con su
  nombre escrito abajo (los grupos se juntan entonces a 62 px). Un pincho con `estado: "quiero_ir"` se dibuja en el
  color `--deseo`, sin polaroid, y no pinta ni su país ni su lugar. Sustituye lo
  pintado antes. Los pinchos que en pantalla quedan cerca se agrupan en un círculo con el número; al acercar, se
  separan. `resaltar` es el `id` de un pincho que entra con animación (el recién guardado).
- `mapa.encuadrar()`: ajusta la vista para que se vean todos los pinchos (la vista inicial si no hay).
- `mapa.irA(lat, lon, zoom = 6)`: se acerca a ese punto.
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
- **Buscar un lugar, nombrar un punto y su contorno:** Nominatim de OpenStreetMap, sin cuenta. Solo se le envía el
  texto buscado (al pulsar Buscar) o las coordenadas del punto elegido. El contorno (`polygon_geojson`) se guarda
  en `forma` con 4 decimales y hasta 60 KB; si no hay, `null`. Un lugar sin contorno conocido lo pide al guardarse.
- **Miniatura y portada:** al guardar, si la primera foto cambió, se hace una copia de 240 px con `prepararFoto` y
  se sube como `<uid>/<id>/miniatura-<nombre de la primera foto>.jpg` (se guarda en `miniatura` y se borra la
  anterior). El mapa recibe como `portada` el enlace firmado de la miniatura **solo si es la de la primera foto
  actual**; si no (o no hay), el de la primera foto; sin fotos, ninguna. Si la miniatura no se puede rehacer, la fila
  deja de apuntar a la vieja; si ni eso se puede, el formulario avisa y se reintenta con Guardar. Solo se guardan
  contornos que pasan `formaValida`.
- **Capa de datos:** todo lo que va a Supabase pasa por un objeto `datos` con esta forma (la de ejemplo la imita):
  - `sesion()` → `{ id, correo }` o `null`; `entrar(correo, clave)` → `{ id, correo }` (lanza `Error`); `salir()`.
  - `esPersona()` → boolean (la función `mundi_es_persona`).
  - `listar()` → pinchos; `crear(fila)` → pincho; `actualizar(id, campos)` → pincho; `borrar(id)`.
  - `subirFoto(ruta, blob)`; `urlsFirmadas(rutas)` → `{ [ruta]: url }`; `quitarFotos(rutas)`; `fotosEn(carpeta)` →
    las rutas de los archivos de esa carpeta del almacén.
- **Guardar** espera a que terminen de prepararse las fotos elegidas: mientras tanto, el botón está desactivado.
  Mientras guarda, el formulario queda bloqueado: no se añaden ni quitan fotos ni se cambia el sitio.
- **Datos de ejemplo:** en `localhost` con `?ejemplo`, `datos` es `crearDatosEjemplo()` de
  `setup/pruebas/datos-ejemplo.js`: pinchos inventados en memoria, sin Supabase. Fuera de `localhost`, `?ejemplo` no
  hace nada.

## Copia — el archivo de la copia de seguridad

Fichero: `copia.js` (módulo ES, sin dependencias). Prueba: `setup/pruebas/copia.test.mjs`.

- `crc32(bytes)` → el CRC-32 (sin signo) de un `Uint8Array`.
- `crearZip(archivos, fecha = new Date())` → `Uint8Array`: un ZIP sin comprimir (método «store»; las fotos ya son
  JPEG y comprimirlas no ahorra nada), con los nombres en UTF-8. Cada archivo es `{ nombre, datos }`, con `datos`
  como `Uint8Array` o texto.
- `nombreSeguro(texto)` → el texto apto para un nombre de carpeta o de archivo: sin `/ \ : * ? " < > |` ni
  caracteres de control, sin espacios ni puntos en los extremos, 60 caracteres como mucho y `lugar` si queda vacío.

**La copia que descarga la Interfaz** (`mundi-copia-AAAA-MM-DD.zip`):

- `lugares.json`: `{ "version": 1, "exportado": "<fecha ISO>", "lugares": [...] }`. Cada lugar lleva `id`, `nombre`,
  `pais`, `lat`, `lon`, `fecha`, `relato`, `creado_en` y `fotos`: las rutas de sus fotos dentro del ZIP.
- `fotos/<NNN>-<nombre del lugar>/<k>.jpg`: las fotos de cada lugar, en orden (`NNN`, el número del lugar, con tres
  cifras).
- `LEEME.txt`: qué es la copia y cómo está organizada.

## Interfaz — filtro por año y copia (añadido)

- **Filtro por año:** una fila de botones sobre el mapa: «Todos», los años con lugares (del más reciente al más
  antiguo) y «Sin fecha» si hay lugares sin fecha. Solo aparece si hay al menos dos opciones además de «Todos».
  Al elegir uno, el mapa pinta solo esos pinchos (`mapa.pintar`) y se encuadra en ellos, y el contador de la
  cabecera cuenta solo esos. El perfil siempre cuenta todo. Si se guarda un lugar que el filtro dejaría fuera, el
  filtro vuelve a «Todos».
- **Copia de seguridad:** botón «Descargar copia» en el perfil. Descarga las fotos con `datos.urlsFirmadas`, arma
  el ZIP con `crearZip` y lo descarga. Si alguna foto no se puede bajar, la copia sale igual y avisa de cuántas
  faltan.

## Puente — compartir un lugar (con la App de avisos)

Fichero: `puente.js` (módulo ES, sin dependencias). Prueba: `setup/pruebas/puente.test.mjs`. El acuerdo con la App de
avisos está en `docs/puente-avisos.md`.

- `textoCompartir({ nombre, lat, lon })` → texto de dos líneas: el nombre (en una línea; «Lugar» si está vacío) y
  `enlaceMapa(lat, lon)`.
- `enlaceMapa(lat, lon)` → `https://maps.google.com/?q=LAT,LON` con punto decimal y 6 decimales, sin espacios.
  Coordenadas fuera de rango: `RangeError`.

## Interfaz — «Quiero ir» y «Compartir» (añadido)

- En el formulario, «Estuve aquí» o «Quiero ir» (`estado`). Un «quiero ir» no lleva fecha (el campo «Cuándo» se
  esconde y se guarda null); fotos y relato, opcionales como siempre.
- El filtro suma la opción «Quiero ir» si hay alguno; los años y «Sin fecha» solo cuentan lo visitado. Con «Quiero
  ir», la cabecera dice cuántos hay «por visitar»; si no, cuenta solo lo visitado. El perfil cuenta solo lo visitado
  y lista aparte los «Quiero ir».
- En la ficha, el país sale como sello «Quiero ir · País» y el botón «Ya fui» lo pasa a visitado con el mes de hoy.
- En la ficha de cualquier pincho, «Compartir»: `navigator.share({ title: nombre, text: textoCompartir(pincho) })`;
  si el navegador no puede compartir, copia ese texto al portapapeles y lo dice.

## Interfaz — instalar en el teléfono (añadido)

- Cuando el navegador ofrece instalar la app (`beforeinstallprompt`, Chrome en Android), en la pantalla de entrar y
  en el perfil aparece «Instalar Mundi», que lanza la instalación del navegador (`prompt()`, una vez).
- Si no lo ofrece y la app no está instalada, la pantalla de entrar da una pista: en Chrome, menú ⋮ → «Instalar
  app»; en iPhone, Compartir → «Añadir a pantalla de inicio».
- Ya instalada (`display-mode: standalone`), no aparece nada. Al instalarse (`appinstalled`), lo dice.

## Mapa — un punto por país y líneas de regiones al acercar (añadido)

Ficheros nuevos: `datos/limites.json` (lo genera `setup/limites.mjs` desde Natural Earth; prueba
`setup/pruebas/limites.test.mjs`).

- **De lejos (zoom < `ZOOM_PAISES` = 2,5), solo los países:** un punto por país (círculo con el número de lugares),
  en el lugar suyo más céntrico, con el nombre del país en español debajo si no lo tapa otro punto; los pinchos sin
  país, cada uno solo; dos puntos que quedan encima se juntan (sin nombre). Tocar el punto de un país acerca el mapa
  a ese país entero (su trozo más grande, más sus lugares), ya por encima de `ZOOM_PAISES`. No hay líneas grises.
- **Desde `ZOOM_PAISES`,** como antes: los pinchos (los cercanos en pantalla, juntos con su número) y, desde el zoom
  4, las polaroids.
- **Líneas grises de regiones y provincias:** desde `ZOOM_PAISES`, cada capa (país y nivel) aparece poco a poco cuando
  el mapa llega al zoom que propone Natural Earth menos 2 niveles (zoom web: el mundo mide 256 px en el nivel 0), y
  solo se dibujan las que caen en pantalla. Color: la variable `--limite`. Van por debajo de los lugares y no se tocan.
- **`datos/limites.json` (limites.v1):** `{ tipo: "limites.v1", fuente, paises: [{ pais, niveles: [{ z, lineas }] }] }`;
  `pais`, el código ISO de 3 letras; `z`, el zoom web de Natural Earth; cada línea, en milésimas de grado y en
  diferencias: `[lon0, lat0, dlon1, dlat1, …]`. Se pide (junto a `mapa.js`) la primera vez que hace falta; si no
  llega, el mapa sigue sin líneas y lo vuelve a pedir como pronto al minuto. Lo que no tenga esa forma se ignora.
