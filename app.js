// Interfaz de Mundi (Contrato «Interfaz» de docs/contratos.md): entrar, el mapa con tus pinchos, añadir, editar y
// borrar lugares con sus fotos, y tus cifras. Todo lo que va a Supabase pasa por `datos`; los textos se ponen con
// textContent (nada de innerHTML con datos).
import { SUPABASE_URL, SUPABASE_CLAVE } from "./config.js";
import { crearMapa, formaValida } from "./mapa.js";
import { prepararFoto, LADO_MINIATURA } from "./fotos.js";
import { crearZip, nombreSeguro } from "./copia.js";
import { textoCompartir } from "./puente.js";

const ALMACEN = "mundi-fotos";
const COLUMNAS = "id, nombre, pais, lat, lon, fecha, relato, fotos, forma, miniatura, estado, creado_en";
const MAX_FORMA = 60000; // caracteres del contorno que se guarda (la base admite 100 KB)
const MAX_FOTOS = 30;
const SEGUNDOS_URL = 3600;
const TOTAL_PAISES = 195;
const NOMINATIM = "https://nominatim.openstreetmap.org";
const EN_LOCAL = ["localhost", "127.0.0.1"].includes(location.hostname);

/* ---------- Utilidades ---------- */
const $ = (selector) => document.querySelector(selector);

function el(etiqueta, clase, texto) {
  const e = document.createElement(etiqueta);
  if (clase) e.className = clase;
  if (texto !== undefined && texto !== null) e.textContent = texto;
  return e;
}

function icono(d) {
  const ns = "http://www.w3.org/2000/svg";
  const s = document.createElementNS(ns, "svg");
  s.setAttribute("viewBox", "0 0 24 24");
  s.setAttribute("aria-hidden", "true");
  const p = document.createElementNS(ns, "path");
  p.setAttribute("d", d);
  s.append(p);
  return s;
}

const nombresPais = new Intl.DisplayNames(["es"], { type: "region" });
function nombrePais(codigo) {
  if (!codigo) return "Sin país";
  try {
    return nombresPais.of(codigo) || codigo;
  } catch {
    return codigo;
  }
}

function bandera(codigo) {
  if (!codigo || !/^[A-Z]{2}$/.test(codigo)) return "";
  return String.fromCodePoint(...[...codigo].map((letra) => 0x1f1e6 + letra.charCodeAt(0) - 65));
}

const formatoMes = new Intl.DateTimeFormat("es", { month: "long", year: "numeric" });
function textoFecha(fecha) {
  const [anio, mes] = fecha.split("-").map(Number);
  const texto = formatoMes.format(new Date(anio, mes - 1, 1));
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

function coordenadas(lat, lon) {
  const f = (n) => Math.abs(n).toFixed(2).replace(".", ",");
  return `${f(lat)}° ${lat < 0 ? "S" : "N"} · ${f(lon)}° ${lon < 0 ? "O" : "E"}`;
}

const redondear = (n) => Math.round(n * 1e5) / 1e5;

let avisoTemporizador = 0;
function avisar(texto) {
  const aviso = $("#aviso");
  aviso.textContent = texto;
  aviso.classList.add("visible");
  clearTimeout(avisoTemporizador);
  avisoTemporizador = setTimeout(() => aviso.classList.remove("visible"), 3200);
}

function ordenar(lista) {
  return lista.sort((a, b) =>
    (b.fecha ?? "").localeCompare(a.fecha ?? "") || (b.creado_en ?? "").localeCompare(a.creado_en ?? ""));
}

/* ---------- Datos (Supabase) ---------- */
function traducirErrorEntrar(error) {
  const m = error?.message ?? "";
  if (/invalid login credentials/i.test(m)) return "Correo o contraseña incorrectos.";
  if (/email not confirmed/i.test(m)) return "Esta cuenta aún no tiene el correo confirmado.";
  if (/fetch|network/i.test(m)) return "Sin conexión. Inténtalo de nuevo.";
  return m || "No se pudo entrar.";
}

function crearDatosSupabase() {
  const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_CLAVE, {
    // La sesión se guarda aparte de la de la App de avisos, que vive en el mismo dominio
    auth: { storageKey: "mundi-sesion", persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
  });
  const comprobar = ({ data, error }) => {
    if (error) throw new Error(error.message);
    return data;
  };
  const usuario = (u) => (u ? { id: u.id, correo: u.email } : null);
  const pinchos = () => sb.from("mundi_pinchos");
  return {
    async sesion() {
      const { data } = await sb.auth.getSession();
      return usuario(data.session?.user);
    },
    async entrar(correo, clave) {
      const { data, error } = await sb.auth.signInWithPassword({ email: correo, password: clave });
      if (error) throw new Error(traducirErrorEntrar(error));
      return usuario(data.user);
    },
    async salir() {
      await sb.auth.signOut({ scope: "local" });
    },
    async esPersona() {
      return comprobar(await sb.rpc("mundi_es_persona")) === true;
    },
    async listar() {
      return comprobar(await pinchos().select(COLUMNAS)
        .order("fecha", { ascending: false, nullsFirst: false })
        .order("creado_en", { ascending: false }));
    },
    async crear(fila) {
      return comprobar(await pinchos().insert(fila).select(COLUMNAS).single());
    },
    async actualizar(id, campos) {
      return comprobar(await pinchos().update(campos).eq("id", id).select(COLUMNAS).single());
    },
    async borrar(id) {
      comprobar(await pinchos().delete().eq("id", id));
    },
    async subirFoto(ruta, blob) {
      comprobar(await sb.storage.from(ALMACEN).upload(ruta, blob, { contentType: "image/jpeg", upsert: false }));
    },
    async urlsFirmadas(rutas) {
      if (!rutas.length) return {};
      const lista = comprobar(await sb.storage.from(ALMACEN).createSignedUrls(rutas, SEGUNDOS_URL));
      return Object.fromEntries(lista.filter((x) => x.signedUrl).map((x) => [x.path, x.signedUrl]));
    },
    async quitarFotos(rutas) {
      if (rutas.length) comprobar(await sb.storage.from(ALMACEN).remove(rutas));
    },
    async fotosEn(carpeta) {
      const lista = comprobar(await sb.storage.from(ALMACEN).list(carpeta, { limit: 1000 }));
      return lista.filter((x) => x.id).map((x) => `${carpeta}/${x.name}`); // sin id: subcarpetas
    },
  };
}

// En localhost, ?ejemplo prueba la app con lugares inventados en memoria (sin Supabase)
const EJEMPLO = EN_LOCAL && new URLSearchParams(location.search).has("ejemplo");
const datos = EJEMPLO
  ? (await import("./setup/pruebas/datos-ejemplo.js")).crearDatosEjemplo()
  : crearDatosSupabase();
if (EJEMPLO) window.datosEjemplo = datos; // para mirar el estado desde la consola en las pruebas

/* ---------- Estado ---------- */
let yo = null; // { id, correo }
let pinchos = [];
let mapa = null;
let abierto = null; // el pincho de la ficha
let elegirEnMapa = false;
let form = null; // el formulario abierto: { editando, donde, existentes, quitadas, nuevas, guardando }
let turnoFotos = 0;
let filtro = "todos"; // "todos", un año ("2025") o "sin-fecha"
const urls = new Map(); // ruta → { url, hasta }

/* ---------- Instalar en el teléfono ---------- */
// Chrome avisa (beforeinstallprompt) cuando se puede instalar: se guarda el aviso y se lanza al pulsar el botón.
// Si no hay aviso y no está instalada, una pista de cómo hacerlo a mano.
let avisoInstalar = null;
let recienInstalada = false; // instalada desde esta pestaña: la pista ya no hace falta
const instalada = () =>
  recienInstalada || matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
const esIphone = /iPhone|iPad|iPod/.test(navigator.userAgent);

function pintarInstalar() {
  const puede = !!avisoInstalar && !instalada();
  for (const boton of document.querySelectorAll(".boton-instalar")) boton.hidden = !puede;
  const pista = $("#instalar-pista");
  pista.hidden = puede || instalada();
  pista.textContent = esIphone
    ? "Para tenerla como app: botón Compartir → «Añadir a pantalla de inicio»."
    : "Para tenerla como app: en Chrome, menú ⋮ → «Instalar app».";
}

async function instalar() {
  const aviso = avisoInstalar;
  if (!aviso) return;
  avisoInstalar = null; // Chrome solo deja usarlo una vez
  await aviso.prompt();
  await aviso.userChoice.catch(() => null);
  pintarInstalar();
}

window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault(); // sin la barra automática: se ofrece con el botón
  avisoInstalar = e;
  pintarInstalar();
});
window.addEventListener("appinstalled", () => {
  avisoInstalar = null;
  recienInstalada = true;
  pintarInstalar();
  avisar("Mundi instalada: ya la tienes con su icono.");
});

