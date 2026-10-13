// Caja Puente de Mundi: lo que se comparte de un lugar (Contrato «Puente con la App de avisos», docs/puente-avisos.md).
// Texto plano de dos líneas: el nombre y un enlace estándar de Google Maps con punto decimal y 6 decimales. Es lo único
// que une Mundi con la App de avisos: la de Android lo recoge desde «Compartir».

export function enlaceMapa(lat, lon) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    throw new RangeError("Coordenadas no válidas");
  }
  return `https://maps.google.com/?q=${lat.toFixed(6)},${lon.toFixed(6)}`;
}

export function textoCompartir({ nombre, lat, lon }) {
  const limpio = String(nombre ?? "").replace(/\s+/g, " ").trim() || "Lugar";
  return `${limpio}\n${enlaceMapa(lat, lon)}`;
}
