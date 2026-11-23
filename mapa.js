// Caja Mapa de Mundi (Contrato «Mapa» de docs/contratos.md; Contrato 387 del 23/11/2026).
// El mapamundi «como Google Maps» con el fondo «Papel»: MapLibre GL JS dibuja las teselas de OpenStreetMap
// (OpenFreeMap) con el estilo fijo datos/papel.json y, debajo, el mundo de world-atlas, por si las teselas no llegan.
// Los países visitados y la zona de cada lugar van en el lienzo; los pinchos, los grupos y las polaroids, en una capa
// SVG propia encima, en coordenadas de pantalla, para que no crezcan al acercar. Usa los globales `maplibregl`, `d3` y
// `topojson`, cargados antes por la página. Al importarse no toca la página ni la red: lo importa también Node.

export const URL_GEOMETRIA = "https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-50m.json";
// El fondo «Papel» (lo genera setup/papel.mjs); vive junto a mapa.js
export const URL_PAPEL = new URL("datos/papel.json", import.meta.url).href;

// Zoom de MapLibre: el mundo mide 512 px en el nivel 0
export const ZOOM_PAISES = 2.5; // por debajo, un punto por país
export const ZOOM_FOTOS = 3.3; // desde aquí, los pinchos con foto (portada) se ven como polaroids
export const ZOOM_PUNTO = 10; // «ir a un lugar» y encuadrar un solo pincho: la ciudad y sus alrededores
export const TOPE_ENCUADRE = 14; // como mucho, al encuadrar varios pinchos o tocar un grupo
export const ZOOM_MAXIMO = 18; // los barrios
export const RADIO_GRUPO = 24; // px: pinchos más cerca que esto en pantalla van juntos
export const RADIO_GRUPO_FOTOS = 62; // px, con polaroids
export const RADIO_ZONA_KM = 9; // la mancha de un lugar sin contorno
export const LAT_MAXIMA = 85.05113; // Mercator no llega más allá
// La vista inicial: el mundo habitado, de alto
export const VISTA_INICIAL = { sur: -60, norte: 80, lon: 0 };
// Lo que tapa la Interfaz alrededor del mapa (el filtro arriba, los botones a la derecha, la franja abajo)
export const HUECOS = { top: 64, right: 80, bottom: 96, left: 32 };
const DURACION = 850; // ms de cada movimiento de cámara
const TIEMPO_MAXIMO = 15_000; // ms para tener el mapa; si no, se rechaza
const ESPERA_TOQUE = 300; // ms: un toque en el mapa espera por si es el primero de un doble toque
const TOLERANCIA_TOQUE = 6; // px que se puede mover el dedo y seguir siendo un toque

// El mundo de respaldo, debajo de las teselas: mar, tierra y costas, en los colores de «Papel»
const BASE = { agua: "#CFDCCF", fondo: "#F3EAD7", costa: "#A58C68" };
// Los colores de lo de Mundi; en claro, los de la página (style.css) si los tiene
export const PALETA = {
  pin: "#B23A2B", deseo: "#3D7A74", visitado: "#E2B85C", visitadoBorde: "#8A6E4B", sup: "#FFFBF2", postal: "#FFFFFF",
  tinta: "#3B2F22", tinta2: "#6B5843", tinta3: "#9A8468",
};
const VARIABLES = {
  pin: "--pin", deseo: "--deseo", visitado: "--visitado", visitadoBorde: "--visitado-borde", sup: "--sup",
  postal: "--postal", tinta: "--tinta", tinta2: "--tinta-2", tinta3: "--tinta-3",
};
export const CAPAS_PROPIAS = ["mm-tierra", "mm-costas", "mm-visitados", "mm-zonas-relleno", "mm-zonas-borde"];

// Los textos de MapLibre, en español
const TEXTOS = {
  "Map.Title": "Mapa",
  "AttributionControl.ToggleAttribution": "Créditos del mapa",
  "AttributionControl.MapFeedback": "Mejorar este mapa",
  "NavigationControl.ZoomIn": "Acercar",
  "NavigationControl.ZoomOut": "Alejar",
  "Marker.Title": "Marcador",
};

let clipsCreados = 0;

