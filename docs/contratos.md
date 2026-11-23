# Contratos de Mundi

El único puente entre Cajas (método C.C.D. §2): cada Caja se programa leyendo solo su Contrato y los que usa.

## BD — los datos en Supabase

Migraciones: `setup/migraciones/2026-10-12-mundi.sql` y `2026-10-13-forma-y-miniatura.sql` y `2026-10-13-quiero-ir.sql` y `2026-10-13-forma-estricta.sql` y `2026-10-23-compartir-y-experiencias.sql` (en orden). Pruebas: `setup/pruebas/bd.md` y `setup/pruebas/bd-compartir.md`.
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

## BD — compartir el mapa y experiencias (añadido)

Migración `setup/migraciones/2026-10-23-compartir-y-experiencias.sql`; prueba `setup/pruebas/bd-compartir.md`.

**Columnas nuevas de `mundi_pinchos`:**

| Columna | Tipo | Regla |
|---|---|---|
| `valoracion` | smallint o null | De 1 a 5; null si no se valora |
| `experiencias` | jsonb | `[]` por defecto. Hasta 30 objetos `{ tipo, nombre, texto?, estrellas? }`, sin más claves: `tipo` es `comer`, `dormir`, `visitar`, `hacer` o `consejo`; `nombre`, texto de 1 a 80 caracteres sin contar los espacios de los lados; `texto`, hasta 1000; `estrellas`, un entero de 1 a 5 o null. Lo comprueba `mundi_experiencias_validas()` |

Las experiencias y la valoración las escribe solo el dueño del pincho (las mismas reglas de escritura de siempre).

**Tabla `mundi_compartidos`** (un permiso = «este dueño comparte su mapa entero con este correo»):

| Columna | Tipo | Regla |
|---|---|---|
| `dueno` | uuid | Lo pone la base: el `auth.uid()` de la sesión. No puede ser otro |
| `dueno_correo` | text | Lo pone la base: el correo de la sesión, en minúsculas. No puede ser otro |
| `nombre` | text | Cómo verá al dueño quien recibe el permiso (p. ej., «Vicente»): de 1 a 40 caracteres |
| `lector` | text | El correo con quien se comparte, en minúsculas; no puede ser el del dueño |
| `creado_en` | timestamptz | Lo pone la base |

Clave: (`dueno`, `lector`). **Reglas:**

- Solo el dueño da, cambia y quita sus permisos. Una fila la ven su dueño y su `lector`; nadie más.
- Quien recibe un permiso (y está en `mundi_personas`) puede **leer** los pinchos de ese dueño y sus fotos del almacén
  (`<dueno>/…`); no puede crear, cambiar ni borrar nada suyo. Lo decide `mundi_me_comparte(dueno en texto)`.
- Quitar el permiso corta el acceso al momento; los enlaces firmados que ya tuviera caducan solos (una hora).
- Como los pinchos que se pueden leer ya no son solo los propios, la app siempre pide los de un dueño concreto.

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
- `sw.js` guarda la cáscara propia (`ASSETS`: `./`, `index.html`, `style.css`, `app.js`, `mapa.js`, `datos/papel.json`,
  `fotos.js`, `copia.js`, `puente.js`, `experiencias.js`, `config.js`, el manifiesto y los iconos) y lo que se pida a los
  CDN (`cdn.jsdelivr.net`, `cdnjs.cloudflare.com`) y a Google Fonts. Red primero y caché de respaldo, para que funcione
  sin conexión.
- Del mapa (`tiles.openfreemap.org`, desde `mundi-v10`) guarda el índice de teselas (`/planet`), los iconos
  (`/sprites/`) y las letras (`/fonts/`); las teselas no: se quedan en la caché del navegador, porque guardarlas aquí
  sin tope llenaría el origen que Mundi comparte con la App de avisos.
- **Nunca toca lo que va a Supabase** (datos ni fotos): siempre va directo a la red.
- Convenio: si cambia un fichero de `ASSETS` o una URL de CDN, se sube el número de `CACHE` (`mundi-v1`, `mundi-v2`…).

## Mapa — el mapamundi (MapLibre, fondo «Papel»)

