# El Zar de las Fragancias — Landing

Landing page comercial de una sola página para la perfumería **El Zar de las Fragancias**.
HTML + CSS + JavaScript **vanilla**, sin build step, sin frameworks. Se puede publicar en
GitHub y desplegar en Vercel (o cualquier hosting estático) tal cual está.

## 📁 Estructura

```
ZarFragancias/
├── index.html               ← página principal
├── css/styles.css           ← estilos (identidad de marca)
├── js/app.js                 ← catálogo, filtros, buscador, carrito, export Instagram
├── data/
│   ├── productos.js          ← catálogo embebido (262 productos) — lo que usa la web
│   └── productos.json        ← mismo catálogo en JSON (para editar cómodo)
├── assets/
│   ├── owner.jpg             ← foto del hero
│   └── productos/            ← 262 fotos de producto (una por código)
└── scripts/                  ← scripts de extracción (opcionales, no necesarios para la web)
```

## ⚙️ Configuración (editar antes de publicar)

En **`js/app.js`**, arriba de todo, el objeto `CONFIG`:

```js
const CONFIG = {
  WHATSAPP_NUMERO: '5492216181900',        // WhatsApp (formato internacional, sin + ni espacios)
  INSTAGRAM_USER:  'elzar.delasfragancias',
  INSTAGRAM_URL:   'https://instagram.com/elzar.delasfragancias',
  UBICACION:       'La Plata — envíos a todo el país',
  ...
};
```

## 🛒 Funciones

- **Catálogo dinámico** de 262 productos con filtros (categoría, género), buscador (nombre,
  código o "inspirado en"), orden y paginación.
- **Carrito**: botón "Agregar" en cada ficha → panel del pedido con cantidades → pantalla de
  resumen → **abre WhatsApp con el pedido completo** listo para enviar. El carrito se guarda
  en el navegador (localStorage).
- **Descargar para Instagram**: cada producto genera una placa PNG (1080×1080 y 1080×1920)
  con la identidad de la marca, todo en el navegador (sin servidor).
- **WhatsApp** con mensaje prearmado por producto y flotante para consultas.

## 🖼️ Fotos

Cada producto usa `assets/productos/{codigo}.jpg`. Para reemplazar una foto por una mejor,
guardá el archivo con el mismo nombre (código) en formato vertical 4:5 (ideal 760×950px o más).

> La web lee el catálogo desde **`data/productos.js`** para que funcione también abriendo el
> `index.html` con doble clic. Si editás `data/productos.json`, actualizá el `.js`
> (mismo contenido con `window.CATALOGO = ` adelante) o corré `python scripts/build_web.py`.

## 🚀 Publicar en GitHub + Vercel

El repositorio ya está inicializado y con el primer commit hecho (rama `main`).

**1) Subir a tu GitHub**
- Creá un repo nuevo en https://github.com/new (por ej. `el-zar-fragancias`, público, **sin**
  agregarle README ni .gitignore).
- En una terminal, dentro de `C:\ZarFragancias`:
  ```bash
  git remote add origin https://github.com/TU_USUARIO/el-zar-fragancias.git
  git push -u origin main
  ```
  (La primera vez, Windows te abre el navegador para iniciar sesión en GitHub.)

**2) Desplegar en Vercel**
- Entrá a https://vercel.com/new e importá ese repositorio de GitHub.
- Framework preset: **Other** · Root Directory: `./` · sin build command.
- **Deploy**. En segundos tenés la URL pública. Cada `git push` vuelve a desplegar solo.

> Alternativa sin build: arrastrar la carpeta a https://app.netlify.com/drop.

---
Las imágenes son a modo ilustrativo · Industria Argentina
