# Contexto de Mundi

Proyecto creado el 12/10/2026 a partir de una idea que le dieron a Vicente, desde la sesión de Claude en `C:\Dev`.
Recoge lo decidido, lo propuesto y lo pendiente. Lo «propuesto» no está decidido hasta que Vicente lo diga.

## 1. Vicente

- Chileno. Estudia 2.º de Ingeniería Civil en la UCAM (Murcia, España).
- Llamarle **Vicente**. Él decide: sus precisiones numeradas mandan. Quiere la opinión objetiva, explicada antes de
  escribir nada, y respuestas cortas.
- **Tiempo:** parciales del 30/10 al 17/12. Aun así, decidió hacer la app ya (12/10).

## 2. El objetivo

**Una app personal, como la App de avisos: el mapamundi de viajes de Vicente en su teléfono, con un pincho en cada
lugar donde estuvo, sus fotos y su relato, guardado de verdad.**

- **Es personal, no un negocio** (corrección de Vicente del 12/10: «es personal para mí, como lo es la App de
  avisos»). Del primer planteamiento queda descartado: validar con 20 personas, financiarla con el póster impreso,
  distinguirse de Polarsteps, la comunidad de desconocidos con su moderación y registrar el nombre.
- **La idea** (12/10, tal como la contó Vicente): una app de viajes con el mundo como un mapamundi. Como el mapa de
  papel en la pared al que se le clavan pinchos en los lugares donde uno estuvo, pero virtual y con las fotos de cada
  lugar. Para teléfono.
- **Cuándo:** ya (decisión del 12/10).

## 3. La demo (HECHA el 12/10)

- **Publicada (privada):** https://claude.ai/artifact/HiuRaN6nXihPoFMN4UG1SS. Solo la ve Vicente hasta que la comparta
  desde el menú «Compartir» de la página.
- **Fuente:** `demo/mundi.html`, una sola página HTML. Al publicarse se envuelve en un esqueleto; para verla en local
  hace falta servirla con `<!doctype html>` y la meta viewport.
- **Qué hace:**
  - Mapamundi (proyección Natural Earth con d3 v7.9.0, topojson 3.0.2 y la geometría de `datamaps.world` 0.5.9, todo
    desde cdnjs).
  - **Mis viajes:** pinchos rojos y países visitados pintados. Al tocar un pincho se abren sus fotos, la fecha, las
    coordenadas y el relato. Los pinchos cercanos se agrupan con un número y se separan al acercar.
  - **Añadir (+):** buscar una ciudad (30 en la lista) o tocar el punto en el mapa, que detecta el país; nombre, mes,
    fotos del teléfono, texto, quién lo ve (todos, amigos o solo yo) y «ubicación aproximada», que redondea a un
    decimal.
  - **Perfil:** países sobre 195, el lugar más lejos de casa y la lista de países.
  - **Comunidad, Explorar y el póster «Próximamente»** venían del planteamiento de red social y negocio.
- **Límites de la demo:**
  - los viajeros y sus fotos son inventados, y las fotos son dibujos SVG;
  - lo que se añade vive en memoria hasta recargar y no se envía a nadie;
  - el mapa es de baja resolución: algunas islas pequeñas no salen, y Santorini cae en el mar.
- Comprobada el 12/10 en móvil (375 px) y en escritorio, en claro y en oscuro: sin errores en la consola y sin
  desbordar.

## 4. Opinión dada (12/10)

- Como app personal está claramente a su alcance: es casi lo mismo que la App de avisos (`C:\Dev\App de avisos`),
  Supabase con cuentas, almacenamiento de fotos y permisos por fila.
- Aunque sea personal, se cuida la ubicación: las fotos se suben sin el GPS (EXIF).
- La opinión sobre el negocio (competencia de Polarsteps, conseguir usuarios, moderar, el póster) decayó al pasar a ser
  personal.

## 5. Técnica (decidida el 12/10)

Vicente: «soy solo yo, y sigo lo que recomiendas y propones».

- **Solo para Vicente:** cada pincho es de su dueño y nadie más lo ve.
- Una web instalable (PWA) para teléfono, sin build, como la App de avisos.
- **Supabase: el mismo proyecto que la App de avisos**, con tablas, función y almacén propios con el prefijo `mundi`.
  Motivo: el plan gratuito pausa un proyecto tras una semana sin uso y la App de avisos lo mantiene activo; además,
  la cuenta ya existe. A cambio, comparten el 1 GB gratis de almacenamiento.
- Fotos: comprimirlas en el teléfono y **quitarles el GPS (EXIF)** antes de subirlas.
- El mapa: el mismo enfoque de la demo (d3 con Natural Earth), con una geometría de más resolución.
- Publicación: repositorio público `Pvicen/mundi` en GitHub Pages. El código es público; los datos y las fotos, privados
  en Supabase.
- **Cajas, en este orden:** BD (crítica) → lote de Fotos, Cáscara PWA y Documentación → Mapa (crítica) → Interfaz
  (crítica).

## 6. Estado y pendiente

- **12/10:** BD hecha y ejecutada en Supabase (`mundi_bd` = PASA, acceso solo para Vicente); lote de Fotos, Cáscara
  PWA y Documentación hecho. Siguen el Mapa y la Interfaz. El estado de cada parte está en `README.md`.
- Pendiente de Vicente: verificar cada Caja al terminarla y ejecutar el SQL en Supabase. Lo que tenga que pegar se
  le da completo y ya rellenado.