Desde el 23/11/2026 (Contrato 387: el mapa «como Google Maps», con el estilo «Papel» que eligieron Vicente y su suegro).
Ficheros: `mapa.js` (módulo ES) y el fondo `datos/papel.json`, que genera `setup/papel.mjs` desde el estilo `liberty`
de OpenFreeMap. Pruebas: `setup/pruebas/mapa.test.mjs` y `setup/pruebas/papel.test.mjs` (Node) y, en el navegador,
`setup/pruebas/mapa.html`. Necesita los globales `maplibregl` (MapLibre GL JS 5.24.0, JS y CSS), `d3` (7.9.0) y
`topojson` (3.0.2), cargados antes por la página; al importarse no toca la página ni la red. Los países (Natural Earth a
1:50 millones, `world-atlas@2.0.2/countries-50m.json`) los descarga él desde jsdelivr; las teselas de OpenStreetMap,
los iconos y las letras vienen de `tiles.openfreemap.org`.

- `crearMapa(contenedor, { alTocarPincho, alTocarPunto })` → `Promise<mapa>`. El mapa llena el `contenedor` y se
  adapta si cambia de tamaño, sin perder la vista. Se resuelve cuando han cargado el estilo y los países (no espera a
  las teselas), en 15 s como mucho. Si no, se rechaza con un `Error` cuyo mensaje se puede enseñar tal cual («Falta
  MapLibre…», «Faltan d3 y topojson…», «Este teléfono no puede dibujar el mapa.» sin WebGL, o «No se pudo cargar el
  mapa. Comprueba la conexión y vuelve a intentarlo.») y no deja nada creado.
- **Vista:** Mercator, con el norte siempre arriba (no gira ni se inclina) y el mundo sin repetirse a los lados.
  Empieza con el mundo habitado (de −60° a 80° de latitud) de alto; se puede alejar hasta que el mundo llena el mapa
  (en un teléfono en vertical, unos 180° de ancho).
- **Zoom,** en unidades de MapLibre (el mundo mide 512 px en el nivel 0), exportados: `ZOOM_PAISES` 2,5,
  `ZOOM_FOTOS` 3,3, `ZOOM_PUNTO` 10, `TOPE_ENCUADRE` 14 y `ZOOM_MAXIMO` 18.
- **El fondo «Papel»:** nombres en español por importancia al acercar (países y capitales, ciudades, pueblos y, de
  cerca, barrios) y límites grises (los de provincias y municipios, a trazos desde el zoom 7). Debajo va siempre el
  mundo de world-atlas (mar, tierra y costas): si las teselas no llegan, se ve el mapa de papel con los países
  visitados y los pinchos.
- `mapa.pintar(pinchos, { resaltar } = {})`: cada pincho es un objeto con, al menos, `{ id, nombre, lat, lon, pais }`
  (las filas de `mundi_pinchos` valen tal cual), y puede llevar `forma`, `portada` (la URL de una imagen) y `estado`.
  Sustituye lo pintado antes y no mueve la cámara. Pinta en suave los países visitados (se desvanecen entre los zooms
  5 y 8) y, en fuerte, cada lugar: su `forma` (GeoJSON) si pasa `formaValida(forma)` (exportada) o, si no, una mancha
  de 9 km alrededor (de cerca se aclara: desde el zoom 12, solo el borde). Un contorno roto nunca impide dibujar el
  mapa. Un pincho con `estado: "quiero_ir"` va en el color `--deseo`, sin polaroid, y no pinta ni su país ni su lugar.
  `resaltar` es el `id` de un pincho que entra con animación (el recién guardado).
- **Marcas** (una capa SVG propia sobre el lienzo, en px de pantalla): por debajo de `ZOOM_PAISES`, un punto por país
  con el número de lugares, en su lugar más céntrico (los pinchos sin país, cada uno solo; dos puntos que se tapan se
  juntan y pierden el país; un país con un solo lugar se ve con su pincho, sin «1»). Desde ahí, los pinchos que en
  pantalla quedan a menos de 24 px se agrupan en un círculo con el número (a 62 px desde `ZOOM_FOTOS`) y, desde
  `ZOOM_FOTOS`, un pincho suelto con `portada` se dibuja como una polaroid clavada con su nombre. Cada marca se puede
  tocar y usar con el teclado (Enter o Espacio), con su `aria-label`.
- **Toques:** en un pincho (también el único de un país) → `alTocarPincho(pincho)`, con el mismo objeto que se pasó a
  `pintar`; en un grupo → el mapa se acerca a sus pinchos; en el punto de un país → el país entero (su trozo más
  grande) más sus lugares; en el mapa, fuera de las marcas → `alTocarPunto({ lat, lon, pais })`, con `lat` y `lon` en
  grados (5 decimales, `lon` entre −180 y 180) y `pais` como en `paisEn`. No cuentan como toque arrastrar, pellizcar,
  el doble toque para acercar (el aviso espera 300 ms) ni lo de fuera del mundo.
