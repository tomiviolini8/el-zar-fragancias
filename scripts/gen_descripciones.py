# -*- coding: utf-8 -*-
"""
Genera descripciones de venta ("copy") para cada producto a partir de los
datos existentes (familia olfativa, inspirado_en, marca, genero, ocasion, linea).
- Solo rellena `descripcion` cuando está vacía (no pisa copy manual).
- Determinista: la variante de plantilla se elige por el código del producto,
  así que re-ejecutar no cambia el resultado.
Uso:  python scripts/gen_descripciones.py [--force] [--dry]
"""
import json, sys, re, unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
JSON = ROOT / "data" / "productos.json"

FORCE = "--force" in sys.argv          # regenerar aunque ya tenga descripción
DRY   = "--dry" in sys.argv            # no escribir, solo mostrar

def strip_accents(s):
    return "".join(c for c in unicodedata.normalize("NFD", s) if unicodedata.category(c) != "Mn")

def key(s):
    return strip_accents((s or "").lower())

def title(s):
    s = (s or "").strip()
    return re.sub(r"\w[\w']*", lambda m: m.group(0)[0].upper() + m.group(0)[1:].lower(), s)

def hnum(code):
    return sum(ord(c) for c in (code or "x"))

# --- Familia olfativa -> frase sensorial (por palabras clave) ---
FAM_KW = [
    ("gourmand", "matices gourmand"),
    ("vainilla", "vainilla cremosa"),
    ("avainill", "vainilla cremosa"),
    ("ambar",    "calidez ambarina"),
    ("amaderad", "fondo amaderado"),
    ("maderas",  "fondo amaderado"),
    ("cuero",    "un acorde de cuero noble"),
    ("chipre",   "elegancia chipre"),
    ("fougere",  "frescor fougère"),
    ("especiad", "especias envolventes"),
    ("oriental", "carácter oriental"),
    ("citric",   "frescura cítrica"),
    ("acuatic",  "notas acuáticas"),
    ("aromatic", "hierbas aromáticas"),
    ("frutal",   "destellos frutales"),
    ("floral",   "un corazón floral"),
    ("dulce",    "un fondo dulce"),
]

def familia_frase(fam):
    k = key(fam)
    hits = []
    for kw, frase in FAM_KW:
        if kw in k and frase not in hits:
            hits.append(frase)
    if not hits:
        return ""
    if len(hits) == 1:
        return hits[0]
    return hits[0] + " y " + hits[1]

GENERO = {
    "Hombre": ["de presencia masculina", "para el hombre que deja huella", "de carácter masculino"],
    "Mujer":  ["de feminidad envolvente", "para la mujer que marca presencia", "de una femineidad luminosa"],
    "Unisex": ["de espíritu unisex", "para quien elige su propia firma", "de uso libre y personal"],
}

OCASION = {
    "Noche":  "Ideal para la noche.",
    "Día":    "Perfecto para el día a día.",
    "Dia":    "Perfecto para el día a día.",
    "Citas":  "Pensado para citas y momentos especiales.",
    "Ecléctica": "Versátil: te acompaña de día y de noche.",
    "Eclectica": "Versátil: te acompaña de día y de noche.",
}

def clean_insp(insp):
    s = (insp or "").strip()
    s = re.sub(r"\b(EDP|EDT|EDC|EDP\s*Intense|Elixir|Parfum|Eau\s*de\s*Parfum)\b", "", s, flags=re.I).strip()
    return re.sub(r"\s{2,}", " ", s)

def es_cosmetica(p):
    linea = key(p.get("linea"))
    fmt = key(p.get("formato"))
    return ("cosm" in linea) or any(w in fmt for w in ["emulsion", "espuma", "crema", "serum", "colageno", "locion", "body", "corporal", "gel"])

