#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Ensambla /data/productos.json final: enriquece fragancias + familias secundarias."""
import json, re, unicodedata, sys, os

SP = 'C:/Users/tomas/AppData/Local/Temp/claude/C--ZarFragancias/44e2a542-26c4-4056-94ff-c44a7acfaa3c/scratchpad'
OUT = 'C:/ZarFragancias/data/productos.json'
IMGDIR = 'C:/ZarFragancias/assets/productos'

def has_image(code):
    return os.path.exists(os.path.join(IMGDIR, code + '.jpg'))

def slugify(s):
    s = unicodedata.normalize('NFKD', s).encode('ascii', 'ignore').decode()
    s = re.sub(r'[^a-zA-Z0-9]+', '-', s).strip('-').lower()
    return s or 'x'

def genero_from(code, nombre=''):
    p = re.match(r'[A-Z]+', code).group(0)
    n = nombre.upper()
    if code.startswith(('BF', 'PF', 'ACF', 'AGF', 'GF', 'BSFP', 'EC')):
        return 'Mujer'
    if code.startswith(('BM', 'PM', 'ACM', 'AGM', 'GM', 'BSMP')):
        return 'Hombre'
    if code.startswith('COL'):
        return 'Unisex'
    return 'Unisex'

def ocasion_from(fam):
    f = (fam or '').lower()
    if any(w in f for w in ['cítric', 'citric', 'acuát', 'acuat', 'fougere', 'aromát', 'aromat', 'verde']):
        return 'Día'
    if any(w in f for w in ['oriental', 'ámbar', 'ambar', 'cuero', 'amaderad', 'especiad', 'tabaco', 'oud']):
        return 'Noche'
    if any(w in f for w in ['floral', 'frutal', 'dulce', 'gourmand', 'vainilla', 'chipre']):
        return 'Citas'
    return 'Ecléctica'

def es_arabe(code, linea=''):
    return code.startswith(('ACF', 'ACM', 'ACU', 'AGF', 'AGM', 'AGU', 'BOUTIQUE')) or 'Árabe' in linea or 'Arabian' in linea or 'Boutique' in linea

def linea_frag(code):
    if code.startswith(('ACF', 'ACM', 'ACU')):
        return 'Arabian Collection'
    if code.startswith(('PF', 'PM')):
        return 'Pocket'
    return 'Premium'

def build():
    frag = json.load(open(f'{SP}/frag_out.json', encoding='utf-8'))
    sec = json.load(open(f'{SP}/secondary_out.json', encoding='utf-8'))
    productos = []

    for r in frag:
        code = r['codigo']
        # precio fallback: si falta precio pero hay regular, usar regular como precio
        precio = r['precio']
        preg = r['precio_regular']
        if not precio and preg:
            precio, preg = preg, None
        if not precio and code == 'BF281':
            precio = 29900
        gen = genero_from(code, r['nombre'])
        linea = linea_frag(code)
        arabe = es_arabe(code, linea)
        cats = ['Fragancias Premium']
        if arabe:
            cats.append('Línea Árabe')
        if linea == 'Pocket':
            cats.append('Pocket')
        if gen == 'Hombre':
            cats.append('Masculinas')
        elif gen == 'Mujer':
            cats.append('Femeninas')
        else:
            cats.append('Unisex')
        et = list(r.get('etiquetas', []))
        pg = r.get('page', 0)
        # etiquetas por seccion del catalogo (indice): Lanzamientos 4-13, Best Sellers 19-28
        if 4 <= pg <= 13 and 'NUEVO' not in et:
            et.insert(0, 'NUEVO')
        if 19 <= pg <= 28 and 'BEST SELLER' not in et:
            et.append('BEST SELLER')
        if 'OFERTA' in et:
            cats.append('Ofertas')
        if 'BEST SELLER' in et:
            cats.append('Best Sellers')
        if 'NUEVO' in et:
            cats.append('Novedades')
        productos.append(mk(code, r['nombre'], r.get('formato', ''), r.get('familia_olfativa', ''),
                            r.get('inspirado_en', ''), r.get('marca', ''), precio, preg, gen,
                            linea, cats, et, ocasion_from(r.get('familia_olfativa', '')),
                            arabe, r.get('descripcion', '')))

    for r in sec:
        code = r['codigo']
        gen = r.get('genero') or genero_from(code, r['nombre'])
        linea = r.get('linea', 'Complementarios')
        arabe = es_arabe(code, linea)
        cats = []
        if linea == 'Cosmética':
            cats = ['Cosmética']
        elif linea in ('Body Splash',):
            cats = ['Complementarios', 'Body Splash']
        elif linea == 'Boutique':
            cats = ['Fragancias Premium', 'Línea Árabe', 'Boutique Nicho']
        elif linea == 'Arabian Gold':
            cats = ['Línea Árabe', 'Arabian Gold']
        elif linea == 'Línea Gold':
            cats = ['Complementarios', 'Línea Gold']
        else:
            cats = ['Complementarios']
        if gen == 'Hombre' and linea not in ('Cosmética',):
            cats.append('Masculinas')
        elif gen == 'Mujer' and linea not in ('Cosmética',):
            cats.append('Femeninas')
        et = list(r.get('etiquetas', []))
        if 'OFERTA' in et and linea != 'Cosmética':
            cats.append('Ofertas')
        productos.append(mk(code, r['nombre'], r.get('formato', ''), r.get('familia_olfativa', ''),
                            r.get('inspirado_en', ''), r.get('marca', ''), r.get('precio'),
                            r.get('precio_regular'), gen, linea, cats, et,
                            ocasion_from(r.get('familia_olfativa', '')), arabe, r.get('descripcion', '')))

    return productos

