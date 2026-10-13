// Service worker de Mundi (Contrato «Cáscara PWA» de docs/contratos.md).
// Red primero (siempre lo más nuevo) y caché de respaldo, para que la app abra sin conexión.
// Lo que va a Supabase (datos y fotos) no se toca nunca: va siempre directo a la red.
//
// Convenio: sube el número de CACHE («mundi-v2», …) si cambias un fichero de ASSETS o una URL de CDN.
const CACHE = "mundi-v5";
const ASSETS = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./mapa.js",
  "./fotos.js",
  "./copia.js",
  "./puente.js",
  "./config.js",
  "./manifest.webmanifest",
  "./icons/icono-192.png",
  "./icons/icono-512.png",
  "./icons/apple-touch-icon.png",
];
// Librerías con versión fijada y tipografías: se guardan la primera vez que se piden
const DE_FUERA = [
  "https://cdn.jsdelivr.net/",
  "https://cdnjs.cloudflare.com/",
  "https://fonts.googleapis.com/",
  "https://fonts.gstatic.com/",
];

const SIN_CONEXION = () =>
  new Response("Sin conexión. Inténtalo de nuevo cuando tengas internet.", {
    status: 503,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE)
      // Uno a uno y sin cortar si alguno falla: la caché es un respaldo, no una condición para instalarse
      .then((c) => Promise.all(ASSETS.map((u) => c.add(new Request(u, { cache: "reload" })).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

// Mundi comparte origen (pvicen.github.io) con la App de avisos: solo se borran las cachés viejas de Mundi
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((claves) => Promise.all(
        claves.filter((k) => k.startsWith("mundi-") && k !== CACHE).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

function esCascara(url) {
  return url.origin === self.location.origin || DE_FUERA.some((p) => url.href.startsWith(p));
}

self.addEventListener("fetch", (e) => {
  const peticion = e.request;
  if (peticion.method !== "GET") return;
  const url = new URL(peticion.url);
  if (!esCascara(url)) return; // Supabase y todo lo demás: directo a la red

  // Las navegaciones se guardan bajo una sola clave, para no acumular una por cada ?consulta
  const clave = peticion.mode === "navigate" ? "./index.html" : peticion;
  e.respondWith(
    fetch(peticion)
      .then((resp) => {
        if (resp.ok) {
          const copia = resp.clone();
          e.waitUntil(caches.open(CACHE).then((c) => c.put(clave, copia)).catch(() => {}));
        }
        return resp;
      })
      .catch(async () => (await caches.match(clave)) || SIN_CONEXION())
  );
});