// ISO 3166-1: el código numérico (el id de world-atlas) → alfa-2 (el `pais` de la base)
export const ISO = {
  "004": "AF", "008": "AL", "010": "AQ", "012": "DZ", "016": "AS", "020": "AD", "024": "AO", "028": "AG", "031": "AZ",
  "032": "AR", "036": "AU", "040": "AT", "044": "BS", "048": "BH", "050": "BD", "051": "AM", "052": "BB", "056": "BE",
  "060": "BM", "064": "BT", "068": "BO", "070": "BA", "072": "BW", "074": "BV", "076": "BR", "084": "BZ", "086": "IO",
  "090": "SB", "092": "VG", "096": "BN", "100": "BG", "104": "MM", "108": "BI", "112": "BY", "116": "KH", "120": "CM",
  "124": "CA", "132": "CV", "136": "KY", "140": "CF", "144": "LK", "148": "TD", "152": "CL", "156": "CN", "158": "TW",
  "162": "CX", "166": "CC", "170": "CO", "174": "KM", "175": "YT", "178": "CG", "180": "CD", "184": "CK", "188": "CR",
  "191": "HR", "192": "CU", "196": "CY", "203": "CZ", "204": "BJ", "208": "DK", "212": "DM", "214": "DO", "218": "EC",
  "222": "SV", "226": "GQ", "231": "ET", "232": "ER", "233": "EE", "234": "FO", "238": "FK", "239": "GS", "242": "FJ",
  "246": "FI", "248": "AX", "250": "FR", "254": "GF", "258": "PF", "260": "TF", "262": "DJ", "266": "GA", "268": "GE",
  "270": "GM", "275": "PS", "276": "DE", "288": "GH", "292": "GI", "296": "KI", "300": "GR", "304": "GL", "308": "GD",
  "312": "GP", "316": "GU", "320": "GT", "324": "GN", "328": "GY", "332": "HT", "334": "HM", "336": "VA", "340": "HN",
  "344": "HK", "348": "HU", "352": "IS", "356": "IN", "360": "ID", "364": "IR", "368": "IQ", "372": "IE", "376": "IL",
  "380": "IT", "384": "CI", "388": "JM", "392": "JP", "398": "KZ", "400": "JO", "404": "KE", "408": "KP", "410": "KR",
  "414": "KW", "417": "KG", "418": "LA", "422": "LB", "426": "LS", "428": "LV", "430": "LR", "434": "LY", "438": "LI",
  "440": "LT", "442": "LU", "446": "MO", "450": "MG", "454": "MW", "458": "MY", "462": "MV", "466": "ML", "470": "MT",
  "474": "MQ", "478": "MR", "480": "MU", "484": "MX", "492": "MC", "496": "MN", "498": "MD", "499": "ME", "500": "MS",
  "504": "MA", "508": "MZ", "512": "OM", "516": "NA", "520": "NR", "524": "NP", "528": "NL", "531": "CW", "533": "AW",
  "534": "SX", "535": "BQ", "540": "NC", "548": "VU", "554": "NZ", "558": "NI", "562": "NE", "566": "NG", "570": "NU",
  "574": "NF", "578": "NO", "580": "MP", "581": "UM", "583": "FM", "584": "MH", "585": "PW", "586": "PK", "591": "PA",
  "598": "PG", "600": "PY", "604": "PE", "608": "PH", "612": "PN", "616": "PL", "620": "PT", "624": "GW", "626": "TL",
  "630": "PR", "634": "QA", "638": "RE", "642": "RO", "643": "RU", "646": "RW", "652": "BL", "654": "SH", "659": "KN",
  "660": "AI", "662": "LC", "663": "MF", "666": "PM", "670": "VC", "674": "SM", "678": "ST", "682": "SA", "686": "SN",
  "688": "RS", "690": "SC", "694": "SL", "702": "SG", "703": "SK", "704": "VN", "705": "SI", "706": "SO", "710": "ZA",
  "716": "ZW", "724": "ES", "728": "SS", "729": "SD", "732": "EH", "740": "SR", "744": "SJ", "748": "SZ", "752": "SE",
  "756": "CH", "760": "SY", "762": "TJ", "764": "TH", "768": "TG", "772": "TK", "776": "TO", "780": "TT", "784": "AE",
  "788": "TN", "792": "TR", "795": "TM", "796": "TC", "798": "TV", "800": "UG", "804": "UA", "807": "MK", "818": "EG",
  "826": "GB", "831": "GG", "832": "JE", "833": "IM", "834": "TZ", "840": "US", "850": "VI", "854": "BF", "858": "UY",
  "860": "UZ", "862": "VE", "876": "WF", "882": "WS", "887": "YE", "894": "ZM",
};
// Los territorios que world-atlas trae sin código numérico, por su nombre
export const SIN_CODIGO = { "Kosovo": "XK", "N. Cyprus": "CY", "Somaliland": "SO" };

// El alfa-2 de un país de world-atlas, o null
export function alfa2(pais) {
  return ISO[pais?.id] ?? SIN_CODIGO[pais?.properties?.name] ?? null;
}

// ¿Es un contorno que se puede dibujar? Polygon o MultiPolygon con anillos de al menos 4 puntos [lon, lat] en rango
const esNumero = (n) => typeof n === "number" && Number.isFinite(n);
const puntoValido = (p) => Array.isArray(p) && p.length >= 2 && esNumero(p[0]) && esNumero(p[1])
  && Math.abs(p[0]) <= 180 && Math.abs(p[1]) <= 90;
const anilloValido = (r) => Array.isArray(r) && r.length >= 4 && r.every(puntoValido);
const poligonoValido = (pol) => Array.isArray(pol) && pol.length >= 1 && pol.every(anilloValido);
export function formaValida(forma) {
  if (!forma || typeof forma !== "object") return false;
  if (forma.type === "Polygon") return poligonoValido(forma.coordinates);
  if (forma.type === "MultiPolygon") {
    return Array.isArray(forma.coordinates) && forma.coordinates.length >= 1 && forma.coordinates.every(poligonoValido);
  }
  return false;
}

// Agrupa puntos de pantalla [{ x, y, pincho }] que queden a menos de `radio` px → [{ x, y, pinchos }]
export function agrupar(puntos, radio = RADIO_GRUPO) {
  const grupos = [];
  for (const p of [...puntos].sort((a, b) => a.y - b.y || a.x - b.x)) {
    const g = grupos.find((g) => Math.hypot(g.x - p.x, g.y - p.y) < radio);
    if (g) {
      g.miembros.push(p);
      g.x = g.miembros.reduce((s, m) => s + m.x, 0) / g.miembros.length;
      g.y = g.miembros.reduce((s, m) => s + m.y, 0) / g.miembros.length;
    } else {
      grupos.push({ x: p.x, y: p.y, miembros: [p] });
    }
  }
  return grupos.map((g) => ({ x: g.x, y: g.y, pinchos: g.miembros.map((m) => m.pincho) }));
}

