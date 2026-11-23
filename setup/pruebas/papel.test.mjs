// Pruebas del fondo «Papel»: el generador (setup/papel.mjs) y el estilo que vive en el repo (datos/papel.json).
// Se ejecutan con `node --test` desde la raíz del repo; no van a la red.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { CAPA_LIMITES, ID_LIMITES, NOMBRE, OPACIDAD_RELIEVE, PAPEL, aPapel } from "../papel.mjs";

// Un liberty de juguete con una capa de cada clase que toca el generador
const liberty = () => ({
  version: 8,
  name: "Liberty",
  sources: { openmaptiles: { type: "vector", url: "https://tiles.openfreemap.org/planet" } },
  layers: [
    { id: "background", type: "background", paint: { "background-color": "#ffffff" } },
    { id: "natural_earth", type: "raster", source: "ne2_shaded", paint: { "raster-opacity": 0.7 } },
    { id: "park", type: "fill", source: "openmaptiles", "source-layer": "park" },
    { id: "park_outline", type: "line", source: "openmaptiles", "source-layer": "park" },
    { id: "landuse_residential", type: "fill", source: "openmaptiles", "source-layer": "landuse" },
    { id: "waterway_river", type: "line", source: "openmaptiles", "source-layer": "waterway" },
    { id: "water", type: "fill", source: "openmaptiles", "source-layer": "water" },
    { id: "road_area_pattern", type: "fill", source: "openmaptiles", "source-layer": "transportation" },
    { id: "road_motorway_casing", type: "line", source: "openmaptiles", "source-layer": "transportation" },
    { id: "road_motorway", type: "line", source: "openmaptiles", "source-layer": "transportation" },
    { id: "road_minor_casing", type: "line", source: "openmaptiles", "source-layer": "transportation" },
    { id: "road_minor", type: "line", source: "openmaptiles", "source-layer": "transportation" },
    { id: "road_major_rail", type: "line", source: "openmaptiles", "source-layer": "transportation" },
    // Un icono antes de los nombres de los ríos, como en liberty: las líneas locales no van antes de él
    { id: "road_one_way_arrow", type: "symbol", source: "openmaptiles", "source-layer": "transportation",
      layout: { "icon-image": "arrow" } },
    { id: "building", type: "fill", source: "openmaptiles", "source-layer": "building" },
    { id: "building-3d", type: "fill-extrusion", source: "openmaptiles", "source-layer": "building" },
    { id: "boundary_2", type: "line", source: "openmaptiles", "source-layer": "boundary" },
    // Empieza por «boundary» pero no es una línea: no admite line-color
    { id: "boundary_label", type: "symbol", source: "openmaptiles", "source-layer": "boundary" },
    { id: "waterway_line_label", type: "symbol", source: "openmaptiles", "source-layer": "waterway",
      layout: { "text-field": ["coalesce", ["get", "name_en"], ["get", "name"]] } },
    { id: "poi_r1", type: "symbol", source: "openmaptiles", "source-layer": "poi", layout: { "icon-image": "x" } },
    { id: "label_city", type: "symbol", source: "openmaptiles", "source-layer": "place",
      layout: { "text-field": "{name:latin}" } },
  ],
});

const PREFIJO = { background: "background-", raster: "raster-", fill: "fill-", line: "line-", symbol: "text-" };

test("aPapel: los colores de Mundi, sin tocar el original", () => {
  const original = liberty();
  const copia = structuredClone(original);
  const papel = aPapel(original, { fecha: "2026-11-23" });
  assert.deepEqual(original, copia);
  const capa = (id) => papel.layers.find((c) => c.id === id);
  assert.equal(capa("background").paint["background-color"], PAPEL.fondo);
  assert.equal(capa("natural_earth").paint["raster-opacity"], OPACIDAD_RELIEVE);
  assert.equal(capa("park").paint["fill-color"], PAPEL.verde);
  assert.equal(capa("landuse_residential").paint["fill-color"], PAPEL.ciudad);
  assert.equal(capa("waterway_river").paint["line-color"], PAPEL.agua);
  assert.equal(capa("water").paint["fill-color"], PAPEL.agua);
  assert.equal(capa("road_motorway_casing").paint["line-color"], PAPEL.autopistaBorde);
  assert.equal(capa("road_motorway").paint["line-color"], PAPEL.autopista);
  assert.equal(capa("road_minor_casing").paint["line-color"], PAPEL.borde);
  assert.equal(capa("road_minor").paint["line-color"], PAPEL.calle);
  assert.equal(capa("road_major_rail").paint, undefined, "las vías del tren no son calles");
  assert.equal(capa("road_area_pattern").paint, undefined);
  assert.equal(capa("building").paint["fill-color"], PAPEL.edificio);
  assert.equal(capa("boundary_2").paint["line-color"], PAPEL.limite);
  assert.equal(capa("label_city").paint["text-color"], PAPEL.texto);
  assert.equal(capa("label_city").paint["text-halo-color"], PAPEL.halo);
  assert.equal(papel.name, "Mundi Papel");
  assert.equal(papel.metadata["mundi:fecha"], "2026-11-23");
});