- `mapa.encuadrar()`: enseña todos los pinchos, dejando libres los huecos de la Interfaz (64 px arriba, 80 a la
  derecha, 96 abajo y 32 a la izquierda); uno solo, a `ZOOM_PUNTO`; sin pinchos, la vista inicial.
- `mapa.irA(lat, lon, zoom = ZOOM_PUNTO)`: vuela a ese punto. El último `encuadrar` o `irA` corta al anterior;
  `pintar` y `marcarPunto` nunca mueven la cámara.
- `mapa.marcarPunto(lat, lon)`: pone un pincho gris provisional (el que se está creando); `mapa.marcarPunto(null)` lo
  quita.
- `mapa.paisEn(lat, lon)` → código ISO 3166-1 alfa-2 (`ES`) o `null` si el punto no cae en ningún país. Es síncrono y
  vale para cualquier punto (world-atlas y `d3.geoContains`; tabla `ISO`, más Kosovo `XK`, N. Cyprus `CY` y
  Somaliland `SO`).
- **Colores:** el fondo lleva los fijos de «Papel». Lo de Mundi toma de la página `--pin`, `--deseo`, `--visitado`,
  `--visitado-borde`, `--sup`, `--postal`, `--tinta`, `--tinta-2` y `--tinta-3` si son colores sencillos (hex, rgb o
  hsl); si no, y siempre de noche (el mapa sigue en «Papel» claro), los claros de `style.css`. Sus clases empiezan por
  `mm-`, para no chocar con las de la Interfaz; las de MapLibre, por `maplibregl-`.
- **Atribución** (obligatoria): el control compacto de MapLibre, abajo a la izquierda, con la de OpenFreeMap,
  OpenMapTiles y OpenStreetMap más «Natural Earth». Es fija: va en cada fuente de `datos/papel.json` (`ATRIBUCION` de
  `setup/papel.mjs`), porque MapLibre la pone en la página como HTML y, si la fuente no la trae, usa la que manda el
  servidor con el índice de teselas.
- Lo que cruza la línea de cambio de fecha (Rusia, Fiyi, un contorno o una mancha junto a ella) se parte en dos para
  el mapa plano (`partirEnLaFecha`); un anillo que rodea un polo (la Antártida) se queda como está.

## Interfaz — la app

Ficheros: `index.html`, `app.js`, `style.css` y `config.js`. Usa los Contratos BD, Fotos, Mapa y Cáscara PWA.

- **`config.js`** (módulo ES), solo lo público: `SUPABASE_URL` y `SUPABASE_CLAVE` (la clave publicable). Es el
  proyecto de la App de avisos.
- **Librerías**, con versión fijada y SRI: d3 7.9.0 y topojson 3.0.2 (cdnjs), MapLibre GL JS 5.24.0 (jsdelivr; su CSS
  antes de `style.css` y su JS con `defer`, antes de `app.js`) y supabase-js 2.112.4 (jsdelivr).
- **El contenedor del mapa** (`.zona-mapa > .mapa`) aísla los z-index de MapLibre (`isolation: isolate`), y la franja
  «Mapa de X» deja sitio debajo para la atribución del mapa.
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
  - `listar(dueno)` → los pinchos de ese dueño (los míos o los de quien me comparte su mapa); `crear(fila)` → pincho;
    `actualizar(id, campos)` → pincho; `borrar(id)`.
  - `compartidos(dueno)` → `[{ lector, nombre, creado_en }]`, con quién comparto; `compartir(lector, nombre)`;
    `renombrar(dueno, nombre)` (cambia el nombre en todos mis permisos); `dejarDeCompartir(dueno, lector)`;
    `meComparten(correo)` → `[{ dueno, dueno_correo, nombre }]`, quién me comparte su mapa.
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
  `estado`, `pais`, `lat`, `lon`, `fecha`, `relato`, `valoracion`, `experiencias`, `forma`, `creado_en` y `fotos`: las
  rutas de sus fotos dentro del ZIP. La copia es solo de mis lugares, nunca de los mapas que me comparten.
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

## Interfaz — la ficha como pantalla aparte (añadido)

