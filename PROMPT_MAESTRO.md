# 🧭 PROMPT MAESTRO — El Zar de las Fragancias

> **Cómo usar este documento:** pegá TODO este contenido al inicio de una nueva conversación
> con Claude (Claude Code, en la carpeta `C:\ZarFragancias`). Le da el contexto completo del
> proyecto y el cronograma de mejoras. Después decile en qué **fase / tarea** querés trabajar.

---

## 0) INSTRUCCIÓN PARA CLAUDE

Sos el desarrollador full-stack y diseñador de la landing **"El Zar de las Fragancias"**.
El proyecto YA está online y funcionando; ahora entramos en etapa de **pulido y mejoras
incrementales**. Trabajá de forma incremental, mostrá avances por sección, no rehagas todo de
cero, y confirmá antes de cambios grandes. Preservá la identidad de marca (lujo árabe / realeza).
Al terminar un bloque de cambios, dejá listo el commit para desplegar (`git push` → Vercel
redespliega solo).

---

## 1) QUÉ ES EL PROYECTO

Landing comercial de una sola página para una **perfumería** (fragancias árabes, masculinas y
femeninas — dupes inspirados en grandes casas, marca "All Beauty" / revendedor "El Zar").
Objetivo: mostrar el catálogo y **convertir por WhatsApp** (con carrito).

- **Stack:** HTML + CSS + JavaScript **vanilla**. Sin frameworks, sin build step.
- **Live:** https://el-zar-fragancias.vercel.app
- **Repo GitHub:** `tomiviolini8/el-zar-fragancias` (rama `main`).
- **Deploy:** Vercel conectado al repo → cada `git push` redespliega automáticamente.
- **Carpeta local:** `C:\ZarFragancias`

### Configuración (en `js/app.js`, objeto `CONFIG` arriba de todo)
- `WHATSAPP_NUMERO: '5492216181900'`
- `INSTAGRAM_USER: 'elzar.delasfragancias'` · `INSTAGRAM_URL`
- `UBICACION: 'La Plata — envíos a todo el país'`
- Mensajes de WhatsApp prearmados (`WA_MSG_PRODUCTO`, `WA_MSG_GENERAL`).

### Identidad visual
Fondo negro/marrón (`#140d07`–`#2b1d10`), dorado (`#d4af37`/`#c9a227`), crema (`#f5ede1`),
burdeos (`#7b1e2b`). Serif editorial **Playfair Display** (títulos) + sans **Montserrat** (cuerpo).
Hero con foto del owner (`assets/owner.jpg`). Corona como emblema.

---

## 2) ESTRUCTURA DE ARCHIVOS

```
index.html               ← página (header, hero, best sellers, línea árabe, catálogo,
                            ofertas, cómo comprar, footer, carrito, modal Instagram)
css/styles.css           ← estilos (tokens de marca al inicio)
js/app.js                ← TODO el JS: CONFIG, carga de catálogo, render de tarjetas,
                            filtros/buscador, rails, carrito, export a Instagram (canvas)
data/productos.js        ← catálogo EMBEBIDO (window.CATALOGO) — ES LO QUE USA LA WEB
data/productos.json      ← mismo catálogo en JSON (fuente para editar)
assets/owner.jpg         ← hero
assets/productos/{codigo}.jpg  ← 262 fotos (una por código de producto)
scripts/                 ← scripts Python de extracción (NO necesarios para la web)
README.md · PROMPT_MAESTRO.md
```
> Los assets se cargan con `?v=N` (cache-bust). Al cambiar CSS/JS/JSON grande, subir el número
> de versión en `index.html` (`styles.css?v=`, `productos.js?v=`, `app.js?v=`).

### Cómo funciona el catálogo
- `index.html` incluye `data/productos.js` que define `window.CATALOGO = {meta, productos:[...]}`.
- `app.js` lee de `window.CATALOGO` (funciona hasta abriendo el HTML con doble clic) y cae a
  `fetch('data/productos.json')` si no está embebido.
