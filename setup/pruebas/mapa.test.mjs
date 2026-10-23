// Pruebas de la Caja Mapa (mapa.js) que se pueden hacer en Node: la tabla de códigos de país y los grupos de
// pinchos. El dibujo, el zoom y los toques solo existen en el navegador: se prueban con setup/pruebas/mapa.html.
// Se ejecutan con `node --test` desde la raíz del repo.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ISO, SIN_CODIGO, alfa2, agrupar, agruparPorPais, capasDeLimites, crearMapa, decodificarLinea, formaValida,
  nombrePais, opacidadLimite, RADIO_GRUPO, URL_LIMITES, ZOOM_PAISES, zoomWeb,
} from "../../mapa.js";

test("la tabla ISO: numérico de 3 cifras → alfa-2 en mayúsculas, sin repetidos", () => {
  const claves = Object.keys(ISO);
  const valores = Object.values(ISO);
  assert.equal(claves.length, 249);
  for (const c of claves) assert.match(c, /^\d{3}$/);
  for (const v of valores) assert.match(v, /^[A-Z]{2}$/);
  assert.equal(new Set(valores).size, valores.length);
});

test("algunos países conocidos", () => {
  const esperados = {
    "724": "ES", "152": "CL", "826": "GB", "840": "US", "250": "FR", "300": "GR", "392": "JP", "076": "BR",
    "032": "AR", "484": "MX", "620": "PT", "380": "IT", "276": "DE", "604": "PE", "858": "UY", "036": "AU",
  };
  for (const [numerico, codigo] of Object.entries(esperados)) assert.equal(ISO[numerico], codigo, numerico);
});

test("alfa2 de un país de world-atlas", () => {
  assert.equal(alfa2({ id: "724", properties: { name: "Spain" } }), "ES");
  assert.equal(alfa2({ properties: { name: "Kosovo" } }), "XK");
  assert.equal(alfa2({ id: undefined, properties: { name: "N. Cyprus" } }), "CY");
  assert.equal(alfa2({ id: "999", properties: { name: "Inventado" } }), null);
  assert.equal(alfa2(undefined), null);
  for (const v of Object.values(SIN_CODIGO)) assert.match(v, /^[A-Z]{2}$/);
});

test("agrupar: los cercanos van juntos, en su punto medio", () => {
  const a = { id: "a" }, b = { id: "b" }, c = { id: "c" };
  const grupos = agrupar([
    { x: 100, y: 100, pincho: a },
    { x: 110, y: 100, pincho: b },
    { x: 300, y: 300, pincho: c },
  ]);
  assert.equal(grupos.length, 2);
  const juntos = grupos.find((g) => g.pinchos.length === 2);
  assert.deepEqual(juntos.pinchos.map((p) => p.id).sort(), ["a", "b"]);
  assert.equal(juntos.x, 105);
  assert.equal(juntos.y, 100);
  assert.deepEqual(grupos.find((g) => g.pinchos.length === 1).pinchos, [c]);
});

test("agrupar: justo en el radio ya no se juntan; sin puntos, sin grupos", () => {
  assert.equal(RADIO_GRUPO, 24);
  assert.equal(agrupar([{ x: 0, y: 0, pincho: 1 }, { x: 24, y: 0, pincho: 2 }]).length, 2);
  assert.equal(agrupar([{ x: 0, y: 0, pincho: 1 }, { x: 23.9, y: 0, pincho: 2 }]).length, 1);
  assert.deepEqual(agrupar([]), []);
});

test("crearMapa rechaza lo que no es un elemento", async () => {
  await assert.rejects(crearMapa(null), TypeError);
});

test("formaValida: solo contornos que se pueden dibujar", () => {
  const anillo = [[-3.8, 40.3], [-3.6, 40.3], [-3.6, 40.5], [-3.8, 40.3]];
  assert.equal(formaValida({ type: "Polygon", coordinates: [anillo] }), true);
  assert.equal(formaValida({ type: "MultiPolygon", coordinates: [[anillo], [anillo]] }), true);
  // Los que encontró la revisión: sin coordenadas y con un polígono nulo
  assert.equal(formaValida({ type: "Polygon" }), false);
  assert.equal(formaValida({ type: "MultiPolygon", coordinates: [null] }), false);
  assert.equal(formaValida({ type: "Polygon", coordinates: [] }), false);
  assert.equal(formaValida({ type: "Polygon", coordinates: [anillo.slice(0, 3)] }), false);
  assert.equal(formaValida({ type: "Polygon", coordinates: [[["a", 1], [1, 1], [1, 2], ["a", 1]]] }), false);
  assert.equal(formaValida({ type: "Polygon", coordinates: [[[200, 1], [1, 1], [1, 2], [200, 1]]] }), false);
  assert.equal(formaValida({ type: "Point", coordinates: [1, 2] }), false);
  assert.equal(formaValida(null), false);
});

