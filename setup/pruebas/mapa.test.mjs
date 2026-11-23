// Pruebas de la Caja Mapa (mapa.js) que se pueden hacer en Node: la tabla de códigos de país, los grupos de pinchos,
// qué marca sale a cada zoom, las zonas, los colores y el estilo completo. El dibujo, el zoom y los toques solo existen
// en el navegador: se prueban con setup/pruebas/mapa.html. Se ejecutan con `node --test` desde la raíz del repo.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CAPAS_PROPIAS, HUECOS, ISO, LAT_MAXIMA, PALETA, RADIO_GRUPO, RADIO_GRUPO_FOTOS, SIN_CODIGO, TOPE_ENCUADRE,
  URL_PAPEL, ZOOM_FOTOS, ZOOM_MAXIMO, ZOOM_PAISES, ZOOM_PUNTO, agrupar, agruparPorPais, alfa2, cajaDe, componerEstilo,
  crearMapa, esDeseo, etiquetaDe, filtroVisitados, formaValida, giro, leerPaleta, mancha, marcasPara, nombrePais,
  normalizarLon, paisesVisitados, partirEnLaFecha, redondear, vistaDeAlto, zonasGeoJSON, zoomMinimo,
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

test("los zooms del Contrato 387, en unidades de MapLibre y en orden", () => {
  assert.deepEqual(
    [ZOOM_PAISES, ZOOM_FOTOS, ZOOM_PUNTO, TOPE_ENCUADRE, ZOOM_MAXIMO],
    [2.5, 3.3, 10, 14, 18],
  );
  assert.equal(RADIO_GRUPO_FOTOS, 62);
  assert.deepEqual(HUECOS, { top: 64, right: 80, bottom: 96, left: 32 });
});

test("giro: siempre el mismo para un id, entre −6,6° y 6,6°", () => {
  const vistos = new Set();
  for (let i = 0; i < 500; i++) {
    const g = giro(`id-${i}`);
    assert.equal(g, giro(`id-${i}`));
    assert.ok(g >= -6.6 - 1e-9 && g <= 6.6 + 1e-9, String(g));
    vistos.add(g.toFixed(1));
  }
  assert.ok(vistos.size >= 10, "los giros se reparten");
  assert.equal(giro(42), giro("42"));
});

test("normalizarLon: lo de fuera de −180..180 vuelve dentro, y lo de dentro no cambia", () => {
  assert.equal(normalizarLon(-3.7), -3.7);
  assert.equal(normalizarLon(180), 180);
  assert.equal(normalizarLon(-180), -180);
  assert.equal(normalizarLon(200), -160);
  assert.equal(normalizarLon(-200), 160);
  assert.equal(normalizarLon(370.5), 10.5);
  assert.equal(redondear(-3.703812), -3.70381);
});

test("mancha: un anillo cerrado de 9 km alrededor del punto, que pasa formaValida", () => {
  const forma = mancha(40.4168, -3.7038);
  const [anillo] = forma.coordinates;
  assert.equal(forma.type, "Polygon");
  assert.equal(anillo.length, 65);
  assert.deepEqual(anillo[0], anillo.at(-1));
  assert.equal(formaValida(forma), true);
  const rad = Math.PI / 180;
  for (const [lon, lat] of anillo) {
    const a = Math.sin(((lat - 40.4168) * rad) / 2) ** 2
      + Math.cos(40.4168 * rad) * Math.cos(lat * rad) * Math.sin(((lon + 3.7038) * rad) / 2) ** 2;
    const km = 2 * 6371.0088 * Math.asin(Math.sqrt(a));
    assert.ok(Math.abs(km - 9) < 0.01, String(km));
  }
  // Junto a la línea de cambio de fecha, las longitudes siguen dentro de −180..180
  assert.equal(formaValida(mancha(-17.7, 179.99)), true);
});