- Tocar un pincho (o un lugar del perfil) abre su ficha como **una pantalla aparte** que entra desde la derecha y
  tapa el mapa, diseño «Diario»: arriba, la primera foto a media pantalla (tocarla abre el visor) con el sello del
  país, el nombre y «fecha · N fotos»; debajo, el relato con capitular, una muestra de las fotos (hasta tres polaroids
  pequeñas después de la portada; cada una abre el visor en ella) con el botón «Ver las N fotos», las coordenadas y los
  botones de siempre («Ya fui», Compartir, Editar, Borrar). Sin fotos, la portada es un bloque de color (sepia; verde
  si es «Quiero ir»). Arriba, «←» vuelve al mapa y otro botón comparte.
- **La pantalla de las fotos:** «Ver las N fotos» abre otra pantalla encima de la ficha con todas las fotos del lugar
  en cuadrícula (cada una abre el visor en ella); «←» o «atrás» vuelve a la ficha. Con una sola foto no hay muestra ni
  botón: basta la portada.
- **El «atrás» del teléfono:** mientras haya algo abierto encima del mapa (la ficha, una hoja —formulario o perfil—,
  el visor o «Toca el lugar en el mapa») la app tiene un paso propio en el historial (`history.pushState`). «Atrás»
  cierra lo de más arriba (visor, «Toca el lugar…», hoja, la pantalla de las fotos y, por último, la ficha) en vez de
  salir de Mundi; si queda
  algo abierto, el paso vuelve. **Mientras se guarda un lugar, «atrás» no cierra nada:** avisa «Espera a que termine
  de guardarse» y el paso vuelve. Cuando ya no queda nada abierto (con «←», la ✕, Escape, al guardar o al borrar), la
  app gasta su paso (`history.back()`), para que el siguiente «atrás» no pida nada.
- **Editar** abre el formulario encima de la ficha; al guardar, la ficha enseña los cambios. «Elegir en el mapa»
  cierra la ficha para dejar ver el mapa (al guardar se queda en el mapa). Borrar cierra la ficha.

## Interfaz — experiencias (añadido)

Fichero nuevo: `experiencias.js` (módulo ES, sin dependencias; prueba `setup/pruebas/experiencias.test.mjs`): `TIPOS`
(comer 🍽️, dormir 🛏️, visitar 🏛️, hacer 🥾, consejo 💡, en ese orden), `experienciaValida`, `experienciasValidas` y
`valoracionValida` (las mismas reglas que la base, contando caracteres como ella), `limpiarExperiencias(borradores)` →
`{ lista }` o `{ error }`, `agruparPorTipo(lista)` y `estrellas(n)` («★★★★☆»).

- **En el formulario**, después del relato: la valoración (cinco estrellas; tocar la marcada la quita; oculta y null en
  un «quiero ir») y las experiencias, cada una con tipo, estrellas (o ninguna), nombre y «qué te pareció»; «Añadir
  experiencia» (hasta 30) y una ✕ para quitarla. Al guardar se recortan los espacios, se quitan las del todo vacías y,
  si alguna tiene algo pero no nombre, se avisa y no se guarda nada.
- **En la ficha**, después de las fotos: «Experiencias» (o «Valoración», si solo hay valoración) con las estrellas del
  lugar y las experiencias agrupadas por tipo; sin valoración ni experiencias, la sección no sale.

## Interfaz — compartir el mapa (añadido)

- **En el perfil**, «Mapas que te comparten» (si hay alguno): un botón por persona, con el nombre que ella puso; y
  «Compartir mi mapa»: «Tu nombre, como te verán» (obligatorio para compartir; cambiarlo lo cambia en todos tus
  permisos), la lista de con quién compartes con «Quitar» (pide confirmación) y un campo de correo con «Compartir». No
  se comparte con tu propio correo ni dos veces con el mismo; los errores se dicen en palabras.
- **Ver un mapa que te comparten:** el mapa pasa a enseñar sus lugares (filtro, cifras y polaroids, de ese mapa) y,
  abajo, «Mapa de <nombre> · Volver al mío». Sus fichas solo se miran (sin «Ya fui», «Editar» ni «Borrar»; «Compartir»
  sí) y dicen «Del mapa de <nombre>». No se pueden clavar pinchos (sin «+»). «Volver al mío», Escape o el «atrás» del
  teléfono (después de cerrar lo que esté encima) vuelven a tu mapa; abrir uno de tus lugares desde el perfil, también.
- La copia de seguridad y las cifras del perfil son siempre de tus lugares.
