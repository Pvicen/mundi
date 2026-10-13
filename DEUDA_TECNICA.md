# Deuda técnica

Errores o límites no críticos, anotados para no frenar el avance (método C.C.D. §3).

| Fecha | Dónde | Nivel | Qué pasa | Por qué se deja |
|---|---|---|---|---|
| 12/10/2026 | `demo/mundi.html` | Bajo | El mapa es de baja resolución: algunas islas pequeñas no salen (Santorini cae en el mar) | Es una demo; el MVP usará una geometría de más resolución |
| 12/10/2026 | `demo/mundi.html` | Bajo | Lo que se añade vive en memoria y se pierde al recargar | Es una demo; el MVP guarda en Supabase |
| 12/10/2026 | `sw.js` | Bajo | Sin conexión, la app abre pero las fotos no se ven: sus URL firmadas van siempre a la red | Las fotos son privadas y no se guardan en el teléfono a propósito |
| 12/10/2026 | Supabase | Bajo | El almacén gratuito (1 GB, unas 3.000 fotos comprimidas) se comparte con la App de avisos | Decisión del 12/10: el mismo proyecto evita que el gratuito se pause |
| 12/10/2026 | `mapa.js` | Bajo | La geometría de Natural Earth es «de hecho»: Crimea sale como Rusia, y «Indian Ocean Ter.» y «Siachen Glacier» no tienen código (`pais` null) | Casos de borde; se puede corregir con una tabla de excepciones si hace falta |
| 12/10/2026 | `mapa.js` | Bajo | La primera vez descarga unos 750 KB de geometría (después la guarda `sw.js`) | El detalle hace falta para las islas pequeñas; se podría simplificar con topojson |
| 12/10/2026 | `mapa.js` | Bajo | Al cambiar de tamaño (girar el teléfono) el mapa se redibuja y vuelve a encuadrar los pinchos: se pierde el zoom que hubiera | Es raro y no rompe nada |
| 12/10/2026 | `app.js` | Bajo | Sin conexión, la app abre pero no carga ni guarda lugares (la lista no se guarda en el teléfono) | Es personal y casi siempre hay red; se puede añadir una copia local |
| 12/10/2026 | `app.js` | Bajo | Una foto que queda en el almacén sin que la fila la cite (falla su borrado al editar, o se sube y falla guardar su ruta y se cierra el formulario) ocupa sitio hasta que se borra el lugar, que limpia su carpeta entera | Raro; ocupa poco |
| 12/10/2026 | `app.js` | Bajo | Cerrar el formulario sin guardar descarta los cambios sin preguntar | Comodidad; no pierde nada guardado |
| 12/10/2026 | `app.js` | Bajo | Buscar depende de Nominatim (OpenStreetMap), con uso justo y sin autocompletar: si un día no responde, queda «Elegir en el mapa» y «Estoy aquí» | Gratis y sin cuenta; alternativa: Photon |
| 12/10/2026 | `sw.js` | Bajo | Cuando la App de avisos se actualiza, su `sw.js` borra las cachés de otros nombres, incluida la de Mundi; se vuelve a llenar sola con red | No se toca la App de avisos |
| 12/10/2026 | `app.js` | Bajo | En Windows las banderas salen como letras (ES, CL): es el emoji; en el teléfono se ven | Estética de escritorio |
| 12/10/2026 | `app.js` | Bajo | La copia arma el .zip en memoria: con muchísimas fotos (miles) podría quedarse corta en un teléfono; y en el iPhone instalada, la descarga abre la hoja de compartir en vez de ir a Descargas | Con cientos de fotos va bien; se puede partir por años si hace falta |
| 13/10/2026 | `app.js` | Bajo | El contorno es el que da OpenStreetMap para ese sitio: a veces no hay (queda la mancha) o trae de más (Valparaíso incluye unas islas lejanas) | Es lo que hay gratis; se puede cambiar el sitio y volver a guardar |
| 13/10/2026 | `app.js` | Bajo | Los lugares guardados antes del 13/10 cogen su contorno y su miniatura la próxima vez que se editan y guardan; mientras, mancha y la foto entera en la polaroid | No se escribe en la base sin que él guarde |
| 13/10/2026 | `app.js` | Bajo | En escritorio, «Compartir» abre la ventana de compartir del sistema (o copia el texto si no hay); la prueba de punta a punta con «Avisos: guardar lugar» solo se puede hacer en su Android | El puente es para el teléfono |
| 12/10/2026 | `setup/pruebas/bd.md` | Bajo | La prueba completa de la base (32 comprobaciones) no se ha ejecutado; solo la comprobación final de la migración (PASA) y el sondeo sin sesión (401) | Se puede ejecutar cuando Vicente quiera; lo deshace todo |
