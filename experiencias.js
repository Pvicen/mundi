// Experiencias y valoración de un lugar (Contrato «Interfaz — experiencias» de docs/contratos.md): los tipos, las
// mismas reglas que la base (mundi_experiencias_validas) y cómo se limpian y se agrupan. Módulo ES sin dependencias.

export const TIPOS = [
  { id: "comer", nombre: "Comer", icono: "🍽️" },
  { id: "dormir", nombre: "Dormir", icono: "🛏️" },
  { id: "visitar", nombre: "Visitar", icono: "🏛️" },
  { id: "hacer", nombre: "Hacer", icono: "🥾" },
  { id: "consejo", nombre: "Consejo", icono: "💡" },
];
export const MAX_EXPERIENCIAS = 30;
export const MAX_NOMBRE = 80;
export const MAX_TEXTO = 1000;

const IDS = new Set(TIPOS.map((t) => t.id));
const CLAVES = new Set(["tipo", "nombre", "texto", "estrellas"]);
const largo = (s) => [...s].length; // en caracteres, como char_length de la base (no en unidades UTF-16)
const esEstrellas = (n) => Number.isInteger(n) && n >= 1 && n <= 5;

export function valoracionValida(v) {
  return v === null || esEstrellas(v);
}

export function experienciaValida(x) {
  if (!x || typeof x !== "object" || Array.isArray(x)) return false;
  if (Object.keys(x).some((k) => !CLAVES.has(k))) return false;
  if (typeof x.tipo !== "string" || !IDS.has(x.tipo)) return false;
  if (typeof x.nombre !== "string" || largo(x.nombre.trim()) < 1 || largo(x.nombre.trim()) > MAX_NOMBRE) return false;
  if ("texto" in x && (typeof x.texto !== "string" || largo(x.texto) > MAX_TEXTO)) return false;
  if ("estrellas" in x && x.estrellas !== null && !esEstrellas(x.estrellas)) return false;
  return true;
}

export function experienciasValidas(lista) {
  return Array.isArray(lista) && lista.length <= MAX_EXPERIENCIAS && lista.every(experienciaValida);
}

// De lo que se escribió en el formulario a lo que se guarda: se recortan los espacios, se quitan las que están del
// todo vacías y, si alguna tiene algo pero no nombre, se dice. → { lista } o { error }
export function limpiarExperiencias(borradores) {
  const lista = [];
  for (const b of borradores) {
    const nombre = (b.nombre ?? "").trim();
    const texto = (b.texto ?? "").trim();
    const estrellas = b.estrellas === "" || b.estrellas === null || b.estrellas === undefined ? null : Number(b.estrellas);
    if (!nombre && !texto && estrellas === null) continue;
    if (!nombre) return { error: "Cada experiencia necesita un nombre (por ejemplo, el del restaurante)." };
    const x = { tipo: b.tipo, nombre, ...(texto ? { texto } : {}), ...(estrellas !== null ? { estrellas } : {}) };
    if (!experienciaValida(x)) return { error: `La experiencia «${nombre}» no se puede guardar así.` };
    lista.push(x);
  }
  if (lista.length > MAX_EXPERIENCIAS) return { error: `Como mucho ${MAX_EXPERIENCIAS} experiencias por lugar.` };
  return { lista };
}

// Las experiencias por tipo, en el orden de TIPOS y sin tipos vacíos → [{ tipo, items }]
export function agruparPorTipo(lista) {
  return TIPOS.map((tipo) => ({ tipo, items: (lista ?? []).filter((x) => x.tipo === tipo.id) }))
    .filter((g) => g.items.length);
}

// «★★★★☆» para 4 de 5
export function estrellas(n) {
  return esEstrellas(n) ? "★".repeat(n) + "☆".repeat(5 - n) : "";
}
