# Puente entre Mundi y la App de avisos

Mundi no toca nada de la App de avisos (ni sus tablas ni su código). El único puente es **compartir** un lugar como
un enlace de mapa normal: desde la ficha de un pincho, «Compartir» → «Avisos: guardar lugar» (la app de Android de
la App de avisos, repo `avisos-widget`), que lo recoge y avisa al pasar por allí.

## El texto que se comparte

Texto plano de dos líneas:

```
Museo del Prado
https://maps.google.com/?q=40.413800,-3.692100
```

- Línea 1: el nombre del pincho, en una sola línea (la App de avisos guarda como mucho 40 letras).
- Línea 2: `https://maps.google.com/?q=LAT,LON` con punto decimal (nunca coma), 6 decimales y sin espacios. Es un
  enlace estándar de Google Maps: abre el sitio en cualquier navegador.
- Nada más: ni fotos, ni notas, ni fechas.

Lo genera `textoCompartir` de `puente.js` (Contrato «Puente» de `docs/contratos.md`).

## Cómo se comprueba de punta a punta

En el Android de Vicente: Mundi → ficha del pincho → Compartir → «Avisos: guardar lugar» → sale el nombre y
«📍 40.41380, -3.69210» → escribe qué hacer allí → Guardar. Al pasar por allí, su Android le avisa.