test("aPapel: nombres en español, sin edificios en 3D y con las líneas locales antes de los nombres de los ríos", () => {
  const papel = aPapel(liberty());
  const ids = papel.layers.map((c) => c.id);
  assert.ok(!ids.includes("building-3d"));
  assert.equal(ids.indexOf(ID_LIMITES), ids.indexOf("waterway_line_label") - 1);
  assert.deepEqual(papel.layers.find((c) => c.id === ID_LIMITES), CAPA_LIMITES);
  assert.deepEqual(papel.layers.find((c) => c.id === "label_city").layout["text-field"], NOMBRE);
  assert.deepEqual(papel.layers.find((c) => c.id === "waterway_line_label").layout["text-field"], NOMBRE);
  assert.equal(papel.layers.find((c) => c.id === "poi_r1").layout["text-field"], undefined, "un icono sin nombre no cambia");
  // Una propiedad que no vale para el tipo de capa invalidaría el estilo entero
  for (const c of papel.layers) {
    for (const prop of Object.keys(c.paint ?? {})) {
      if (PREFIJO[c.type]) assert.ok(prop.startsWith(PREFIJO[c.type]), `${c.id}: ${prop}`);
    }
  }
});

test("aPapel: si faltan capas no se rompe; sin nombres de ríos, las líneas van antes del primer nombre", () => {
  const recortado = liberty();
  recortado.layers = recortado.layers.filter((c) => !["waterway_line_label", "water", "building"].includes(c.id));
  const ids = aPapel(recortado).layers.map((c) => c.id);
  assert.equal(ids[ids.indexOf(ID_LIMITES) + 1], "road_one_way_arrow");
  const sinNombres = { version: 8, sources: {}, layers: [{ id: "background", type: "background" }] };
  assert.deepEqual(aPapel(sinNombres).layers.map((c) => c.id), ["background", ID_LIMITES]);
  // Dos veces seguidas, una sola capa de líneas
  assert.equal(aPapel(aPapel(liberty())).layers.filter((c) => c.id === ID_LIMITES).length, 1);
  assert.throws(() => aPapel({ version: 7, layers: [] }), /versión 8/);
  assert.throws(() => aPapel(null), /versión 8/);
});

test("datos/papel.json: el estilo del repo es «Papel» de OpenFreeMap", async () => {
  const papel = JSON.parse(await readFile(new URL("../../datos/papel.json", import.meta.url), "utf8"));
  assert.equal(papel.version, 8);
  assert.equal(papel.name, "Mundi Papel");
  assert.equal(papel.metadata["mundi:origen"], "https://tiles.openfreemap.org/styles/liberty");
  assert.match(papel.metadata["mundi:fecha"], /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(papel.sources.openmaptiles.url, "https://tiles.openfreemap.org/planet");
  assert.match(papel.glyphs, /^https:\/\/tiles\.openfreemap\.org\/fonts\//);
  assert.match(papel.sprite, /^https:\/\/tiles\.openfreemap\.org\/sprites\//);
  const ids = papel.layers.map((c) => c.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(!ids.includes("building-3d"));
  assert.ok(ids.includes(ID_LIMITES));
  for (const id of ["water", "label_country_1", "label_city", "label_town", "label_village", "label_other"]) {
    assert.ok(ids.includes(id), id);
  }
  assert.equal(papel.layers.find((c) => c.type === "background").paint["background-color"], PAPEL.fondo);
  const conNombre = papel.layers.filter((c) => JSON.stringify(c.layout?.["text-field"] ?? "").includes("name"));
  assert.ok(conNombre.length > 10);
  for (const c of conNombre) assert.deepEqual(c.layout["text-field"], NOMBRE, c.id);
  // Solo habla con OpenFreeMap
  const urls = JSON.stringify(papel).match(/https?:\/\/[^"]+/g);
  for (const u of urls) assert.match(u, /^https:\/\/tiles\.openfreemap\.org\//, u);
});
