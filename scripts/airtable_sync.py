# -*- coding: utf-8 -*-
"""
Poblar Airtable (fuente de verdad de la landing).

La web LEE de Airtable en vivo a través de /api/catalogo (función serverless en
Vercel). Este script solo sirve para la carga inicial de los 262 productos.

Comandos:
  python scripts/airtable_sync.py check                 # verifica token y cuenta registros
  python scripts/airtable_sync.py seed                  # sube data/productos.json (upsert por Codigo). Deja Foto vacía -> placeholder.
  python scripts/airtable_sync.py seed --fotos-actuales # además carga como Foto los recortes actuales del catálogo (assets/productos/<cod>.jpg vía SITE_URL)
  python scripts/airtable_sync.py pull                  # Airtable -> web: regenera json/js + baja fotos y les QUITA EL FONDO (transparente)
  python scripts/airtable_sync.py pull --no-bg          # igual pero sin quitar el fondo (usa la foto tal cual)

Requiere scripts/.env con AIRTABLE_TOKEN (ver .env.example). El pull usa rembg
para dejar los frascos sin fondo; el resto es stdlib.
"""
import json, os, sys, time, re, unicodedata, shutil, urllib.request, urllib.error, urllib.parse
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ENV  = Path(__file__).resolve().parent / ".env"
DATA_JSON = ROOT / "data" / "productos.json"
DATA_JS   = ROOT / "data" / "productos.js"
IMG_DIR   = ROOT / "assets" / "productos"
INDEX     = ROOT / "index.html"
API = "https://api.airtable.com/v0"
NO_BG = "--no-bg" in sys.argv   # si se pasa, no quita el fondo de las fotos

# Mapeo campo Airtable <-> clave del producto  (kind: text/num/bool/list)
FIELDS = [
    ("Codigo",           "codigo",           "text"),
    ("Nombre",           "nombre",           "text"),
    ("Precio",           "precio",           "num"),
    ("Precio regular",   "precio_regular",   "num"),
    ("Descuento %",      "descuento_pct",    "num"),
    ("Descripcion",      "descripcion",      "text"),
    ("Inspirado en",     "inspirado_en",     "text"),
    ("Marca",            "marca",            "text"),
    ("Formato",          "formato",          "text"),
    ("Familia olfativa", "familia_olfativa", "text"),
    ("Genero",           "genero",           "text"),
    ("Linea",            "linea",            "text"),
    ("Ocasion",          "ocasion",          "text"),
    ("Es arabe",         "es_arabe",         "bool"),
    ("Categorias",       "categorias",       "list"),
    ("Etiquetas",        "etiquetas",        "list"),
    ("Pagina",           "pagina",           "num"),
]

def load_env():
    env = {}
    if ENV.exists():
        for line in ENV.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line: continue
            k, v = line.split("=", 1); env[k.strip()] = v.strip()
    for k in ("AIRTABLE_TOKEN", "AIRTABLE_BASE", "AIRTABLE_TABLE", "SITE_URL"):
        if os.environ.get(k): env[k] = os.environ[k]
    if not env.get("AIRTABLE_TOKEN") or env["AIRTABLE_TOKEN"].startswith("pat_pegar"):
        sys.exit("ERROR: falta AIRTABLE_TOKEN en scripts/.env (ver scripts/.env.example).")
    env.setdefault("AIRTABLE_BASE", "appNFFIDioekqNCEV")
    env.setdefault("AIRTABLE_TABLE", "Perfumes")
    env.setdefault("SITE_URL", "https://el-zar-fragancias.vercel.app")
    return env

def api_req(env, method, query="", body=None):
    url = f"{API}/{env['AIRTABLE_BASE']}/{urllib.parse.quote(env['AIRTABLE_TABLE'])}{query}"
    data = json.dumps(body).encode("utf-8") if body is not None else None
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header("Authorization", f"Bearer {env['AIRTABLE_TOKEN']}")
    if data: req.add_header("Content-Type", "application/json")
    for attempt in range(5):
        try:
            with urllib.request.urlopen(req) as r:
                return json.loads(r.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            if e.code == 429: time.sleep(1.5); continue
            sys.exit(f"HTTP {e.code} en {method} {url}\n{e.read().decode('utf-8','ignore')}")
        except urllib.error.URLError as e:
            time.sleep(1.0)
            if attempt == 4: sys.exit(f"Red: {e}")
    sys.exit("Demasiados reintentos (rate limit).")

def cmd_seed(env):
    con_fotos = "--fotos-actuales" in sys.argv
    ps = json.loads(DATA_JSON.read_text(encoding="utf-8"))["productos"]
    site = env["SITE_URL"].rstrip("/")
    records = []
    for p in ps:
        f = {}
        for aname, pkey, kind in FIELDS:
            v = p.get(pkey)
            if kind == "num":
                if v in ("", None): continue
                f[aname] = v
            elif kind == "bool":
                f[aname] = bool(v)
            elif kind == "list":
                f[aname] = v or []
            else:
                if v not in ("", None): f[aname] = v
        if con_fotos:
            img = p.get("imagen")
            if img and not p.get("imagen_placeholder", False):
                f["Foto"] = [{"url": f"{site}/{img}"}]
        f["Publicar"] = True
        records.append({"fields": f})
    print(f"Subiendo {len(records)} registros (upsert por Codigo){' + fotos actuales' if con_fotos else ' sin fotos (placeholder)'}...")
    for i in range(0, len(records), 10):
        api_req(env, "PATCH", "", {"performUpsert": {"fieldsToMergeOn": ["Codigo"]},
                                   "records": records[i:i+10], "typecast": True})
        print(f"  {min(i+10, len(records))}/{len(records)}"); time.sleep(0.25)
    print("Seed completo. Revisá la base en Airtable.")

def fetch_all(env):
    out, offset = [], None
    while True:
        q = "?pageSize=100" + (f"&offset={offset}" if offset else "")
        r = api_req(env, "GET", q); out.extend(r.get("records", [])); offset = r.get("offset")
        if not offset: break
    return out

def cmd_check(env):
    print(f"Token OK. Base {env['AIRTABLE_BASE']} / {env['AIRTABLE_TABLE']}: {len(fetch_all(env))} registros.")

def slugify(s):
    s = unicodedata.normalize("NFKD", s or "").encode("ascii", "ignore").decode()
    return re.sub(r"[^a-zA-Z0-9]+", "-", s).strip("-").lower() or "item"

def download(url, dest):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req) as r, open(dest, "wb") as fh:
        fh.write(r.read())

