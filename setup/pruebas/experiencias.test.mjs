// Pruebas de experiencias.js: las mismas reglas que la base (mundi_experiencias_validas, en
// setup/migraciones/2026-10-23-compartir-y-experiencias.sql), la limpieza del formulario y el agrupado de la ficha.
// Se ejecutan con `node --test` desde la raíz del repo.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  TIPOS, agruparPorTipo, estrellas, experienciaValida, experienciasValidas, limpiarExperiencias, valoracionValida,
} from "../../experiencias.js";

test("los tipos son los cinco de la base, en orden", () => {
  assert.deepEqual(TIPOS.map((t) => t.id), ["comer", "dormir", "visitar", "hacer", "consejo"]);
});

test("experienciaValida: las mismas que rechaza la migración", () => {
  const malas = [
    {}, 1, null, [], { tipo: "comer" }, { tipo: "bailar", nombre: "x" }, { tipo: "comer", nombre: "   " },
    { tipo: "comer", nombre: "x", estrellas: 6 }, { tipo: "comer", nombre: "x", estrellas: 2.5 },
    { tipo: "comer", nombre: "x", texto: 3 }, { tipo: "comer", nombre: "x", otra: 1 },
    { tipo: "comer", nombre: "x".repeat(81) }, { tipo: "comer", nombre: "x", texto: "a".repeat(1001) },
  ];
  for (const m of malas) assert.equal(experienciaValida(m), false, JSON.stringify(m));
  assert.equal(experienciaValida({ tipo: "comer", nombre: "Café Turri", texto: "Vistas", estrellas: 4 }), true);
  assert.equal(experienciaValida({ tipo: "consejo", nombre: "Ir temprano", estrellas: null }), true);
  // Los emojis cuentan como un carácter, igual que en la base
  assert.equal(experienciaValida({ tipo: "comer", nombre: "🍣".repeat(80) }), true);
});

test("experienciasValidas: una lista de hasta 30", () => {
  const una = { tipo: "hacer", nombre: "Surf" };
  assert.equal(experienciasValidas([]), true);
  assert.equal(experienciasValidas(Array(30).fill(una)), true);
  assert.equal(experienciasValidas(Array(31).fill(una)), false);
  assert.equal(experienciasValidas({}), false);
  assert.equal(experienciasValidas([una, { tipo: "x", nombre: "y" }]), false);
});

test("valoracionValida: null o de 1 a 5", () => {
  for (const v of [null, 1, 3, 5]) assert.equal(valoracionValida(v), true, String(v));
  for (const v of [0, 6, 2.5, "3", undefined]) assert.equal(valoracionValida(v), false, String(v));
});

test("limpiarExperiencias: recorta, quita las vacías y pide nombre", () => {
  assert.deepEqual(limpiarExperiencias([
    { tipo: "comer", nombre: "  Café Turri ", texto: " Vistas ", estrellas: "4" },
    { tipo: "dormir", nombre: "", texto: "", estrellas: "" },
    { tipo: "consejo", nombre: "Ir temprano", texto: "", estrellas: "" },
  ]), { lista: [
    { tipo: "comer", nombre: "Café Turri", texto: "Vistas", estrellas: 4 },
    { tipo: "consejo", nombre: "Ir temprano" },
  ] });
  assert.match(limpiarExperiencias([{ tipo: "comer", nombre: " ", texto: "Rico", estrellas: "" }]).error, /nombre/);
  assert.match(limpiarExperiencias([{ tipo: "otra", nombre: "x", texto: "", estrellas: "" }]).error, /no se puede/);
  assert.deepEqual(limpiarExperiencias([]), { lista: [] });
});

test("agruparPorTipo: en el orden de los tipos y sin grupos vacíos", () => {
  const grupos = agruparPorTipo([
    { tipo: "consejo", nombre: "a" }, { tipo: "comer", nombre: "b" }, { tipo: "comer", nombre: "c" },
  ]);
  assert.deepEqual(grupos.map((g) => [g.tipo.id, g.items.map((x) => x.nombre)]), [["comer", ["b", "c"]], ["consejo", ["a"]]]);
  assert.deepEqual(agruparPorTipo(undefined), []);
});

test("estrellas: llenas y vacías hasta cinco", () => {
  assert.equal(estrellas(4), "★★★★☆");
  assert.equal(estrellas(null), "");
  assert.equal(estrellas(7), "");
});
