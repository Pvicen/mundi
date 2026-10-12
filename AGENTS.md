# Mundi — Reglas del proyecto

App de viajes para teléfono: un mapamundi con pinchos y fotos de los lugares visitados (nombre provisional).
Creado el 12/10/2026. No es un repositorio git todavía. Estas reglas complementan (y en conflicto, prevalecen
sobre) el `AGENTS.md` general de `C:\Dev`. Vicente decide; la IA ejecuta la Caja que él manda.

## Método C.C.D. y escalada de modelos

**C**ajas, **C**ontratos y **D**euda Técnica. Documento maestro de Vicente (2026-09-25; §6
añadido el 2026-10-08), piedra angular de todo repo bajo `C:\Dev`; se reproduce igual en cada
`AGENTS.md`. La IA solo ejecuta lo que Vicente manda por Cajas.

### 1. Ley primera: avance sobre perfección
El objetivo del desarrollador y las IAs es alcanzar el Producto Mínimo Viable (MVP). Si el «Camino
Feliz» funciona y no hay riesgos graves, se aprueba y se avanza.
* **Prohibido:** los bucles de refutación. La IA no decide si el código está perfecto; el
  desarrollador (Arquitecto) es el árbitro final.

### 2. Arquitectura por Cajas y Contratos
* **Las Cajas:** todo se programa de forma aislada (Caja Red, Caja BD, Caja Interfaz).
* **Aislamiento de contexto:** al programar una Caja, NUNCA se pasa a la IA el código de las demás
  Cajas.
* **Los Contratos:** el único puente entre Cajas es el Contrato (el formato exacto de los datos que
  entran y salen, p. ej. un JSON). A la IA solo se le pasa este Contrato como contexto para que
  programe la Caja correspondiente.

### 3. Gestión de deuda técnica
* **Errores medios/bajos:** optimizaciones, estética o casos de borde improbables NO se arreglan en
  la fase de construcción.
* **Archivo `DEUDA_TECNICA.md`:** cada proyecto tiene este archivo en su raíz. Todo error no crítico
  se anota aquí con su explicación y se ignora temporalmente.
* Solo se detiene el avance ante errores **Bloqueantes** (crasheos absolutos) o **Altos** (brechas
  de seguridad, pérdida de datos).

### 4. La regla de los subagentes (solo exploración)
* **Prohibido:** usar subagentes para debatir, buscar bugs o criticar código ya escrito.
* **Uso permitido:** «Exploradores de Contratos». Antes de programar se pueden lanzar un número
  estricto y limitado de subagentes (2 o 3) SOLO para leer Cajas distintas y proponer el Contrato
  que las va a unir. Una vez hecho el molde, los subagentes desaparecen.

### 5. Matriz de escalada de modelos (uso eficiente de tokens)
* **Nivel 1 — El día a día (Opus 5.5, modo estándar):** el 90 % del trabajo. Hacer moldes,
  programar Cajas individuales a partir de Contratos, lanzar subagentes de exploración. Consumo
  eficiente.
* **Nivel 2 — El refactorizador menor (Fable 5.1, modo estándar):** cuando hay un cambio de rumbo
  arquitectónico y hay que reescribir varios archivos para que sigan una nueva lógica. Mantiene
  excelente coherencia narrativa.
* **Nivel 3 — El botón nuclear algorítmico (Opus 5.5, UltraCode):** uso quirúrgico y
  ultra-restringido. Solo para crear desde cero cuellos de botella lógicos o matemáticos muy
  complejos (p. ej. el motor del Análisis Financiero). Se usa, se copia el código y se vuelve al
  Nivel 1.
* **Nivel 4 — El mega-refactor / cataclismo (Fable 5.1, UltraCode):** solo en migraciones masivas
  de tecnología o cambios estructurales que reescriben la mayoría del proyecto manteniendo lógica
  compleja de fondo.
