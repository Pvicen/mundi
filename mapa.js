// Caja Mapa de Mundi (Contrato «Mapa» de docs/contratos.md).
// El mapamundi: países, pinchos agrupados, zoom y toques. Usa los globales `d3` y `topojson` (cargados antes desde
// cdnjs) y descarga la geometría de Natural Earth a 1:50 millones (world-atlas). Los pinchos se dibujan en
// coordenadas de pantalla, encima del mundo, para que no crezcan al acercar.

export const URL_GEOMETRIA = "https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-50m.json";
export const RADIO_GRUPO = 24; // px: pinchos más cerca que esto en pantalla van juntos
const ZOOM_MAXIMO = 120;
const RADIO_ZONA_KM = 9; // la mancha de un lugar sin contorno
const ZOOM_FOTOS = 4; // desde este zoom, los pinchos con foto (portada) se ven como polaroids
const RADIO_GRUPO_FOTOS = 62;
let clipsCreados = 0;

// Un giro pequeño y siempre el mismo para cada pincho, como una foto clavada a mano
function giro(id) {
  let h = 0;
  for (const c of String(id)) h = (h * 31 + c.charCodeAt(0)) | 0;
  return ((Math.abs(h) % 13) - 6) * 1.1;
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
const ZOOM_PUNTO = 6;

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

const ESTILOS = `
.mundi-mapa { display: block; width: 100%; height: 100%; touch-action: none; user-select: none; -webkit-user-select: none; }
.mm-oceano { fill: var(--mar, #CCE0E9); }
.mm-graticula { fill: none; stroke: var(--grat, rgba(15, 42, 58, .09)); stroke-width: 1; vector-effect: non-scaling-stroke; }
.mm-pais { fill: var(--tierra, #FAFBF8); stroke: var(--tierra-borde, #A9BEC7); stroke-width: .7; vector-effect: non-scaling-stroke; transition: fill .4s; }
/* El país visitado, suave; lo fuerte es el lugar (su contorno o su mancha) */
.mm-pais.mm-visitado { fill: color-mix(in srgb, var(--visitado, #F0B23E) 30%, var(--tierra, #FAFBF8)); }
.mm-polaroid-papel { fill: var(--postal, #FFFFFF); stroke: rgba(59, 47, 34, .25); stroke-width: .6; }
.mm-polaroid-sombra { fill: #000000; opacity: .16; }
.mm-polaroid-nombre { font: italic 600 8.5px var(--f-titulo, Georgia, serif); fill: #3B2F22; text-anchor: middle; }
.mm-hilo { stroke: var(--tinta-2, #4C6371); stroke-width: 1.2; stroke-linecap: round; }
.mm-zona { fill: var(--visitado, #F0B23E); fill-opacity: .8; stroke: var(--visitado-borde, #B9821A); stroke-width: 1.2; vector-effect: non-scaling-stroke; pointer-events: none; }
.mm-marca { cursor: pointer; }
.mm-marca:focus { outline: none; }
.mm-sombra { fill: var(--tinta, #0F2A3A); opacity: .22; }
.mm-aguja { stroke: var(--tinta-2, #4C6371); stroke-width: 1.6; stroke-linecap: round; }
.mm-cabeza, .mm-grupo-fondo { fill: var(--pin, #E0352B); stroke: var(--sup, #FFFFFF); }
.mm-cabeza { stroke-width: 1.2; }
.mm-grupo-fondo { stroke-width: 2.5; }
.mm-brillo { fill: #FFFFFF; opacity: .55; }
.mm-toque { fill: transparent; }
.mm-marca:focus-visible .mm-cabeza, .mm-marca:focus-visible .mm-grupo-fondo { stroke: var(--tinta, #0F2A3A); stroke-width: 2.5; }
.mm-grupo-num { font: 600 12px var(--f-dato, ui-monospace, monospace); fill: #FFFFFF; text-anchor: middle; dominant-baseline: central; pointer-events: none; }
.mm-provisional { pointer-events: none; }
.mm-provisional .mm-cabeza { fill: var(--tinta-3, #7A8F9A); }
.mm-nuevo .mm-cuerpo { animation: mm-clavar .7s cubic-bezier(.3, 1.4, .5, 1) both; }
@keyframes mm-clavar { from { transform: translateY(-46px) scale(1.25); opacity: 0; } 60% { opacity: 1; } to { transform: none; opacity: 1; } }
@media (prefers-reduced-motion: reduce) { .mm-pais { transition: none; } .mm-nuevo .mm-cuerpo { animation: none; } }
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

const redondear = (n) => Math.round(n * 1e5) / 1e5;

export async function crearMapa(contenedor, { alTocarPincho = () => {}, alTocarPunto = () => {} } = {}) {
  if (typeof Element === "undefined" || !(contenedor instanceof Element)) {
    throw new TypeError("crearMapa espera el elemento donde va el mapa");
  }
  const d3 = globalThis.d3;
  const topojson = globalThis.topojson;
  if (!d3 || !topojson) throw new Error("Faltan d3 y topojson: hay que cargarlos antes que mapa.js.");

  let mundo;
  try {
    const respuesta = await fetch(URL_GEOMETRIA);
    if (!respuesta.ok) throw new Error(String(respuesta.status));
    mundo = await respuesta.json();
  } catch {
    throw new Error("No se pudo cargar el mapa. Comprueba la conexión y vuelve a intentarlo.");
  }
  const paises = topojson.feature(mundo, mundo.objects.countries).features;
  for (const p of paises) p.alfa2 = alfa2(p);

  ponerEstilos();
  const reducirMovimiento = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const svg = d3.select(contenedor).append("svg")
    .attr("class", "mundi-mapa")
    .attr("role", "group")
    .attr("aria-label", "Mapamundi con tus pinchos");

  let W = 0, H = 0, proyeccion, camino, zoom, gMundo, gZonas, gPinchos;
  let t = d3.zoomIdentity;
  let vistaMundo = d3.zoomIdentity;
  let pinchos = [];
  let resaltado = null;
  let provisional = null;

  function construir() {
    const caja = contenedor.getBoundingClientRect();
    if (!caja.width || !caja.height) return false;
    W = caja.width;
    H = caja.height;
    svg.attr("width", W).attr("height", H).attr("viewBox", `0 0 ${W} ${H}`);
    svg.selectAll("*").remove();

    // El mundo cabe de alto; en un teléfono en vertical sobra de ancho y se arrastra a los lados
    const esfera = { type: "Sphere" };
    proyeccion = d3.geoNaturalEarth1().fitHeight(H * 0.94, esfera);
    camino = d3.geoPath(proyeccion);
    let [[x0, y0], [x1, y1]] = camino.bounds(esfera);
    const [tx, ty] = proyeccion.translate();
    proyeccion.translate([tx + W / 2 - (x0 + x1) / 2, ty + H / 2 - (y0 + y1) / 2]);
    [[x0, y0], [x1, y1]] = camino.bounds(esfera);

    gMundo = svg.append("g");
    gMundo.append("path").attr("class", "mm-oceano").attr("d", camino(esfera));
    gMundo.append("path").attr("class", "mm-graticula").attr("d", camino(d3.geoGraticule10()));
    gMundo.selectAll("path.mm-pais").data(paises).join("path").attr("class", "mm-pais").attr("d", camino);
    gZonas = gMundo.append("g").attr("class", "mm-zonas");
    gPinchos = svg.append("g").attr("class", "mm-pinchos");

    // Vista inicial: el mundo entero si así ocupa al menos el 60 % del alto; si no (teléfono en vertical), de alto
    const kMin = Math.min(1, W / (x1 - x0));
    const k0 = kMin >= 0.6 ? kMin : 1;
    vistaMundo = d3.zoomIdentity.translate((W / 2) * (1 - k0), (H / 2) * (1 - k0)).scale(k0);
    zoom = d3.zoom()
      .scaleExtent([kMin, ZOOM_MAXIMO])
      .translateExtent([[x0 - 20, y0 - 60], [x1 + 20, y1 + 60]])
      .on("zoom", (e) => {
        t = e.transform;
        gMundo.attr("transform", t);
        dibujarPinchos();
      });
    svg.call(zoom).on("click", tocarMapa);
    svg.call(zoom.transform, vistaMundo);
    colorear();
    return true;
  }

  function colorear() {
    if (!gMundo) return;
    const visitados = new Set(pinchos.map((p) => p.pais).filter(Boolean));
    gMundo.selectAll("path.mm-pais").classed("mm-visitado", (d) => d.alfa2 !== null && visitados.has(d.alfa2));
    // La zona de cada lugar: su contorno real si lo trae (GeoJSON) o una mancha redonda alrededor del pincho
    const formas = pinchos.map((p) =>
      p.forma ? rebobinar(p.forma) : d3.geoCircle().center([p.lon, p.lat]).radius(RADIO_ZONA_KM / 111.32)());
    gZonas.selectAll("path.mm-zona").data(formas).join("path").attr("class", "mm-zona").attr("d", camino);
  }

  // d3 quiere los anillos exteriores en sentido horario; GeoJSON (RFC 7946) los trae al revés
  function rebobinar(geom) {
    const anillos = geom.type === "Polygon" ? [geom.coordinates] : geom.type === "MultiPolygon" ? geom.coordinates : [];
    // Si el exterior sale «al revés» (más de medio mundo), se dan la vuelta todos sus anillos, también los huecos
    const poligonos = anillos.map((pol) =>
      d3.geoArea({ type: "Polygon", coordinates: [pol[0]] }) > 2 * Math.PI ? pol.map((anillo) => [...anillo].reverse()) : pol);
    return { type: "MultiPolygon", coordinates: poligonos };
  }

  const enPantalla = (lat, lon) => t.apply(proyeccion([lon, lat]));

  function dibujarPinchos() {
    if (!gPinchos) return;
    const puntos = pinchos.map((p) => {
      const [x, y] = enPantalla(p.lat, p.lon);
      return { x, y, pincho: p };
    });
    const conFotos = t.k >= ZOOM_FOTOS;
    const grupos = agrupar(puntos, conFotos ? RADIO_GRUPO_FOTOS : RADIO_GRUPO);
    for (const g of grupos) {
      g.polaroid = conFotos && g.pinchos.length === 1 && !!g.pinchos[0].portada;
      g.clave = (g.polaroid ? "f:" : "p:") + g.pinchos.map((p) => p.id).sort().join("|");
    }

    gPinchos.selectAll("g.mm-marca")
      .data(grupos, (g) => g.clave)
      .join((entra) => entra.append("g").each(function (g) {
        const sel = d3.select(this).attr("tabindex", 0).attr("role", "button");
        if (g.polaroid) {
          polaroid(sel, g.pinchos[0]);
        } else if (g.pinchos.length === 1) {
          cuerpoPincho(sel.append("g").attr("class", "mm-cuerpo"));
          sel.append("circle").attr("class", "mm-toque").attr("cy", -14).attr("r", 18);
        } else {
          sel.append("circle").attr("class", "mm-grupo-fondo").attr("cy", -12).attr("r", 15);
          sel.append("text").attr("class", "mm-grupo-num").attr("y", -12).text(g.pinchos.length);
          sel.append("circle").attr("class", "mm-toque").attr("cy", -12).attr("r", 20);
        }
      }))
      .attr("class", (g) => "mm-marca" + (g.pinchos.length === 1 && g.pinchos[0].id === resaltado ? " mm-nuevo" : ""))
      .attr("aria-label", (g) => g.pinchos.length === 1
        ? g.pinchos[0].nombre
        : `${g.pinchos.length} lugares: ${g.pinchos.map((p) => p.nombre).join(", ")}`)
      .attr("transform", (g) => `translate(${g.x.toFixed(1)},${g.y.toFixed(1)})`)
      .on("click", (e, g) => {
        e.stopPropagation();
        if (g.pinchos.length === 1) alTocarPincho(g.pinchos[0]);
        else ir(transformacionPara(g.pinchos, 70));
      })
      .on("keydown", (e, g) => {
        if (e.key !== "Enter" && e.key !== " ") return;
        e.preventDefault();
        if (g.pinchos.length === 1) alTocarPincho(g.pinchos[0]);
        else ir(transformacionPara(g.pinchos, 70));
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

  function transformacionPara(lista, margen, kPunto = ZOOM_PUNTO) {
    const puntos = lista.map((p) => proyeccion([p.lon, p.lat]));
    const [x0, x1] = d3.extent(puntos, (d) => d[0]);
    const [y0, y1] = d3.extent(puntos, (d) => d[1]);
    const [kMin, kMax] = zoom.scaleExtent();
    const ajuste = Math.min((W - margen * 2) / Math.max(x1 - x0, 1), (H - margen * 2) / Math.max(y1 - y0, 1));
    const k = Math.max(kMin, Math.min(lista.length === 1 ? kPunto : kMax, ajuste));
    return d3.zoomIdentity.translate(W / 2, H / 2).scale(k).translate(-(x0 + x1) / 2, -(y0 + y1) / 2);
  }

  function ir(transformacion, animado = true) {
    if (!zoom) return;
    (animado && !reducirMovimiento ? svg.transition().duration(850) : svg).call(zoom.transform, transformacion);
  }

  function tocarMapa(e) {
    const [x, y] = d3.pointer(e, svg.node());
    const [mx, my] = t.invert([x, y]);
    const lonLat = proyeccion.invert([mx, my]);
    if (!lonLat || !lonLat.every(Number.isFinite)) return;
    const [lon, lat] = lonLat;
    // Fuera de la esfera, la inversa no vuelve al mismo sitio: ese toque no es un punto del mundo
    const [px, py] = proyeccion([lon, lat]);
    if (Math.abs(lon) > 180 || Math.abs(lat) > 90 || Math.hypot(px - mx, py - my) > 0.5) return;
    alTocarPunto({ lat: redondear(lat), lon: redondear(lon), pais: paisEn(lat, lon) });
  }

  function paisEn(lat, lon) {
    const p = paises.find((f) => d3.geoContains(f, [lon, lat]));
    return p ? p.alfa2 : null;
  }

  let pendiente = 0;
  const observador = new ResizeObserver(() => {
    cancelAnimationFrame(pendiente);
    pendiente = requestAnimationFrame(() => {
      const caja = contenedor.getBoundingClientRect();
      if (caja.width === W && caja.height === H) return;
      if (construir()) {
        dibujarPinchos();
        if (pinchos.length) ir(transformacionPara(pinchos, 48), false);
      }
    });
  });
  observador.observe(contenedor);
  construir();

  return {
    pintar(lista, { resaltar = null } = {}) {
      pinchos = Array.isArray(lista) ? lista.filter((p) => Number.isFinite(p?.lat) && Number.isFinite(p?.lon)) : [];
      resaltado = resaltar;
      gPinchos?.selectAll("g.mm-marca").remove(); // se vuelven a crear con el estado nuevo
      colorear();
      dibujarPinchos();
      resaltado = null; // la animación, solo al entrar: no se repite al hacer zoom
    },
    encuadrar() {
      if (!zoom) return;
      ir(pinchos.length ? transformacionPara(pinchos, 48) : vistaMundo);
    },
    irA(lat, lon, k = ZOOM_PUNTO) {
      if (zoom) ir(transformacionPara([{ lat, lon }], 70, k));
    },
    marcarPunto(lat, lon) {
      provisional = lat === null || lat === undefined ? null : { lat, lon };
      dibujarPinchos();
    },
    paisEn,
  };
}