test("zonasGeoJSON: el contorno si vale, si no la mancha; los «quiero ir», sin zona", () => {
  const forma = { type: "Polygon", coordinates: [[[4.77, 45.71], [4.9, 45.71], [4.9, 45.81], [4.77, 45.71]]], extra: 1 };
  const zonas = zonasGeoJSON([
    { id: 1, lat: 45.76, lon: 4.83, forma },
    { id: 2, lat: 40.4, lon: -3.7, forma: { type: "Polygon" } },
    { id: 3, lat: 35, lon: 135.7, estado: "quiero_ir" },
    { id: 4, lat: 38, lon: -1.1, estado: "visitado" },
  ]);
  assert.equal(zonas.type, "FeatureCollection");
  assert.deepEqual(zonas.features.map((f) => f.properties.id), ["1", "2", "4"]);
  assert.deepEqual(zonas.features[0].geometry, { type: "Polygon", coordinates: forma.coordinates });
  assert.equal(zonas.features[1].geometry.coordinates[0].length, 65);
  assert.ok(esDeseo({ estado: "quiero_ir" }) && !esDeseo({ estado: "visitado" }) && !esDeseo(undefined));
});

const saltos = (geo) => (geo.type === "Polygon" ? [geo.coordinates] : geo.coordinates)
  .flat().filter((anillo) => anillo.some((p, i) => i > 0 && Math.abs(p[0] - anillo[i - 1][0]) > 180)).length;

test("partirEnLaFecha: lo que cruza la línea de cambio de fecha se parte en dos, sin rayas de lado a lado", () => {
  const cruza = { type: "Polygon", coordinates: [[[170, 60], [-170, 60], [-170, 70], [170, 70], [170, 60]]] };
  const partido = partirEnLaFecha(cruza);
  assert.equal(partido.type, "MultiPolygon");
  assert.equal(partido.coordinates.length, 2);
  assert.equal(saltos(partido), 0);
  const lados = partido.coordinates.map((pol) => pol[0].map((p) => p[0]));
  for (const lons of lados) assert.ok(lons.every((x) => Math.abs(x) <= 180));
  assert.ok(lados.some((lons) => Math.min(...lons) === 170 && Math.max(...lons) === 180));
  assert.ok(lados.some((lons) => Math.min(...lons) === -180 && Math.max(...lons) === -170));
  for (const pol of partido.coordinates) assert.deepEqual(pol[0][0], pol[0].at(-1), "anillos cerrados");
  // Lo que no cruza no se toca
  const espana = { type: "Polygon", coordinates: [[[-9, 36], [3, 36], [3, 43], [-9, 43], [-9, 36]]] };
  assert.equal(partirEnLaFecha(espana), espana);
  // Un anillo que rodea el polo (como la Antártida) se queda como está
  const polo = [[-180, -80], [0, -75], [180, -80], [180, -90], [-180, -90], [-180, -80]];
  assert.deepEqual(partirEnLaFecha({ type: "Polygon", coordinates: [polo] }), { type: "MultiPolygon", coordinates: [[polo]] });
  // Una mancha junto a la línea de cambio de fecha (Fiyi) tampoco deja rayas
  assert.equal(saltos(zonasGeoJSON([{ id: 1, lat: -17.7, lon: 179.99 }]).features[0].geometry), 0);
  assert.equal(partirEnLaFecha(null), null);
});

test("paisesVisitados: sin repetir, sin «quiero ir» y solo códigos de dos letras", () => {
  const visitados = paisesVisitados([
    { pais: "FR" }, { pais: "ES" }, { pais: "ES" }, { pais: "JP", estado: "quiero_ir" }, { pais: null }, { pais: "esp" },
  ]);
  assert.deepEqual(visitados, ["ES", "FR"]);
  assert.deepEqual(filtroVisitados(visitados), ["in", ["get", "iso"], ["literal", ["ES", "FR"]]]);
});

test("cajaDe: oeste-sur y este-norte de los pinchos", () => {
  assert.deepEqual(cajaDe([{ lat: 40, lon: -3 }, { lat: -33, lon: -70 }, { lat: 48, lon: 2 }]), [[-70, -33], [2, 48]]);
});