* **Nivel 5 — El Tribunal Supremo / auditor final (GPT-6 Astra Ultra):** la última fase de la
  inteligencia. Cero programación. Misiones exclusivas: (1) **Auditoría final:** al terminar una
  Caja crítica se le pasa el código a GPT para buscar ÚNICAMENTE vulnerabilidades Altas o
  Bloqueantes; si está limpio, responde «CAJA APROBADA». (2) **El Solucionador (fallback):** si los
  modelos anteriores fracasan resolviendo un crasheo grave, se le pasa el problema a Astra para que
  diagnostique y repare.

### 6. Lotes y Cajas críticas (enmienda de Vicente, 2026-10-08)
Antes de programar, cada Caja se clasifica. **Ante la duda, es crítica.**
* **Caja de lote (fácil):** documentación o código satélite, con su Contrato aprobado, que no usa
  la salida de otra Caja del mismo lote ni toca el núcleo del repo (esquema de la base de datos,
  migraciones, protocolo, seguridad, núcleo protegido). Se hacen **hasta 5 seguidas**, una detrás
  de otra y sin pedir permiso entre ellas, cada una programada solo contra su Contrato, con su gate
  en verde y su propio commit en la rama. Si necesita mirar el código de otra, no es de lote.
* **Caja crítica:** la que toca el núcleo (p. ej. crear la base de datos) o un algoritmo central.
  Se hace **sola**, de una en una.
* **Parada:** al terminar un lote o una Caja crítica, la IA se detiene para la verificación y el
  arbitraje de Vicente. El push y el merge, solo con su orden.
* **Errores dentro de un lote:** lo medio y lo bajo va a `DEUDA_TECNICA.md` y el lote sigue. Ante
  algo Bloqueante o Alto, el lote se detiene: esa Caja no se commitea, las anteriores se quedan y
  se avisa a Vicente.
* **Modelo:** lo fija la matriz (§5). Un lote es Nivel 1; una Caja crítica también, salvo si es un
  cuello de botella algorítmico (Nivel 3). Un cambio de rumbo sigue siendo Nivel 2 o 4.

## Qué es

Una app de viajes **personal**, como la App de avisos: el mapamundi de Vicente en su teléfono, con un pincho en cada
lugar donde estuvo, sus fotos y su relato. No es un negocio ni una red social abierta. Nombre: «Mundi».

**Objetivo:** tener ese mapa de verdad en el teléfono, con lo que se añade guardado y privado. Se construye ya
(decisión del 12/10). Detalle en `docs/contexto.md`, punto 2.

## Cajas de este proyecto

Orden aprobado: BD → lote de Fotos, Cáscara PWA y Documentación → Mapa → Interfaz. Los Contratos, en
`docs/contratos.md`. `demo/mundi.html` es el prototipo de referencia para el diseño, no código de producción.

| Caja | Tipo | Ficheros | Contrato |
|---|---|---|---|
| BD | crítica | `setup/migraciones/` y su prueba `setup/pruebas/bd.md` | «BD» de `docs/contratos.md` |
| Fotos | lote | `fotos.js` y su prueba `setup/pruebas/fotos.test.mjs` | «Fotos» |
| Cáscara PWA | lote | `sw.js`, `manifest.webmanifest` e `icons/` (dibujados con `setup/iconos.py`) | «Cáscara PWA» |
| Documentación | lote | `README.md` y `_config.yml` (lo que no se publica en Pages) | — |
| Mapa | crítica | `mapa.js`, su prueba `setup/pruebas/mapa.test.mjs` y la página `setup/pruebas/mapa.html` | «Mapa» |
| Interfaz | crítica | `index.html`, `app.js`, `style.css`, `config.js` y los datos de ejemplo `setup/pruebas/datos-ejemplo.js` | «Interfaz» |

**Lotes (C.C.D. §6):** son críticas toda migración o cambio de RLS o del almacén, el mapa y lo que toque la sesión o
los datos; la documentación, la cáscara PWA y los ajustes de estilo pueden ir en lote.