# --- Quita-fondo (rembg) para dejar el frasco transparente sobre el diseño oscuro ---
_rembg_session = None
def quitar_fondo(src, dest):
    """True si generó el PNG transparente en dest; False si falló (usar original)."""
    global _rembg_session
    try:
        from rembg import remove, new_session
        from PIL import Image
        if _rembg_session is None:
            _rembg_session = new_session("isnet-general-use")
        img = Image.open(src).convert("RGBA")
        res = remove(img, session=_rembg_session, post_process_mask=True)
        res.save(dest)
        return True
    except Exception as e:
        print(f"  ! quita-fondo falló ({getattr(src,'name',src)}): {e}")
        return False

def cmd_pull(env):
    recs = fetch_all(env)
    print(f"{len(recs)} registros en Airtable.")
    IMG_DIR.mkdir(parents=True, exist_ok=True)
    productos, n_img = [], 0
    for rec in recs:
        fl = rec.get("fields", {})
        cod = (fl.get("Codigo") or "").strip()
        if not cod or fl.get("Publicar") is False:
            continue
        p = {
            "id": f"{slugify(fl.get('Nombre'))}-{cod.lower()}",
            "codigo": cod, "nombre": fl.get("Nombre") or "",
            "formato": fl.get("Formato") or "", "familia_olfativa": fl.get("Familia olfativa") or "",
            "inspirado_en": fl.get("Inspirado en") or "", "marca": fl.get("Marca") or "",
            "precio": fl.get("Precio"), "precio_regular": fl.get("Precio regular"),
            "descuento_pct": fl.get("Descuento %") or 0, "descripcion": fl.get("Descripcion") or "",
            "genero": fl.get("Genero") or "", "linea": fl.get("Linea") or "",
            "es_arabe": bool(fl.get("Es arabe")), "ocasion": fl.get("Ocasion") or "",
            "categorias": fl.get("Categorias") or [], "etiquetas": fl.get("Etiquetas") or [],
            "pagina": fl.get("Pagina"), "stock": fl.get("Stock") or "A pedido",
            "imagen": "", "imagen_placeholder": True,
        }
        # foto: Foto URL tiene prioridad; si no, primer adjunto
        url, ext = None, ".jpg"
        if fl.get("Foto URL"):
            url = fl["Foto URL"].strip()
            ext = ".png" if url.lower().split("?")[0].endswith(".png") else ".jpg"
        else:
            atts = fl.get("Foto") or []
            if atts:
                url = atts[0].get("url")
                fn = (atts[0].get("filename") or "").lower(); ty = atts[0].get("type", "")
                ext = ".png" if (fn.endswith(".png") or ty.endswith("png")) else ".jpg"
        if url:
            try:
                tmp = IMG_DIR / f"{cod}__orig{ext}"
                download(url, tmp)
                dest_png = IMG_DIR / f"{cod}.png"
                if (not NO_BG) and quitar_fondo(tmp, dest_png):
                    try: tmp.unlink()
                    except OSError: pass
                    jpg = IMG_DIR / f"{cod}.jpg"
                    if jpg.exists(): jpg.unlink()
                    p["imagen"] = f"assets/productos/{cod}.png"
                else:
                    final = IMG_DIR / f"{cod}{ext}"
                    tmp.replace(final)
                    other = IMG_DIR / f"{cod}{'.jpg' if ext=='.png' else '.png'}"
                    if other.exists(): other.unlink()
                    p["imagen"] = f"assets/productos/{cod}{ext}"
                p["imagen_placeholder"] = False; n_img += 1
            except Exception as e:
                print(f"  ! foto {cod}: {e}")
        productos.append(p)
    productos.sort(key=lambda x: x["codigo"])
    data = {"meta": {"marca": "El Zar de las Fragancias", "catalogo": "Catálogo Sep/Oct 2026",
                     "total": len(productos), "moneda": "ARS"}, "productos": productos}
    DATA_JSON.write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")
    DATA_JS.write_text("window.CATALOGO = " + json.dumps(data, ensure_ascii=False, indent=1) + ";\n", encoding="utf-8")
    if INDEX.exists():
        html = INDEX.read_text(encoding="utf-8")
        html2 = re.sub(r"(data/productos\.js)\?v=(\d+)", lambda m: f"{m.group(1)}?v={int(m.group(2))+1}", html)
        if html2 != html: INDEX.write_text(html2, encoding="utf-8")
    print(f"OK: {len(productos)} productos, {n_img} con foto, {len(productos)-n_img} con placeholder.")
    print("Luego: git add -A && git commit -m 'Sync catálogo desde Airtable' && git push")

def main():
    cmd = sys.argv[1] if len(sys.argv) > 1 else ""
    if cmd not in ("seed", "check", "pull"): sys.exit(__doc__)
    env = load_env()
    {"seed": cmd_seed, "check": cmd_check, "pull": cmd_pull}[cmd](env)

if __name__ == "__main__":
    main()