test("marcasPara: de lejos un punto por país; al acercar, pinchos y grupos; desde ZOOM_FOTOS, polaroids", () => {
  const p = (id, x, extra = {}) => ({ x, y: 100, pincho: { id, nombre: id, pais: "ES", ...extra } });
  const puntos = [p("a", 100, { portada: "a.jpg" }), p("b", 140), p("c", 400, { portada: "c.jpg", estado: "quiero_ir" })];
  const lejos = marcasPara(puntos, ZOOM_PAISES - 0.01);
  assert.equal(lejos.length, 1);
  assert.ok(lejos[0].porPais && !lejos[0].polaroid);
  assert.match(lejos[0].clave, /^c:p:/);
  const cerca = marcasPara(puntos, ZOOM_PAISES);
  assert.equal(cerca.length, 3); // a 40 px: más que RADIO_GRUPO
  assert.ok(cerca.every((g) => !g.porPais && !g.polaroid));
  const fotos = marcasPara(puntos, ZOOM_FOTOS);
  // a 40 px ya se juntan (RADIO_GRUPO_FOTOS); el «quiero ir» no lleva polaroid aunque tenga portada
  assert.equal(fotos.length, 2);
  const deseo = fotos.find((g) => g.pinchos[0].id === "c");
  assert.ok(deseo.deseo && !deseo.polaroid);
  assert.match(deseo.clave, /^d:/);
  const solo = marcasPara([p("a", 100, { portada: "a.jpg" })], ZOOM_FOTOS);
  assert.ok(solo[0].polaroid);
  assert.equal(solo[0].clave, "f:a");
  assert.equal(marcasPara([p("a", 100, { portada: "a.jpg" })], ZOOM_FOTOS - 0.01)[0].polaroid, false);
});

test("etiquetaDe: lo que se lee de cada marca", () => {
  const uno = { nombre: "Madrid" };
  assert.equal(etiquetaDe({ pinchos: [uno] }), "Madrid");
  assert.equal(etiquetaDe({ pinchos: [uno], porPais: true, pais: "ES" }), "Madrid, España");
  assert.equal(etiquetaDe({ pinchos: [uno], deseo: true }), "Madrid (quiero ir)");
  const dos = [uno, { nombre: "Toledo" }];
  assert.equal(etiquetaDe({ pinchos: dos, porPais: true, pais: "ES" }), "España, 2 lugares: Madrid, Toledo");
  assert.equal(etiquetaDe({ pinchos: dos }), "2 lugares: Madrid, Toledo");
});

test("leerPaleta: de día, los colores de la página si MapLibre los entiende; de noche, los claros fijos", () => {
  const pagina = { "--pin": " #E0533F", "--visitado": "color-mix(in srgb, red 30%, blue)", "--deseo": "rgb(1, 2, 3)" };
  const leer = (v) => pagina[v] ?? "";
  const dia = leerPaleta(leer, false);
  assert.equal(dia.pin, "#E0533F");
  assert.equal(dia.deseo, "rgb(1, 2, 3)");
  assert.equal(dia.visitado, PALETA.visitado); // color-mix no lo entiende MapLibre
  assert.equal(dia.sup, PALETA.sup); // sin la variable
  assert.deepEqual(leerPaleta(leer, true), PALETA);
});

test("vistaDeAlto y zoomMinimo: el mundo habitado de alto; se aleja hasta que el mundo llena el mapa", () => {
  const v = vistaDeAlto(650);
  assert.ok(Math.abs(v.zoom - 1.09) < 0.02, String(v.zoom));
  assert.ok(v.lat > 25 && v.lat < 35, String(v.lat));
  assert.ok(vistaDeAlto(1300).zoom - v.zoom > 0.999 && vistaDeAlto(1300).zoom - v.zoom < 1.001);
  assert.equal(vistaDeAlto(0).zoom, 1);
  // Un teléfono en vertical: manda el alto; un escritorio: el ancho
  assert.equal(zoomMinimo(375, 1024), 1);
  assert.equal(zoomMinimo(2048, 700), 2);
  assert.ok(zoomMinimo(375, 650) < v.zoom, "la vista inicial está por encima del mínimo");
  assert.equal(zoomMinimo(0, 0), -2);
  assert.ok(LAT_MAXIMA > 85 && LAT_MAXIMA < 85.1);
});

