# -*- coding: utf-8 -*-
"""Genera la imagen OG (1200x630) de marca para compartir el link.
Salida: assets/og-image.jpg
Uso: python scripts/gen_og.py
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "assets" / "og-image.jpg"
W, H = 1200, 630
GOLD = (212, 175, 55); GOLD_SOFT = (236, 212, 138); CREAM = (245, 237, 225)
MUTED = (156, 136, 107); WINE = (123, 30, 43)

def font(names, size):
    for n in names:
        p = Path("C:/Windows/Fonts") / n
        if p.exists():
            try: return ImageFont.truetype(str(p), size)
            except Exception: pass
    return ImageFont.load_default()

def main():
    img = Image.new("RGB", (W, H), (12, 8, 5))
    d = ImageDraw.Draw(img)
    # fondo degradado vertical
    for y in range(H):
        t = y / H
        r = int(0x24 + (0x0c - 0x24) * t); g = int(0x17 + (0x08 - 0x17) * t); b = int(0x08 + (0x05 - 0x08) * t)
        d.line([(0, y), (W, y)], fill=(r, g, b))
    # glow dorado arriba
    glow = Image.new("L", (W, H), 0); gd = ImageDraw.Draw(glow)
    gd.ellipse([W*0.18, -H*0.7, W*0.82, H*0.45], fill=48)
    glow = glow.filter(ImageFilter.GaussianBlur(130))
    img.paste(Image.new("RGB", (W, H), GOLD), (0, 0), glow)
    d = ImageDraw.Draw(img)
    # marco
    d.rounded_rectangle([18, 18, W-18, H-18], radius=16, outline=(212,175,55), width=2)
    d.rounded_rectangle([28, 28, W-28, H-28], radius=12, outline=(212,175,55), width=1)
    # acentos diagonales esquinas
    for (x1,y1,x2,y2) in [(-20,80,150,-20),(W+20,H-80,W-150,H+20)]:
        d.line([(x1,y1),(x2,y2)], fill=(212,175,55), width=3)
    # corona
    cx, cy, s = W//2, 150, 46
    u = s/12
    pts = [(0,4),(3.5,7),(12,0),(20.5,7),(24,4),(22.4,15.2),(1.6,15.2)]
    poly = [(cx - s + px*u, cy + py*u) for (px,py) in pts]
    d.polygon(poly, fill=GOLD)
    for gx in (4,12,20):
        d.ellipse([cx - s + gx*u - 3, cy + 11*u - 3, cx - s + gx*u + 3, cy + 11*u + 3], fill=WINE)
    # títulos
    def center(text, y, fnt, fill, spacing=0):
        if spacing:
            text = (" "*1).join(list(text)) if False else text
        w = d.textlength(text, font=fnt)
        d.text(((W - w)/2, y), text, font=fnt, fill=fill)
    center("EL ZAR DE LAS FRAGANCIAS", 235, font(["georgiab.ttf","times.ttf"], 62), GOLD_SOFT)
    # regla con rombo
    ry = 320
    d.line([(W/2-190, ry), (W/2-16, ry)], fill=(212,175,55), width=2)
    d.line([(W/2+16, ry), (W/2+190, ry)], fill=(212,175,55), width=2)
    d.polygon([(W/2, ry-8),(W/2+8, ry),(W/2, ry+8),(W/2-8, ry)], fill=GOLD)
    center("P E R F U M E R Í A   D E   A U T O R", 345, font(["arial.ttf"], 24), MUTED)
    center("Perfumes árabes, masculinos y femeninos", 420, font(["georgia.ttf","times.ttf"], 40), CREAM)
    center("Inspirados en las grandes casas · Envíos a todo el país", 480, font(["arial.ttf"], 26), MUTED)
    center("@elzar.delasfragancias   ·   La Plata", 540, font(["arialbd.ttf","arial.ttf"], 24), GOLD_SOFT)
    img.save(OUT, "JPEG", quality=88)
    print("OG listo:", OUT, img.size)

if __name__ == "__main__":
    main()
