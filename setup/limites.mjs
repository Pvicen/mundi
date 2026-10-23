// Prepara `datos/limites.json`: las líneas grises de regiones y provincias que el mapa enseña al acercar.
// Fuente: Natural Earth 1:10 millones, «Admin 1 – States, Provinces» en líneas (dominio público), versión 5.1.2:
//   https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v5.1.2/geojson/ne_10m_admin_1_states_provinces_lines.geojson
// Uso:  node setup/limites.mjs <ruta del .geojson descargado> [tolerancia en grados, 0.004 por defecto]
// Simplifica cada línea (Douglas-Peucker), la guarda en milésimas de grado (~100 m) y la agrupa por país y por el zoom
// mínimo que Natural Earth propone para ella (MIN_ZOOM, en niveles de un mapa web). Formato: Contrato «Mapa» de
// docs/contratos.md (limites.v1).
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Las clases que son de verdad límites entre regiones; fuera quedan los marcos y los indicadores de los mapas
export const CLASES = new Set(["Admin-1 boundary", "Admin-1 region boundary", "Admin-1 statistical boundary"]);

// Distancia de p a la recta a-b (en grados, en el plano lon/lat)
function distancia(p, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const largo = dx * dx + dy * dy;
  if (largo === 0) return Math.hypot(p[0] - a[0], p[1] - a[1]);
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / largo));
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}

// Douglas-Peucker sin recursión: conserva los extremos y los puntos que se apartan más que `tolerancia`
export function simplificar(linea, tolerancia) {
  if (linea.length <= 2) return linea.slice();
  const guardar = new Uint8Array(linea.length);
  guardar[0] = guardar[linea.length - 1] = 1;
  const pila = [[0, linea.length - 1]];
  while (pila.length) {
    const [i, j] = pila.pop();
    let max = -1, k = -1;
    for (let m = i + 1; m < j; m++) {
      const d = distancia(linea[m], linea[i], linea[j]);
      if (d > max) { max = d; k = m; }
    }
    if (max > tolerancia) { guardar[k] = 1; pila.push([i, k], [k, j]); }
  }
  return linea.filter((_, n) => guardar[n]);
}

// De las piezas de Natural Earth a { tipo, fuente, paises: [{ pais, niveles: [{ z, lineas }] }] }. Cada línea va en
// milésimas de grado y en diferencias: [lon0, lat0, dlon1, dlat1, …] (cada lon es la suma de los anteriores / 1000)
export function prepararLimites(geojson, tolerancia = 0.004) {
  const paises = new Map();
  for (const f of geojson.features ?? []) {
    const g = f.geometry, p = f.properties ?? {};
    if (!g || !CLASES.has(p.FEATURECLA) || !Number.isFinite(p.MIN_ZOOM) || !p.ADM0_A3) continue;
    const lineas = g.type === "LineString" ? [g.coordinates] : g.type === "MultiLineString" ? g.coordinates : [];
    const z = Math.round(p.MIN_ZOOM * 10) / 10;
    for (const linea of lineas) {
      const codificada = [];
      let x = null, y = null;
      for (const [lon, lat] of simplificar(linea, tolerancia)) {
        const nx = Math.round(lon * 1000), ny = Math.round(lat * 1000);
        if (nx === x && ny === y) continue;
        codificada.push(x === null ? nx : nx - x, y === null ? ny : ny - y);
        x = nx; y = ny;
      }
      if (codificada.length < 4) continue;
      if (!paises.has(p.ADM0_A3)) paises.set(p.ADM0_A3, new Map());
      const niveles = paises.get(p.ADM0_A3);
      if (!niveles.has(z)) niveles.set(z, []);
      niveles.get(z).push(codificada);
    }
  }
  return {
    tipo: "limites.v1",
    fuente: "Natural Earth 1:10m admin-1 lines v5.1.2 (dominio público)",
    paises: [...paises.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([pais, niveles]) => ({
      pais,
      niveles: [...niveles.entries()].sort((a, b) => a[0] - b[0]).map(([z, lineas]) => ({ z, lineas })),
    })),
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const [ruta, tol] = process.argv.slice(2);
  if (!ruta) {
    console.error("Uso: node setup/limites.mjs <ne_10m_admin_1_states_provinces_lines.geojson> [tolerancia]");
    process.exit(1);
  }
  const salida = prepararLimites(JSON.parse(readFileSync(ruta, "utf8")), tol ? Number(tol) : undefined);
  const texto = JSON.stringify(salida);
  const destino = join(dirname(fileURLToPath(import.meta.url)), "..", "datos", "limites.json");
  mkdirSync(dirname(destino), { recursive: true });
  writeFileSync(destino, texto);
  let puntos = 0;
  for (const p of salida.paises) for (const n of p.niveles) for (const l of n.lineas) puntos += l.length / 2;
  console.log(`${destino}: ${salida.paises.length} países, ${puntos} puntos, ` +
    `${(texto.length / 1024).toFixed(0)} KB (${(gzipSync(texto).length / 1024).toFixed(0)} KB comprimido)`);
}
