#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Extrae familias secundarias: Boutique, Arabian Gold, Linea Gold, Body Splash,
Body Luxury, Cosmetica. Devuelve listas de dicts homogeneos."""
import pymupdf, re
PDF = 'C:/ZarFragancias/Cata_logo_XII_julio__agosto_2026.pdf'
d = pymupdf.open(PDF)

def ptext(a, b=None):
    b = a if b is None else b
    return '\n'.join(d[i].get_text() for i in range(a, b+1))

def price(s):
    s = str(s).replace('$', '').replace('.', '').replace(' ', '')
    return int(s) if s.isdigit() else None

# ---------- BOUTIQUE (paginas 68-70) ----------
def boutique():
    txt = ptext(68, 70)
    lines = [l.strip() for l in txt.splitlines()]
    out = []
    for i, l in enumerate(lines):
        mc = re.match(r'COD\s+(BOUTIQUE\d+)', l, re.I)
        if not mc:
            continue
        code = mc.group(1).upper()
        # buscar hacia atras: FAMILIA OLFATIVA y la linea de titulo BOUTIQUE ... (INSP)
        fam, insp, title = '', '', ''
        for j in range(i-1, max(0, i-6), -1):
            mf = re.match(r'FAMILIA OLFATIVA:?\s*(.+)', lines[j], re.I)
            if mf and not fam:
                fam = mf.group(1).strip()
            mt = re.search(r'\(([^)]+)\)', lines[j])
            if mt and not insp:
                insp = mt.group(1).strip()
            if re.match(r'\d*\s*30ML|BOUTIQUE', lines[j], re.I) and not title:
                title = lines[j]
        num = code.replace('BOUTIQUE', '')
        out.append({'codigo': code, 'nombre': (insp.title() if insp else f'Boutique N°{num}'),
                    'formato': 'Perfume Boutique Nicho 30ml', 'familia_olfativa': fam.title(),
                    'inspirado_en': insp, 'marca': '', 'precio': 25990, 'precio_regular': 31990,
                    'genero': 'Unisex', 'linea': 'Boutique', 'etiquetas': ['OFERTA']})
    return out

# ---------- ARABIAN GOLD (pagina 71) ----------
def arabian_gold():
    txt = ptext(71)
    out = []
    gen = 'Unisex'
    for line in txt.splitlines():
        l = line.strip()
        if re.match(r'unisex', l, re.I): gen = 'Unisex'; continue
        if re.match(r'femenin', l, re.I): gen = 'Mujer'; continue
        if re.match(r'masculin', l, re.I): gen = 'Hombre'; continue
        m = re.match(r'(AG[UFM]\d{3})\s+(.+)', l)
        if m:
            out.append({'codigo': m.group(1), 'nombre': m.group(2).strip().title(),
                        'formato': 'Perfume Árabe Gold 55ml', 'familia_olfativa': '',
                        'inspirado_en': m.group(2).strip(), 'marca': '', 'precio': 18990,
                        'precio_regular': 22990, 'genero': gen, 'linea': 'Arabian Gold',
                        'etiquetas': ['OFERTA']})
    return out

# ---------- LINEA GOLD (paginas 72-74) ----------
def linea_gold():
    out = []
    for pno, gen in [(72, 'Hombre'), (73, 'Mujer'), (74, 'Mujer')]:
        words = d[pno].get_text("words")
        # agrupar por proximidad: cada codigo GM/GF seguido de un nombre (varias palabras)
        toks = [(w[0], w[1], w[4]) for w in words]
        toks.sort(key=lambda t: (round(t[1]/6), t[0]))
        # reconstruir por lineas
        codes = [(x, y, t) for x, y, t in toks if re.match(r'^G[MF]\d{3}$', t)]
        # nombre = palabras cercanas despues del codigo (misma zona)
        full = d[pno].get_text()
        # patron: CODE \n Name words \n (hasta proximo code)
        blocks = re.split(r'\b(G[MF]\d{3})\b', full)
        # blocks: [pre, code1, text1, code2, text2, ...]
        for i in range(1, len(blocks)-1, 2):
            code = blocks[i]
            nm = blocks[i+1]
            # tomar hasta 4 palabras utiles
            nm = re.split(r'\b(?:LINEA|FEMENINO|MASCULINO|INDUSTRIA|PRESENTACI|PARFUM|I WILL|ALL BEAUTY|GODDESS|\$)', nm)[0]
            nm = re.sub(r'[\n]+', ' ', nm)
            nm = clean_words(nm)
            if not nm:
                continue
            out.append({'codigo': code, 'nombre': nm.title(),
                        'formato': 'Perfume Gold 55ml', 'familia_olfativa': '',
                        'inspirado_en': nm, 'marca': '', 'precio': 15990,
                        'precio_regular': 21990, 'genero': gen, 'linea': 'Línea Gold',
                        'etiquetas': ['OFERTA']})
    # dedup
    seen = {}
    for r in out:
        seen.setdefault(r['codigo'], r)
    return list(seen.values())

def clean_words(s):
    s = re.sub(r'\s+', ' ', s).strip(' .,-')
    s = re.sub(r'\s+\d{1,3}$', '', s)  # quitar numero de pagina pegado
    # descartar restos numericos
    if len(s) < 2 or s.isdigit():
        return ''
    return s

# ---------- BODY SPLASH (pagina 75) + BODY LUXURY (76) ----------
def body_splash():
    out = []
    txt = d[75].get_text()
    # nombres (femeninos/masculinos) y luego codigos BSFP/BSMP en orden
    names = []
    codes = []
    gen_map = {}
    cur = 'Mujer'
    for l in txt.splitlines():
        s = l.strip()
        if re.match(r'femenin', s, re.I): cur = 'Mujer'; continue
        if re.match(r'masculin', s, re.I): cur = 'Hombre'; continue
        if re.match(r'^(BSFP|BSMP)\d+$', s):
            codes.append((s, 'Mujer' if s.startswith('BSFP') else 'Hombre'))
        elif (s and not re.search(r'BODY|SPLASH|INDUSTRIA|IM[ÁA]GENES|PRECIO|\$|^\d+$', s, re.I)
              and len(s) > 2 and not all(len(w) == 1 for w in s.split())):
            names.append(s)
    # emparejar por orden dentro de cada genero
    fem_names = names[:len([c for c in codes if c[1]=='Mujer'])]
    # simpler: keep names list and codes list, zip by genre order
    fem_codes = [c[0] for c in codes if c[1] == 'Mujer']
    mas_codes = [c[0] for c in codes if c[1] == 'Hombre']
    # split names by where masculinos starts — approximate: names in order female then male
    fn = names[:len(fem_codes)]
    mn = names[len(fem_codes):len(fem_codes)+len(mas_codes)]
    for code, nm in list(zip(fem_codes, fn)) + list(zip(mas_codes, mn)):
        gen = 'Mujer' if code.startswith('BSFP') else 'Hombre'
        out.append({'codigo': code, 'nombre': nm.title(), 'formato': 'Body Splash',
                    'familia_olfativa': '', 'inspirado_en': nm, 'marca': '',
                    'precio': 15990, 'precio_regular': 18990, 'genero': gen,
                    'linea': 'Body Splash', 'etiquetas': ['OFERTA']})
    # body luxury 76
    txt2 = d[76].get_text()
    for m in re.finditer(r'([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ ]+?)\s*\n\s*BODY LUXURY SPLASH\s*\n?\s*200 ML\s*\n?\s*(BLS\d+)', txt2):
        out.append({'codigo': m.group(2), 'nombre': m.group(1).strip().title(),
                    'formato': 'Body Luxury Splash 200ml', 'familia_olfativa': '',
                    'inspirado_en': m.group(1).strip(), 'marca': '', 'precio': 17990,
                    'precio_regular': 21990, 'genero': 'Unisex', 'linea': 'Body Splash',
                    'etiquetas': ['OFERTA']})
    return out

# ---------- COSMETICA (paginas 78-88) ----------
def cosmetica():
    out = []
    # items puntuales con precio propio
    catalog = [
        ('PSF1', 'Protector Solar Facial', 'Con niacinamida y ácido hialurónico 50g', 27990, None),
        ('BTR1', 'Bruma Pro Balance', 'Con extracto de rosas 150ml', 18990, None),
        ('SVC01', 'Serum Vitamina C', '30ml', 20990, None),
        ('SAH01', 'Serum Ácido Hialurónico', '30ml', 20990, None),
        ('SNIA01', 'Pro Niacinamide Mat', 'Concentrado minimizador de poros 30g', 22990, None),
        ('CDO01', 'Crema de Ordeñe', 'Con ácido hialurónico 300g', 25500, None),
        ('CDO02', 'Crema de Ordeñe Ultra Concentrada', 'Con ácido hialurónico 200g', 21500, None),
        ('CFH01', 'Crema Facial Hidratante', 'A base de oro x50g', 20990, None),
        ('CFN01', 'Crema Facial Nutritiva', 'A base de caviar x50g', 20990, None),
        ('ESPF001', 'Espuma Facial Vainilla', 'Por 150ml', 12990, None),
        ('PAE01', 'Pomada Óleo 30+1', 'Ungüento balsámico con vitamina E y karité', 14990, None),
        ('KMC1', 'Body Mousse Corporal Kaloe', 'Con aloe vera x100g', 10900, 11900),
        ('KCG1', 'Gel Crema Reparadora Kaloe', 'Con aloe vera x50g', 8900, None),
        ('KGL1', 'Gel de Limpieza Kaloe', 'Con aloe vera x50g', 8900, None),
        ('COLAG02', 'Beauty Collagen Piel', 'Colágeno hidrolizado + Vit C, Q10, hialurónico x150g', 36990, None),
        ('COLAG01', 'Beauty Collagen Cabello y Uñas', 'Colágeno + biotina, cúrcuma, B12 x150g', 36990, None),
        ('COLAG03', 'Beauty Collagen Multivitamínico', 'Colágeno + magnesio, cúrcuma, K2, D3 x150g', 36990, None),
        ('COLAG04', 'Beauty Collagen Articulaciones', 'Colágeno + Vit B, C, A x150g', 36990, None),
    ]
    for code, nm, desc, p, pr in catalog:
        out.append({'codigo': code, 'nombre': nm, 'formato': 'Cosmética',
                    'familia_olfativa': '', 'inspirado_en': '', 'marca': '',
                    'descripcion': desc, 'precio': p, 'precio_regular': pr,
                    'genero': 'Unisex', 'linea': 'Cosmética',
                    'etiquetas': ['OFERTA'] if pr else []})
    # emulsion corporal (varias fragancias) EC + codigo
    ectxt = d[81].get_text()
    ecs = re.findall(r'\n([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ +&]+?)\s*\n(EC\d{3})', ectxt)
    for nm, code in ecs:
        out.append({'codigo': code, 'nombre': f'Emulsión Corporal {nm.strip().title()}',
                    'formato': 'Emulsión Corporal 200ml', 'familia_olfativa': '',
                    'inspirado_en': nm.strip(), 'marca': '', 'descripcion': 'Acción anticelulítica, hidratación extrema',
                    'precio': 13500, 'precio_regular': 18500, 'genero': 'Unisex',
                    'linea': 'Cosmética', 'etiquetas': ['OFERTA']})
    return out

if __name__ == '__main__':
    import json
    fams = {'boutique': boutique(), 'arabian_gold': arabian_gold(),
            'linea_gold': linea_gold(), 'body_splash': body_splash(),
            'cosmetica': cosmetica()}
    for k, v in fams.items():
        print(f'{k}: {len(v)}')
        for r in v[:3]:
            print('   ', r['codigo'], r['nombre'], r.get('precio'))
    allsec = sum(fams.values(), [])
    print('TOTAL secundarios:', len(allsec))
    json.dump(allsec, open('secondary_out.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
