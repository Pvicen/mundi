// Pruebas de la Caja Puente (puente.js): el texto que se comparte con la App de avisos.
// Se ejecutan con `node --test` desde la raíz del repo. Solo datos inventados.
import { test } from "node:test";
import assert from "node:assert/strict";
import { enlaceMapa, textoCompartir } from "../../puente.js";

test("dos líneas: el nombre y el enlace de Google Maps", () => {
  assert.equal(
    textoCompartir({ nombre: "Museo del Prado", lat: 40.4138, lon: -3.6921 }),
    "Museo del Prado\nhttps://maps.google.com/?q=40.413800,-3.692100"
  );
});

test("punto decimal, 6 decimales y sin espacios, también en el hemisferio sur y al oeste", () => {
  assert.equal(enlaceMapa(-33.4489, -70.6693), "https://maps.google.com/?q=-33.448900,-70.669300");
  assert.equal(enlaceMapa(0, 0), "https://maps.google.com/?q=0.000000,0.000000");
  assert.equal(enlaceMapa(36.39321234, 25.46159876), "https://maps.google.com/?q=36.393212,25.461599");
  assert.doesNotMatch(enlaceMapa(40.5, -3.5), /\s|,.*,/);
});

test("el nombre va en una sola línea y nunca vacío", () => {
  assert.equal(textoCompartir({ nombre: "  Casa\nde  la abuela ", lat: 1, lon: 2 }).split("\n")[0], "Casa de la abuela");
  assert.equal(textoCompartir({ nombre: "   ", lat: 1, lon: 2 }).split("\n")[0], "Lugar");
  assert.equal(textoCompartir({ lat: 1, lon: 2 }).split("\n").length, 2);
});

test("coordenadas no válidas", () => {
  assert.throws(() => enlaceMapa(91, 0), RangeError);
  assert.throws(() => enlaceMapa(0, Number.NaN), RangeError);
});