// Un punto por país: los pinchos de cada país van juntos, en el suyo que queda más en medio (así el punto cae siempre
// en tierra y en el país); los que no tienen país, cada uno solo. Si dos puntos quedan a menos de `radio` px, se juntan.
// [{ x, y, pincho }] → [{ x, y, pinchos, pais }] (`pais`: el código si todos son del mismo, o null)
export function agruparPorPais(puntos, radio = RADIO_GRUPO) {
  const porPais = new Map();
  const listas = [];
  for (const p of puntos) {
    const pais = p.pincho?.pais;
    if (!pais) { listas.push([p]); continue; }
    if (!porPais.has(pais)) {
      porPais.set(pais, []);
      listas.push(porPais.get(pais));
    }
    porPais.get(pais).push(p);
  }
  const semillas = listas.map((lista) => {
    const mx = lista.reduce((s, m) => s + m.x, 0) / lista.length;
    const my = lista.reduce((s, m) => s + m.y, 0) / lista.length;
    const lejos = (m) => Math.hypot(m.x - mx, m.y - my);
    const centro = lista.reduce((mejor, m) => (lejos(m) < lejos(mejor) ? m : mejor));
    return { x: centro.x, y: centro.y, pincho: lista.map((m) => m.pincho) };
  });
  return agrupar(semillas, radio).map((g) => {
    const pinchos = g.pinchos.flat();
    const paises = new Set(pinchos.map((p) => p.pais ?? null));
    return { x: g.x, y: g.y, pinchos, pais: paises.size === 1 ? [...paises][0] : null };
  });
}

// El nombre de un país en español a partir de su código (ES → España); el código si el navegador no lo sabe
export function nombrePais(codigo) {
  try {
    return new Intl.DisplayNames(["es"], { type: "region" }).of(codigo) ?? codigo;
  } catch {
    return codigo;
  }
}

// Los «quiero ir» no cuentan como visitados: ni pintan su país ni su lugar, ni llevan polaroid
export const esDeseo = (p) => p?.estado === "quiero_ir";

// Un giro pequeño y siempre el mismo para cada pincho, como una foto clavada a mano (de −6,6° a 6,6°)
export function giro(id) {
  let h = 0;
  for (const c of String(id)) h = (h * 31 + c.charCodeAt(0)) | 0;
  return ((Math.abs(h) % 13) - 6) * 1.1;
}

export const redondear = (n) => Math.round(n * 1e5) / 1e5;

// Una longitud cualquiera, llevada a −180..180 (la base de datos no acepta otra)
export function normalizarLon(lon) {
  if (lon >= -180 && lon <= 180) return lon;
  return ((((lon + 180) % 360) + 360) % 360) - 180;
}

// Mercator: la latitud → la altura en el mundo (0 arriba, 1 abajo), y al revés
const mercY = (lat) => {
  const s = Math.sin((lat * Math.PI) / 180);
  return 0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI);
};
const latDeMercY = (y) => (360 / Math.PI) * Math.atan(Math.exp((0.5 - y) * 2 * Math.PI)) - 90;

// La vista que enseña de `sur` a `norte` llenando `alto` px: { zoom, lat } del centro
export function vistaDeAlto(alto, sur = VISTA_INICIAL.sur, norte = VISTA_INICIAL.norte) {
  const yN = mercY(norte);
  const yS = mercY(sur);
  const zoom = alto > 0 ? Math.log2(alto / ((yS - yN) * 512)) : 1;
  return { zoom, lat: latDeMercY((yN + yS) / 2) };
}

// Hasta dónde se puede alejar: hasta que el mundo llena el mapa a lo ancho y a lo alto (como el mundo no se repite a
// los lados, MapLibre no deja ver más allá). En un teléfono en vertical eso son unos 180° de ancho
export function zoomMinimo(ancho, alto) {
  return Math.max(-2, Math.log2(Math.max(ancho, alto, 1) / 512));
}

// La mancha de un lugar sin contorno: un círculo de `km` alrededor del punto, como polígono GeoJSON
export function mancha(lat, lon, km = RADIO_ZONA_KM, lados = 64) {
  const d = km / 6371.0088;
  const f = (lat * Math.PI) / 180;
  const l = (lon * Math.PI) / 180;
  const anillo = [];
  for (let i = 0; i < lados; i++) {
    const rumbo = (2 * Math.PI * i) / lados;
    const f2 = Math.asin(Math.sin(f) * Math.cos(d) + Math.cos(f) * Math.sin(d) * Math.cos(rumbo));
    const l2 = l + Math.atan2(Math.sin(rumbo) * Math.sin(d) * Math.cos(f), Math.cos(d) - Math.sin(f) * Math.sin(f2));
    anillo.push([redondear(normalizarLon((l2 * 180) / Math.PI)), redondear((f2 * 180) / Math.PI)]);
  }
  anillo.push([...anillo[0]]);
  return { type: "Polygon", coordinates: [anillo] };
}

// world-atlas está hecho para el globo: Rusia, Fiyi o un contorno junto a la línea de cambio de fecha la cruzan con un
// salto de más de 180° entre dos puntos seguidos, que en el mapa plano sería una raya de lado a lado. Esos polígonos
// se parten en dos: lo de un lado y lo del otro. Un anillo que rodea un polo (la Antártida) se queda como está
const cruzaLaFecha = (anillo) => anillo.some((p, i) => i > 0 && Math.abs(p[0] - anillo[i - 1][0]) > 180);
function desplegar(anillo) {
  let suma = 0;
  return anillo.map((p, i) => {
    if (i > 0) {
      const salto = p[0] - anillo[i - 1][0];
      if (salto > 180) suma -= 360;
      else if (salto < -180) suma += 360;
    }
    return [p[0] + suma, p[1]];
  });
}
// Sutherland-Hodgman contra una recta vertical: se queda con lo que cumple `dentro`
function recortarVertical(anillo, x0, dentro) {
  const salida = [];
  for (let i = 0; i < anillo.length - 1; i++) {
    const a = anillo[i];
    const b = anillo[i + 1];
    const corte = () => [x0, a[1] + ((b[1] - a[1]) * (x0 - a[0])) / (b[0] - a[0])];
    if (dentro(a)) {
      salida.push(a);
      if (!dentro(b)) salida.push(corte());
    } else if (dentro(b)) {
      salida.push(corte());
    }
  }
  if (salida.length) salida.push([...salida[0]]);
  return salida;
}
const recortarAlMundo = (anillo) =>
  recortarVertical(recortarVertical(anillo, 180, (p) => p[0] <= 180), -180, (p) => p[0] >= -180);

