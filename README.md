# Mundi

Mi mapamundi de viajes en el teléfono: un pincho en cada lugar donde estuve, con sus fotos y su relato. Es una app
personal, una web instalable (PWA) sin build, con los datos en Supabase.

Publicada en **https://pvicen.github.io/mundi/** (GitHub Pages, rama `main`).

## Estado

| Parte | Estado |
|---|---|
| Base en Supabase (pinchos, almacén de fotos y permisos) | Hecha y ejecutada (12/10/2026) |
| Fotos: reducirlas y quitarles el GPS antes de subirlas | Hecha |
| Cáscara PWA: instalación e icono | Hecha |
| Mapa: países, pinchos agrupados, zoom y toques | Hecho |
| Interfaz: entrar, Mis viajes, añadir y editar con fotos, borrar, perfil | Hecha |
| Filtro por año y copia de seguridad (.zip con lugares y fotos) | Hecho |
| Diseño «Mapa de papel» (papel, sepia, ocre y rojo lacre; Fraunces y Outfit; versión oscura) | Hecho |
| El lugar en vez del país (contorno real de OpenStreetMap o mancha) y fotos en el mapa como polaroids | Hecho |
| «Quiero ir» (sitios pendientes, en otro color) y «Compartir» un lugar (también hacia la App de avisos) | Hecho |
| Botón «Instalar Mundi» (al entrar y en el perfil; si el navegador no lo ofrece, una pista de cómo hacerlo) | Hecho |
| De lejos, un punto por país; al acercar, los pinchos y las líneas grises de regiones y provincias | Hecho |
| La ficha de un lugar como pantalla aparte (diseño «Diario»), con el «atrás» del teléfono | Hecho |
| En la ficha, una muestra de fotos y su propia pantalla con todas; logo «Mapa plegado» | Hecho |
| Valoración y experiencias de cada lugar (comer, dormir, visitar, hacer, consejo) | Hecho; falta ejecutar su SQL |
| Compartir tu mapa, en solo lectura, con quien tú elijas; ver los mapas que te comparten | Hecho; falta ejecutar su SQL |

## Cómo está hecha

- **Supabase:** el mismo proyecto que la App de avisos. Todo lo de Mundi lleva el prefijo `mundi` y no toca nada de
  ella. Solo el dueño ve y toca sus pinchos y sus fotos; quién puede usar Mundi está en la tabla `mundi_personas`.
- **Fotos:** se redibujan en el teléfono antes de subirlas, así que el archivo que se guarda no lleva EXIF ni GPS.
- **Entrar:** con el correo y la contraseña de la cuenta de Supabase (la de la App de avisos). La sesión de Mundi se
  guarda aparte de la de avisos aunque compartan dominio.
- **Buscar lugares:** Nominatim de OpenStreetMap, sin cuenta. Solo recibe el texto buscado o las coordenadas del
  punto elegido, para sugerir su nombre.
- **Contratos entre las partes:** `docs/contratos.md`.

| Fichero | Qué es |
|---|---|
| `setup/migraciones/2026-10-12-mundi.sql` | La base: tablas, función, almacén y permisos |
| `setup/pruebas/bd.md` | Prueba de la base en el SQL Editor (lo deshace todo al terminar) |
| `index.html`, `app.js`, `style.css` | La app: pantallas, lógica y estilos |
| `config.js` | La URL del proyecto de Supabase y su clave publicable (públicas) |
| `setup/pruebas/datos-ejemplo.js` | Datos inventados para probar la app en local con `?ejemplo` |
| `fotos.js` | Prepara cada foto antes de subirla |
| `copia.js` | Arma el .zip de la copia de seguridad (sin librerías) |
| `puente.js` | El texto que se comparte de un lugar (nombre y enlace de Google Maps); acuerdo en `docs/puente-avisos.md` |
| `experiencias.js` | Los tipos de experiencia y sus reglas (las mismas que la base) |
| `setup/migraciones/2026-10-23-compartir-y-experiencias.sql` | Compartir el mapa en solo lectura y las experiencias; su prueba, `setup/pruebas/bd-compartir.md` |
| `mapa.js` | El mapamundi (d3 y Natural Earth a 1:50 millones); se prueba en `setup/pruebas/mapa.html` |
| `datos/limites.json` | Las líneas grises de regiones y provincias (Natural Earth 1:10 millones, dominio público); se rehace con `node setup/limites.mjs <geojson>` (la URL, en su cabecera) |
| `sw.js`, `manifest.webmanifest`, `icons/` | Lo que permite instalarla y abrirla sin conexión |
| `setup/iconos.py` | Dibuja los iconos (`py -3 setup/iconos.py`, con Pillow) |
| `demo/mundi.html` | El prototipo de diseño, con datos inventados |

## La base en Supabase

La migración ya está ejecutada. Para volver a ejecutarla (se puede hacer dos veces sin romper nada): en el SQL Editor
del proyecto, pegar `setup/migraciones/2026-10-12-mundi.sql` con el correo de la cuenta en el paso 1 y pulsar
**Run**; tiene que salir `mundi_bd` = PASA. La prueba completa está en `setup/pruebas/bd.md`.

## Desarrollo

- Vista previa: configuración `mundi` de `C:\Dev\.claude\launch.json`. La app con datos inventados, sin Supabase:
  http://localhost:8126/?ejemplo (opciones en `setup/pruebas/datos-ejemplo.js`); el mapa solo:
  http://localhost:8126/setup/pruebas/mapa.html.
- Pruebas: `node --test` desde la raíz.
- Lo que no se publica en GitHub Pages está en `_config.yml`.