// Un «Papel» de juguete: fondo, agua, una calle y dos capas de nombres
const papelDeJuguete = () => ({
  version: 8,
  sources: { openmaptiles: { type: "vector", url: "https://tiles.openfreemap.org/planet" } },
  layers: [
    { id: "background", type: "background", paint: { "background-color": "#F3EAD7" } },
    { id: "park", type: "fill", source: "openmaptiles", "source-layer": "park" },
    { id: "water", type: "fill", source: "openmaptiles", "source-layer": "water" },
    { id: "road_minor", type: "line", source: "openmaptiles", "source-layer": "transportation" },
    { id: "label_city", type: "symbol", source: "openmaptiles", "source-layer": "place" },
    { id: "label_country_1", type: "symbol", source: "openmaptiles", "source-layer": "place" },
  ],
});

test("componerEstilo: el mundo de respaldo debajo, los visitados bajo el agua y las zonas bajo los nombres", () => {
  const papel = papelDeJuguete();
  const copia = structuredClone(papel);
  const tierra = { type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [] } };
  const estilo = componerEstilo(papel, { tierra, paleta: { ...PALETA, visitado: "#123456" } });
  assert.deepEqual(papel, copia, "no toca el original");
  assert.deepEqual(estilo.layers.map((c) => c.id), [
    "background", "mm-tierra", "mm-costas", "park", "mm-visitados", "water", "road_minor", "mm-zonas-relleno",
    "mm-zonas-borde", "label_city", "label_country_1",
  ]);
  assert.equal(estilo.sources["mm-tierra"].data, tierra);
  assert.deepEqual(estilo.sources["mm-zonas"].data, { type: "FeatureCollection", features: [] });
  assert.ok(estilo.sources.openmaptiles);
  const fondo = estilo.layers[0].paint["background-color"];
  assert.equal(fondo[0], "interpolate"); // mar de lejos, papel de cerca
  const visitados = estilo.layers.find((c) => c.id === "mm-visitados");
  assert.equal(visitados.paint["fill-color"], "#123456");
  assert.deepEqual(visitados.filter, filtroVisitados([]));
  // Dos veces seguidas no duplica nada
  const otra = componerEstilo(estilo, { tierra });
  assert.equal(otra.layers.length, estilo.layers.length);
  assert.deepEqual(new Set(otra.layers.map((c) => c.id)).size, otra.layers.length);
  for (const id of CAPAS_PROPIAS) assert.ok(otra.layers.some((c) => c.id === id), id);
});

test("componerEstilo: sin agua ni nombres ni fondo, todo encuentra sitio", () => {
  const estilo = componerEstilo({ version: 8, sources: {}, layers: [] });
  assert.deepEqual(estilo.layers.map((c) => c.id), [
    "background", "mm-tierra", "mm-costas", "mm-visitados", "mm-zonas-relleno", "mm-zonas-borde",
  ]);
});

test("componerEstilo con el «Papel» de verdad (datos/papel.json)", async () => {
  const { readFile } = await import("node:fs/promises");
  const papel = JSON.parse(await readFile(new URL(URL_PAPEL), "utf8"));
  const estilo = componerEstilo(papel, {});
  const ids = estilo.layers.map((c) => c.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(ids.indexOf("mm-visitados") === ids.indexOf("water") - 1);
  const primerNombre = estilo.layers.findIndex((c) => c.type === "symbol");
  assert.equal(ids[primerNombre - 1], "mm-zonas-borde");
  assert.equal(ids[primerNombre - 2], "mm-zonas-relleno");
});