/* ---------- Pantallas ---------- */
function mostrar(id) {
  for (const p of ["pantalla-carga", "pantalla-entrar", "pantalla-sin-acceso", "app"]) $("#" + p).hidden = p !== id;
}

async function arrancar() {
  ponerEventos();
  pintarInstalar();
  if ("serviceWorker" in navigator && !EN_LOCAL) navigator.serviceWorker.register("./sw.js").catch(() => {});
  try {
    yo = await datos.sesion();
  } catch {
    yo = null;
  }
  if (yo) await abrirApp();
  else mostrar("pantalla-entrar");
}

async function entrar(e) {
  e.preventDefault();
  const correo = $("#entrar-correo").value.trim();
  const clave = $("#entrar-clave").value;
  const error = $("#entrar-error");
  error.hidden = true;
  if (!correo || !clave) {
    error.textContent = "Escribe tu correo y tu contraseña.";
    error.hidden = false;
    return;
  }
  const boton = $("#entrar-boton");
  boton.disabled = true;
  boton.textContent = "Entrando…";
  try {
    yo = await datos.entrar(correo, clave);
    $("#entrar-clave").value = "";
    await abrirApp();
  } catch (err) {
    error.textContent = err.message;
    error.hidden = false;
  } finally {
    boton.disabled = false;
    boton.textContent = "Entrar";
  }
}

async function salir() {
  try {
    await datos.salir();
  } finally {
    location.reload();
  }
}

async function abrirApp() {
  mostrar("pantalla-carga");
  $("#carga-texto").textContent = "Cargando…";
  $("#carga-reintentar").hidden = true;
  let permitido;
  try {
    permitido = await datos.esPersona();
  } catch {
    $("#carga-texto").textContent = "No se pudo conectar con Mundi. Comprueba la conexión.";
    $("#carga-reintentar").hidden = false;
    return;
  }
  if (!permitido) {
    $("#sin-acceso-texto").textContent = `${yo.correo} no está en la lista de Mundi.`;
    mostrar("pantalla-sin-acceso");
    return;
  }
  mostrar("app");
  await Promise.all([iniciarMapa(), cargarPinchos()]);
  pintar();
  mapa?.encuadrar();
}

async function iniciarMapa() {
  $("#sin-mapa").hidden = true;
  $("#mapa").replaceChildren();
  try {
    mapa = await crearMapa($("#mapa"), { alTocarPincho: abrirLugar, alTocarPunto: tocarPunto });
  } catch (e) {
    mapa = null;
    $("#sin-mapa-texto").textContent = e.message;
    $("#sin-mapa").hidden = false;
  }
}

async function cargarPinchos() {
  try {
    pinchos = ordenar(await datos.listar());
  } catch (e) {
    avisar("No se pudieron cargar tus lugares: " + e.message);
  }
}

/* ---------- Filtro por año ---------- */
const esDeseo = (p) => p.estado === "quiero_ir"; // un sitio al que quiere ir (no cuenta como visitado)
const anioDe = (p) => (esDeseo(p) ? "quiero-ir" : p.fecha ? p.fecha.slice(0, 4) : "sin-fecha");
const visibles = () => (filtro === "todos" ? pinchos : pinchos.filter((p) => anioDe(p) === filtro));

function pintarFiltro() {
  const estuve = pinchos.filter((p) => !esDeseo(p));
  const anios = [...new Set(estuve.filter((p) => p.fecha).map(anioDe))].sort().reverse();
  const opciones = [
    ...anios,
    ...(estuve.some((p) => !p.fecha) ? ["sin-fecha"] : []),
    ...(pinchos.some(esDeseo) ? ["quiero-ir"] : []),
  ];
  if (filtro !== "todos" && !opciones.includes(filtro)) filtro = "todos";
  const barra = $("#filtro-anio");
  barra.hidden = opciones.length < 2;
  barra.replaceChildren(...["todos", ...opciones].map((valor) => {
    const boton = el("button", null, valor === "todos" ? "Todos" : valor === "sin-fecha" ? "Sin fecha" : valor === "quiero-ir" ? "Quiero ir" : valor);
    boton.type = "button";
    boton.setAttribute("aria-pressed", String(valor === filtro));
    boton.addEventListener("click", () => {
      filtro = valor;
      pintar();
      mapa?.encuadrar();
    });
    return boton;
  }));
}

