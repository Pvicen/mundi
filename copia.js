// Caja Copia de Mundi (Contrato «Copia» de docs/contratos.md): arma el ZIP de la copia de seguridad.
// ZIP sin comprimir (método «store»): las fotos ya son JPEG y comprimirlas no ahorra nada. Nombres en UTF-8.
// Formato: APPNOTE de PKWARE (cabecera local + datos por archivo, directorio central y fin de directorio).

const TABLA_CRC = (() => {
  const tabla = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    tabla[n] = c >>> 0;
  }
  return tabla;
})();

export function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = TABLA_CRC[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

// Hora y fecha en el formato de MS-DOS que usa el ZIP (desde 1980, con segundos de dos en dos)
function fechaDos(fecha) {
  const anio = Math.min(Math.max(fecha.getFullYear(), 1980), 2107);
  return {
    hora: (fecha.getHours() << 11) | (fecha.getMinutes() << 5) | Math.floor(fecha.getSeconds() / 2),
    dia: ((anio - 1980) << 9) | ((fecha.getMonth() + 1) << 5) | fecha.getDate(),
  };
}

export function crearZip(archivos, fecha = new Date()) {
  const texto = new TextEncoder();
  const { hora, dia } = fechaDos(fecha);
  const UTF8 = 0x0800; // bit 11: los nombres van en UTF-8
  const partes = [];
  const central = [];
  let desplazamiento = 0;

  for (const archivo of archivos) {
    const nombre = texto.encode(archivo.nombre);
    const datos = typeof archivo.datos === "string" ? texto.encode(archivo.datos) : archivo.datos;
    const crc = crc32(datos);

    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true); // versión necesaria: 2.0
    local.setUint16(6, UTF8, true);
    local.setUint16(8, 0, true); // método: store
    local.setUint16(10, hora, true);
    local.setUint16(12, dia, true);
    local.setUint32(14, crc, true);
    local.setUint32(18, datos.length, true);
    local.setUint32(22, datos.length, true);
    local.setUint16(26, nombre.length, true);
    local.setUint16(28, 0, true);
    partes.push(new Uint8Array(local.buffer), nombre, datos);

    const cabecera = new DataView(new ArrayBuffer(46));
    cabecera.setUint32(0, 0x02014b50, true);
    cabecera.setUint16(4, 20, true); // hecho con: 2.0
    cabecera.setUint16(6, 20, true);
    cabecera.setUint16(8, UTF8, true);
    cabecera.setUint16(10, 0, true);
    cabecera.setUint16(12, hora, true);
    cabecera.setUint16(14, dia, true);
    cabecera.setUint32(16, crc, true);
    cabecera.setUint32(20, datos.length, true);
    cabecera.setUint32(24, datos.length, true);
    cabecera.setUint16(28, nombre.length, true);
    cabecera.setUint32(42, desplazamiento, true); // el resto (comentario, disco, atributos) a cero
    central.push(new Uint8Array(cabecera.buffer), nombre);

    desplazamiento += 30 + nombre.length + datos.length;
  }

  const tamCentral = central.reduce((s, p) => s + p.length, 0);
  const fin = new DataView(new ArrayBuffer(22));
  fin.setUint32(0, 0x06054b50, true);
  fin.setUint16(8, archivos.length, true);
  fin.setUint16(10, archivos.length, true);
  fin.setUint32(12, tamCentral, true);
  fin.setUint32(16, desplazamiento, true);

  const todo = [...partes, ...central, new Uint8Array(fin.buffer)];
  const salida = new Uint8Array(todo.reduce((s, p) => s + p.length, 0));
  let i = 0;
  for (const p of todo) {
    salida.set(p, i);
    i += p.length;
  }
  return salida;
}

// Texto apto para un nombre de carpeta o de archivo
export function nombreSeguro(texto) {
  const limpio = String(texto ?? "")
    .replace(/[\u0000-\u001f\u007f/\\:*?"<>|]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 60)
    .replace(/^[\s.]+|[\s.]+$/g, "");
  return limpio || "lugar";
}