def mk(code, nombre, formato, fam, insp, marca, precio, preg, gen, linea, cats, et, ocasion, arabe, desc=''):
    # limpiar
    nombre = re.sub(r'\s+', ' ', nombre).strip() or code
    if precio and preg and preg <= precio:
        preg = None
    pct = round((1 - precio/preg)*100) if (precio and preg and preg > precio) else 0
    tiene_img = has_image(code)
    return {
        'id': slugify(nombre) + '-' + code.lower(),
        'codigo': code,
        'nombre': nombre.title() if nombre.isupper() else nombre,
        'formato': formato,
        'familia_olfativa': fam,
        'inspirado_en': insp,
        'marca': marca,
        'precio': precio,
        'precio_regular': preg,
        'descuento_pct': pct,
        'descripcion': desc,
        'genero': gen,
        'linea': linea,
        'es_arabe': arabe,
        'ocasion': ocasion,
        'categorias': sorted(set(cats)),
        'etiquetas': et,
        'imagen': f'assets/productos/{code}.jpg',
        'imagen_placeholder': not tiene_img,
    }

if __name__ == '__main__':
    productos = build()
    # dedup por codigo
    seen = {}
    for p in productos:
        seen.setdefault(p['codigo'], p)
    productos = list(seen.values())
    data = {
        'meta': {
            'marca': 'El Zar de las Fragancias',
            'catalogo': 'Catálogo XII — Julio/Agosto 2026',
            'total': len(productos),
            'moneda': 'ARS',
        },
        'productos': productos,
    }
    json.dump(data, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    # versión embebida (funciona sin servidor / file://)
    js = ('/* Catálogo embebido — generado desde productos.json. */\n'
          'window.CATALOGO = ' + json.dumps(data, ensure_ascii=False, indent=1) + ';\n')
    open(OUT.replace('.json', '.js'), 'w', encoding='utf-8').write(js)
    # resumen
    from collections import Counter
    print('TOTAL productos:', len(productos))
    print('\nPor linea:')
    for k, v in Counter(p['linea'] for p in productos).most_common():
        print(f'  {k:22} {v}')
    print('\nPor genero:')
    for k, v in Counter(p['genero'] for p in productos).most_common():
        print(f'  {k:22} {v}')
    print('\nPor categoria:')
    cc = Counter()
    for p in productos:
        for c in p['categorias']:
            cc[c] += 1
    for k, v in cc.most_common():
        print(f'  {k:22} {v}')
    print('\nEn oferta:', sum(1 for p in productos if p['precio_regular']))
    print('Árabes:', sum(1 for p in productos if p['es_arabe']))
    print('Sin precio:', [p['codigo'] for p in productos if not p['precio']])
