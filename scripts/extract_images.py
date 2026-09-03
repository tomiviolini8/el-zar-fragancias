#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Extrae la imagen del frasco de cada fragancia desde el PDF, recorta y quita
el fondo blanco -> PNG transparente para usar en las tarjetas."""
import pymupdf, json, os, sys
from PIL import Image
import numpy as np

PDF = 'C:/ZarFragancias/Cata_logo_XII_julio__agosto_2026.pdf'
OUTDIR = 'C:/ZarFragancias/assets/productos'
SP = 'C:/Users/tomas/AppData/Local/Temp/claude/C--ZarFragancias/44e2a542-26c4-4056-94ff-c44a7acfaa3c/scratchpad'
os.makedirs(OUTDIR, exist_ok=True)
d = pymupdf.open(PDF)

def candidates(pno):
    """Imagenes 'de producto' en la pagina (excluye glifos, lineas, fondos, frutas)."""
    out = []
    for im in d[pno].get_image_info(xrefs=True):
        xref = im['xref']
        if xref == 0:
            continue
        bb = im['bbox']
        w, h = bb[2]-bb[0], bb[3]-bb[1]
        if w < 55 or h < 85:            # muy chico (glifos, badges)
            continue
        if w > 340 or h > 470:          # fondo de pagina
            continue
        ar = h / w
        if ar < 0.9:                    # descartar apaisadas (skylines, franjas)
            continue
        area = w*h
        out.append({'xref': xref, 'cx': (bb[0]+bb[2])/2, 'cy': (bb[1]+bb[3])/2,
                    'y0': bb[1], 'y1': bb[3], 'w': w, 'h': h, 'area': area, 'ar': ar})
    return out

def pick(cands, px, py):
    """Elige el frasco: en la columna del producto y por encima del codigo."""
    if not cands:
        return None
    # preferir los que estan arriba del codigo y cerca en x
    def score(c):
        dx = abs(c['cx'] - px)
        above = 0 if c['cy'] < py else 250      # penalizar los que estan debajo
        return dx + above - c['area']*0.002       # premiar area (frasco grande)
    return min(cands, key=score)

TILE_W, TILE_H = 760, 950   # placa 4:5

def make_tile():
    """Placa oscura de marca con degradado cálido."""
    yy = np.linspace(0, 1, TILE_H)[:, None]
    xx = np.linspace(0, 1, TILE_W)[None, :]
    # degradado radial cálido tipo tarjeta
    cx, cy = 0.5, 0.32
    d2 = ((xx-cx)**2 + (yy-cy)**2)
    t = np.clip(d2*1.4, 0, 1)
    top = np.array([44, 30, 16]); bot = np.array([20, 14, 8])
    tile = (top*(1-t[...,None]) + bot*t[...,None]).astype(np.uint8)
    tile = np.repeat(tile, 1, axis=2) if tile.shape[2] == 3 else tile
    return Image.fromarray(tile, 'RGB').convert('RGBA')

TILE = make_tile()

def process_image(xref, out_path):
    pix = pymupdf.Pixmap(d, xref)
    if pix.colorspace and pix.colorspace.name != 'DeviceRGB':
        pix = pymupdf.Pixmap(pymupdf.csRGB, pix)
    mode = 'RGBA' if pix.alpha else 'RGB'
    img = Image.frombytes(mode, (pix.width, pix.height), pix.samples).convert('RGBA')
    arr = np.array(img).astype(np.int16)
    r, g, b = arr[...,0], arr[...,1], arr[...,2]
    H, W = r.shape
    k = max(3, min(H, W)//12)
    corners = np.concatenate([
        arr[:k,:k,:3].reshape(-1,3), arr[:k,-k:,:3].reshape(-1,3),
        arr[-k:,:k,:3].reshape(-1,3), arr[-k:,-k:,:3].reshape(-1,3)])
    cstd = corners.std(0).mean()
    lum = corners.mean(0).mean()
    if cstd > 40:
        return False                 # fondo no uniforme -> compuesto -> descartar
    if lum > 205:                    # fondo blanco -> flood-fill desde los bordes
        from PIL import ImageDraw
        rgb = img.convert('RGB')
        SENT = (255, 0, 255)
        for seed in [(0,0),(W-1,0),(0,H-1),(W-1,H-1),(W//2,0),(W//2,H-1)]:
            try: ImageDraw.floodfill(rgb, seed, SENT, thresh=46)
            except Exception: pass
        mask = (np.array(rgb) == np.array(SENT)).all(2)   # solo fondo conectado al borde
        a2 = arr[...,3].copy()
        a2[mask] = 0
        arr[...,3] = a2
        cut = Image.fromarray(arr.astype(np.uint8), 'RGBA')
        bbox = cut.getbbox()
        if not bbox:
            return False
        cut = cut.crop(bbox)
        frac = (np.array(cut)[...,3] > 20).mean()
        if frac < 0.04 or cut.width < 40 or cut.height < 55:
            return False
    elif lum < 62:                   # fondo negro -> se funde con la placa, NO keyear
        cut = Image.fromarray(arr.astype(np.uint8), 'RGBA')
        # recortar bordes negros muertos para centrar mejor
        gray = np.array(cut)[...,:3].max(2)
        ys, xs = np.where(gray > 24)
        if len(xs) < 50:
            return False
        cut = cut.crop((xs.min(), ys.min(), xs.max()+1, ys.max()+1))
        if cut.width < 40 or cut.height < 55:
            return False
    else:
        return False
    # componer sobre placa oscura, centrado, ~82% de la placa
    tile = TILE.copy()
    scale = min((TILE_W*0.80)/cut.width, (TILE_H*0.82)/cut.height)
    nw, nh = max(1,int(cut.width*scale)), max(1,int(cut.height*scale))
    cut = cut.resize((nw, nh), Image.LANCZOS)
    ox, oy = (TILE_W-nw)//2, int(TILE_H*0.50 - nh/2)
    if lum > 205:                    # frasco transparente -> pegar con alpha
        tile.alpha_composite(cut, (ox, max(0, oy)))
        result = tile.convert('RGB')
    else:                            # frasco sobre negro -> screen (funde el negro)
        from PIL import ImageChops
        canvas = Image.new('RGB', (TILE_W, TILE_H), (0, 0, 0))
        canvas.paste(cut.convert('RGB'), (ox, max(0, oy)))
        result = ImageChops.screen(tile.convert('RGB'), canvas)
    result.save(out_path, quality=90)
    return True

def run(limit_pages=None, only_codes=None):
    frag = json.load(open(f'{SP}/frag_out.json', encoding='utf-8'))
    done, skipped = [], []
    for r in frag:
        code = r['codigo']
        if only_codes and code not in only_codes:
            continue
        pno = r['page'] - 1
        if limit_pages and pno not in limit_pages:
            continue
        cands = candidates(pno)
        c = pick(cands, r.get('_cx', 200), r.get('_cy', 400))
        if not c:
            skipped.append(code); continue
        ok = process_image(c['xref'], f'{OUTDIR}/{code}.jpg')
        (done if ok else skipped).append(code)
    return done, skipped

if __name__ == '__main__':
    mode = sys.argv[1] if len(sys.argv) > 1 else 'test'
    if mode == 'all':
        # limpiar png previos
        for f in os.listdir(OUTDIR):
            if f.endswith(('.png','.jpg')):
                os.remove(os.path.join(OUTDIR, f))
        done, skipped = run()
        print('EXTRAIDAS:', len(done))
        print('SIN IMAGEN (placeholder):', len(skipped), skipped)
        json.dump({'done': done, 'skipped': skipped},
                  open(f'{SP}/img_result.json', 'w'), ensure_ascii=False)
    else:
        test_pages = [4,5,6,7,8, 33,34,35, 23,24, 41,42]
        done, skipped = run(limit_pages=test_pages)
        print('extraidas:', len(done), done)
        print('sin imagen:', len(skipped), skipped)
