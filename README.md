# Mundi

Mi mapamundi de viajes en el teléfono: un pincho en cada lugar donde estuve, con sus fotos y su relato. Es una app
personal, una web instalable (PWA) sin build, con los datos en Supabase.

## Estado

| Parte | Estado |
|---|---|
| Base en Supabase (pinchos, almacén de fotos y permisos) | Hecha y ejecutada (12/10/2026) |
| Fotos: reducirlas y quitarles el GPS antes de subirlas | Hecha |
| Cáscara PWA: instalación e icono | Hecha |
| Mapa: países, pinchos agrupados, zoom y toques | Hecho |
| Interfaz | Pendiente |

## Cómo está hecha

- **Supabase:** el mismo proyecto que la App de avisos. Todo lo de Mundi lleva el prefijo `mundi` y no toca nada de
  ella. Solo el dueño ve y toca sus pinchos y sus fotos; quién puede usar Mundi está en la tabla `mundi_personas`.
- **Fotos:** se redibujan en el teléfono antes de subirlas, así que el archivo que se guarda no lleva EXIF ni GPS.
- **Contratos entre las partes:** `docs/contratos.md`.

| Fichero | Qué es |
|---|---|
| `setup/migraciones/2026-10-12-mundi.sql` | La base: tablas, función, almacén y permisos |
| `setup/pruebas/bd.md` | Prueba de la base en el SQL Editor (lo deshace todo al terminar) |
| `fotos.js` | Prepara cada foto antes de subirla |
| `mapa.js` | El mapamundi (d3 y Natural Earth a 1:50 millones); se prueba en `setup/pruebas/mapa.html` |
| `sw.js`, `manifest.webmanifest`, `icons/` | Lo que permite instalarla y abrirla sin conexión |
| `setup/iconos.py` | Dibuja los iconos (`py -3 setup/iconos.py`, con Pillow) |
| `demo/mundi.html` | El prototipo de diseño, con datos inventados |

## La base en Supabase

La migración ya está ejecutada. Para volver a ejecutarla (se puede hacer dos veces sin romper nada): en el SQL Editor
del proyecto, pegar `setup/migraciones/2026-10-12-mundi.sql` con el correo de la cuenta en el paso 1 y pulsar
**Run**; tiene que salir `mundi_bd` = PASA. La prueba completa está en `setup/pruebas/bd.md`.

## Desarrollo

- Vista previa: configuración `mundi` de `C:\Dev\.claude\launch.json` (http://localhost:8126/).
- Pruebas: `node --test` desde la raíz.
- Lo que no se publica en GitHub Pages está en `_config.yml`.