function pintar(resaltar = null) {
  pintarFiltro();
  const lista = visibles();
  mapa?.pintar(lista.map((p) => ({ ...p, portada: portadaDe(p) })), { resaltar });
  firmarPortadas();
  const estuve = lista.filter((p) => !esDeseo(p));
  const paises = new Set(estuve.map((p) => p.pais).filter(Boolean)).size;
  $("#cifras").replaceChildren(...(filtro === "quiero-ir"
    ? [el("b", null, String(lista.length)), " por visitar"]
    : [el("b", null, String(paises)), ` ${paises === 1 ? "país" : "países"} · `,
      el("b", null, String(estuve.length)), ` ${estuve.length === 1 ? "lugar" : "lugares"}`]));
  $("#vacio").hidden = pinchos.length > 0;
}

/* ---------- Portadas del mapa (polaroids) ---------- */
// La miniatura se llama como la primera foto; si no coincide (p. ej., quedó una vieja), se usa la foto entera
const miniaturaEsperada = (p) => (p.fotos?.[0] ? p.fotos[0].replace(/\/([^/]+)\.jpg$/, "/miniatura-$1.jpg") : null);
function rutaPortada(p) {
  const primera = p.fotos?.[0] ?? null;
  if (!primera) return null;
  return p.miniatura && p.miniatura === miniaturaEsperada(p) ? p.miniatura : primera;
}
function portadaDe(p) {
  const enlace = urls.get(rutaPortada(p));
  return enlace && enlace.hasta > Date.now() ? enlace.url : null;
}

const intentosPortada = new Map(); // ruta → cuándo se pidió su enlace (no se repite antes de 5 min)
async function firmarPortadas() {
  const ahora = Date.now();
  const faltan = [...new Set(pinchos.map(rutaPortada))].filter((r) =>
    r && !(urls.get(r)?.hasta > ahora) && !(intentosPortada.get(r) > ahora - 300000));
  if (!faltan.length) return;
  for (const r of faltan) intentosPortada.set(r, ahora);
  await firmar(faltan);
  pintar();
}

/* ---------- Contorno del lugar ---------- */
// Solo polígonos, con 4 decimales (unos 11 m) y hasta MAX_FORMA caracteres; si no, null (el mapa pinta una mancha)
function normalizarForma(geo) {
  if (!geo || (geo.type !== "Polygon" && geo.type !== "MultiPolygon") || !Array.isArray(geo.coordinates)) return null;
  const redondearTodo = (c) => (typeof c === "number" ? Math.round(c * 1e4) / 1e4 : c.map(redondearTodo));
  let forma = { type: geo.type, coordinates: redondearTodo(geo.coordinates) };
  if (forma.type === "MultiPolygon") {
    // Se quedan solo los polígonos que se pueden dibujar
    forma = { type: "MultiPolygon", coordinates: forma.coordinates.filter((pol) => formaValida({ type: "Polygon", coordinates: pol })) };
  }
  return formaValida(forma) && JSON.stringify(forma).length <= MAX_FORMA ? forma : null;
}

// El lugar de un punto (su ciudad o pueblo) según Nominatim: { nombre, forma }, o null si no responde
async function lugarEn(lat, lon) {
  try {
    const url = new URL(NOMINATIM + "/reverse");
    url.search = new URLSearchParams({
      lat, lon, format: "jsonv2", zoom: "10", polygon_geojson: "1", polygon_threshold: "0.001", "accept-language": "es",
    });
    const respuesta = await fetch(url);
    if (!respuesta.ok) return null;
    const d = await respuesta.json();
    if (d.error) return { nombre: null, forma: null }; // en el mar: sin lugar
    const a = d.address ?? {};
    const nombre = a.city || a.town || a.village || a.municipality || a.county || a.state || d.name || null;
    return { nombre, forma: normalizarForma(d.geojson) };
  } catch {
    return null;
  }
}

/* ---------- Hojas ---------- */
function abrirHoja(id) {
  for (const h of document.querySelectorAll(".hoja.abierta")) if (h.id !== id) h.classList.remove("abierta");
  $("#velo").hidden = false;
  const hoja = $("#" + id);
  hoja.classList.add("abierta");
  hoja.querySelector(".contenido").scrollTop = 0;
}

function cerrarHojas({ conservarForm = false } = {}) {
  if (form?.guardando) return;
  for (const h of document.querySelectorAll(".hoja.abierta")) h.classList.remove("abierta");
  $("#velo").hidden = true;
  if (!conservarForm) descartarForm();
}

/* ---------- Fotos firmadas ---------- */
async function firmar(rutas) {
  const ahora = Date.now();
  const faltan = rutas.filter((r) => !(urls.get(r)?.hasta > ahora));
  if (faltan.length) {
    try {
      const nuevas = await datos.urlsFirmadas(faltan);
      for (const [ruta, url] of Object.entries(nuevas)) {
        urls.set(ruta, { url, hasta: ahora + (SEGUNDOS_URL - 300) * 1000 });
      }
    } catch {
      avisar("No se pudieron cargar las fotos.");
    }
  }
  return Object.fromEntries(rutas.filter((r) => urls.has(r)).map((r) => [r, urls.get(r).url]));
}

/* ---------- Ficha de un lugar: una pantalla aparte ---------- */
// Al abrirla se añade un paso al historial: el «atrás» del teléfono la cierra y vuelve al mapa en vez de salir
let pasoFicha = false; // hay en el historial un paso de la ficha que aún no se ha gastado
const fichaAbierta = () => $("#ficha").classList.contains("abierta");

