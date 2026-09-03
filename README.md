# El Zar de las Fragancias — Landing

Landing page comercial de una sola página para la perfumería **El Zar de las Fragancias**.
HTML + CSS + JavaScript vanilla. **Sin build step, sin frameworks** — se sube por
drag-and-drop a cualquier hosting estático (Hostinger, Vercel, Netlify).

## 📁 Estructura

```
ZarFragancias/
├── index.html            ← página principal
├── css/styles.css        ← estilos (identidad de marca)
├── js/app.js             ← lógica: catálogo, filtros, WhatsApp, export Instagram
├── data/productos.json   ← 298 productos (se renderizan dinámicamente)
└── assets/
    ├── owner.jpg         ← foto del hero
    └── productos/        ← fotos reales de productos (opcional, ver abajo)
```

## ⚙️ Configuración (IMPORTANTE antes de publicar)

Abrí **`js/app.js`** y editá el objeto `CONFIG` (arriba de todo):

```js
const CONFIG = {
  WHATSAPP_NUMERO: '5491100000000',        // ← tu número, formato internacional SIN + ni espacios
  INSTAGRAM_USER:  'elzardelasfragancias', // ← tu usuario de Instagram (sin @)
  INSTAGRAM_URL:   'https://instagram.com/elzardelasfragancias',
  UBICACION:       'Buenos Aires, Argentina — envíos a todo el país',
  ...
};
```

- **WHATSAPP_NUMERO**: para Argentina es `549` + código de área (sin 0) + número (sin 15).
  Ej: Buenos Aires 11 5678-1234 → `5491156781234`.
- El botón de cada producto abre WhatsApp con un mensaje ya escrito:
  *"¡Hola El Zar! 👑 Me interesa The Bomb (código BF325)…"*

## 🖼️ Fotos de los productos

**Ya vienen incluidas 119 fotos** de frascos, extraídas del propio catálogo PDF y montadas
sobre una placa oscura de marca (`assets/productos/{codigo}.jpg`). Los productos sin foto
usable muestran un **placeholder elegante** (corona + nombre) que no rompe el diseño.

**Para reemplazar o agregar una foto (mejor calidad):**
1. Guardá la imagen en `assets/productos/` con el **código como nombre**, en `.jpg`.
   Ej: producto `BF325` → `assets/productos/BF325.jpg` (ideal vertical 4:5, ~760×950px o más).
2. Si ese producto estaba con placeholder, en `data/productos.js` (y `data/productos.json`)
   buscalo y cambiá `"imagen_placeholder": true` → `false`. Si ya tenía foto, con reemplazar
   el archivo `.jpg` alcanza.
3. Listo: la tarjeta y la placa de Instagram usan la foto automáticamente. Si el archivo no
   existe, vuelve al placeholder solo.

> **Importante:** el sitio lee el catálogo desde **`data/productos.js`** (para que funcione
> también abriendo `index.html` con doble clic). Si editás `data/productos.json`, regenerá el
> `.js` corriendo `python scripts/build_json.py`, o editá directamente el `.js` (es el mismo
> contenido con `window.CATALOGO = ` adelante).

También podés reemplazar la foto del hero en `assets/owner.jpg`.

## 📲 Descargar tarjetas para Instagram

Cada producto tiene el botón **"Descargar para Instagram"** (ícono de cámara). Genera —en el
navegador, sin servidor— una placa PNG con la identidad de la marca en dos formatos:

- **Post cuadrado** 1080×1080
- **Story / Reel** 1080×1920

El archivo se descarga como `elzar_{codigo}_{formato}.png`. Se puede personalizar el
@usuario/contacto que aparece en la placa.

## 🚀 Subir a Hostinger (paso a paso)

1. Entrá a **hPanel** → tu hosting → **Administrador de archivos** (File Manager).
2. Abrí la carpeta **`public_html`** (borrá el `index.html` de ejemplo si hay uno).
3. Seleccioná **TODO** el contenido de esta carpeta (`index.html`, `css/`, `js/`, `data/`,
   `assets/`) y arrastralo adentro de `public_html`.
   - Tip: si subís un `.zip`, usá luego "Extraer" (Extract) dentro de `public_html`.
4. Verificá que quede así: `public_html/index.html`, `public_html/css/styles.css`, etc.
   (el `index.html` debe estar en la **raíz** de `public_html`, no dentro de una subcarpeta).
5. Abrí tu dominio en el navegador. ¡Listo! 🎉

> No hace falta compilar nada. Si actualizás productos, editás `data/productos.json` y volvés
> a subir ese archivo.

### Alternativa rápida (Vercel / Netlify)
Arrastrá la carpeta completa a **vercel.com** o **app.netlify.com/drop**. Deploy instantáneo.

## 🔧 Regenerar el catálogo desde el PDF (avanzado)

Los scripts de extracción (`extract_frag.py`, `extract_secondary.py`, `build_json.py`) usan
**PyMuPDF** y aíslan cada producto por fuente tipográfica del PDF. No son necesarios para
operar el sitio; solo si querés reprocesar un catálogo nuevo.

---
Las imágenes son a modo ilustrativo · Industria Argentina