export function partirEnLaFecha(geometria) {
  const poligonos = geometria?.type === "Polygon" ? [geometria.coordinates]
    : geometria?.type === "MultiPolygon" ? geometria.coordinates : null;
  if (!poligonos || !poligonos.some((pol) => pol.some(cruzaLaFecha))) return geometria;
  const salida = [];
  for (const pol of poligonos) {
    const desplegados = pol.map(desplegar);
    const exterior = desplegados[0];
    const rodeaUnPolo = Math.abs(exterior.at(-1)[0] - exterior[0][0]) > 180;
    if (!pol.some(cruzaLaFecha) || rodeaUnPolo) {
      salida.push(pol);
      continue;
    }
    for (const desplazamiento of [0, 360, -360]) {
      const [fuera, ...huecos] = desplegados.map((r) => recortarAlMundo(r.map(([x, y]) => [x + desplazamiento, y])));
      if (fuera.length >= 4) salida.push([fuera, ...huecos.filter((r) => r.length >= 4)]);
    }
  }
  return { type: "MultiPolygon", coordinates: salida };
}

// La zona de cada lugar visitado: su contorno si se puede dibujar o, si no, la mancha. Un contorno roto nunca
// impide dibujar el mapa
export function zonasGeoJSON(pinchos) {
  return {
    type: "FeatureCollection",
    features: pinchos.filter((p) => !esDeseo(p)).map((p) => ({
      type: "Feature",
      properties: { id: String(p.id) },
      geometry: partirEnLaFecha(
        formaValida(p.forma) ? { type: p.forma.type, coordinates: p.forma.coordinates } : mancha(p.lat, p.lon)),
    })),
  };
}

// Los países visitados (alfa-2, sin repetir): los de los lugares que no son «quiero ir»
export function paisesVisitados(pinchos) {
  const codigos = pinchos.filter((p) => !esDeseo(p)).map((p) => p.pais).filter((c) => /^[A-Z]{2}$/.test(c ?? ""));
  return [...new Set(codigos)].sort();
}
export const filtroVisitados = (codigos) => ["in", ["get", "iso"], ["literal", codigos]];

// La caja [[oeste, sur], [este, norte]] de unos pinchos
export function cajaDe(pinchos) {
  const lons = pinchos.map((p) => p.lon);
  const lats = pinchos.map((p) => p.lat);
  return [[Math.min(...lons), Math.min(...lats)], [Math.max(...lons), Math.max(...lats)]];
}

// Qué marca va en cada sitio a este zoom. De lejos, un punto por país; al acercar, los pinchos (los cercanos en
// pantalla, juntos) y, desde ZOOM_FOTOS, las polaroids. [{ x, y, pincho }] → grupos con porPais, polaroid, deseo y clave
export function marcasPara(puntos, zoom) {
  const porPais = zoom < ZOOM_PAISES;
  const conFotos = zoom >= ZOOM_FOTOS;
  const grupos = porPais ? agruparPorPais(puntos) : agrupar(puntos, conFotos ? RADIO_GRUPO_FOTOS : RADIO_GRUPO);
  for (const g of grupos) {
    g.porPais = porPais;
    g.polaroid = !porPais && conFotos && g.pinchos.length === 1 && !!g.pinchos[0].portada && !esDeseo(g.pinchos[0]);
    g.deseo = g.pinchos.every(esDeseo);
    g.clave = (porPais ? "c:" : "") + (g.polaroid ? "f:" : g.deseo ? "d:" : "p:")
      + g.pinchos.map((p) => p.id).sort().join("|");
  }
  return grupos;
}

// Lo que se lee de una marca (aria-label)
export function etiquetaDe(g) {
  const nombres = g.pinchos.map((p) => p.nombre).join(", ");
  if (g.pinchos.length === 1) {
    return g.pinchos[0].nombre + (g.porPais && g.pais ? `, ${nombrePais(g.pais)}` : "") + (g.deseo ? " (quiero ir)" : "");
  }
  if (g.porPais && g.pais) return `${nombrePais(g.pais)}, ${g.pinchos.length} lugares: ${nombres}`;
  return `${g.pinchos.length} lugares: ${nombres}`;
}

