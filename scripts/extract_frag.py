#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Extractor de fragancias del Catalogo XII.
Estrategia: aislar el 'card' de cada producto por FUENTE tipografica:
  - nombre  -> DINAlternate-Bold
  - cuerpo  -> DINCondensed-Bold (formato / familia / inspirado / marca)
  - codigo  -> DIN-Medium o DINAlternate-Bold que matchea patron de codigo
Los esloganes/titulos usan otras fuentes (Trajan/Minion/AbrahamLincoln) y se descartan.
Los precios se asignan por columna (posicion x)."""
import pymupdf, re, json, sys

PDF = 'C:/ZarFragancias/Cata_logo_XII_julio__agosto_2026.pdf'
d = pymupdf.open(PDF)

CODE_RE = re.compile(r'^(?:COD\.?\s+)?(?:BF|BM|ACF|ACM|ACU|COL|PF|PM)\d{2,4}$')
CODE_IN = re.compile(r'\b((?:BF|BM|ACF|ACM|ACU|COL|PF|PM)\d{2,4})\b')
def code_val(t):
    m = CODE_IN.search(t)
    return m.group(1) if m else None

def clean(s):
    return re.sub(r'\s+', ' ', s).strip(' |:')

def parse_price(tok):
    t = str(tok).replace('$', '').replace(' ', '').replace('.', '')
    return int(t) if t.isdigit() else None

def cluster_columns(xs, gap=48):
    xs = sorted(xs)
    cols = []
    for x in xs:
        if cols and x - cols[-1][-1] < gap:
            cols[-1].append(x)
        else:
            cols.append([x])
    return [sum(c) / len(c) for c in cols]

def get_spans(pno):
    out = []
    for b in d[pno].get_text("dict")["blocks"]:
        for ln in b.get("lines", []):
            for sp in ln["spans"]:
                t = sp["text"].strip()
                if t:
                    out.append((sp["font"], round(sp["size"], 1),
                                sp["bbox"][0], sp["bbox"][1], sp["bbox"][2], t))
    return out

def col_of(cx, bounds):
    for i, (lo, hi) in enumerate(bounds):
        if lo <= cx < hi:
            return i
    return None

def lines_from(spans):
    """Reconstruye lineas (y, texto) a partir de spans (x0,y0,x1,txt)."""
    spans = sorted(spans, key=lambda s: (round(s[1] / 4), s[0]))
    lines, cur, cy = [], [], None
    for x0, y0, x1, t in spans:
        if cy is None or abs(y0 - cy) <= 4:
            cur.append(t); cy = y0 if cy is None else cy
        else:
            lines.append(clean(' '.join(cur))); cur = [t]; cy = y0
    if cur:
        lines.append(clean(' '.join(cur)))
    return [l for l in lines if l]

INSP_RE = re.compile(r'INSP\w*\s+EN', re.I)

def parse_body(blines):
    """De las lineas DINCondensed extrae formato, familia, inspirado, marca."""
    # formato
    formato, fmt_i = '', None
    for i, l in enumerate(blines):
        m = re.search(r'(PERFUME|COLONIA)\b.*?\d+\s*ML', l, re.I)
        if m:
            formato = clean(m.group(0)); fmt_i = i; break
        if re.match(r'(PERFUME|COLONIA)\b', l, re.I) and fmt_i is None:
            formato = clean(l); fmt_i = i
    # linea de inspirado
    insp_i = None
    for i, l in enumerate(blines):
        if INSP_RE.search(l):
            insp_i = i; break
    # familia = lineas entre formato e inspirado
    lo = (fmt_i + 1) if fmt_i is not None else 0
    hi = insp_i if insp_i is not None else len(blines)
    fam_lines = []
    for l in blines[lo:hi]:
        if re.match(r'^\d+\s*ML\b', l, re.I):
            continue
        fam_lines.append(l)
    fam = clean(' '.join(fam_lines))
    fam = re.sub(r'FAMILIA\s+OLFATIVA:?', '', fam, flags=re.I).strip()
    # inspirado + marca
    insp, marca = '', ''
    if insp_i is not None:
        seg = blines[insp_i:]
        first = seg[0]
        # familia puede ser prefijo: "ORIENTAL INSPIRADO EN ..."
        mpre = re.match(r'(.*?)\s*INSP\w*\s+EN', first, re.I)
        if mpre and mpre.group(1).strip():
            if not fam:
                fam = clean(mpre.group(1))
        joined = ' '.join(seg)
        after = INSP_RE.sub('', joined, count=1)
        after = re.sub(r'^\s*[:.]?\s*', '', after)
        # quitar posible familia-prefijo duplicada al inicio
        if fam and after.upper().startswith(fam.upper()):
            after = after[len(fam):].strip()
        if '|' in after:
            a, b = after.split('|', 1)
            insp, marca = clean(a), clean(b)
        elif len(seg) >= 2:
            last = clean(seg[-1])
            if last and not re.search(r'\d', last) and 1 <= len(last.split()) <= 3 and last.isupper():
                marca = last
                insp = clean(INSP_RE.sub('', ' '.join(seg[:-1]), count=1).lstrip(' :.'))
            else:
                insp = clean(after)
        else:
            insp = clean(after)
    fam = clean(re.sub(r'^\d+\s*ML\b', '', fam, flags=re.I))
    return formato, fam, insp, marca

def clean_brand(s):
    s = clean(s)
    for stop in ['BEST', 'SELLER', 'INDUSTRIA', 'PRECIO', 'OFERTA', 'PERFUME',
                 'LAS IM', 'FRAGANCIA', 'LARGO', ' CM', 'PROMO', 'GARGANTILLA',
                 'PULSERA', 'CIRCONIA', 'INCLUYE']:
        i = s.upper().find(stop)
        if i > 0:
            s = s[:i]
    return clean(s)

def extract_page(pno):
    spans = get_spans(pno)
    din = [s for s in spans if 'DIN' in s[0]]
    # celdas: cada codigo es un producto (cx, cy, code)
    cells = []
    for f, sz, x0, y0, x1, t in din:
        if CODE_RE.match(t):
            cv = code_val(t)
            if cv:
                cells.append({'cx': (x0+x1)/2, 'cy': y0, 'code': cv,
                              'name': [], 'body': []})
    if not cells:
        return []
    centers = cluster_columns([c['cx'] for c in cells])
    n = len(centers)
    bounds = []
    for i in range(n):
        lo = -1e9 if i == 0 else (centers[i-1]+centers[i])/2
        hi = 1e9 if i == n-1 else (centers[i]+centers[i+1])/2
        bounds.append((lo, hi))
    def nearest_cell(cx, cy):
        col = col_of(cx, bounds)
        cand = [c for c in cells if col_of(c['cx'], bounds) == col] or cells
        return min(cand, key=lambda c: abs(cy - c['cy']))
    for f, sz, x0, y0, x1, t in din:
        if CODE_RE.match(t):
            continue
        cell = nearest_cell((x0+x1)/2, y0)
        if f.startswith('DINAlternate'):
            cell['name'].append((x0, y0, x1, t))
        else:  # DINCondensed / DIN-Medium
            cell['body'].append((x0, y0, x1, t))
    results = []
    for cell in cells:
        name = clean(re.sub(r'\bCOD\.?\b', '', ' '.join(lines_from(cell['name'])), flags=re.I))
        name = clean_name(name)
        blines = lines_from(cell['body'])
        formato, fam, insp, marca = parse_body(blines)
        results.append({
            'codigo': cell['code'], 'nombre': name, 'formato': formato,
            'familia_olfativa': fam.title() if fam else '',
            'inspirado_en': insp, 'marca': clean_brand(marca),
            'precio': None, 'precio_regular': None, 'etiquetas': [],
            'page': pno+1, '_cx': cell['cx'], '_cy': cell['cy'],
        })
    assign_prices(pno, results, bounds)
    assign_badges(pno, results, bounds)
    return results

# corta el nombre en tokens de combo/joyeria/badges que se pegan de la misma celda
NAME_CUT = re.compile(r'\b(GARGANTILLA|PULSERA|ARO|AROS|DIJE|CIRCONIA|LADY DI|LARGO|'
    r'STRASS|PIEDRAS|PERLA|CADENA|EDICI[OÓ]N LIMITADA|EDICION LIMITADA|PROMO|INCLUYE|'
    r'GARGANTILL|PU\d|GA\d|AR\d)\b', re.I)
def clean_name(name):
    m = NAME_CUT.search(name)
    if m and m.start() > 0:
        name = name[:m.start()]
    return clean(name)

def assign_badges(pno, results, bounds):
    """Asigna badges (NUEVO / BEST SELLER / EDICION LIMITADA / % OFF) por cercania 2D."""
    words = d[pno].get_text("words")
    toks = []  # (cx, cy, label)
    i = 0
    joined = [(w[0], w[1], w[2], w[3], w[4]) for w in words]
    for x0, y0, x1, y1, t in joined:
        u = t.upper().strip('.,!¡')
        if u in ('NUEVO', 'NUEVA'):
            toks.append(((x0+x1)/2, y0, 'NUEVO'))
        elif u == 'BEST':
            toks.append(((x0+x1)/2, y0, 'BEST SELLER'))
        elif re.match(r'^\d{1,2}%$', u) or (u == 'OFF'):
            toks.append(((x0+x1)/2, y0, 'OFF'))
        elif u in ('EDICION', 'EDICIÓN') :
            toks.append(((x0+x1)/2, y0, 'EDICIÓN LIMITADA'))
    for r in results:
        col = col_of(r['_cx'], bounds)
        near = [tk for tk in toks if col_of(tk[0], bounds) == col and abs(tk[1]-r['_cy']) < 90]
        labs = set()
        for _, _, lab in near:
            if lab != 'OFF':
                labs.add(lab)
        et = list(r['etiquetas'])
        for lab in ('NUEVO', 'BEST SELLER', 'EDICIÓN LIMITADA'):
            if lab in labs and lab not in et:
                et.append(lab)
        # OFERTA / % OFF a partir de precio_regular
        if r['precio'] and r['precio_regular'] and r['precio_regular'] > r['precio']:
            pct = round((1 - r['precio']/r['precio_regular'])*100)
            if 'OFERTA' not in et:
                et.append('OFERTA')
            if pct >= 5:
                et.append(f'{pct}% OFF')
        r['etiquetas'] = et

def assign_prices(pno, results, bounds):
    """Asigna precios a cada producto por proximidad 2D (x de columna, y de celda)."""
    words = d[pno].get_text("words")
    ptext = d[pno].get_text()
    up = ptext.upper()
    reg_vals = [parse_price(m) for m in re.findall(r'PRECIO\s+REGULAR:?\s*\$?\s?(\d{1,3}(?:\.\d{3})+)', up)]
    reg_vals = [v for v in reg_vals if v]
    # tokens de precio con posicion
    sale_tok, reg_tok = [], []
    for w in words:
        x0, y0, x1, y1, t = w[0], w[1], w[2], w[3], w[4]
        for val in re.findall(r'\$?\s?(\d{1,3}(?:\.\d{3})+)', t):
            v = parse_price(val)
            if not v:
                continue
            (reg_tok if v in reg_vals else sale_tok).append(((x0+x1)/2, y0, v))
    def nearest(r, toks):
        col = col_of(r['_cx'], bounds)
        cand = [tk for tk in toks if col_of(tk[0], bounds) == col]
        if not cand:
            return None
        # precio suele estar debajo del codigo; preferimos el mas cercano en y
        return min(cand, key=lambda tk: abs(tk[1] - r['_cy']) + (0 if tk[1] > r['_cy'] - 30 else 200))
    cu = re.findall(r'\$\s?(\d{1,3}(?:\.\d{3})+)\s*(?:c/u|cada|C/U)', ptext, re.I)
    shared = parse_price(cu[0]) if cu else None
    for r in results:
        pt = nearest(r, sale_tok)
        if pt:
            r['precio'] = pt[2]
        rt = nearest(r, reg_tok)
        if rt:
            r['precio_regular'] = rt[2]
    # fallbacks
    for r in results:
        if not r['precio']:
            allp = sorted({parse_price(m) for m in re.findall(r'\$\s?(\d{1,3}(?:\.\d{3})+)', ptext)} - set(reg_vals) - {None})
            if shared:
                r['precio'] = shared
            elif len(allp) == 1:
                r['precio'] = allp[0]
        if not r['precio_regular'] and r['precio'] and len(set(reg_vals)) == 1 and reg_vals and reg_vals[0] > r['precio']:
            r['precio_regular'] = reg_vals[0]
        # sanidad: regular debe ser > precio
        if r['precio_regular'] and r['precio'] and r['precio_regular'] <= r['precio']:
            r['precio_regular'] = None

if __name__ == '__main__':
    allrecs = []
    for pno in range(3, 92):
        allrecs += extract_page(pno)
    seen = {}
    for r in allrecs:
        if r['codigo'] not in seen:
            seen[r['codigo']] = r
    recs = list(seen.values())
    print('total:', len(recs), '/ raw', len(allrecs))
    bad = {'nombre': [], 'precio': [], 'familia': [], 'insp': []}
    for r in recs:
        if not r['nombre']: bad['nombre'].append(r['codigo'])
        if not r['precio']: bad['precio'].append(r['codigo'])
        if not r['familia_olfativa']: bad['familia'].append(r['codigo'])
        if not r['inspirado_en']: bad['insp'].append(r['codigo'])
    for k, v in bad.items():
        print(f'  sin {k}: {len(v)} {v}')
    json.dump(recs, open(sys.argv[1] if len(sys.argv) > 1 else 'out.json', 'w', encoding='utf-8'),
              ensure_ascii=False, indent=1)