test("agruparPorPais: un punto por país, en el lugar suyo más céntrico; sin país, cada uno solo", () => {
  const p = (id, pais) => ({ id, pais });
  const grupos = agruparPorPais([
    { x: 0, y: 0, pincho: p("m", "ES") },
    { x: 10, y: 0, pincho: p("b", "ES") },
    { x: 60, y: 0, pincho: p("s", "ES") },
    { x: 300, y: 300, pincho: p("v", "CL") },
    { x: 500, y: 500, pincho: p("mar1", null) },
    { x: 700, y: 700, pincho: p("mar2", undefined) },
  ]);
  assert.equal(grupos.length, 4);
  const es = grupos.find((g) => g.pais === "ES");
  assert.deepEqual(es.pinchos.map((x) => x.id), ["m", "b", "s"]);
  // La media es x = 23,3: el más cercano es «b» (x = 10), no la media, para que el punto caiga en un lugar de verdad
  assert.deepEqual([es.x, es.y], [10, 0]);
  assert.equal(grupos.find((g) => g.pais === "CL").pinchos.length, 1);
  assert.equal(grupos.filter((g) => g.pais === null).length, 2);
});

test("agruparPorPais: dos países que quedan encima se juntan, sin nombre de país", () => {
  const grupos = agruparPorPais([
    { x: 100, y: 100, pincho: { id: "a", pais: "ES" } },
    { x: 110, y: 100, pincho: { id: "b", pais: "PT" } },
    { x: 400, y: 100, pincho: { id: "c", pais: "FR" } },
  ]);
  assert.equal(grupos.length, 2);
  const juntos = grupos.find((g) => g.pinchos.length === 2);
  assert.equal(juntos.pais, null);
  assert.deepEqual(juntos.pinchos.map((x) => x.id).sort(), ["a", "b"]);
  assert.deepEqual(agruparPorPais([]), []);
});

test("nombrePais: en español, y el código si no se conoce", () => {
  assert.equal(nombrePais("ES"), "España");
  assert.equal(nombrePais("CL"), "Chile");
  assert.equal(nombrePais("ZZZZ"), "ZZZZ");
});

test("zoomWeb: 256 px de mundo es el nivel 0; cada vez que se dobla, un nivel más", () => {
  assert.equal(zoomWeb(256, 1), 0);
  assert.equal(zoomWeb(1024, 2), 3);
  assert.equal(zoomWeb(512, 0.5), 0);
});

test("decodificarLinea: milésimas de grado en diferencias → [lon, lat]", () => {
  assert.deepEqual(decodificarLinea([-70650, -33450, 150, -50, -25, 5]), [[-70.65, -33.45], [-70.5, -33.5], [-70.525, -33.495]]);
  assert.deepEqual(decodificarLinea([]), []);
});

test("capasDeLimites: una capa por país y nivel; lo que no cuadra se ignora", () => {
  const capas = capasDeLimites({
    tipo: "limites.v1",
    paises: [
      { pais: "ESP", niveles: [{ z: 6.7, lineas: [[-3000, 40000, 100, 100], [1, 2]] }, { z: 8, lineas: [[0, 0, 1, 1]] }] },
      { pais: "MAL", niveles: [{ z: 6, lineas: [[999000, 0, 1, 1]] }] }, // fuera de rango
      { pais: "SIN", niveles: [{ z: "6", lineas: [[0, 0, 1, 1]] }] }, // z que no es número
      { niveles: [] }, // sin país
    ],
  });
  assert.deepEqual(capas.map((c) => c.clave), ["ESP:6.7", "ESP:8"]);
  assert.deepEqual(capas[0].geo, { type: "MultiLineString", coordinates: [[[-3, 40], [-2.9, 40.1]]] });
  assert.deepEqual(capasDeLimites({ tipo: "otro", paises: [] }), []);
  assert.deepEqual(capasDeLimites(null), []);
});

test("opacidadLimite: de lejos nada; al acercar, cada capa entra poco a poco hasta verse entera", () => {
  assert.equal(opacidadLimite(2, 10, ZOOM_PAISES - 0.01), 0); // de lejos, solo los países
  assert.equal(opacidadLimite(2, 10, ZOOM_PAISES), 0); // justo en el umbral, aún nada
  assert.equal(opacidadLimite(2, 10, ZOOM_PAISES * 2), 1);
  assert.equal(opacidadLimite(8, 5, 50), 0); // nivel 8: con zoom web 5 todavía no le toca (sale en el 6)
  assert.ok(opacidadLimite(8, 6.3, 50) > 0 && opacidadLimite(8, 6.3, 50) < 1); // entrando
  assert.equal(opacidadLimite(8, 7, 50), 1);
});

test("el fichero de límites de la app (datos/limites.json) es limites.v1 y trae los países de los viajes", async () => {
  const { readFile } = await import("node:fs/promises");
  const datos = JSON.parse(await readFile(new URL(URL_LIMITES)));
  const capas = capasDeLimites(datos);
  assert.ok(datos.paises.length > 150);
  // Lo que se ignora al leerlo sería un fichero mal hecho: todas las capas del fichero tienen que servir
  assert.equal(capas.length, datos.paises.reduce((s, p) => s + p.niveles.length, 0));
  const niveles = (pais) => capas.filter((c) => c.pais === pais).map((c) => c.z);
  assert.deepEqual(niveles("ESP"), [6.7, 8]); // comunidades y, más cerca, provincias
  assert.deepEqual(niveles("CHL"), [6]); // regiones
  assert.ok(niveles("JPN").length >= 1 && niveles("PRT").length >= 1);
});
