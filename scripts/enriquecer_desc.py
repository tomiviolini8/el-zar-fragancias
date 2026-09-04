# -*- coding: utf-8 -*-
"""
Enriquece 'inspirado_en'/'marca' de los perfumes con dato flojo (inspirado_en ausente
o == nombre) y regenera su descripción, para que no queden con copy genérico.

Fuentes (sin inventar):
  1) GEMELO: si otro producto con el MISMO nombre normalizado ya tiene 'inspirado_en'
     validado, se copia (insp/marca/familia).
  2) MAPA curado: dupes clásicos inconfundibles (Sauvage, Invictus, Acqua di Gio, ...).
Los que no matchean quedan como están (se listan para revisar).

Uso: python scripts/enriquecer_desc.py [--dry]
"""
import json, sys, re, unicodedata
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
import gen_descripciones as gd

ROOT = Path(__file__).resolve().parent.parent
JSON = ROOT / "data" / "productos.json"
JS   = ROOT / "data" / "productos.js"
INDEX= ROOT / "index.html"
DRY  = "--dry" in sys.argv

def norm(s):
    s = unicodedata.normalize("NFD", (s or "").lower())
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    s = re.sub(r"[^a-z0-9 ]", " ", s)
    return re.sub(r"\s+", " ", s).strip()

def weak(p):
    ins = norm(p.get("inspirado_en")); nom = norm(p.get("nombre"))
    return (not ins) or ins == nom

# Mapa curado: nombre normalizado -> (inspirado_en, marca)  [dupes clásicos]
MANUAL = {
    "212 vip black": ("212 VIP Black", "Carolina Herrera"),
    "212 sexy": ("212 Sexy", "Carolina Herrera"),
    "212 vip gold": ("212 VIP", "Carolina Herrera"),
    "212 hombre": ("212 Men", "Carolina Herrera"),
    "212 vip": ("212 VIP Men", "Carolina Herrera"),
    "212 rosa": ("212 VIP Rosé", "Carolina Herrera"),
    "212 rosa extra": ("212 VIP Rosé Elixir", "Carolina Herrera"),
    "212 femenino": ("212 Women", "Carolina Herrera"),
    "agua de gio": ("Acqua di Giò", "Giorgio Armani"),
    "aqua di gioia": ("Acqua di Gioia", "Giorgio Armani"),
    "fahrenheite": ("Fahrenheit", "Dior"),
    "salvaje": ("Sauvage", "Dior"),
    "invicto": ("Invictus", "Paco Rabanne"),
    "invicto victoria": ("Invictus Victory", "Paco Rabanne"),
    "invicto victoria elixir": ("Invictus Victory Elixir", "Paco Rabanne"),
    "one dollar": ("One Million", "Paco Rabanne"),
    "lady dollar": ("Lady Million", "Paco Rabanne"),
    "lady dollar fabuloso": ("Lady Million Fabulous", "Paco Rabanne"),
    "stronger intense": ("Stronger With You Intensely", "Emporio Armani"),
    "dolch gaban one": ("The One", "Dolce & Gabbana"),
    "blu d g": ("Light Blue", "Dolce & Gabbana"),
    "rey d g": ("K by Dolce & Gabbana", "Dolce & Gabbana"),
    "quinta avenida": ("5th Avenue", "Elizabeth Arden"),
    "nro 5": ("N.º 5", "Chanel"),
    "libre": ("Libre", "Yves Saint Laurent"),
    "goddess": ("Goddess", "Burberry"),
    "olimpica": ("Olympéa", "Paco Rabanne"),
    "olimpica parfum": ("Olympéa", "Paco Rabanne"),
    "hellowen": ("Halloween", "Jesús Del Pozo"),
    "ok one": ("CK One", "Calvin Klein"),
    "mad boy": ("Bad Boy", "Carolina Herrera"),
    "robot pr": ("Phantom", "Paco Rabanne"),
    "robot femme": ("Fame", "Paco Rabanne"),
    "ton for tuscan leather": ("Tuscan Leather", "Tom Ford"),
    "bonshel": ("Bombshell", "Victoria's Secret"),
    "tini bacaratt": ("Baccarat Rouge 540", "Maison Francis Kurkdjian"),
    "moschi fany": ("Moschino Funny!", "Moschino"),
    "mishaki l eau d ivey": ("L'Eau d'Issey", "Issey Miyake"),
    "escandalo": ("Scandal", "Jean Paul Gaultier"),
    "escandalo homme": ("Scandal pour Homme", "Jean Paul Gaultier"),
    "escandalo parfum": ("Scandal Le Parfum", "Jean Paul Gaultier"),
    "cdnuite blu": ("Club de Nuit Iconic", "Armaf"),
    "ltfa mahir femme": ("Maahir", "Lattafa"),
    "ltfa mahir homme": ("Maahir Legacy", "Lattafa"),
}

def main():
    data = json.loads(JSON.read_text(encoding="utf-8"))
    ps = data["productos"]
    # 1) índice de gemelos (nombre normalizado -> fuente con insp real)
    twin = {}
    for p in ps:
        if not weak(p):
            twin.setdefault(norm(p["nombre"]), {
                "inspirado_en": p.get("inspirado_en"), "marca": p.get("marca"),
                "familia_olfativa": p.get("familia_olfativa"),
            })
    enriquecidos, sin_match = 0, []
    for p in ps:
        if not weak(p): continue
        key = norm(p["nombre"])
        src = twin.get(key)
        if src:
            p["inspirado_en"] = src["inspirado_en"] or p.get("inspirado_en")
            if src.get("marca"): p["marca"] = src["marca"]
            if not (p.get("familia_olfativa") or "").strip() and src.get("familia_olfativa"):
                p["familia_olfativa"] = src["familia_olfativa"]
            p["descripcion"] = gd.build(p); enriquecidos += 1
        elif key in MANUAL:
            insp, marca = MANUAL[key]
            p["inspirado_en"] = insp; p["marca"] = marca
            p["descripcion"] = gd.build(p); enriquecidos += 1
        else:
            sin_match.append(f"{p['codigo']} {p['nombre']}")

    print(f"Enriquecidos: {enriquecidos}")
    print(f"Sin match (quedan con copy genérico, revisar): {len(sin_match)}")
    for s in sin_match: print("   -", s)
    if not DRY:
        data["productos"] = ps
        JSON.write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")
        JS.write_text("window.CATALOGO = " + json.dumps(data, ensure_ascii=False, indent=1) + ";\n", encoding="utf-8")
        html = INDEX.read_text(encoding="utf-8")
        html2 = re.sub(r"(data/productos\.js)\?v=(\d+)", lambda m: f"{m.group(1)}?v={int(m.group(2))+1}", html)
        if html2 != html: INDEX.write_text(html2, encoding="utf-8")
        print("Guardado + cache-bust.")
    else:
        print("(dry-run)")

if __name__ == "__main__":
    main()