- **Editar productos:** cambiar en `data/productos.json` y regenerar el `.js`
  (`python scripts/build_web.py`) **o** editar directamente `data/productos.js` (mismo contenido
  con `window.CATALOGO = ` adelante). Mantener ambos en sync.

### Modelo de cada producto (campos)
`id, codigo, nombre, formato, familia_olfativa, inspirado_en, marca, precio, precio_regular,
descuento_pct, descripcion, genero (Hombre|Mujer|Unisex), linea, es_arabe, ocasion, categorias[],
etiquetas[], pagina, imagen, imagen_placeholder`

---

## 3) ESTADO ACTUAL (lo que YA está hecho)

- **262 productos** cargados del **Catálogo Sep/Oct 2026**. Líneas: Premium 108, Arabian
  Collection 21, Boutique 9, Pocket 9, Arabian Gold 15, Línea Gold 61, Cosmética 37, Infantil 2.
- **Las 262 con foto** (recortes del catálogo; Gold/Arabian-Gold reusan el frasco premium del
  mismo aroma). Sin placeholders.
- **Catálogo dinámico** con filtros (categoría, género), buscador (nombre/código/inspirado en),
  orden y "ver más".
- **Carrito** (guardado en localStorage `zar_cart_v1`): botón "Agregar" → drawer con cantidades →
  pantalla resumen → abre WhatsApp con el pedido armado.
- **Export a Instagram**: cada ficha genera placa PNG 1080×1080 y 1080×1920 (canvas nativo).
- **Deploy** en Vercel desde GitHub. Mobile-first y responsive.

### Datos de origen (importante)
El catálogo nuevo (`Catalogo septiembre-octubre 2026.pdf`) tiene la sección de perfumes como
**imágenes planas sin texto** (págs. 0-92) y joyería con texto (93+). Se depuró a
`Catalogo_Perfumes_sep-oct_2026.pdf` (77 págs, hasta la pág. impresa 75). Los datos se
**leyeron a mano/visión** página por página (no hay capa de texto), por eso puede haber algún
typo. Tope de resolución de imágenes: **555×779 px por página** (limita la calidad de recortes).
Excel de referencia: `Catalogo_ElZar_Sep-Oct-2026.xlsx`.

---

## 4) BACKLOG PRIORIZADO — CRONOGRAMA DE MEJORAS

> Trabajar por fases. Dentro de cada fase, ítems ordenados por impacto. Marcar `[x]` al completar.

### 🟥 FASE 1 — Fidelidad de datos (rápido, alto impacto)
- [ ] Revisar precios y datos contra el catálogo (se leyeron por visión; verificar typos,
      familias olfativas, "inspirado en", ml).
- [ ] Decidir alcance: ¿la **Cosmética** (37 ítems: cremas, serums, colágeno) va en la web o se
      saca / se separa en una pestaña aparte? Ídem líneas Gold/Splash.
- [ ] Cargar **descripciones** por producto (el catálogo trae textos para varios) → campo
      `descripcion`, mostrarlo en la ficha/detalle.
- [ ] Capturar la **ocasión real** (íconos día ☀️ / noche 🌙 / citas 🏹 del catálogo) en vez de
      derivarla de la familia olfativa.

### 🟧 FASE 2 — Calidad de fotos
- [ ] Pulir recortes que muestran la **caja en vez del frasco** (ej. Libre Berry BF335) — ajustar
      cajas en `scripts/crop_new.py` (dict `BOX_OVR` / `BAND_OVR`) y regenerar.
- [ ] Mejorar los crops de **Línea Gold** que salieron de la grilla (muestran etiqueta/caja).
- [ ] Diferenciar imágenes de **Emulsión (EC*)** y **Espuma (ESP*)** — hoy comparten una sola.
- [ ] Optimizar peso: convertir a **WebP** / comprimir (hoy ~23 MB en total) para mejor
      performance; mantener `assets/productos/{codigo}.jpg` como fallback si hace falta.
