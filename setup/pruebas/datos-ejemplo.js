// Datos de ejemplo para probar la Interfaz sin Supabase (Contrato «Interfaz»: la forma de `datos`).
// app.js los carga solo en localhost con ?ejemplo. Lugares inventados; las fotos viven en memoria y se pierden al
// recargar. Imita las reglas de la base (Contrato BD) para que los errores salgan aquí también.
// Opciones en la URL: ?ejemplo&fuera (empieza sin sesión; la contraseña de prueba está en CLAVE_PRUEBA),
// ?ejemplo&sinacceso (la cuenta no está en la lista), ?ejemplo&vacio (sin lugares) y ?ejemplo&fallofotos (falla
// la subida de fotos).
export const CLAVE_PRUEBA = "ejemplo";

const espera = (ms = 120) => new Promise((resolver) => setTimeout(resolver, ms));

function comprobarFila(p) {
  if (typeof p.nombre !== "string" || p.nombre.trim().length < 1 || p.nombre.trim().length > 80) {
    throw new Error('new row violates check constraint "mundi_pinchos_nombre_check"');
  }
  if (p.pais !== null && !/^[A-Z]{2}$/.test(p.pais)) throw new Error('violates check constraint "mundi_pinchos_pais_check"');
  if (!(p.lat >= -90 && p.lat <= 90) || !(p.lon >= -180 && p.lon <= 180)) throw new Error("violates check constraint (lat/lon)");
  if (p.fecha !== null && !/^\d{4}-\d{2}-\d{2}$/.test(p.fecha)) throw new Error("invalid input syntax for type date");
  if (typeof p.relato !== "string" || p.relato.length > 4000) throw new Error('violates check constraint "mundi_pinchos_relato_check"');
  if (!Array.isArray(p.fotos) || p.fotos.length > 30) throw new Error('violates check constraint "mundi_pinchos_fotos_check"');
}

export function crearDatosEjemplo() {
  const opciones = new URLSearchParams(location.search);
  const yo = { id: "00000000-0000-4000-8000-000000000001", correo: "ejemplo@ejemplo.com" };
  let dentro = !opciones.has("fuera");
  const fotos = new Map(); // ruta → Blob
  let pinchos = opciones.has("vacio") ? [] : [
    { nombre: "Madrid", pais: "ES", lat: 40.4168, lon: -3.7038, fecha: "2025-09-01", relato: "Primer mes de intercambio." },
    { nombre: "París", pais: "FR", lat: 48.8566, lon: 2.3522, fecha: "2025-12-01", relato: "" },
    { nombre: "Lyon", pais: "FR", lat: 45.764, lon: 4.8357, fecha: "2025-12-01", relato: "Fête des Lumières." },
    { nombre: "Santorini", pais: "GR", lat: 36.3932, lon: 25.4615, fecha: "2026-06-01", relato: "Atardecer en Oia.\nCalor." },
    { nombre: "Santiago", pais: "CL", lat: -33.4489, lon: -70.6693, fecha: null, relato: "Casa." },
  ].map((p, i) => ({
    id: `00000000-0000-4000-8000-00000000010${i}`, dueno: yo.id, fotos: [], creado_en: `2026-01-0${i + 1}T10:00:00Z`, ...p,
  }));
  const copia = (p) => ({ ...p, fotos: [...p.fotos] });

  return {
    async sesion() {
      await espera();
      return dentro ? yo : null;
    },
    async entrar(correo, clave) {
      await espera(300);
      if (correo.toLowerCase() !== yo.correo || clave !== CLAVE_PRUEBA) throw new Error("Correo o contraseña incorrectos.");
      dentro = true;
      return yo;
    },
    async salir() {
      dentro = false;
    },
    async esPersona() {
      await espera();
      return !opciones.has("sinacceso");
    },
    async listar() {
      await espera();
      return pinchos.map(copia);
    },
    async crear(fila) {
      await espera();
      const p = { id: crypto.randomUUID(), dueno: yo.id, fecha: null, relato: "", fotos: [], ...fila,
        creado_en: new Date().toISOString() };
      comprobarFila(p);
      pinchos.push(p);
      return copia(p);
    },
    async actualizar(id, campos) {
      await espera();
      const p = pinchos.find((x) => x.id === id);
      if (!p) throw new Error("JSON object requested, multiple (or no) rows returned");
      const nuevo = { ...p, ...campos };
      comprobarFila(nuevo);
      Object.assign(p, nuevo);
      return copia(p);
    },
    async borrar(id) {
      await espera();
      pinchos = pinchos.filter((x) => x.id !== id);
    },
    async subirFoto(ruta, blob) {
      await espera(200);
      if (opciones.has("fallofotos")) throw new Error("Failed to fetch");
      if (!ruta.startsWith(yo.id + "/")) throw new Error("new row violates row-level security policy");
      if (blob.type !== "image/jpeg") throw new Error("mime type not supported");
      if (blob.size > 5 * 1024 * 1024) throw new Error("The object exceeded the maximum allowed size");
      if (fotos.has(ruta)) throw new Error("The resource already exists");
      fotos.set(ruta, blob);
    },
    async urlsFirmadas(rutas) {
      await espera();
      return Object.fromEntries(rutas.filter((r) => fotos.has(r)).map((r) => [r, URL.createObjectURL(fotos.get(r))]));
    },
    async quitarFotos(rutas) {
      await espera();
      for (const r of rutas) fotos.delete(r);
    },
    async fotosEn(carpeta) {
      await espera();
      if (!carpeta.startsWith(yo.id + "/")) return []; // como el almacén: solo se ve la carpeta propia
      return [...fotos.keys()].filter((r) => r.startsWith(carpeta + "/") && !r.slice(carpeta.length + 1).includes("/"));
    },
    // Solo para mirar desde la consola en las pruebas
    _estado: () => ({ pinchos: pinchos.map(copia), fotos: [...fotos.keys()] }),
  };
}
