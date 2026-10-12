# Deuda técnica

Errores o límites no críticos, anotados para no frenar el avance (método C.C.D. §3).

| Fecha | Dónde | Nivel | Qué pasa | Por qué se deja |
|---|---|---|---|---|
| 12/10/2026 | `demo/mundi.html` | Bajo | El mapa es de baja resolución: algunas islas pequeñas no salen (Santorini cae en el mar) | Es una demo; el MVP usará una geometría de más resolución |
| 12/10/2026 | `demo/mundi.html` | Bajo | Lo que se añade vive en memoria y se pierde al recargar | Es una demo; el MVP guarda en Supabase |
| 12/10/2026 | `sw.js` | Bajo | Sin conexión, la app abre pero las fotos no se ven: sus URL firmadas van siempre a la red | Las fotos son privadas y no se guardan en el teléfono a propósito |
| 12/10/2026 | Supabase | Bajo | El almacén gratuito (1 GB, unas 3.000 fotos comprimidas) se comparte con la App de avisos | Decisión del 12/10: el mismo proyecto evita que el gratuito se pause |
| 12/10/2026 | `setup/pruebas/bd.md` | Bajo | La prueba completa de la base (32 comprobaciones) no se ha ejecutado; solo la comprobación final de la migración (PASA) y el sondeo sin sesión (401) | Se puede ejecutar cuando Vicente quiera; lo deshace todo |
