// Pruebas de setup/limites.mjs, el que prepara datos/limites.json a partir de Natural Earth.
// Se ejecutan con `node --test` desde la raíz del repo.
import { test } from "node:test";
import assert from "node:assert/strict";
import { CLASES, prepararLimites, simplificar } from "../limites.mjs";
import { capasDeLimites } from "../../mapa.js";

test("simplificar: conserva los extremos y quita lo que no se aparta", () => {
  const recta = [[0, 0], [1, 0.0001], [2, 0], [3, 0]];
  assert.deepEqual(simplificar(recta, 0.01), [[0, 0], [3, 0]]);
  const pico = [[0, 0], [1, 1], [2, 0]];
  assert.deepEqual(simplificar(pico, 0.01), pico);
  assert.deepEqual(simplificar([[5, 5]], 0.01), [[5, 5]]);
});

test("prepararLimites: solo las clases de límites, por país y nivel, y se lee igual con capasDeLimites", () => {
  const pieza = (clase, pais, z, coordinates, type = "LineString") =>
    ({ type: "Feature", properties: { FEATURECLA: clase, ADM0_A3: pais, MIN_ZOOM: z }, geometry: { type, coordinates } });
  const salida = prepararLimites({
    features: [
      pieza("Admin-1 boundary", "CHL", 6, [[-70.6501, -33.4499], [-70.5, -33.5]]),
      pieza("Admin-1 region boundary", "ESP", 6.7, [[[-3, 40], [-2.5, 40.5]], [[1, 41], [1.5, 41.2]]], "MultiLineString"),
      pieza("Admin-1 boundary", "ESP", 8, [[-4, 38], [-4.2, 38.1]]),
      pieza("Admin-1 statistical meta bounds", "GBR", 10, [[0, 50], [1, 51]]), // un marco: fuera
      pieza("Admin-1 boundary", "PRT", 8, [[-9, 39], [-9, 39]]), // un solo punto en realidad: fuera
      { type: "Feature", properties: { FEATURECLA: "Admin-1 boundary", ADM0_A3: "YEM", MIN_ZOOM: 8 }, geometry: null },
    ],
  });
  assert.equal(salida.tipo, "limites.v1");
  assert.deepEqual(salida.paises.map((p) => p.pais), ["CHL", "ESP"]);
  assert.deepEqual(salida.paises[0].niveles, [{ z: 6, lineas: [[-70650, -33450, 150, -50]] }]);
  assert.deepEqual(salida.paises[1].niveles.map((n) => [n.z, n.lineas.length]), [[6.7, 2], [8, 1]]);
  const capas = capasDeLimites(salida);
  assert.deepEqual(capas.map((c) => c.clave), ["CHL:6", "ESP:6.7", "ESP:8"]);
  assert.deepEqual(capas[0].geo.coordinates, [[[-70.65, -33.45], [-70.5, -33.5]]]);
  assert.ok(CLASES.has("Admin-1 boundary") && !CLASES.has("Admin-1 statistical meta bounds"));
});
