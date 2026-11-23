// Genera datos/papel.json: el fondo «Papel» del mapa de Mundi (Contrato «Mapa» de docs/contratos.md).
// Parte del estilo `liberty` de OpenFreeMap (teselas de OpenStreetMap con el esquema OpenMapTiles) y le aplica lo que
// Vicente y su suegro aprobaron en prueba-mapa.html: los colores de Mundi, los nombres en español, las líneas grises
// de provincias y municipios al acercar y sin edificios en 3D. Las teselas, los iconos y las letras siguen viniendo de
// OpenFreeMap; el estilo queda fijo en el repo para que no cambie por sorpresa y lo guarde el service worker.
//
// Uso, desde la raíz del repo:
//   node setup/papel.mjs                 lo descarga de OpenFreeMap
//   node setup/papel.mjs liberty.json    desde un fichero ya descargado
import { readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

export const URL_LIBERTY = "https://tiles.openfreemap.org/styles/liberty";

// Los colores de «Papel» (los de prueba-mapa.html, aprobados el 23/11)
export const PAPEL = {
  fondo: "#F3EAD7", agua: "#CFDCCF", verde: "#DCE2C4", ciudad: "#EEE3CB", edificio: "#E6D8BC",
  calle: "#FFFBF2", borde: "#DCCDB0", autopista: "#E8C987", autopistaBorde: "#C9A15A",
  limite: "#A39A8E", texto: "#3B2F22", halo: "#F8F1E1",
};
export const OPACIDAD_RELIEVE = 0.18;

// Los nombres, en español si OpenStreetMap lo tiene; si no, en letras latinas; si no, el del sitio
export const NOMBRE = ["coalesce", ["get", "name:es"], ["get", "name:latin"], ["get", "name"]];
export const ID_LIMITES = "mm-limites-locales";

// Los créditos del mapa, fijos en el repo (los de OpenFreeMap, tal cual). MapLibre pone en la página como HTML los de
// cada fuente y, si la fuente no los trae, usa los del índice de teselas que manda el servidor; su filtro deja pasar
// código, así que lo que llegue de fuera nunca entra en la página
export const ATRIBUCION = '<a href="https://openfreemap.org" target="_blank">OpenFreeMap</a> '
  + '<a href="https://www.openmaptiles.org/" target="_blank">&copy; OpenMapTiles</a> '
  + 'Data from <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>';

// Qué propiedades de pintura admite cada tipo de capa: una que no vale invalidaría el estilo entero
const PREFIJOS = {
  background: ["background-"], raster: ["raster-"], fill: ["fill-"], line: ["line-"], symbol: ["text-", "icon-"],
  circle: ["circle-"], "fill-extrusion": ["fill-extrusion-"], hillshade: ["hillshade-"], heatmap: ["heatmap-"],
};

function poner(capa, propiedad, valor) {
  if (!(PREFIJOS[capa.type] ?? []).some((p) => propiedad.startsWith(p))) return;
  capa.paint = { ...(capa.paint ?? {}), [propiedad]: valor };
}

const usaNombre = (capa) =>
  capa.type === "symbol" && JSON.stringify(capa.layout?.["text-field"] ?? "").includes("name");

// Las líneas de provincias y municipios (niveles 5 a 8, sin las marítimas), grises y a trazos, desde el zoom 7
export const CAPA_LIMITES = {
  id: ID_LIMITES,
  type: "line",
  source: "openmaptiles",
  "source-layer": "boundary",
  minzoom: 7,
  filter: ["all", [">=", ["get", "admin_level"], 5], ["<=", ["get", "admin_level"], 8], ["!=", ["get", "maritime"], 1]],
  paint: {
    "line-color": PAPEL.limite,
    "line-width": ["interpolate", ["linear"], ["zoom"], 7, 0.6, 12, 1.4],
    "line-dasharray": [3, 2],
    "line-opacity": ["interpolate", ["linear"], ["zoom"], 7, 0.4, 10, 0.9],
  },
};

// liberty → «Papel». No toca el original. Un id de capa que no esté se ignora: el generador no se rompe si
// OpenFreeMap cambia algo, solo deja de recolorear esa capa.
export function aPapel(liberty, { origen = URL_LIBERTY, fecha = "" } = {}) {
  if (liberty?.version !== 8 || !Array.isArray(liberty.layers) || typeof liberty.sources !== "object") {
    throw new Error("No es un estilo de MapLibre (versión 8)");
  }
  const estilo = structuredClone(liberty);
  estilo.name = "Mundi Papel";
  estilo.metadata = { ...(estilo.metadata ?? {}), "mundi:origen": origen, "mundi:fecha": fecha };
  for (const fuente of Object.values(estilo.sources)) fuente.attribution = ATRIBUCION;
  estilo.layers = estilo.layers.filter((c) => c.id !== "building-3d" && c.id !== ID_LIMITES);
  for (const capa of estilo.layers) {
    const id = String(capa.id);
    if (usaNombre(capa)) capa.layout = { ...capa.layout, "text-field": NOMBRE };
    if (capa.type === "background") poner(capa, "background-color", PAPEL.fondo);
    else if (capa.type === "raster") poner(capa, "raster-opacity", OPACIDAD_RELIEVE);
    else if (id === "water") poner(capa, "fill-color", PAPEL.agua);
    else if (id.startsWith("waterway") && capa.type === "line") poner(capa, "line-color", PAPEL.agua);
    else if (/park|wood|grass|wetland|pitch|cemetery/.test(id) && capa.type === "fill") poner(capa, "fill-color", PAPEL.verde);
    else if (id === "landuse_residential") poner(capa, "fill-color", PAPEL.ciudad);
    else if (id === "building") poner(capa, "fill-color", PAPEL.edificio);
    else if (capa.type === "line" && /motorway/.test(id) && /casing/.test(id)) poner(capa, "line-color", PAPEL.autopistaBorde);
    else if (capa.type === "line" && /motorway/.test(id)) poner(capa, "line-color", PAPEL.autopista);
    else if (capa.type === "line" && /casing/.test(id)) poner(capa, "line-color", PAPEL.borde);
    else if (capa.type === "line" && /^(road|bridge|tunnel)_/.test(id) && !/rail/.test(id)) poner(capa, "line-color", PAPEL.calle);
    else if (id.startsWith("boundary")) poner(capa, "line-color", PAPEL.limite);
    else if (capa.type === "symbol" && capa["source-layer"] === "place") {
      poner(capa, "text-color", PAPEL.texto);
      poner(capa, "text-halo-color", PAPEL.halo);
    }
  }
  // Las líneas locales van antes de los nombres de los ríos (o, si no está esa capa, antes del primer nombre)
  let i = estilo.layers.findIndex((c) => c.id === "waterway_line_label");
  if (i < 0) i = estilo.layers.findIndex((c) => c.type === "symbol");
  estilo.layers.splice(i < 0 ? estilo.layers.length : i, 0, structuredClone(CAPA_LIMITES));
  return estilo;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const archivo = process.argv[2];
  let liberty;
  if (archivo) {
    liberty = JSON.parse(await readFile(archivo, "utf8"));
  } else {
    const respuesta = await fetch(URL_LIBERTY);
    if (!respuesta.ok) throw new Error(`OpenFreeMap respondió ${respuesta.status}`);
    liberty = await respuesta.json();
  }
  const estilo = aPapel(liberty, { origen: URL_LIBERTY, fecha: new Date().toISOString().slice(0, 10) });
  await writeFile(new URL("../datos/papel.json", import.meta.url), JSON.stringify(estilo, null, 1) + "\n");
  console.log(`datos/papel.json: ${estilo.layers.length} capas, ${Object.keys(estilo.sources).length} fuentes`);
}