let fotosFicha = []; // los enlaces de las fotos que enseña la ficha, para el visor
async function abrirLugar(p) {
  if (elegirEnMapa) return;
  abierto = p;
  const ficha = $("#ficha");
  const portada = $("#lugar-portada");
  const pais = `${bandera(p.pais)} ${nombrePais(p.pais)}`.trim();
  $("#lugar-meta").replaceChildren(el("span", "sello", esDeseo(p) ? `Quiero ir · ${pais}` : pais));
  $("#lugar-titulo").textContent = p.nombre;
  const nFotos = p.fotos?.length ?? 0;
  $("#lugar-cuando").textContent = [p.fecha ? textoFecha(p.fecha) : null, esDeseo(p) ? "Todavía no has ido" : null,
    nFotos ? `${nFotos} ${nFotos === 1 ? "foto" : "fotos"}` : null].filter(Boolean).join(" · ");
  $("#lugar-relato").textContent = p.relato || "";
  $("#lugar-coords").textContent = coordenadas(p.lat, p.lon);
  $("#lugar-ya-fui").hidden = !esDeseo(p);
  $("#lugar-fotos").replaceChildren();
  fotosFicha = [];
  portada.style.backgroundImage = "";
  portada.classList.toggle("con-foto", nFotos > 0);
  portada.classList.toggle("sin-foto", nFotos === 0);
  portada.classList.toggle("deseo", esDeseo(p));

  if (!fichaAbierta()) {
    ficha.scrollTop = 0;
    ficha.classList.add("abierta");
    ficha.setAttribute("aria-hidden", "false");
    if (!pasoFicha) {
      history.pushState({ mundi: "ficha" }, "");
      pasoFicha = true;
    }
    setTimeout(() => { if (fichaAbierta()) $("#lugar-volver").focus({ preventScroll: true }); }, 340);
  }
  if (!nFotos) return;

  const enlaces = await firmar(p.fotos);
  if (abierto !== p) return;
  fotosFicha = p.fotos.map((r) => enlaces[r]).filter(Boolean);
  if (!fotosFicha.length) return;
  // Entre comillas y con las comillas y barras escapadas, venga el enlace como venga
  portada.style.backgroundImage = `url("${fotosFicha[0].replace(/["\\]/g, "\\$&")}")`;
  $("#lugar-fotos").replaceChildren(...fotosFicha.slice(1).map((url, i) => {
    const boton = el("button", "polaroid");
    boton.type = "button";
    boton.setAttribute("aria-label", `Ver la foto ${i + 2} de ${fotosFicha.length}`);
    const img = el("img");
    img.src = url;
    img.alt = "";
    img.loading = "lazy";
    img.decoding = "async";
    boton.append(img, el("span", null, `${p.nombre} · ${i + 2} de ${fotosFicha.length}`));
    boton.addEventListener("click", () => abrirVisor(fotosFicha, i + 1));
    return boton;
  }));
}

// Cierra la ficha; si su paso sigue en el historial, se gasta (el «atrás» de después no la vuelve a pedir)
function cerrarFicha() {
  if (!fichaAbierta()) return;
  const ficha = $("#ficha");
  ficha.classList.remove("abierta");
  ficha.setAttribute("aria-hidden", "true");
  abierto = null;
  if (pasoFicha) {
    pasoFicha = false;
    history.back();
  }
}

// El «atrás» del teléfono: cierra lo que esté encima (el visor o una hoja) y, si no hay nada, la ficha
function alVolver() {
  if (!pasoFicha) return; // el paso no era de la ficha
  if (!$("#visor").hidden || document.querySelector(".hoja.abierta")) {
    if (!$("#visor").hidden) cerrarVisor();
    else cerrarHojas();
    history.pushState({ mundi: "ficha" }, ""); // la ficha sigue abierta: su paso vuelve al historial
    return;
  }
  pasoFicha = false;
  if (fichaAbierta()) {
    $("#ficha").classList.remove("abierta");
    $("#ficha").setAttribute("aria-hidden", "true");
    abierto = null;
  }
}

// Compartir (Contrato «Puente con la App de avisos»): nombre y enlace de mapa; sin navigator.share, al portapapeles
async function compartir() {
  const p = abierto;
  if (!p) return;
  const texto = textoCompartir(p);
  if (navigator.share) {
    try {
      await navigator.share({ title: p.nombre, text: texto });
      return;
    } catch (e) {
      if (e.name === "AbortError") return; // lo cerró sin elegir
    }
  }
  try {
    await navigator.clipboard.writeText(texto);
    avisar("Copiado: pégalo donde quieras.");
  } catch {
    avisar("No se pudo compartir ni copiar.");
  }
}

// Mientras se cambia el estado de un pincho, su ficha no deja editar, borrar ni repetir «Ya fui»
let cambiandoEstado = false;
function bloquearFicha(si) {
  cambiandoEstado = si;
  for (const boton of ["#lugar-ya-fui", "#lugar-editar", "#lugar-borrar"]) $(boton).disabled = si;
}

