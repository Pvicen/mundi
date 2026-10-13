// Pruebas de la Caja Fotos (fotos.js) que se pueden hacer en Node: las medidas finales y el rechazo de lo que no es
// un archivo. La parte del lienzo (girar, comprimir y quitar el EXIF) solo existe en el navegador y se comprueba allí.
// Se ejecutan con `node --test` desde la raíz del repo.
import { test } from "node:test";
import assert from "node:assert/strict";
import { medidasDestino, prepararFoto, LADO_MAXIMO, LADO_MINIATURA } from "../../fotos.js";

test("el lado mayor se queda en 1600 y se conserva la proporción", () => {
  assert.equal(LADO_MAXIMO, 1600);
  assert.deepEqual(medidasDestino(4000, 3000), { ancho: 1600, alto: 1200 });
  assert.deepEqual(medidasDestino(3000, 4000), { ancho: 1200, alto: 1600 });
  assert.deepEqual(medidasDestino(4032, 3024), { ancho: 1600, alto: 1200 });
  assert.deepEqual(medidasDestino(2000, 2000), { ancho: 1600, alto: 1600 });
});

test("una foto pequeña no se amplía", () => {
  assert.deepEqual(medidasDestino(800, 600), { ancho: 800, alto: 600 });
  assert.deepEqual(medidasDestino(1600, 900), { ancho: 1600, alto: 900 });
});

test("las medidas son enteras y nunca bajan de 1 px", () => {
  assert.deepEqual(medidasDestino(4001, 2999), { ancho: 1600, alto: 1199 });
  assert.deepEqual(medidasDestino(10000, 1000), { ancho: 1600, alto: 160 });
  assert.deepEqual(medidasDestino(20000, 10), { ancho: 1600, alto: 1 });
});

test("otro máximo y el de la miniatura", () => {
  assert.deepEqual(medidasDestino(1000, 500, 400), { ancho: 400, alto: 200 });
  assert.equal(LADO_MINIATURA, 240);
  assert.deepEqual(medidasDestino(1600, 1200, LADO_MINIATURA), { ancho: 240, alto: 180 });
});

test("medidas no válidas", () => {
  assert.throws(() => medidasDestino(0, 100), RangeError);
  assert.throws(() => medidasDestino(100, -1), RangeError);
  assert.throws(() => medidasDestino(Number.NaN, 100), RangeError);
});

test("prepararFoto rechaza lo que no es un archivo", async () => {
  await assert.rejects(prepararFoto("foto.jpg"), TypeError);
  await assert.rejects(prepararFoto(null), TypeError);
});