def desc_cosmetica(p):
    fmt = key(p.get("formato"))
    insp = clean_insp(p.get("inspirado_en"))
    nombre = (p.get("nombre") or "").strip()
    # solo usar aroma si es una referencia corta y distinta del nombre del producto
    aroma = title(insp) if insp and key(insp) != key(nombre) and len(insp) <= 22 else ""
    if "espuma" in fmt or "mousse" in fmt:
        tipo, verbo, cola = "Espuma corporal", "limpia y perfuma", "para una piel suave y aromatizada"
    elif "serum" in fmt:
        tipo, verbo, cola = "Sérum", "nutre e ilumina", "para un cuidado diario de la piel"
    elif "crema" in fmt:
        tipo, verbo, cola = "Crema corporal", "hidrata y suaviza", "para una piel nutrida y perfumada"
    elif "colageno" in fmt:
        tipo, verbo, cola = "Tratamiento con colágeno", "reafirma y nutre", "para una piel firme y luminosa"
    else:
        tipo, verbo, cola = "Emulsión corporal", "hidrata y perfuma", "ideal para prolongar tu fragancia"
    if aroma:
        return f"{tipo} que {verbo} la piel con la estela de {aroma}. Ideal para prolongar tu fragancia todo el día."
    return f"{tipo} que {verbo} la piel, {cola}."

def desc_perfume(p):
    h = hnum(p.get("codigo"))
    fam = p.get("familia_olfativa")
    fam_fr = familia_frase(fam)
    genero = p.get("genero")
    gfr = GENERO.get(genero, GENERO["Unisex"])[h % 3]
    occ = OCASION.get((p.get("ocasion") or "").strip(), "")
    insp = clean_insp(p.get("inspirado_en"))
    nombre = (p.get("nombre") or "").strip()
    tiene_insp = bool(insp) and key(insp) != key(nombre)
    marca = title(p.get("marca")) if p.get("marca") else ""
    marca_tail = f" de {marca}" if marca else ""
    es_arabe = p.get("es_arabe")

    fam_cap = (fam_fr[0].upper() + fam_fr[1:]) if fam_fr else ""

    if tiene_insp:
        insp_t = title(insp)
        opts = []
        if fam_fr:
            opts.append(f"{fam_cap}, inspirado en {insp_t}{marca_tail}. {occ}".strip())
            opts.append(f"Evoca a {insp_t}{marca_tail} con {fam_fr}, {gfr}. {occ}".strip())
            opts.append(f"Recreación de alto perfil inspirada en {insp_t}{marca_tail}: {fam_fr}. {occ}".strip())
        else:
            opts.append(f"Inspirado en {insp_t}{marca_tail}, {gfr}. {occ}".strip())
            opts.append(f"Fragancia {gfr} que evoca a {insp_t}{marca_tail}. {occ}".strip())
        return opts[h % len(opts)]

    # línea propia / árabe sin "inspirado en" real
    arab = "árabe " if es_arabe else ""
    opts = []
    if fam_fr:
        opts.append(f"Fragancia {arab}de {fam_fr}, {gfr}. {occ}".strip())
        opts.append(f"{fam_cap} en una fragancia {arab}exclusiva, {gfr}. {occ}".strip())
    else:
        opts.append(f"Fragancia {arab}de autor, {gfr}. {occ}".strip())
        opts.append(f"Una firma {arab}distinta, {gfr}. {occ}".strip())
    return opts[h % len(opts)]

def build(p):
    return desc_cosmetica(p) if es_cosmetica(p) else desc_perfume(p)

def main():
    data = json.loads(JSON.read_text(encoding="utf-8"))
    ps = data["productos"]
    n = 0
    for p in ps:
        if not FORCE and (p.get("descripcion") or "").strip():
            continue
        d = re.sub(r"\s{2,}", " ", build(p)).strip()
        d = d.replace(" .", ".").strip()
        p["descripcion"] = d
        n += 1
    print(f"Descripciones generadas: {n} / {len(ps)}")
    # muestra variada
    import random
    random.seed(7)
    sample = random.sample(ps, 12)
    print("\n=== MUESTRAS ===")
    for p in sample:
        print(f"[{p['codigo']}] {p['nombre']} ({p.get('linea')}/{p.get('genero')}/{p.get('familia_olfativa') or '-'})")
        print(f"   -> {p['descripcion']}\n")
    if not DRY:
        JSON.write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")
        print("Guardado en", JSON)
    else:
        print("(dry-run: no se escribió)")

if __name__ == "__main__":
    main()