// Un «quiero ir» al que ya fue: pasa a visitado con el mes de hoy
async function yaFui() {
  const p = abierto;
  if (!p || !esDeseo(p) || cambiandoEstado) return;
  bloquearFicha(true);
  const hoy = new Date();
  const fecha = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}-01`;
  try {
    const nuevo = await datos.actualizar(p.id, { estado: "visitado", fecha });
    pinchos = ordenar(pinchos.map((x) => (x.id === nuevo.id ? nuevo : x)));
    if (filtro === "quiero-ir") filtro = "todos";
    pintar(nuevo.id);
    // Solo se repinta la ficha si sigue enseñando este lugar y no hay un formulario abierto encima
    if (abierto?.id === nuevo.id && !form) abrirLugar(nuevo);
    avisar("¡A tu mapa! Edítalo para añadir fotos y el relato.");
  } catch (e) {
    avisar("No se pudo cambiar: " + e.message);
  } finally {
    bloquearFicha(false);
  }
}

async function borrarLugar() {
  const p = abierto;
  if (cambiandoEstado || !p || !confirm(`¿Borrar «${p.nombre}» y sus fotos? No se puede deshacer.`)) return;
  try {
    // Las que cita la fila y todo lo que haya en su carpeta (p. ej., fotos subidas en un guardado que falló)
    const rutas = new Set([...(p.fotos ?? []), ...(await datos.fotosEn(`${yo.id}/${p.id}`))]);
    if (rutas.size) await datos.quitarFotos([...rutas]);
    await datos.borrar(p.id);
    pinchos = pinchos.filter((x) => x.id !== p.id);
    cerrarHojas();
    cerrarFicha();
    pintar();
    avisar("Lugar borrado.");
  } catch (e) {
    avisar("No se pudo borrar: " + e.message);
  }
}

function abrirVisor(lista, inicio) {
  const caja = $("#visor-fotos");
  caja.replaceChildren(...lista.map((url) => {
    const img = el("img");
    img.src = url;
    img.alt = "";
    return img;
  }));
  $("#visor").hidden = false;
  requestAnimationFrame(() => { caja.scrollLeft = inicio * caja.clientWidth; });
  $("#visor-cerrar").focus();
}

function cerrarVisor() {
  $("#visor").hidden = true;
  $("#visor-fotos").replaceChildren();
}

/* ---------- Formulario: nuevo lugar o editar ---------- */
const estadoForm = () => document.querySelector('input[name="estado"]:checked')?.value ?? "visitado";
// Un «quiero ir» no tiene fecha: el campo «Cuándo» se esconde
function pintarEstadoForm() {
  $("#campo-cuando").hidden = estadoForm() === "quiero_ir";
}

function abrirForm(p = null) {
  descartarForm();
  form = {
    editando: p,
    donde: p ? { lat: p.lat, lon: p.lon, pais: p.pais, forma: p.forma ?? undefined } : null,
    existentes: p ? [...(p.fotos ?? [])] : [],
    quitadas: [],
    nuevas: [],
    preparando: 0, // fotos elegidas que aún se están preparando
    guardando: false,
  };
  $("#form-titulo").textContent = p ? "Editar lugar" : "Nuevo lugar";
  $("#campo-nombre").value = p?.nombre ?? "";
  const estado = p?.estado ?? (filtro === "quiero-ir" ? "quiero_ir" : "visitado");
  for (const r of document.querySelectorAll('input[name="estado"]')) r.checked = r.value === estado;
  pintarEstadoForm();
  $("#campo-fecha").value = p?.fecha ? p.fecha.slice(0, 7) : "";
  $("#campo-relato").value = p?.relato ?? "";
  $("#buscar-texto").value = "";
  $("#sugerencias").hidden = true;
  ponerError(null);
  ponerEstado(null);
  pintarDonde();
  pintarFotosForm();
  validarForm();
  abrirHoja("hoja-form");
}

function descartarForm() {
  if (!form) return;
  for (const n of form.nuevas) URL.revokeObjectURL(n.url);
  form = null;
  mapa?.marcarPunto(null);
}

function ponerError(texto) {
  const e = $("#form-error");
  e.textContent = texto ?? "";
  e.hidden = !texto;
}

function ponerEstado(texto) {
  const e = $("#form-estado");
  e.textContent = texto ?? "";
  e.hidden = !texto;
}

function validarForm() {
  $("#guardar").disabled =
    !form || form.guardando || form.preparando > 0 || !form.donde || !$("#campo-nombre").value.trim();
  // Mientras guarda, el formulario no se toca: lo que se añadiera ya no entraría en el guardado
  $("#form-lugar").inert = !!form?.guardando;
}

function pintarDonde() {
  const d = form?.donde;
  $("#donde-elegido").hidden = !d;
  $("#donde-buscar").hidden = !!d;
  if (!d) return;
  $("#donde-nombre").textContent = `${bandera(d.pais)} ${nombrePais(d.pais)}`.trim();
  $("#donde-coords").textContent = coordenadas(d.lat, d.lon);
}

// forma: el contorno si ya se sabe (o null si no tiene); sin él, se pide después (completarLugar o al guardar)
function elegirLugar(lat, lon, pais, nombre, forma = undefined) {
  if (!form || form.guardando) return;
  form.donde = {
    lat: redondear(lat), lon: redondear(lon), pais: pais ?? null,
    forma: forma === undefined ? undefined : normalizarForma(forma),
  };
  if (nombre && !$("#campo-nombre").value.trim()) $("#campo-nombre").value = nombre;
  $("#sugerencias").hidden = true;
  mapa?.marcarPunto(form.donde.lat, form.donde.lon);
  pintarDonde();
  validarForm();
}

async function buscar() {
  const texto = $("#buscar-texto").value.trim();
  if (texto.length < 2) return;
  const caja = $("#sugerencias");
  caja.hidden = false;
  caja.replaceChildren(el("p", null, "Buscando…"));
  try {
    const url = new URL(NOMINATIM + "/search");
    url.search = new URLSearchParams({
      q: texto, format: "jsonv2", limit: "6", addressdetails: "1", "accept-language": "es",
      polygon_geojson: "1", polygon_threshold: "0.001",
    });
    const respuesta = await fetch(url);
    if (!respuesta.ok) throw new Error(String(respuesta.status));
    const lista = await respuesta.json();
    caja.replaceChildren();
    if (!lista.length) {
      caja.append(el("p", null, "No encontré ese lugar. Prueba con otro nombre o elígelo en el mapa."));
      return;
    }
    for (const d of lista) {
      const lat = Number(d.lat);
      const lon = Number(d.lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
      const nombre = d.name || String(d.display_name ?? "").split(",")[0] || texto;
      const cc = String(d.address?.country_code ?? "").toUpperCase();
      const pais = /^[A-Z]{2}$/.test(cc) ? cc : (mapa?.paisEn(lat, lon) ?? null);
      const boton = el("button");
      boton.type = "button";
      boton.append(el("span", null, nombre), el("small", null, d.display_name ?? ""));
      boton.addEventListener("click", () => elegirLugar(lat, lon, pais, nombre, d.geojson ?? null));
      caja.append(boton);
    }
  } catch {
    caja.replaceChildren(el("p", null, "No se pudo buscar. Comprueba la conexión o elige el lugar en el mapa."));
  }
}

// Para un punto elegido en el mapa o con «Estoy aquí»: su contorno y, si el campo sigue vacío, su nombre
async function completarLugar(lat, lon) {
  const lugar = await lugarEn(lat, lon);
  if (!lugar || !form?.donde || form.donde.lat !== lat || form.donde.lon !== lon) return;
  if (form.donde.forma === undefined) form.donde.forma = lugar.forma;
  if (lugar.nombre && !$("#campo-nombre").value.trim()) {
    $("#campo-nombre").value = String(lugar.nombre).slice(0, 80);
    validarForm();
  }
}

function empezarElegir() {
  if (!form || form.guardando) return;
  elegirEnMapa = true;
  cerrarHojas({ conservarForm: true });
  cerrarFicha(); // para elegir hay que ver el mapa (si se editaba desde la ficha, al guardar se vuelve al mapa)
  $("#aviso-elegir").hidden = false;
}

function cancelarElegir() {
  elegirEnMapa = false;
  $("#aviso-elegir").hidden = true;
  if (form) abrirHoja("hoja-form");
}

function tocarPunto({ lat, lon, pais }) {
  if (!elegirEnMapa || !form) return;
  elegirEnMapa = false;
  $("#aviso-elegir").hidden = true;
  elegirLugar(lat, lon, pais, null);
  abrirHoja("hoja-form");
  completarLugar(form.donde.lat, form.donde.lon);
}

function estoyAqui() {
  if (!navigator.geolocation) {
    avisar("Este navegador no da la ubicación.");
    return;
  }
  const boton = $("#estoy-aqui");
  boton.disabled = true;
  boton.textContent = "Buscando…";
  const terminar = () => {
    boton.disabled = false;
    boton.textContent = "Estoy aquí";
  };
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      terminar();
      const { latitude: lat, longitude: lon } = pos.coords;
      elegirLugar(lat, lon, mapa?.paisEn(lat, lon) ?? null, null);
      completarLugar(form.donde.lat, form.donde.lon);
    },
    (err) => {
      terminar();
      avisar(err.code === 1 ? "Mundi no tiene permiso para ver tu ubicación." : "No se pudo saber dónde estás.");
    },
    { enableHighAccuracy: false, timeout: 15000, maximumAge: 60000 }
  );
}

async function anadirFotos(archivos) {
  const f = form;
  if (!f) return;
  if (f.guardando) {
    avisar("Espera a que termine de guardar para añadir más fotos.");
    return;
  }
  const libres = MAX_FOTOS - f.existentes.length - f.nuevas.length - f.preparando;
  const lista = [...archivos].slice(0, Math.max(0, libres));
  if (archivos.length > lista.length) avisar(`Como mucho ${MAX_FOTOS} fotos por lugar.`);
  // Mientras quede alguna por preparar, Guardar espera: si no, se guardaría sin ellas
  f.preparando += lista.length;
  validarForm();
  for (let i = 0; i < lista.length; i++) {
    if (form !== f) return;
    ponerEstado(`Preparando fotos: ${i + 1} de ${lista.length}…`);
    try {
      const blob = await prepararFoto(lista[i]);
      if (form !== f) return;
      f.nuevas.push({ blob, url: URL.createObjectURL(blob) });
      pintarFotosForm();
    } catch (e) {
      avisar(e.message);
    } finally {
      f.preparando--;
      if (form === f) validarForm();
    }
  }
  if (form === f && !f.preparando) ponerEstado(null);
}

function miniatura(url, quitar) {
  const caja = el("div", "miniatura");
  if (url) {
    const img = el("img");
    img.src = url;
    img.alt = "";
    caja.append(img);
  }
  const boton = el("button");
  boton.type = "button";
  boton.setAttribute("aria-label", "Quitar esta foto");
  boton.append(icono("M6 6l12 12M18 6L6 18"));
  boton.addEventListener("click", quitar);
  caja.append(boton);
  return caja;
}

async function pintarFotosForm() {
  if (!form) return;
  const turno = ++turnoFotos;
  const enlaces = form.existentes.length ? await firmar(form.existentes) : {};
  if (!form || turno !== turnoFotos) return;
  const piezas = [
    ...form.existentes.map((ruta) => miniatura(enlaces[ruta], () => {
      if (form.guardando) return;
      form.existentes = form.existentes.filter((r) => r !== ruta);
      form.quitadas.push(ruta);
      pintarFotosForm();
    })),
    ...form.nuevas.map((n) => miniatura(n.url, () => {
      if (form.guardando) return;
      form.nuevas = form.nuevas.filter((x) => x !== n);
      URL.revokeObjectURL(n.url);
      pintarFotosForm();
    })),
  ];
  const subir = $("#subir");
  $("#fotos-form").replaceChildren(...piezas, subir);
  subir.hidden = form.existentes.length + form.nuevas.length >= MAX_FOTOS;
}

// La miniatura del mapa sale de la primera foto y se llama como ella: «<uid>/<id>/miniatura-<foto>.jpg». Si la primera
// foto cambia (o no hay), se rehace (o se quita) y se borra la anterior.
async function rehacerMiniatura(p, subidas) {
  const primera = p.fotos?.[0] ?? null;
  const esperada = miniaturaEsperada(p);
  if ((p.miniatura ?? null) === esperada) return p;
  if (esperada) {
    let origen = subidas.get(primera);
    if (!origen) {
      const enlace = (await firmar([primera]))[primera];
      const respuesta = enlace ? await fetch(enlace) : null;
      if (!respuesta?.ok) throw new Error("no se pudo bajar la primera foto");
      origen = await respuesta.blob();
    }
    const mini = await prepararFoto(origen, LADO_MINIATURA);
    try {
      await datos.subirFoto(esperada, mini);
    } catch (e) {
      if (!/exist/i.test(e.message)) throw e; // ya estaba subida de un intento anterior
    }
  }
  const vieja = p.miniatura;
  p = await datos.actualizar(p.id, { miniatura: esperada });
  if (vieja && vieja !== esperada) await datos.quitarFotos([vieja]).catch(() => {});
  return p;
}

async function guardar(e) {
  e.preventDefault();
  if (!form || form.guardando || form.preparando > 0) return;
  const nombre = $("#campo-nombre").value.trim();
  if (!form.donde || !nombre) return;
  form.guardando = true;
  validarForm();
  ponerError(null);
  if (form.donde.forma === undefined) {
    // Aún no se sabe su contorno (p. ej., un lugar guardado antes de que existiera): se pide ahora
    ponerEstado("Buscando el contorno del lugar…");
    const lugar = await lugarEn(form.donde.lat, form.donde.lon);
    if (lugar) form.donde.forma = lugar.forma;
  }
  const mes = $("#campo-fecha").value;
  const campos = {
    nombre,
    pais: form.donde.pais,
    lat: form.donde.lat,
    lon: form.donde.lon,
    estado: estadoForm(),
    fecha: estadoForm() !== "quiero_ir" && /^\d{4}-\d{2}$/.test(mes) ? `${mes}-01` : null,
    relato: $("#campo-relato").value.trim(),
    ...(form.donde.forma !== undefined ? { forma: form.donde.forma } : {}),
  };
  const eraNuevo = !form.editando;
  try {
    ponerEstado("Guardando…");
    let p;
    if (form.editando) {
      p = await datos.actualizar(form.editando.id, campos);
    } else {
      // Primero la fila, para tener su id (Contrato BD); si algo falla después, reintentar no la duplica
      p = await datos.crear(campos);
      form.editando = p;
      pinchos = [p, ...pinchos];
    }

    let fallos = 0;
    const subidas = new Map(); // ruta → foto, para hacer la miniatura sin volver a bajarla
    const subir = [...form.nuevas];
    for (let i = 0; i < subir.length; i++) {
      ponerEstado(`Subiendo fotos: ${i + 1} de ${subir.length}…`);
      const ruta = `${yo.id}/${p.id}/${crypto.randomUUID()}.jpg`;
      try {
        await datos.subirFoto(ruta, subir[i].blob);
        subidas.set(ruta, subir[i].blob);
        form.existentes.push(ruta);
        form.nuevas = form.nuevas.filter((x) => x !== subir[i]);
        URL.revokeObjectURL(subir[i].url);
      } catch {
        fallos++;
      }
    }
    const fotosAntes = p.fotos ?? [];
    if (form.existentes.length !== fotosAntes.length || form.existentes.some((r, i) => r !== fotosAntes[i])) {
      ponerEstado("Guardando…");
      p = await datos.actualizar(p.id, { fotos: form.existentes });
    }
    if (form.quitadas.length) {
      try {
        await datos.quitarFotos(form.quitadas);
      } catch {
        // la fila ya no las cita: quedan huérfanas en el almacén (DEUDA_TECNICA.md)
      }
    }

    let falloMiniatura = null; // null, "limpia" (no hay miniatura vieja apuntada) o "vieja" (no se pudo quitar)
    try {
      ponerEstado("Guardando…");
      p = await rehacerMiniatura(p, subidas);
    } catch {
      // Sin la miniatura nueva, que la fila no apunte a una vieja (el mapa usa la primera foto entera); y se avisa
      falloMiniatura = "limpia";
      try {
        if (p.miniatura && p.miniatura !== miniaturaEsperada(p)) {
          const vieja = p.miniatura;
          p = await datos.actualizar(p.id, { miniatura: null });
          datos.quitarFotos([vieja]).catch(() => {});
        }
      } catch {
        falloMiniatura = "vieja";
      }
    }

    pinchos = ordenar(pinchos.map((x) => (x.id === p.id ? p : x)));
    if (fallos || falloMiniatura) {
      form.guardando = false;
      form.editando = p;
      validarForm();
      ponerEstado(null);
      ponerError(fallos
        ? `Se guardó el lugar, pero ${fallos} ${fallos === 1 ? "foto no se pudo" : "fotos no se pudieron"} subir. Pulsa Guardar para reintentarlo.`
        : falloMiniatura === "limpia"
          ? "Se guardó el lugar, pero la foto pequeña del mapa no se pudo hacer (mientras, el mapa usa la foto entera). Pulsa Guardar para reintentarlo."
          : "Se guardó el lugar, pero la foto pequeña del mapa no se pudo poner al día. Pulsa Guardar para reintentarlo.");
      pintarFotosForm();
      pintar();
      return;
    }
    form.guardando = false;
    cerrarHojas();
    if (filtro !== "todos" && anioDe(p) !== filtro) filtro = "todos"; // que se vea lo recién guardado
    pintar(eraNuevo ? p.id : null);
    mapa?.irA(p.lat, p.lon);
    // Si se editó desde su ficha, la ficha sigue abierta y enseña los cambios
    if (fichaAbierta() && abierto?.id === p.id) abrirLugar(p);
    avisar(eraNuevo ? "Pincho clavado." : "Cambios guardados.");
  } catch (err) {
    form.guardando = false;
    validarForm();
    ponerEstado(null);
    ponerError("No se pudo guardar: " + err.message);
    pintar();
  }
}

/* ---------- Perfil ---------- */
function abrirPerfil() {
  $("#perfil-correo").textContent = yo?.correo ?? "";
  const estuve = pinchos.filter((p) => !esDeseo(p));
  const deseos = pinchos.filter(esDeseo);
  const porPais = new Map();
  for (const p of estuve) if (p.pais) porPais.set(p.pais, (porPais.get(p.pais) ?? 0) + 1);
  const fotos = estuve.reduce((suma, p) => suma + (p.fotos?.length ?? 0), 0);
  const cifra = (n, singular, plural) => {
    const caja = el("div");
    caja.append(el("strong", null, String(n)), el("span", null, n === 1 ? singular : plural));
    return caja;
  };
  $("#perfil-cifras").replaceChildren(
    cifra(porPais.size, "país", "países"), cifra(estuve.length, "lugar", "lugares"), cifra(fotos, "foto", "fotos")
  );
  const porcentaje = Math.min(100, (porPais.size / TOTAL_PAISES) * 100);
  $("#perfil-barra").style.width = porcentaje + "%";
  $("#perfil-barra-texto").textContent =
    `${porPais.size} de ${TOTAL_PAISES} países del mundo (${porcentaje.toLocaleString("es", { maximumFractionDigits: 1 })} %)`;

  const paises = [...porPais].sort((a, b) => b[1] - a[1] || nombrePais(a[0]).localeCompare(nombrePais(b[0]), "es"));
  $("#perfil-paises").replaceChildren(...(paises.length
    ? paises.map(([codigo, n]) => {
      const fila = el("div");
      fila.append(el("span", null, `${bandera(codigo)} ${nombrePais(codigo)}`.trim()),
        el("span", "num", `${n} ${n === 1 ? "lugar" : "lugares"}`));
      return fila;
    })
    : [el("p", "suave", "Aún no hay países.")]));

  $("#perfil-deseos-titulo").hidden = $("#perfil-deseos").hidden = !deseos.length;
  $("#perfil-deseos").replaceChildren(...deseos.map((p) => {
    const boton = el("button");
    boton.type = "button";
    boton.append(el("span", null, p.nombre), el("small", null, nombrePais(p.pais)));
    boton.addEventListener("click", () => {
      cerrarHojas();
      mapa?.irA(p.lat, p.lon);
      abrirLugar(p);
    });
    return boton;
  }));

  $("#perfil-lugares").replaceChildren(...(estuve.length
    ? estuve.map((p) => {
      const boton = el("button");
      boton.type = "button";
      boton.append(el("span", null, p.nombre),
        el("small", null, [p.fecha ? textoFecha(p.fecha) : null, nombrePais(p.pais)].filter(Boolean).join(" · ")));
      boton.addEventListener("click", () => {
        cerrarHojas();
        mapa?.irA(p.lat, p.lon);
        abrirLugar(p);
      });
      return boton;
    })
    : [el("p", "suave", "Aún no hay lugares.")]));
  abrirHoja("hoja-perfil");
}

/* ---------- Copia de seguridad ---------- */
const LEEME = `Copia de seguridad de Mundi

