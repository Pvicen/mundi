// Caja Fotos de Mundi: prepara una foto del teléfono antes de subirla al almacén.
// Contrato «Fotos» de docs/contratos.md. La foto se redibuja en un lienzo y solo se guardan los píxeles: el JPEG que
// sale no lleva EXIF ni GPS. La orientación ya viene aplicada, porque el navegador gira la imagen según su EXIF al
// abrirla.

export const LADO_MAXIMO = 1600;
export const CALIDAD = 0.82;
const CALIDAD_REDUCIDA = 0.6;
const LIMITE = 5 * 1024 * 1024; // el del almacén mundi-fotos

// Medidas finales: el lado mayor, como mucho `maximo`; nunca amplía; misma proporción.
export function medidasDestino(ancho, alto, maximo = LADO_MAXIMO) {
  if (!(ancho > 0) || !(alto > 0) || !(maximo > 0)) throw new RangeError("Medidas de la foto no válidas");
  const escala = Math.min(1, maximo / Math.max(ancho, alto));
  return {
    ancho: Math.max(1, Math.round(ancho * escala)),
    alto: Math.max(1, Math.round(alto * escala)),
  };
}

function abrir(archivo) {
  return new Promise((resolver, rechazar) => {
    const url = URL.createObjectURL(archivo);
    const imagen = new Image();
    imagen.onload = () => {
      URL.revokeObjectURL(url);
      resolver(imagen);
    };
    imagen.onerror = () => {
      URL.revokeObjectURL(url);
      rechazar(new Error("No se pudo abrir la foto: este navegador no reconoce su formato."));
    };
    imagen.src = url;
  });
}

function aJpeg(lienzo, calidad) {
  return new Promise((resolver, rechazar) => {
    lienzo.toBlob(
      (blob) => (blob ? resolver(blob) : rechazar(new Error("No se pudo convertir la foto."))),
      "image/jpeg",
      calidad
    );
  });
}

export async function prepararFoto(archivo) {
  if (!(archivo instanceof Blob)) throw new TypeError("prepararFoto espera el archivo de una foto");
  const imagen = await abrir(archivo);
  const { ancho, alto } = medidasDestino(imagen.naturalWidth, imagen.naturalHeight);

  const lienzo = document.createElement("canvas");
  lienzo.width = ancho;
  lienzo.height = alto;
  const ctx = lienzo.getContext("2d");
  ctx.fillStyle = "#ffffff"; // lo transparente (un PNG) sale blanco, no negro
  ctx.fillRect(0, 0, ancho, alto);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(imagen, 0, 0, ancho, alto);

  try {
    let foto = await aJpeg(lienzo, CALIDAD);
    if (foto.size > LIMITE) foto = await aJpeg(lienzo, CALIDAD_REDUCIDA);
    if (foto.size > LIMITE) throw new Error("La foto pesa demasiado incluso comprimida.");
    return foto;
  } finally {
    lienzo.width = lienzo.height = 0; // suelta la memoria del lienzo en el teléfono
  }
}
