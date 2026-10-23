# Dibuja los iconos de Mundi (icons/): el «Mapa plegado» que eligió Vicente (23/10). Un mapa de papel en tres pliegues
# sobre verde agua, con un camino de puntos rojo lacre que acaba en una chincheta.
# Se dibuja a 1024 px y se reduce, para que los bordes salgan suaves. El dibujo se encoge un poco hacia el centro para
# que todo quepa en el círculo seguro del 80 %: el mismo icono sirve de normal y de «maskable» (Android lo recorta).
# Las coordenadas son las del SVG de la cabecera (index.html), en una caja de 512.
# Uso, desde la raíz del repo: py -3 setup/iconos.py   (necesita Pillow)
import math
from pathlib import Path

from PIL import Image, ImageDraw

VERDE = (61, 122, 116, 255)
PAPEL = (243, 234, 215, 255)
PLIEGUE = (225, 207, 171, 255)
TIERRA = (201, 180, 142, 255)
LACRE = (178, 58, 43, 255)
TINTA = (59, 47, 34, 255)

L = 1024
ENCOGER = 0.88  # todo dentro del círculo seguro del 80 %


def p(x, y):
    """De la caja de 512 al lienzo de 1024, encogido hacia el centro."""
    return ((256 + (x - 256) * ENCOGER) * 2, (256 + (y - 256) * ENCOGER) * 2)


def esc(n):
    return n * ENCOGER * 2


def bezier(p0, c1, c2, p3, pasos=200):
    puntos = []
    for i in range(pasos + 1):
        t = i / pasos
        u = 1 - t
        puntos.append((
            u ** 3 * p0[0] + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t ** 3 * p3[0],
            u ** 3 * p0[1] + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t ** 3 * p3[1],
        ))
    return puntos


def circulo(d, centro, r, color):
    x, y = p(*centro)
    d.ellipse([x - esc(r), y - esc(r), x + esc(r), y + esc(r)], fill=color)


def dibujar():
    img = Image.new("RGBA", (L, L), VERDE)

    # La sombra del mapa, suave
    sombra = Image.new("RGBA", (L, L), (0, 0, 0, 0))
    x, y = p(256, 430)
    ImageDraw.Draw(sombra).ellipse([x - esc(170), y - esc(14), x + esc(170), y + esc(14)], fill=(0, 0, 0, 46))
    img = Image.alpha_composite(img, sombra)
    d = ImageDraw.Draw(img)

    # Los tres pliegues: el del medio, en sombra
    d.polygon([p(96, 150), p(196, 118), p(196, 384), p(96, 416)], fill=PAPEL)
    d.polygon([p(196, 118), p(316, 150), p(316, 416), p(196, 384)], fill=PLIEGUE)
    d.polygon([p(316, 150), p(416, 118), p(416, 384), p(316, 416)], fill=PAPEL)

    # Tres trazos de costa en el papel
    for curva in (((120, 250), (140, 244), (160, 256), (172, 272)),
                  ((228, 190), (250, 200), (268, 192), (288, 208)),
                  ((340, 300), (354, 282), (380, 278), (396, 290))):
        d.line([p(*q) for q in bezier(*curva, pasos=40)], fill=TIERRA, width=round(esc(8)), joint="curve")
        for extremo in (curva[0], curva[3]):
            circulo(d, extremo, 4, TIERRA)

    # El camino de puntos: un punto cada 24 unidades a lo largo de la curva
    camino = bezier((130, 370), (180, 330), (214, 352), (244, 300)) + bezier((244, 300), (274, 248), (316, 238), (354, 222))
    recorrido, siguiente = 0.0, 0.0
    for (x0, y0), (x1, y1) in zip(camino, camino[1:]):
        tramo = math.hypot(x1 - x0, y1 - y0)
        while siguiente <= recorrido + tramo:
            t = (siguiente - recorrido) / tramo if tramo else 0
            circulo(d, (x0 + (x1 - x0) * t, y0 + (y1 - y0) * t), 6, LACRE)
            siguiente += 24
        recorrido += tramo
    circulo(d, (130, 370), 10, TINTA)

    # La chincheta al final del camino
    d.line([p(362, 224), p(362, 186)], fill=TINTA, width=round(esc(9)))
    circulo(d, (362, 224), 4.5, TINTA)
    circulo(d, (362, 156), 36, LACRE)
    brillo = Image.new("RGBA", (L, L), (0, 0, 0, 0))
    circulo(ImageDraw.Draw(brillo), (351, 145), 10, (255, 255, 255, 128))
    return Image.alpha_composite(img, brillo).convert("RGB")


def main():
    destino = Path(__file__).resolve().parent.parent / "icons"
    destino.mkdir(exist_ok=True)
    grande = dibujar()
    for nombre, lado in (("icono-512.png", 512), ("icono-192.png", 192), ("apple-touch-icon.png", 180)):
        grande.resize((lado, lado), Image.LANCZOS).save(destino / nombre, optimize=True)
        print(destino / nombre)


if __name__ == "__main__":
    main()
