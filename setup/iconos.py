# Dibuja los iconos de Mundi (icons/): un globo con un pincho rojo sobre el azul tinta de la app.
# Se dibuja a 1024 px y se reduce, para que los bordes salgan suaves. Todo cabe en el círculo seguro del 80 %, así que
# el mismo dibujo sirve de icono normal y de «maskable» (Android lo recorta a su forma).
# Uso, desde la raíz del repo: py -3 setup/iconos.py   (necesita Pillow)
from pathlib import Path

from PIL import Image, ImageDraw

TINTA = (15, 42, 58)
MAR = (204, 224, 233)
LINEA = (169, 190, 199)
PINCHO = (224, 53, 43)
BLANCO = (255, 255, 255)

L = 1024


def dibujar():
    img = Image.new("RGB", (L, L), TINTA)
    d = ImageDraw.Draw(img)

    # El globo y su cuadrícula (meridianos como elipses, paralelos como líneas), recortados al círculo
    cx, cy, r = 512, 560, 300
    globo = Image.new("RGB", (L, L), MAR)
    g = ImageDraw.Draw(globo)
    for ancho in (300, 180, 60):
        g.ellipse([cx - ancho, cy - r, cx + ancho, cy + r], outline=LINEA, width=14)
    g.line([cx, cy - r, cx, cy + r], fill=LINEA, width=14)
    for dy in (-180, -60, 60, 180):
        g.line([cx - r, cy + dy, cx + r, cy + dy], fill=LINEA, width=14)
    mascara = Image.new("L", (L, L), 0)
    ImageDraw.Draw(mascara).ellipse([cx - r, cy - r, cx + r, cy + r], fill=255)
    img.paste(globo, (0, 0), mascara)

    # El pincho: cabeza redonda, punta clavada en el globo y un brillo blanco
    px, py, pr = 600, 380, 130
    d.polygon([(px - 112, py + 66), (px + 112, py + 66), (px, py + 300)], fill=PINCHO)
    d.ellipse([px - pr, py - pr, px + pr, py + pr], fill=PINCHO)
    d.ellipse([px - 48, py - 48, px + 48, py + 48], fill=BLANCO)
    return img


def main():
    destino = Path(__file__).resolve().parent.parent / "icons"
    destino.mkdir(exist_ok=True)
    grande = dibujar()
    for nombre, lado in (("icono-512.png", 512), ("icono-192.png", 192), ("apple-touch-icon.png", 180)):
        grande.resize((lado, lado), Image.LANCZOS).save(destino / nombre, optimize=True)
        print(destino / nombre)


if __name__ == "__main__":
    main()
