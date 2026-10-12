// Pruebas de la Caja Copia (copia.js): el CRC-32, el ZIP (leído de vuelta con un lector mínimo) y los nombres.
// Se ejecutan con `node --test` desde la raíz del repo. Solo datos inventados.
import { test } from "node:test";
import assert from "node:assert/strict";
import { crc32, crearZip, nombreSeguro } from "../../copia.js";

const bytes = (t) => new TextEncoder().encode(t);

// Lector mínimo de ZIP «store»: recorre el directorio central y saca nombre, datos y CRC de cada archivo
function leerZip(zip) {
  const v = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
  const fin = zip.length - 22;
  assert.equal(v.getUint32(fin, true), 0x06054b50, "fin del directorio central");
  const total = v.getUint16(fin + 10, true);
  let p = v.getUint32(fin + 16, true);
  const archivos = [];
  for (let n = 0; n < total; n++) {
    assert.equal(v.getUint32(p, true), 0x02014b50, "cabecera central");
    const flags = v.getUint16(p + 8, true);
    const metodo = v.getUint16(p + 10, true);
    const crc = v.getUint32(p + 16, true);
    const tam = v.getUint32(p + 24, true);
    const largoNombre = v.getUint16(p + 28, true);
    const local = v.getUint32(p + 42, true);
    const nombre = new TextDecoder().decode(zip.subarray(p + 46, p + 46 + largoNombre));
    assert.equal(v.getUint32(local, true), 0x04034b50, "cabecera local");
    const inicio = local + 30 + v.getUint16(local + 26, true) + v.getUint16(local + 28, true);
    archivos.push({ nombre, flags, metodo, crc, datos: zip.subarray(inicio, inicio + tam) });
    p += 46 + largoNombre;
  }
  return archivos;
}

test("crc32 con valores conocidos", () => {
  assert.equal(crc32(bytes("")), 0);
  assert.equal(crc32(bytes("123456789")), 0xcbf43926);
  assert.equal(crc32(bytes("The quick brown fox jumps over the lazy dog")), 0x414fa339);
});

test("el ZIP se lee de vuelta: nombres UTF-8, método store, datos y CRC", () => {
  const foto = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 0xff, 0xd9]);
  const zip = crearZip([
    { nombre: "lugares.json", datos: '{"version":1}' },
    { nombre: "fotos/001-Valparaíso/1.jpg", datos: foto },
    { nombre: "LEEME.txt", datos: "" },
  ], new Date(2026, 9, 12, 18, 30, 10));
  const leidos = leerZip(zip);
  assert.deepEqual(leidos.map((a) => a.nombre), ["lugares.json", "fotos/001-Valparaíso/1.jpg", "LEEME.txt"]);
  for (const a of leidos) {
    assert.equal(a.metodo, 0);
    assert.equal(a.flags & 0x0800, 0x0800);
    assert.equal(a.crc, crc32(a.datos));
  }
  assert.equal(new TextDecoder().decode(leidos[0].datos), '{"version":1}');
  assert.deepEqual([...leidos[1].datos], [...foto]);
  assert.equal(leidos[2].datos.length, 0);
});

test("un ZIP vacío es solo el fin del directorio", () => {
  const zip = crearZip([]);
  assert.equal(zip.length, 22);
  assert.deepEqual(leerZip(zip), []);
});

test("nombreSeguro quita lo que no vale en un nombre de archivo", () => {
  assert.equal(nombreSeguro("Valparaíso"), "Valparaíso");
  assert.equal(nombreSeguro('a/b\\c:d*e?f"g<h>i|j'), "a b c d e f g h i j");
  assert.equal(nombreSeguro("  ..Oia.  "), "Oia");
  assert.equal(nombreSeguro("x".repeat(80)).length, 60);
  assert.equal(nombreSeguro("///"), "lugar");
  assert.equal(nombreSeguro(null), "lugar");
  assert.equal(nombreSeguro("línea\nnueva"), "línea nueva");
});