## Qué no hacer

- **No programar ninguna Caja sin su Contrato aprobado** por Vicente.
- **No publicar la app ni compartir la demo** sin su orden. La demo publicada es privada.
- **Lo que se guarda es privado:** cada pincho y cada foto, solo de su dueño. Hoy el único usuario es Vicente.
- **El proyecto de Supabase es el de la App de avisos:** no tocar sus tablas, funciones, políticas ni almacenes. Lo de
  Mundi lleva siempre el prefijo `mundi`.
- **Mundi comparte dominio con la App de avisos** (`pvicen.github.io`): la sesión va con su propia clave
  (`mundi-sesion`), «Salir» cierra solo la de este dispositivo (`scope: "local"`) y `sw.js` solo toca cachés
  `mundi-`. No cambiar nada de eso.
- **No ejecutar SQL ni desplegar.** Lo hace Vicente desde el panel de Supabase: se le deja el archivo y los pasos. Toda
  migración va en `setup/migraciones/` y se puede ejecutar dos veces.
- **Quitar el GPS (EXIF) de las fotos** antes de subirlas: toda foto pasa por `prepararFoto` de `fotos.js`.
- **No añadir build ni librerías sueltas.** Las de CDN, con versión fijada. Si cambia un fichero de la cáscara o una
  URL de CDN, sube el número de `CACHE` en `sw.js`.
- **No usar `innerHTML` con datos** de la base: nodos de texto y `textContent`.
- **No poner fotos ni datos personales reales en el repo** ni en la demo: los ejemplos son inventados.
- **No comprar, contratar ni registrar nada**: dominios, planes de pago, cuentas de desarrollador.
- **No pedir ni escribir contraseñas, claves ni tokens**, ni en el chat ni en archivos. Los secretos, fuera del repo.
- **No hacer push ni merge sin su orden.**
- **No tocar otros proyectos de `C:\Dev`.** La App de avisos sirve de referencia técnica: se lee, no se cambia.

## Dónde mirar

- `docs/contexto.md` — la idea, el objetivo, la demo, la técnica decidida y lo pendiente.
  **Leerlo entero antes de empezar.**
- `docs/contratos.md` — los Contratos entre Cajas.
- `README.md` — el estado de cada parte y cómo está hecha.
- `demo/mundi.html` — la fuente de la demo publicada (enlace en `docs/contexto.md`).
- `DEUDA_TECNICA.md` — errores no críticos anotados.

## Ejecutar y verificar

La BD: Vicente ejecuta la migración en el SQL Editor de Supabase y después el bloque de `setup/pruebas/bd.md`, que lo
deshace todo al terminar; tiene que salir todo PASA.

Vista previa local: configuración `mundi` de `C:\Dev\.claude\launch.json` (puerto 8126, http://localhost:8126/).
Gate mínimo antes de commitear:

```powershell
node --check app.js; node --check config.js; node --check fotos.js; node --check mapa.js; node --check sw.js; node --test
```

y abrir la vista previa sin errores en la consola. Lo que solo existe en el navegador (el lienzo de las fotos, el
service worker, el dibujo y los toques del mapa, la app entera) se prueba allí, con datos inventados, a 375 px y en
escritorio, en claro y en oscuro: el mapa en http://localhost:8126/setup/pruebas/mapa.html y la app en
http://localhost:8126/?ejemplo (sin Supabase; las opciones, en la cabecera de `setup/pruebas/datos-ejemplo.js`).
Sin la cuenta de Vicente no se prueba contra Supabase: eso lo hace él.

La demo es una sola página. Para verla en local hay que servirla envuelta en `<!doctype html>` con la meta viewport, a
375 px y en escritorio, en claro y en oscuro, sin errores en la consola. Para actualizar la versión publicada, se
publica el mismo archivo con la URL de `docs/contexto.md`.
