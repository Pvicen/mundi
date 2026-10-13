// Pruebas de la Caja Mapa (mapa.js) que se pueden hacer en Node: la tabla de códigos de país y los grupos de
// pinchos. El dibujo, el zoom y los toques solo existen en el navegador: se prueban con setup/pruebas/mapa.html.
// Se ejecutan con `node --test` desde la raíz del repo.
import { test } from "node:test";
import assert from "node:assert/strict";
import { ISO, SIN_CODIGO, alfa2, agrupar, crearMapa, formaValida, RADIO_GRUPO } from "../../mapa.js";

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
