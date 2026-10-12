# Deuda técnica

Errores o límites no críticos, anotados para no frenar el avance (método C.C.D. §3).

| Fecha | Dónde | Nivel | Qué pasa | Por qué se deja |
|---|---|---|---|---|
| 12/10/2026 | `demo/mundi.html` | Bajo | El mapa es de baja resolución: algunas islas pequeñas no salen (Santorini cae en el mar) | Es una demo; el MVP usará una geometría de más resolución |
| 12/10/2026 | `demo/mundi.html` | Bajo | Lo que se añade vive en memoria y se pierde al recargar | Es una demo; el MVP guarda en Supabase |