- [ ] (Ideal a futuro) **Fotos propias** de los frascos (mejor que el tope 555×779 del PDF).
      El sistema ya soporta reemplazo: mismo nombre de código, vertical 4:5.

### 🟨 FASE 3 — UX / conversión
- [ ] **Vista de detalle** del producto (modal): foto grande, notas/familia, inspirado en,
      formato, precio, botón agregar + WhatsApp.
- [ ] Carrito: nota/comentario por ítem, botón "seguir comprando", contador visible en mobile,
      vaciar con confirmación.
- [ ] **Formulario de logística/pago** (pedido gestionable) — el owner quiere, a futuro, vincular
      el carrito a un formulario para gestionar envío y pago (hoy es manual a WhatsApp).
      Opciones: Google Forms / Airtable / Sheet + webhook.
- [ ] Filtros extra: por **precio**, por **marca inspirada**, por **ocasión**; persistir filtros
      en la URL (compartibles).
- [ ] Estados de **stock** (marcar "sin stock" / "a pedido").

### 🟩 FASE 4 — Marca y diseño
- [ ] Refinar **copy** (hero, claims, secciones). Revisar textos placeholder.
- [ ] **Favicon** propio y **imagen OG** (para que se vea lindo al compartir el link en
      WhatsApp/IG).
- [ ] Sección **Línea Árabe** con contenido editorial (es el diferencial del negocio).
- [ ] Prueba social: testimonios / reseñas / "los más vendidos" reales.
- [ ] Micro-animaciones y detalles de lujo (bordes dorados, transiciones).

### 🟦 FASE 5 — Técnico / SEO / performance
- [ ] SEO: meta description real, `<title>` por sección, datos estructurados (Product/Offer),
      sitemap, `robots.txt`.
- [ ] Performance: comprimir imágenes, `loading=lazy` (ya está), preload de fuentes, revisar
      Lighthouse.
- [ ] **Analítica** (Vercel Analytics o Google Analytics) para medir visitas y clicks a WhatsApp.
- [ ] **Dominio propio** (conectar en Vercel → Settings → Domains).
- [ ] Accesibilidad: `alt` descriptivos, contraste, navegación por teclado, foco visible.

### 🟪 FASE 6 — Operación / mantenimiento
- [ ] Flujo simple para **actualizar precios/stock sin tocar código** (ej. Google Sheet →
      script que regenera `productos.json`/`.js`).
- [ ] Automatizar la generación de fotos/JSON cuando llega un catálogo nuevo (los scripts en
      `scripts/` ya hacen parte: `build_excel.py`, `build_web.py`, `crop_new.py`,
      `crop_secondary.py`).
- [ ] Checklist de publicación (verificar links, WhatsApp, IG, precios) antes de cada campaña.

---

## 5) CÓMO TRABAJAR / DEPLOY

- Editar archivos en `C:\ZarFragancias`. Probar localmente con un server estático
  (ej. `python -m http.server 8000`) porque el `fetch` del JSON no corre bajo `file://`
  (aunque el catálogo embebido en `.js` sí funciona con doble clic).
- Al terminar un bloque:
  ```bash
  git add -A
  git commit -m "descripción del cambio"
  git push
  ```
  Vercel redespliega solo en ~1 min.
- Si cambiaste CSS/JS, subí el `?v=N` en `index.html` para romper caché.

---

## 6) DECISIONES YA TOMADAS (no re-litigar salvo que se pida)
- **Sin joyería** en la web (el catálogo trae joyería pero el foco es perfumería).
- Export a Instagram con **canvas nativo** (sin dependencias externas).
- Catálogo **embebido** en `data/productos.js` (funciona sin servidor).
- Fotos = **recortes del catálogo** (tope 555×779); reemplazables por fotos propias.
- Checkout = **manual por WhatsApp** por ahora (formulario de pago/logística es fase futura).

---
*Última actualización del estado: catálogo Sep/Oct 2026, 262 productos, web publicada en Vercel.*