// Los colores de lo de Mundi. De noche, el mapa sigue en «Papel» claro (decisión del 23/11): sus colores claros fijos.
// De día, los de la página si son colores que MapLibre entiende; si no, los claros fijos
const COLOR_SIMPLE = /^(#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})|(?:rgba?|hsla?)\([^()]*\))$/i;
export function leerPaleta(leer, oscuro = false) {
  const paleta = { ...PALETA };
  if (oscuro) return paleta;
  for (const [clave, variable] of Object.entries(VARIABLES)) {
    const valor = String(leer(variable) ?? "").trim();
    if (COLOR_SIMPLE.test(valor)) paleta[clave] = valor;
  }
  return paleta;
}

function insertarAntes(capas, capa, esLaSiguiente) {
  let i = capas.findIndex(esLaSiguiente);
  if (i < 0) i = capas.findIndex((c) => c.type === "symbol");
  capas.splice(i < 0 ? capas.length : i, 0, capa);
}

// El estilo completo: «Papel» más lo propio. Debajo de todo, el mundo de respaldo (mar hasta el zoom 5, tierra de
// world-atlas y costas); los países visitados, debajo del agua de las teselas; la zona de cada lugar, debajo de los
// nombres. No toca `papel`
export function componerEstilo(papel, { paises, tierra, paleta = PALETA } = {}) {
  const vacio = { type: "FeatureCollection", features: [] };
  const estilo = structuredClone(papel);
  estilo.sources = {
    ...estilo.sources,
    "mm-tierra": { type: "geojson", data: tierra ?? vacio },
    "mm-paises": { type: "geojson", data: paises ?? vacio },
    "mm-zonas": { type: "geojson", data: vacio },
  };
  const capas = (estilo.layers ?? []).filter((c) => !CAPAS_PROPIAS.includes(c.id));
  let fondo = capas.find((c) => c.type === "background");
  if (!fondo) {
    fondo = { id: "background", type: "background", paint: {} };
    capas.unshift(fondo);
  }
  fondo.paint = { ...fondo.paint, "background-color": ["interpolate", ["linear"], ["zoom"], 5, BASE.agua, 7, BASE.fondo] };
  capas.splice(capas.indexOf(fondo) + 1, 0,
    { id: "mm-tierra", type: "fill", source: "mm-tierra", paint: { "fill-color": BASE.fondo } },
    {
      id: "mm-costas", type: "line", source: "mm-tierra",
      paint: { "line-color": BASE.costa, "line-width": 0.6, "line-opacity": ["interpolate", ["linear"], ["zoom"], 4, 0.6, 7, 0] },
    });
  insertarAntes(capas, {
    id: "mm-visitados", type: "fill", source: "mm-paises", filter: filtroVisitados([]),
    paint: { "fill-color": paleta.visitado, "fill-opacity": ["interpolate", ["linear"], ["zoom"], 5, 0.3, 8, 0] },
  }, (c) => c.id === "water");
  insertarAntes(capas, {
    id: "mm-zonas-relleno", type: "fill", source: "mm-zonas",
    paint: { "fill-color": paleta.visitado, "fill-opacity": ["interpolate", ["linear"], ["zoom"], 9, 0.8, 12, 0] },
  }, (c) => c.type === "symbol");
  insertarAntes(capas, {
    id: "mm-zonas-borde", type: "line", source: "mm-zonas",
    paint: { "line-color": paleta.visitadoBorde, "line-width": 1.2 },
  }, (c) => c.type === "symbol");
  estilo.layers = capas;
  return estilo;
}

const ESTILOS = `
.mm-capa { position: absolute; left: 0; top: 0; overflow: visible; pointer-events: none; user-select: none; -webkit-user-select: none; }
.mm-capa .mm-marca { pointer-events: auto; cursor: pointer; }
.mm-marca:focus { outline: none; }
.mm-polaroid-papel { fill: var(--postal, #FFFFFF); stroke: rgba(59, 47, 34, .25); stroke-width: .6; }
.mm-polaroid-sombra { fill: #000000; opacity: .16; }
.mm-polaroid-nombre { font: italic 600 8.5px var(--f-titulo, Georgia, serif); fill: #3B2F22; text-anchor: middle; }
.mm-hilo { stroke: var(--tinta-2, #6B5843); stroke-width: 1.2; stroke-linecap: round; }
.mm-sombra { fill: var(--tinta, #3B2F22); opacity: .22; }
.mm-aguja { stroke: var(--tinta-2, #6B5843); stroke-width: 1.6; stroke-linecap: round; }
.mm-cabeza, .mm-grupo-fondo { fill: var(--pin, #B23A2B); stroke: var(--sup, #FFFBF2); }
/* Un sitio al que se quiere ir: otro color, y un grupo solo de deseos también */
.mm-deseo .mm-cabeza, .mm-deseo .mm-grupo-fondo { fill: var(--deseo, #3D7A74); }
.mm-cabeza { stroke-width: 1.2; }
.mm-grupo-fondo { stroke-width: 2.5; }
.mm-brillo { fill: #FFFFFF; opacity: .55; }
.mm-toque { fill: transparent; }
.mm-marca:focus-visible .mm-cabeza, .mm-marca:focus-visible .mm-grupo-fondo { stroke: var(--tinta, #3B2F22); stroke-width: 2.5; }
.mm-grupo-num { font: 600 12px var(--f-dato, ui-monospace, monospace); fill: #FFFFFF; text-anchor: middle; dominant-baseline: central; pointer-events: none; }
.mm-provisional { pointer-events: none; }
.mm-provisional .mm-cabeza { fill: var(--tinta-3, #9A8468); }
.mm-nuevo .mm-cuerpo { animation: mm-clavar .7s cubic-bezier(.3, 1.4, .5, 1) both; }
@keyframes mm-clavar { from { transform: translateY(-46px) scale(1.25); opacity: 0; } 60% { opacity: 1; } to { transform: none; opacity: 1; } }
@media (prefers-reduced-motion: reduce) { .mm-nuevo .mm-cuerpo { animation: none; } }
`;

function ponerEstilos() {
  if (document.getElementById("mm-estilos")) return;
  const estilo = document.createElement("style");
  estilo.id = "mm-estilos";
  estilo.textContent = ESTILOS;
  document.head.append(estilo);
}

function cuerpoPincho(g) {
  g.append("ellipse").attr("class", "mm-sombra").attr("cx", 3).attr("cy", 1).attr("rx", 5).attr("ry", 1.8);
  g.append("line").attr("class", "mm-aguja").attr("x1", 0).attr("y1", 0).attr("x2", 0).attr("y2", -12);
  g.append("circle").attr("class", "mm-cabeza").attr("cy", -18).attr("r", 7.5);
  g.append("circle").attr("class", "mm-brillo").attr("cx", -2.4).attr("cy", -20.4).attr("r", 2.3);
}

function polaroid(sel, p) {
  sel.append("line").attr("class", "mm-hilo").attr("x1", 0).attr("y1", 0).attr("x2", 0).attr("y2", -10);
  sel.append("ellipse").attr("class", "mm-sombra").attr("rx", 4).attr("ry", 1.6);
  const marco = sel.append("g").attr("class", "mm-polaroid").attr("transform", `translate(0,-44) rotate(${giro(p.id)})`);
  marco.append("rect").attr("class", "mm-polaroid-sombra").attr("x", -25).attr("y", -28).attr("width", 52).attr("height", 62);
  marco.append("rect").attr("class", "mm-polaroid-papel").attr("x", -27).attr("y", -31).attr("width", 54).attr("height", 62).attr("rx", 1.5);
  const clip = `mm-clip-${++clipsCreados}`;
  marco.append("clipPath").attr("id", clip).append("rect").attr("x", -23).attr("y", -27).attr("width", 46).attr("height", 42);
  marco.append("image").attr("href", p.portada).attr("x", -23).attr("y", -27).attr("width", 46).attr("height", 42)
    .attr("preserveAspectRatio", "xMidYMid slice").attr("clip-path", `url(#${clip})`);
  const nombre = p.nombre.length > 13 ? p.nombre.slice(0, 12) + "…" : p.nombre;
  marco.append("text").attr("class", "mm-polaroid-nombre").attr("y", 25).text(nombre);
  marco.append("circle").attr("class", "mm-cabeza").attr("cy", -31).attr("r", 4.6);
  marco.append("circle").attr("class", "mm-brillo").attr("cx", -1.4).attr("cy", -32.4).attr("r", 1.4);
  sel.append("rect").attr("class", "mm-toque").attr("x", -30).attr("y", -80).attr("width", 60).attr("height", 82);
}

const SIN_CONEXION = "No se pudo cargar el mapa. Comprueba la conexión y vuelve a intentarlo.";

export async function crearMapa(contenedor, { alTocarPincho = () => {}, alTocarPunto = () => {} } = {}) {
  if (typeof Element === "undefined" || !(contenedor instanceof Element)) {
    throw new TypeError("crearMapa espera el elemento donde va el mapa");
  }
  const { maplibregl, d3, topojson } = globalThis;
  if (!maplibregl) throw new Error("Falta MapLibre: hay que cargarlo antes que mapa.js.");
  if (!d3 || !topojson) throw new Error("Faltan d3 y topojson: hay que cargarlos antes que mapa.js.");
  const limite = Date.now() + TIEMPO_MAXIMO;

  // Los países (world-atlas) y el fondo «Papel», con un tiempo máximo entre los dos
  const bajar = async (url) => {
    const control = new AbortController();
    const reloj = setTimeout(() => control.abort(), Math.max(0, limite - Date.now()));
    try {
      const respuesta = await fetch(url, { signal: control.signal });
      if (!respuesta.ok) throw new Error(String(respuesta.status));
      return await respuesta.json();
    } finally {
      clearTimeout(reloj);
    }
  };
  let paises, tierra, papel;
  try {
    const [mundo, estilo] = await Promise.all([bajar(URL_GEOMETRIA), bajar(URL_PAPEL)]);
    paises = topojson.feature(mundo, mundo.objects.countries).features;
    const tierraGlobo = topojson.feature(mundo, mundo.objects.land);
    const trozos = tierraGlobo.type === "FeatureCollection" ? tierraGlobo.features : [tierraGlobo];
    tierra = {
      type: "FeatureCollection",
      features: trozos.map((t) => ({ type: "Feature", properties: {}, geometry: partirEnLaFecha(t.geometry) })),
    };
    papel = estilo;
  } catch {
    throw new Error(SIN_CONEXION);
  }
  for (const p of paises) p.alfa2 = alfa2(p);
  const paisesGeo = {
    type: "FeatureCollection",
    features: paises.map((p) => ({
      type: "Feature", properties: { iso: p.alfa2 ?? "" }, geometry: partirEnLaFecha(p.geometry),
    })),
  };

  ponerEstilos();
  const oscuro = matchMedia("(prefers-color-scheme: dark)");
  const leer = (variable) => getComputedStyle(contenedor).getPropertyValue(variable);
  let paleta = leerPaleta(leer, oscuro.matches);
  const vistaInicio = () => {
    const v = vistaDeAlto(contenedor.clientHeight);
    return { center: [VISTA_INICIAL.lon, v.lat], zoom: v.zoom };
  };
  let vistaPendiente = !(contenedor.clientHeight > 0); // sin tamaño aún: la vista inicial, cuando lo tenga

  let map;
  try {
    map = new maplibregl.Map({
      container: contenedor,
      style: componerEstilo(papel, { paises: paisesGeo, tierra, paleta }),
      ...vistaInicio(),
      minZoom: zoomMinimo(contenedor.clientWidth, contenedor.clientHeight),
      maxZoom: ZOOM_MAXIMO,
      renderWorldCopies: false,
      dragRotate: false,
      pitchWithRotate: false,
      touchPitch: false,
      maxPitch: 0,
      clickTolerance: TOLERANCIA_TOQUE,
      attributionControl: false,
      pixelRatio: Math.min(globalThis.devicePixelRatio || 1, 2),
      locale: TEXTOS,
    });
  } catch {
    throw new Error("Este teléfono no puede dibujar el mapa.");
  }
  map.touchZoomRotate.disableRotation();
  map.keyboard.disableRotation();
  map.addControl(new maplibregl.AttributionControl({ compact: true, customAttribution: "Natural Earth" }), "bottom-left");
  // Una tesela que no llega (sin red, o el servicio caído) no rompe nada: debajo está el mundo de respaldo
  map.on("error", () => {});

  try {
    await new Promise((resolver, rechazar) => {
      const reloj = setTimeout(() => rechazar(new Error("tiempo")), Math.max(0, limite - Date.now()));
      const listo = () => {
        clearTimeout(reloj);
        resolver();
      };
      if (map.isStyleLoaded()) listo();
      else map.once("style.load", listo);
    });
  } catch {
    map.remove();
    throw new Error(SIN_CONEXION);
  }

  // La capa de las marcas, dentro del contenedor del lienzo: un arrastre que empieza en un pincho mueve el mapa igual
  const svg = d3.select(map.getCanvasContainer()).append("svg")
    .attr("class", "mundi-mapa mm-capa")
    .attr("role", "group")
    .attr("aria-label", "Mapamundi con tus pinchos");
  const gPinchos = svg.append("g").attr("class", "mm-pinchos");
  let pinchos = [];
  let resaltado = null;
  let provisional = null;
  let abajo = null; // dónde empezó el último toque, para no tomar un arrastre por un toque
  svg.on("pointerdown", (e) => { abajo = { x: e.clientX, y: e.clientY }; });

  const ponerColor = (id, propiedad, valor) => {
    try {
      if (map.getLayer(id)) map.setPaintProperty(id, propiedad, valor);
    } catch {
      // un color que MapLibre no entiende deja el que había
    }
  };
  function aplicarPaleta() {
    const nodo = svg.node();
    for (const [clave, variable] of Object.entries(VARIABLES)) nodo.style.setProperty(variable, paleta[clave]);
    ponerColor("mm-visitados", "fill-color", paleta.visitado);
    ponerColor("mm-zonas-relleno", "fill-color", paleta.visitado);
    ponerColor("mm-zonas-borde", "line-color", paleta.visitadoBorde);
  }
  const alCambiarTema = () => {
    paleta = leerPaleta(leer, oscuro.matches);
    aplicarPaleta();
  };
  oscuro.addEventListener("change", alCambiarTema);
  map.once("remove", () => oscuro.removeEventListener("change", alCambiarTema));

  function ajustarCapa() {
    svg.attr("width", contenedor.clientWidth).attr("height", contenedor.clientHeight);
  }

  const enPantalla = (lat, lon) => {
    const p = map.project([lon, Math.max(-LAT_MAXIMA, Math.min(LAT_MAXIMA, lat))]);
    return [p.x, p.y];
  };

  function colorear() {
    map.getSource("mm-zonas")?.setData(zonasGeoJSON(pinchos));
    if (map.getLayer("mm-visitados")) map.setFilter("mm-visitados", filtroVisitados(paisesVisitados(pinchos)));
  }

  function dibujarPinchos() {
    const puntos = pinchos.map((p) => {
      const [x, y] = enPantalla(p.lat, p.lon);
      return { x, y, pincho: p };
    });
    const grupos = marcasPara(puntos, map.getZoom());

    gPinchos.selectAll("g.mm-marca")
      .data(grupos, (g) => g.clave)
      .join((entra) => entra.append("g").each(function (g) {
        const sel = d3.select(this).attr("tabindex", 0).attr("role", "button");
        if (g.polaroid) {
          polaroid(sel, g.pinchos[0]);
        } else if (g.pinchos.length === 1) {
          // Un país con un solo lugar se ve con su pincho, no con un «1»
          cuerpoPincho(sel.append("g").attr("class", "mm-cuerpo"));
          sel.append("circle").attr("class", "mm-toque").attr("cy", -14).attr("r", 18);
        } else {
          sel.append("circle").attr("class", "mm-grupo-fondo").attr("cy", -12).attr("r", 15);
          sel.append("text").attr("class", "mm-grupo-num").attr("y", -12).text(g.pinchos.length);
          sel.append("circle").attr("class", "mm-toque").attr("cy", -12).attr("r", 20);
        }
      }))
      .attr("class", (g) => "mm-marca" + (g.deseo ? " mm-deseo" : "")
        + (g.pinchos.length === 1 && g.pinchos[0].id === resaltado ? " mm-nuevo" : ""))
      .attr("aria-label", etiquetaDe)
      .attr("transform", (g) => `translate(${g.x.toFixed(1)},${g.y.toFixed(1)})`)
      .on("click", (e, g) => {
        e.stopPropagation(); // un toque en una marca no es un toque en el mapa
        if (abajo && Math.hypot(e.clientX - abajo.x, e.clientY - abajo.y) > TOLERANCIA_TOQUE) return;
        tocarGrupo(g);
      })
      .on("keydown", (e, g) => {
        if (e.key !== "Enter" && e.key !== " ") return;
        e.preventDefault();
        tocarGrupo(g);
      })
      .order();

    gPinchos.selectAll("g.mm-provisional").remove();
    if (provisional) {
      const [x, y] = enPantalla(provisional.lat, provisional.lon);
      // Sin la clase mm-marca: no es un pincho de verdad y no entra en el reparto de grupos
      const g = gPinchos.append("g").attr("class", "mm-provisional").attr("transform", `translate(${x},${y})`);
      cuerpoPincho(g.append("g").attr("class", "mm-cuerpo"));
    }
  }

  // Los márgenes, sin pasar de un cuarto del mapa: en un contenedor pequeño, el encuadre siempre cabe
  function holgura(margen) {
    const m = typeof margen === "number" ? { top: margen, right: margen, bottom: margen, left: margen } : margen;
    const w = contenedor.clientWidth / 4;
    const h = contenedor.clientHeight / 4;
    return { top: Math.min(m.top, h), bottom: Math.min(m.bottom, h), left: Math.min(m.left, w), right: Math.min(m.right, w) };
  }

  function ir({ center, zoom }) {
    map.flyTo({ center, zoom, duration: DURACION });
  }

  // Encuadra la caja con ese margen, con el zoom entre `suelo` y `techo`
  function encajar(caja, { margen, suelo = -Infinity, techo }) {
    let camara;
    try {
      camara = map.cameraForBounds(caja, { padding: holgura(margen), maxZoom: techo });
    } catch {
      camara = null;
    }
    if (!camara) return;
    ir({ center: camara.center, zoom: Math.max(suelo, Math.min(techo, camara.zoom)) });
  }

  // Un pincho solo se abre (también el único de un país); un grupo acerca el mapa a sus lugares y el punto de un país
  // con varios, al país entero
  function tocarGrupo(g) {
    if (g.pinchos.length === 1) alTocarPincho(g.pinchos[0]);
    else if (g.porPais) irAlPais(g);
    else encajar(cajaDe(g.pinchos), { margen: 70, techo: TOPE_ENCUADRE });
  }

  // El país entero (su trozo más grande: Francia sin sus islas lejanas) y sus lugares, ya por encima de ZOOM_PAISES
  function irAlPais(g) {
    let caja = cajaDe(g.pinchos);
    const pais = g.pais ? paises.find((f) => f.alfa2 === g.pais) : null;
    if (pais) {
      // Si el trozo cruza la línea de cambio de fecha (oeste > este), solo sus lugares
      const [[po, ps], [pe, pn]] = d3.geoBounds(trozoMayor(pais));
      const [[o, s], [e, n]] = caja;
      if (po <= pe) caja = [[Math.min(o, po), Math.min(s, ps)], [Math.max(e, pe), Math.max(n, pn)]];
    }
    encajar(caja, pais ? { margen: 40, suelo: ZOOM_PAISES + 0.4, techo: TOPE_ENCUADRE } : { margen: 40, techo: ZOOM_PUNTO });
  }

  function trozoMayor(pais) {
    const geo = pais.geometry;
    if (geo?.type !== "MultiPolygon") return pais;
    const trozos = geo.coordinates.map((coordinates) => ({ type: "Polygon", coordinates }));
    return trozos.reduce((mayor, t) => (d3.geoArea(t) > d3.geoArea(mayor) ? t : mayor));
  }

  function paisEn(lat, lon) {
    const p = paises.find((f) => d3.geoContains(f, [lon, lat]));
    return p ? p.alfa2 : null;
  }

  // Un toque en el mapa, fuera de las marcas. Espera un poco por si es el primero de un doble toque (que acerca y no
  // avisa); un toque justo después de hacer zoom tampoco avisa
  let toque = 0;
  let ultimoZoom = -Infinity;
  map.on("zoomstart", () => {
    ultimoZoom = performance.now();
    clearTimeout(toque);
  });
  map.on("dblclick", () => clearTimeout(toque));
  map.on("click", (e) => {
    if (e.originalEvent?.target?.closest?.(".mm-marca")) return;
    const cuando = performance.now();
    if (map.isZooming() || cuando - ultimoZoom < 400) return;
    const { lng, lat } = e.lngLat;
    clearTimeout(toque);
    toque = setTimeout(() => {
      if (ultimoZoom < cuando) avisarPunto(lat, lng);
    }, ESPERA_TOQUE);
  });
  function avisarPunto(lat, lng) {
    // Fuera del mundo (más allá de ±180°, donde no se repite, o de los polos de Mercator) no avisa
    if (!(Math.abs(lng) <= 180) || !(Math.abs(lat) <= LAT_MAXIMA)) return;
    const lon = normalizarLon(lng);
    alTocarPunto({ lat: redondear(lat), lon: redondear(lon), pais: paisEn(lat, lon) });
  }

  map.on("move", dibujarPinchos);
  map.on("resize", () => {
    map.setMinZoom(zoomMinimo(contenedor.clientWidth, contenedor.clientHeight));
    if (vistaPendiente && contenedor.clientHeight > 0) {
      vistaPendiente = false;
      map.jumpTo(vistaInicio());
    }
    ajustarCapa();
    dibujarPinchos();
  });
  ajustarCapa();
  aplicarPaleta();

  return {
    pintar(lista, { resaltar = null } = {}) {
      pinchos = Array.isArray(lista) ? lista.filter((p) => Number.isFinite(p?.lat) && Number.isFinite(p?.lon)) : [];
      resaltado = resaltar;
      gPinchos.selectAll("g.mm-marca").remove(); // se vuelven a crear con el estado nuevo
      colorear();
      dibujarPinchos();
      resaltado = null; // la animación, solo al entrar: no se repite al mover el mapa
    },
    encuadrar() {
      if (!pinchos.length) ir(vistaInicio());
      else if (pinchos.length === 1) ir({ center: [pinchos[0].lon, pinchos[0].lat], zoom: ZOOM_PUNTO });
      else encajar(cajaDe(pinchos), { margen: HUECOS, techo: TOPE_ENCUADRE });
    },
    irA(lat, lon, zoom = ZOOM_PUNTO) {
      ir({ center: [lon, lat], zoom });
    },
    marcarPunto(lat, lon) {
      provisional = lat === null || lat === undefined ? null : { lat, lon };
      dibujarPinchos();
    },
    paisEn,
  };
}
