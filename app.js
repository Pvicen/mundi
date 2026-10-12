// Interfaz de Mundi (Contrato «Interfaz» de docs/contratos.md): entrar, el mapa con tus pinchos, añadir, editar y
// borrar lugares con sus fotos, y tus cifras. Todo lo que va a Supabase pasa por `datos`; los textos se ponen con
// textContent (nada de innerHTML con datos).
import { SUPABASE_URL, SUPABASE_CLAVE } from "./config.js";
import { crearMapa } from "./mapa.js";
import { prepararFoto } from "./fotos.js";
import { crearZip, nombreSeguro } from "./copia.js";

const ALMACEN = "mundi-fotos";
const COLUMNAS = "id, nombre, pais, lat, lon, fecha, relato, fotos, creado_en";
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

/* ---------- Pantallas ---------- */
function mostrar(id) {
  for (const p of ["pantalla-carga", "pantalla-entrar", "pantalla-sin-acceso", "app"]) $("#" + p).hidden = p !== id;
}

async function arrancar() {
  ponerEventos();
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
const anioDe = (p) => (p.fecha ? p.fecha.slice(0, 4) : "sin-fecha");
const visibles = () => (filtro === "todos" ? pinchos : pinchos.filter((p) => anioDe(p) === filtro));

function pintarFiltro() {
  const anios = [...new Set(pinchos.filter((p) => p.fecha).map(anioDe))].sort().reverse();
  const opciones = pinchos.some((p) => !p.fecha) ? [...anios, "sin-fecha"] : anios;
  if (filtro !== "todos" && !opciones.includes(filtro)) filtro = "todos";
  const barra = $("#filtro-anio");
  barra.hidden = opciones.length < 2;
  barra.replaceChildren(...["todos", ...opciones].map((valor) => {
    const boton = el("button", null, valor === "todos" ? "Todos" : valor === "sin-fecha" ? "Sin fecha" : valor);
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
  mapa?.pintar(lista, { resaltar });
  const paises = new Set(lista.map((p) => p.pais).filter(Boolean)).size;
  $("#cifras").replaceChildren(
    el("b", null, String(paises)), ` ${paises === 1 ? "país" : "países"} · `,
    el("b", null, String(lista.length)), ` ${lista.length === 1 ? "lugar" : "lugares"}`
  );
  $("#vacio").hidden = pinchos.length > 0;
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

/* ---------- Ficha de un lugar ---------- */
async function abrirLugar(p) {
  if (elegirEnMapa) return;
  abierto = p;
  $("#lugar-titulo").textContent = p.nombre;
  const meta = $("#lugar-meta");
  meta.replaceChildren(el("span", "sello", `${bandera(p.pais)} ${nombrePais(p.pais)}`.trim()));
  if (p.fecha) meta.append(el("span", null, textoFecha(p.fecha)));
  meta.append(el("span", "coords", coordenadas(p.lat, p.lon)));
  $("#lugar-relato").textContent = p.relato || "";
  const carrusel = $("#lugar-fotos");
  carrusel.replaceChildren();
  abrirHoja("hoja-lugar");
  if (!p.fotos?.length) return;
  const enlaces = await firmar(p.fotos);
  if (abierto !== p) return;
  const lista = p.fotos.map((r) => enlaces[r]).filter(Boolean);
  lista.forEach((url, i) => {
    const boton = el("button", "foto");
    boton.type = "button";
    boton.setAttribute("aria-label", `Ver la foto ${i + 1} de ${lista.length}`);
    const img = el("img");
    img.src = url;
    img.alt = "";
    img.loading = "lazy";
    img.decoding = "async";
    boton.append(img);
    boton.addEventListener("click", () => abrirVisor(lista, i));
    carrusel.append(boton);
  });
}

async function borrarLugar() {
  const p = abierto;
  if (!p || !confirm(`¿Borrar «${p.nombre}» y sus fotos? No se puede deshacer.`)) return;
  try {
    // Las que cita la fila y todo lo que haya en su carpeta (p. ej., fotos subidas en un guardado que falló)
    const rutas = new Set([...(p.fotos ?? []), ...(await datos.fotosEn(`${yo.id}/${p.id}`))]);
    if (rutas.size) await datos.quitarFotos([...rutas]);
    await datos.borrar(p.id);
    pinchos = pinchos.filter((x) => x.id !== p.id);
    abierto = null;
    cerrarHojas();
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
function abrirForm(p = null) {
  descartarForm();
  form = {
    editando: p,
    donde: p ? { lat: p.lat, lon: p.lon, pais: p.pais } : null,
    existentes: p ? [...(p.fotos ?? [])] : [],
    quitadas: [],
    nuevas: [],
    preparando: 0, // fotos elegidas que aún se están preparando
    guardando: false,
  };
  $("#form-titulo").textContent = p ? "Editar lugar" : "Nuevo lugar";
  $("#campo-nombre").value = p?.nombre ?? "";
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

function elegirLugar(lat, lon, pais, nombre) {
  if (!form || form.guardando) return;
  form.donde = { lat: redondear(lat), lon: redondear(lon), pais: pais ?? null };
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
      boton.addEventListener("click", () => elegirLugar(lat, lon, pais, nombre));
      caja.append(boton);
    }
  } catch {
    caja.replaceChildren(el("p", null, "No se pudo buscar. Comprueba la conexión o elige el lugar en el mapa."));
  }
}

// Nombre para un punto elegido en el mapa o con «Estoy aquí» (si el campo sigue vacío)
async function sugerirNombre(lat, lon) {
  try {
    const url = new URL(NOMINATIM + "/reverse");
    url.search = new URLSearchParams({ lat, lon, format: "jsonv2", zoom: "10", "accept-language": "es" });
    const respuesta = await fetch(url);
    if (!respuesta.ok) return;
    const d = await respuesta.json();
    const a = d.address ?? {};
    const nombre = a.city || a.town || a.village || a.municipality || a.county || a.state || d.name;
    if (nombre && form?.donde && !$("#campo-nombre").value.trim()) {
      $("#campo-nombre").value = String(nombre).slice(0, 80);
      validarForm();
    }
  } catch {
    // sin nombre sugerido: se escribe a mano
  }
}

function empezarElegir() {
  if (!form || form.guardando) return;
  elegirEnMapa = true;
  cerrarHojas({ conservarForm: true });
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
  if (!$("#campo-nombre").value.trim()) sugerirNombre(form.donde.lat, form.donde.lon);
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
      if (!$("#campo-nombre").value.trim()) sugerirNombre(form.donde.lat, form.donde.lon);
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

async function guardar(e) {
  e.preventDefault();
  if (!form || form.guardando || form.preparando > 0) return;
  const nombre = $("#campo-nombre").value.trim();
  if (!form.donde || !nombre) return;
  form.guardando = true;
  validarForm();
  ponerError(null);
  const mes = $("#campo-fecha").value;
  const campos = {
    nombre,
    pais: form.donde.pais,
    lat: form.donde.lat,
    lon: form.donde.lon,
    fecha: /^\d{4}-\d{2}$/.test(mes) ? `${mes}-01` : null,
    relato: $("#campo-relato").value.trim(),
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
    const subir = [...form.nuevas];
    for (let i = 0; i < subir.length; i++) {
      ponerEstado(`Subiendo fotos: ${i + 1} de ${subir.length}…`);
      const ruta = `${yo.id}/${p.id}/${crypto.randomUUID()}.jpg`;
      try {
        await datos.subirFoto(ruta, subir[i].blob);
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

    pinchos = ordenar(pinchos.map((x) => (x.id === p.id ? p : x)));
    if (fallos) {
      form.guardando = false;
      form.editando = p;
      validarForm();
      ponerEstado(null);
      ponerError(`Se guardó el lugar, pero ${fallos} ${fallos === 1 ? "foto no se pudo" : "fotos no se pudieron"} subir. Pulsa Guardar para reintentarlo.`);
      pintarFotosForm();
      pintar();
      return;
    }
    form.guardando = false;
    cerrarHojas();
    if (filtro !== "todos" && anioDe(p) !== filtro) filtro = "todos"; // que se vea lo recién guardado
    pintar(eraNuevo ? p.id : null);
    mapa?.irA(p.lat, p.lon);
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
  const porPais = new Map();
  for (const p of pinchos) if (p.pais) porPais.set(p.pais, (porPais.get(p.pais) ?? 0) + 1);
  const fotos = pinchos.reduce((suma, p) => suma + (p.fotos?.length ?? 0), 0);
  const cifra = (n, singular, plural) => {
    const caja = el("div");
    caja.append(el("strong", null, String(n)), el("span", null, n === 1 ? singular : plural));
    return caja;
  };
  $("#perfil-cifras").replaceChildren(
    cifra(porPais.size, "país", "países"), cifra(pinchos.length, "lugar", "lugares"), cifra(fotos, "foto", "fotos")
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

  $("#perfil-lugares").replaceChildren(...(pinchos.length
    ? pinchos.map((p) => {
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
        id: p.id, nombre: p.nombre, pais: p.pais, lat: p.lat, lon: p.lon, fecha: p.fecha,
        relato: p.relato, creado_en: p.creado_en, fotos: rutas,
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
  $("#lugar-editar").addEventListener("click", () => abrirForm(abierto));
  $("#lugar-borrar").addEventListener("click", borrarLugar);
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
    else cerrarHojas();
  });
}

arrancar();