- lugares.json: todos tus lugares (nombre, país, coordenadas, fecha, relato) y, en «fotos», las rutas de sus fotos
  dentro de esta copia.
- fotos/: una carpeta por lugar, con sus fotos en orden.

Las fotos están reducidas y sin la ubicación GPS de la cámara, igual que en la app.
`;

async function descargarCopia() {
  const boton = $("#descargar-copia");
  const estado = $("#copia-estado");
  const poner = (texto) => {
    estado.textContent = texto ?? "";
    estado.hidden = !texto;
  };
  boton.disabled = true;
  try {
    const total = pinchos.reduce((s, p) => s + (p.fotos?.length ?? 0), 0);
    const archivos = [];
    const lugares = [];
    let hechas = 0;
    let fallos = 0;
    for (const [i, p] of pinchos.entries()) {
      const carpeta = `fotos/${String(i + 1).padStart(3, "0")}-${nombreSeguro(p.nombre)}`;
      const enlaces = p.fotos?.length ? await firmar(p.fotos) : {};
      const rutas = [];
      for (const [k, ruta] of (p.fotos ?? []).entries()) {
        poner(`Preparando la copia: foto ${++hechas} de ${total}…`);
        try {
          if (!enlaces[ruta]) throw new Error("sin enlace");
          const respuesta = await fetch(enlaces[ruta]);
          if (!respuesta.ok) throw new Error(String(respuesta.status));
          const nombre = `${carpeta}/${k + 1}.jpg`;
          archivos.push({ nombre, datos: new Uint8Array(await respuesta.arrayBuffer()) });
          rutas.push(nombre);
        } catch {
          fallos++;
        }
      }
      lugares.push({
        id: p.id, nombre: p.nombre, estado: p.estado ?? "visitado", pais: p.pais, lat: p.lat, lon: p.lon, fecha: p.fecha,
        relato: p.relato, forma: p.forma ?? null, creado_en: p.creado_en, fotos: rutas,
      });
    }
    const ahora = new Date();
    const json = JSON.stringify({ version: 1, exportado: ahora.toISOString(), lugares }, null, 2);
    const zip = crearZip([{ nombre: "lugares.json", datos: json }, { nombre: "LEEME.txt", datos: LEEME }, ...archivos], ahora);
    const enlace = el("a");
    enlace.href = URL.createObjectURL(new Blob([zip], { type: "application/zip" }));
    const dia = `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, "0")}-${String(ahora.getDate()).padStart(2, "0")}`;
    enlace.download = `mundi-copia-${dia}.zip`;
    document.body.append(enlace);
    enlace.click();
    enlace.remove();
    setTimeout(() => URL.revokeObjectURL(enlace.href), 60000);
    poner(fallos
      ? `Copia descargada, pero ${fallos} ${fallos === 1 ? "foto no se pudo" : "fotos no se pudieron"} incluir. Vuelve a intentarlo con buena conexión.`
      : `Copia descargada: ${lugares.length} ${lugares.length === 1 ? "lugar" : "lugares"} y ${archivos.length} ${archivos.length === 1 ? "foto" : "fotos"}.`);
  } catch (e) {
    poner("No se pudo preparar la copia: " + e.message);
  } finally {
    boton.disabled = false;
  }
}

/* ---------- Eventos ---------- */
function ponerEventos() {
  $("#form-entrar").addEventListener("submit", entrar);
  $("#carga-reintentar").addEventListener("click", abrirApp);
  $("#sin-acceso-salir").addEventListener("click", salir);
  $("#salir").addEventListener("click", salir);
  $("#descargar-copia").addEventListener("click", descargarCopia);
  for (const boton of document.querySelectorAll(".boton-instalar")) boton.addEventListener("click", instalar);
  $("#abrir-perfil").addEventListener("click", abrirPerfil);
  $("#encuadrar").addEventListener("click", () => mapa?.encuadrar());
  $("#abrir-nuevo").addEventListener("click", () => abrirForm());
  $("#sin-mapa-reintentar").addEventListener("click", async () => {
    await iniciarMapa();
    pintar();
    mapa?.encuadrar();
  });
  $("#cancelar-elegir").addEventListener("click", cancelarElegir);
  $("#velo").addEventListener("click", () => cerrarHojas());
  for (const b of document.querySelectorAll(".hoja .cerrar")) b.addEventListener("click", () => cerrarHojas());
  $("#lugar-editar").addEventListener("click", () => {
    if (!cambiandoEstado) abrirForm(abierto);
  });
  $("#lugar-borrar").addEventListener("click", borrarLugar);
  $("#lugar-compartir").addEventListener("click", compartir);
  $("#lugar-compartir-arriba").addEventListener("click", compartir);
  $("#lugar-volver").addEventListener("click", cerrarFicha);
  $("#lugar-portada").addEventListener("click", (e) => {
    if (!e.target.closest("button") && fotosFicha.length) abrirVisor(fotosFicha, 0);
  });
  window.addEventListener("popstate", alVolver);
  $("#lugar-ya-fui").addEventListener("click", yaFui);
  for (const r of document.querySelectorAll('input[name="estado"]')) r.addEventListener("change", pintarEstadoForm);
  $("#form-lugar").addEventListener("submit", guardar);
  $("#buscar-boton").addEventListener("click", buscar);
  $("#buscar-texto").addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      buscar();
    }
  });
  $("#donde-cambiar").addEventListener("click", () => {
    if (!form || form.guardando) return;
    form.donde = null;
    mapa?.marcarPunto(null);
    pintarDonde();
    validarForm();
  });
  $("#elegir-en-mapa").addEventListener("click", empezarElegir);
  $("#estoy-aqui").addEventListener("click", estoyAqui);
  $("#campo-nombre").addEventListener("input", validarForm);
  $("#campo-fotos").addEventListener("change", (e) => {
    const archivos = [...e.target.files];
    e.target.value = "";
    anadirFotos(archivos);
  });
  $("#visor-cerrar").addEventListener("click", cerrarVisor);
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (!$("#visor").hidden) cerrarVisor();
    else if (elegirEnMapa) cancelarElegir();
    else if (document.querySelector(".hoja.abierta")) cerrarHojas();
    else cerrarFicha();
  });
}

arrancar();
