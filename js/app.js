/* =============================================================
   EL ZAR DE LAS FRAGANCIAS — app.js
   Vanilla JS. Carga productos.json, renderiza catálogo dinámico,
   filtros, buscador, WhatsApp y exportación de tarjetas a imagen.
   ============================================================= */

/* ------------------------------------------------------------------
   ⚙️  CONFIGURACIÓN — EDITÁ ESTOS VALORES
   ------------------------------------------------------------------ */
const CONFIG = {
  // Número de WhatsApp en formato internacional SIN + ni espacios.
  // Ej. Argentina: 549 + código de área sin 0 + número sin 15.
  WHATSAPP_NUMERO: '5492216181900',

  // Usuario de Instagram (sin @) y URL.
  INSTAGRAM_USER: 'elzar.delasfragancias',
  INSTAGRAM_URL: 'https://instagram.com/elzar.delasfragancias',

  // Datos de contacto (placeholders — completar).
  UBICACION: 'La Plata — envíos a todo el país',

  // Mensaje base de WhatsApp. {producto} y {codigo} se reemplazan.
  WA_MSG_PRODUCTO: '¡Hola El Zar! 👑 Me interesa *{producto}* (código {codigo}). ¿Está disponible?',
  WA_MSG_GENERAL: '¡Hola El Zar de las Fragancias! 👑 Quiero hacer una consulta sobre el catálogo.',

  // Paginación del catálogo.
  PAGE_SIZE: 24,
};

/* ------------------------------------------------------------------
   Utilidades
   ------------------------------------------------------------------ */
const $  = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => [...c.querySelectorAll(s)];
const fmtPrice = n => n ? '$' + n.toLocaleString('es-AR') : 'Consultar';
const titleCase = s => (s || '').replace(/\w\S*/g, t => t.charAt(0).toUpperCase() + t.slice(1).toLowerCase());

function waLink(msg){
  return `https://wa.me/${CONFIG.WHATSAPP_NUMERO}?text=${encodeURIComponent(msg)}`;
}
function waProducto(p){
  const msg = CONFIG.WA_MSG_PRODUCTO
    .replace('{producto}', p.nombre)
    .replace('{codigo}', p.codigo);
  return waLink(msg);
}

/* ------------------------------------------------------------------
   Estado
   ------------------------------------------------------------------ */
let PRODUCTOS = [];
let filtered = [];
let shown = 0;
const state = { q: '', genero: '', categoria: 'Todos', orden: 'rel' };

const CATEGORIAS = [
  'Todos', 'Fragancias Premium', 'Línea Árabe', 'Best Sellers',
  'Masculinas', 'Femeninas', 'Unisex', 'Ofertas', 'Novedades',
  'Body Splash', 'Cosmética', 'Complementarios',
];

/* ------------------------------------------------------------------
   Init
   ------------------------------------------------------------------ */
async function init(){
  wireConfigLinks();
  wireUI();
  wireCart();
  try{
    const data = await loadCatalogo();
    PRODUCTOS = data.productos || [];
    // ranking de relevancia (destacados primero)
    PRODUCTOS.forEach((p, i) => p._rank = relRank(p, i));
    buildChips();
    renderRails();
    applyFilters();
    updateStats(data.meta);
    cartRender();   // re-render con productos ya cargados
  }catch(err){
    console.error('Error cargando el catálogo', err);
    $('#grid').innerHTML = `<div class="empty">No se pudo cargar el catálogo. Verificá que <b>data/productos.js</b> esté disponible.</div>`;
  }
  revealOnScroll();
}

/* Carga el catálogo: prioriza el embebido (window.CATALOGO — funciona sin servidor,
   incluso abriendo index.html localmente); si no está, intenta el JSON (hosting). */
async function loadCatalogo(){
  if (window.CATALOGO && Array.isArray(window.CATALOGO.productos)) return window.CATALOGO;
  const res = await fetch('data/productos.json');
  return res.json();
}

function relRank(p, i){
  let s = 0;
  if (p.etiquetas?.includes('BEST SELLER')) s += 100;
  if (p.linea === 'Premium') s += 40;
  if (p.linea === 'Arabian Collection') s += 45;
  if (p.etiquetas?.includes('NUEVO')) s += 30;
  if (p.precio_regular) s += 15;
  s += Math.max(0, 40 - i * 0.1);
  return s;
}

function updateStats(meta){
  const total = PRODUCTOS.length;
  const arabe = PRODUCTOS.filter(p => p.es_arabe).length;
  const off = PRODUCTOS.filter(p => p.precio_regular).length;
  $('#statTotal').textContent = total;
  $('#statArabe').textContent = arabe;
  $('#statOff').textContent = off;
}

/* ------------------------------------------------------------------
   Enlaces de configuración (WhatsApp / Instagram / contacto)
   ------------------------------------------------------------------ */
function wireConfigLinks(){
  const wa = waLink(CONFIG.WA_MSG_GENERAL);
  ['#waHeader','#waHero','#waFloat','#waContact','#waContactBtn','#waFooter','#waFooter2']
    .forEach(sel => { const el = $(sel); if (el) el.href = wa; });
  ['#igContact','#igContactBtn','#igFooter','#igFooter2']
    .forEach(sel => { const el = $(sel); if (el) el.href = CONFIG.INSTAGRAM_URL; });
  $('#igHandleTxt') && ($('#igHandleTxt').textContent = '@' + CONFIG.INSTAGRAM_USER);
  $('#ubicacionTxt') && ($('#ubicacionTxt').textContent = CONFIG.UBICACION);
  $('#waNumberTxt') && ($('#waNumberTxt').textContent = 'WhatsApp — tocá para escribirnos');
  $('#year') && ($('#year').textContent = new Date().getFullYear());
  $('#handleInput') && ($('#handleInput').value = '@' + CONFIG.INSTAGRAM_USER);
}

/* ------------------------------------------------------------------
   UI (nav, búsqueda, filtros, rails, modal)
   ------------------------------------------------------------------ */
function wireUI(){
  // burger
  $('#burger')?.addEventListener('click', () => $('#nav').classList.toggle('open'));
  $$('#nav a').forEach(a => a.addEventListener('click', () => $('#nav').classList.remove('open')));

  // búsqueda (mini + grande sincronizados)
  const onSearch = v => { state.q = v.trim().toLowerCase(); applyFilters(); };
  $('#searchMini')?.addEventListener('input', e => { $('#searchBig').value = e.target.value; onSearch(e.target.value); });
  $('#searchBig')?.addEventListener('input', e => { $('#searchMini').value = e.target.value; onSearch(e.target.value); });
  // enter en mini salta al catálogo
  $('#searchMini')?.addEventListener('keydown', e => { if (e.key === 'Enter') document.getElementById('catalogo').scrollIntoView({behavior:'smooth'}); });

  $('#genero')?.addEventListener('change', e => { state.genero = e.target.value; applyFilters(); });
  $('#orden')?.addEventListener('change', e => { state.orden = e.target.value; applyFilters(); });
  $('#loadMore')?.addEventListener('click', () => { shown += CONFIG.PAGE_SIZE; renderGrid(true); });

  // rails
  $$('.rail-nav button').forEach(b => b.addEventListener('click', () => {
    const track = $('#rail' + capitalize(b.dataset.rail));
    if (track) track.scrollBy({ left: b.dataset.dir * (track.clientWidth * .8), behavior: 'smooth' });
  }));

  // saltar a árabe
  $('[data-jump-arabe]')?.addEventListener('click', e => {
    e.preventDefault();
    setCategoria('Línea Árabe');
    document.getElementById('catalogo').scrollIntoView({ behavior: 'smooth' });
  });

  // modal export
  $('#modalClose')?.addEventListener('click', closeModal);
  $('#modalBack')?.addEventListener('click', e => { if (e.target === $('#modalBack')) closeModal(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });
  $$('#fmtOpts .fmt-opt').forEach(b => b.addEventListener('click', () => {
    $$('#fmtOpts .fmt-opt').forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    exportState.fmt = b.dataset.fmt;
    renderPreview();
  }));
  $('#handleInput')?.addEventListener('input', () => renderPreview());
  $('#downloadBtn')?.addEventListener('click', downloadCard);
}
const capitalize = s => s.charAt(0).toUpperCase() + s.slice(1);

function buildChips(){
  const wrap = $('#chips');
  wrap.innerHTML = '';
  CATEGORIAS.forEach(cat => {
    // ocultar chips sin productos (excepto Todos)
    if (cat !== 'Todos' && !PRODUCTOS.some(p => p.categorias.includes(cat))) return;
    const b = document.createElement('button');
    b.className = 'chip' + (cat === state.categoria ? ' active' : '');
    b.textContent = cat;
    b.dataset.cat = cat;
    b.addEventListener('click', () => setCategoria(cat));
    wrap.appendChild(b);
  });
}
function setCategoria(cat){
  state.categoria = cat;
  $$('#chips .chip').forEach(c => c.classList.toggle('active', c.dataset.cat === cat));
  applyFilters();
}

/* ------------------------------------------------------------------
   Filtrado + orden
   ------------------------------------------------------------------ */
function applyFilters(){
  const q = state.q;
  filtered = PRODUCTOS.filter(p => {
    if (state.genero && p.genero !== state.genero) return false;
    if (state.categoria !== 'Todos' && !p.categorias.includes(state.categoria)) return false;
    if (q){
      const hay = (p.nombre + ' ' + p.codigo + ' ' + p.inspirado_en + ' ' + p.marca + ' ' + p.familia_olfativa).toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  switch (state.orden){
    case 'precio-asc':  filtered.sort((a,b) => (a.precio||1e9) - (b.precio||1e9)); break;
    case 'precio-desc': filtered.sort((a,b) => (b.precio||0) - (a.precio||0)); break;
    case 'nombre':      filtered.sort((a,b) => a.nombre.localeCompare(b.nombre,'es')); break;
    case 'desc':        filtered.sort((a,b) => (b.descuento_pct||0) - (a.descuento_pct||0)); break;
    default:            filtered.sort((a,b) => b._rank - a._rank);
  }
  shown = CONFIG.PAGE_SIZE;
  renderGrid();
}

/* ------------------------------------------------------------------
   Render de tarjetas
   ------------------------------------------------------------------ */
function badgesHTML(p){
  const b = [];
  if (p.etiquetas?.includes('NUEVO')) b.push('<span class="badge badge-new">Nuevo</span>');
  if (p.descuento_pct) b.push(`<span class="badge badge-off">${p.descuento_pct}% OFF</span>`);
  else if (p.etiquetas?.includes('OFERTA')) b.push('<span class="badge badge-off">Oferta</span>');
  if (p.etiquetas?.includes('BEST SELLER')) b.push('<span class="badge badge-best">★ Best</span>');
  if (p.es_arabe) b.push('<span class="badge badge-arabe">Árabe</span>');
  return b.length ? `<div class="badges">${b.join('')}</div>` : '';
}

function mediaHTML(p){
  if (p.imagen && p.imagen_placeholder === false){
    return `<img loading="lazy" src="${p.imagen}" alt="${escapeHtml(p.nombre)}" onerror="this.replaceWith(phEl(${JSON.stringify(JSON.stringify(p))}))">`;
  }
  return placeholderHTML(p);
}
function placeholderHTML(p){
  const brand = p.marca ? escapeHtml(titleCase(p.marca)) : 'El Zar';
  return `<div class="ph">
    <svg class="crown" viewBox="0 0 24 24" fill="currentColor"><path d="M3 8l3.5 3L12 4l5.5 7L21 8l-1.6 10.2a1 1 0 0 1-1 .8H5.6a1 1 0 0 1-1-.8L3 8z"/></svg>
    <div class="ph-name">${escapeHtml(p.nombre)}</div>
    <div class="ph-code">${escapeHtml(p.codigo)}</div>
    <div class="ph-brand">El Zar de las Fragancias</div>
  </div>`;
}

function cardHTML(p){
  const inspReal = p.inspirado_en && titleCase(p.inspirado_en).toLowerCase() !== (p.nombre || '').toLowerCase();
  const insp = `${inspReal ? `<div class="card-insp">Inspirado en <b>${escapeHtml(titleCase(p.inspirado_en))}</b>${p.marca ? ' · ' + escapeHtml(titleCase(p.marca)) : ''}</div>` : ''}${p.descripcion ? `<div class="card-desc">${escapeHtml(p.descripcion)}</div>` : ''}`;
  const price = `<div class="card-price">
      <span class="now">${fmtPrice(p.precio)}</span>
      ${p.precio_regular ? `<span class="was">${fmtPrice(p.precio_regular)}</span>` : ''}
      ${p.descuento_pct ? `<span class="pct">-${p.descuento_pct}%</span>` : ''}
    </div>`;
  return `<article class="card" data-code="${p.codigo}">
    <div class="card-media">
      ${badgesHTML(p)}
      ${mediaHTML(p)}
    </div>
    <div class="card-body">
      ${p.familia_olfativa ? `<div class="card-fam">${escapeHtml(p.familia_olfativa)}</div>` : '<div class="card-fam" style="color:var(--muted)">'+escapeHtml(p.linea)+'</div>'}
      <h3 class="card-name">${escapeHtml(p.nombre)}</h3>
      ${insp}
      <div class="card-meta">
        <span class="card-format">${escapeHtml(p.formato || p.linea)}</span>
        <span class="card-code">${escapeHtml(p.codigo)}</span>
      </div>
      ${price}
      <div class="card-actions">
        <button class="btn btn-add" data-add="${p.codigo}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" width="15" height="15"><path d="M12 5v14M5 12h14"/></svg>
          Agregar
        </button>
        <a class="btn btn-wa icon-btn" href="${waProducto(p)}" target="_blank" rel="noopener" title="Consultar por WhatsApp">
          <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><path d="M17.5 14.4c-.3-.2-1.7-.8-2-.9-.3-.1-.5-.2-.6.2-.2.3-.7.9-.8 1-.2.2-.3.2-.6.1-.3-.2-1.2-.5-2.3-1.4-.9-.8-1.4-1.7-1.6-2-.2-.3 0-.5.1-.6l.4-.5c.1-.2.2-.3.3-.5.1-.2 0-.4 0-.5 0-.2-.6-1.5-.9-2-.2-.5-.4-.4-.6-.5h-.5c-.2 0-.5.1-.7.3-.3.3-1 1-1 2.4s1 2.8 1.2 3c.1.2 2 3.1 5 4.3.7.3 1.2.5 1.6.6.7.2 1.3.2 1.8.1.5-.1 1.7-.7 1.9-1.4.2-.7.2-1.2.2-1.4-.1-.1-.3-.2-.6-.3zM12 2a10 10 0 0 0-8.6 15l-1.3 4.7 4.8-1.3A10 10 0 1 0 12 2z"/></svg>
        </a>
        <button class="btn btn-ghost icon-btn" title="Descargar para Instagram" data-ig="${p.codigo}" aria-label="Descargar para Instagram">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/></svg>
        </button>
      </div>
    </div>
  </article>`;
}

function renderGrid(append = false){
  const grid = $('#grid');
  const slice = filtered.slice(0, shown);
  if (!slice.length){
    grid.innerHTML = `<div class="empty" style="grid-column:1/-1">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>
      <p>No encontramos fragancias con esos filtros.<br>Probá con otro término o categoría.</p>
    </div>`;
    $('#loadMoreWrap').hidden = true;
    updateCount();
    return;
  }
  grid.innerHTML = slice.map(cardHTML).join('');
  wireCardExport(grid);
  $('#loadMoreWrap').hidden = shown >= filtered.length;
  updateCount();
}
function updateCount(){
  const n = filtered.length;
  $('#resultCount').textContent = n ? `${Math.min(shown, n)} de ${n} ${n === 1 ? 'producto' : 'productos'}` : '';
}

function renderRails(){
  const best  = PRODUCTOS.filter(p => p.etiquetas?.includes('BEST SELLER')).slice(0, 14);
  const arabe = PRODUCTOS.filter(p => p.es_arabe).sort((a,b)=>b._rank-a._rank).slice(0, 14);
  const off   = PRODUCTOS.filter(p => p.precio_regular).sort((a,b)=>(b.descuento_pct||0)-(a.descuento_pct||0)).slice(0, 14);
  const fill = (id, arr) => { const el = $(id); if (el){ el.innerHTML = arr.map(cardHTML).join(''); wireCardExport(el); } };
  fill('#railBest', best.length ? best : PRODUCTOS.slice(0,14));
  fill('#railArabe', arabe);
  fill('#railOff', off);
}

function wireCardExport(root){
  $$('[data-ig]', root).forEach(btn => btn.addEventListener('click', () => {
    const p = PRODUCTOS.find(x => x.codigo === btn.dataset.ig);
    if (p) openModal(p);
  }));
  $$('[data-add]', root).forEach(btn => btn.addEventListener('click', () => {
    cartAdd(btn.dataset.add);
    btn.classList.add('added');
    btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" width="15" height="15"><path d="M5 12l5 5 9-11"/></svg> Agregado';
    setTimeout(() => {
      btn.classList.remove('added');
      btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" width="15" height="15"><path d="M12 5v14M5 12h14"/></svg> Agregar';
    }, 1300);
  }));
}

/* ==================================================================
   CARRITO — estado en localStorage, drawer y checkout por WhatsApp
   ================================================================== */
let CART = {};   // { codigo: cantidad }
const CART_KEY = 'zar_cart_v1';

function cartLoad(){
  try { CART = JSON.parse(localStorage.getItem(CART_KEY)) || {}; } catch(e){ CART = {}; }
}
function cartSave(){
  try { localStorage.setItem(CART_KEY, JSON.stringify(CART)); } catch(e){}
}
function cartAdd(code, qty = 1){
  CART[code] = (CART[code] || 0) + qty;
  if (CART[code] < 1) delete CART[code];
  cartSave(); cartRender();
}
function cartSet(code, qty){
  if (qty < 1) delete CART[code]; else CART[code] = qty;
  cartSave(); cartRender();
}
function cartCountTotal(){ return Object.values(CART).reduce((a,b)=>a+b, 0); }
function cartTotalPrice(){
  return Object.entries(CART).reduce((sum,[code,qty])=>{
    const p = PRODUCTOS.find(x=>x.codigo===code);
    return sum + (p && p.precio ? p.precio*qty : 0);
  }, 0);
}

function cartRender(){
  const n = cartCountTotal();
  const badge = $('#cartCount');
  if (badge){ badge.textContent = n; badge.classList.toggle('show', n>0); }
  const wrap = $('#cartItems'), foot = $('#cartFoot');
  if (!wrap) return;
  const entries = Object.entries(CART).filter(([c,q])=>q>0);
  if (!entries.length){
    wrap.innerHTML = `<div class="cart-empty">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><path d="M3 6h18M16 10a4 4 0 0 1-8 0"/></svg>
      <b>Tu carrito está vacío</b>
      <span>Agregá tus fragancias favoritas y coordinamos el pedido por WhatsApp.</span>
    </div>`;
    foot.hidden = true;
    return;
  }
  wrap.innerHTML = entries.map(([code,qty])=>{
    const p = PRODUCTOS.find(x=>x.codigo===code); if(!p) return '';
    return `<div class="ci">
      <img class="ci-img" src="${p.imagen}" alt="" loading="lazy" onerror="this.style.visibility='hidden'">
      <div class="ci-info">
        <div class="ci-name">${escapeHtml(p.nombre)}</div>
        <div class="ci-meta">${escapeHtml(p.formato||p.linea)} · ${escapeHtml(p.codigo)}</div>
        <div class="ci-price">${fmtPrice(p.precio)}</div>
        <div class="ci-bottom">
          <div class="qty">
            <button data-dec="${code}" aria-label="Menos">−</button>
            <span>${qty}</span>
            <button data-inc="${code}" aria-label="Más">+</button>
          </div>
          <button class="ci-remove" data-rm="${code}">Quitar</button>
        </div>
      </div>
    </div>`;
  }).join('');
  foot.hidden = false;
  $('#cartTotal').textContent = fmtPrice(cartTotalPrice());
  $$('[data-inc]', wrap).forEach(b=>b.onclick=()=>cartAdd(b.dataset.inc,1));
  $$('[data-dec]', wrap).forEach(b=>b.onclick=()=>cartAdd(b.dataset.dec,-1));
  $$('[data-rm]', wrap).forEach(b=>b.onclick=()=>cartSet(b.dataset.rm,0));
}

function openCart(){ $('#cartOverlay').classList.add('open'); $('#cartDrawer').classList.add('open'); document.body.style.overflow='hidden'; }
function closeCart(){ $('#cartOverlay').classList.remove('open'); $('#cartDrawer').classList.remove('open'); document.body.style.overflow=''; $('#cartLoading').classList.remove('show'); }

function cartCheckout(){
  const entries = Object.entries(CART).filter(([c,q])=>q>0);
  if (!entries.length) return;
  // pantalla de carga con resumen, luego redirige a WhatsApp
  const load = $('#cartLoading');
  load.classList.add('show');
  setTimeout(()=>{
    let msg = '¡Hola El Zar de las Fragancias! 👑 Quiero hacer este pedido:\n\n';
    entries.forEach(([code,qty])=>{
      const p = PRODUCTOS.find(x=>x.codigo===code); if(!p) return;
      const sub = p.precio ? p.precio*qty : 0;
      msg += `• ${p.nombre} (${p.codigo}) x${qty} — ${fmtPrice(sub)}\n`;
    });
    msg += `\n*Total estimado: ${fmtPrice(cartTotalPrice())}*\n\n¿Me confirmás disponibilidad, formas de pago y envío? ¡Gracias!`;
    load.classList.remove('show');
    window.open(waLink(msg), '_blank');
  }, 1400);
}

function wireCart(){
  cartLoad(); cartRender();
  $('#cartBtn')?.addEventListener('click', openCart);
  $('#cartClose')?.addEventListener('click', closeCart);
  $('#cartOverlay')?.addEventListener('click', closeCart);
  $('#cartClear')?.addEventListener('click', ()=>{ CART={}; cartSave(); cartRender(); });
  $('#cartCheckout')?.addEventListener('click', cartCheckout);
  document.addEventListener('keydown', e=>{ if(e.key==='Escape') closeCart(); });
}

/* helpers */
function escapeHtml(s){ return (s ?? '').toString().replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
window.phEl = pjson => { const d = document.createElement('div'); d.innerHTML = placeholderHTML(JSON.parse(pjson)); return d.firstElementChild; };

/* ------------------------------------------------------------------
   Reveal on scroll
   ------------------------------------------------------------------ */
function revealOnScroll(){
  const els = $$('.reveal');
  if (!('IntersectionObserver' in window)){ els.forEach(el => el.classList.add('in')); return; }
  const io = new IntersectionObserver((entries) => {
    entries.forEach(e => { if (e.isIntersecting){ e.target.classList.add('in'); io.unobserve(e.target); } });
  }, { threshold: .1, rootMargin: '0px 0px -8% 0px' });
  els.forEach(el => io.observe(el));
  // salvaguarda: nunca dejar contenido invisible
  setTimeout(() => els.forEach(el => el.classList.add('in')), 2500);
}

/* ==================================================================
   EXPORTACIÓN A IMAGEN (Instagram) — canvas nativo, sin dependencias
   ================================================================== */
const exportState = { producto: null, fmt: 'post' };
let fontsReady = false;

async function ensureFonts(){
  if (fontsReady) return;
  try{
    await Promise.all([
      document.fonts.load('700 80px "Playfair Display"'),
      document.fonts.load('600 40px "Playfair Display"'),
      document.fonts.load('italic 600 40px "Playfair Display"'),
      document.fonts.load('600 30px "Montserrat"'),
      document.fonts.load('700 30px "Montserrat"'),
      document.fonts.load('400 30px "Montserrat"'),
    ]);
    await document.fonts.ready;
  }catch(e){ /* fallback a fuentes del sistema */ }
  fontsReady = true;
}

function openModal(p){
  exportState.producto = p;
  exportState._img = null;
  $('#modalBack').classList.add('open');
  document.body.style.overflow = 'hidden';
  ensureFonts().then(renderPreview);
  renderPreview();
  // cargar la foto real (si existe) para que el preview la muestre
  loadProductImage(p).then(img => { if (img && exportState.producto === p){ exportState._img = img; renderPreview(); } });
}
function closeModal(){
  $('#modalBack').classList.remove('open');
  document.body.style.overflow = '';
}

const FMT = {
  post:  { w: 1080, h: 1080 },
  story: { w: 1080, h: 1920 },
};

function renderPreview(){
  const p = exportState.producto;
  if (!p) return;
  const { w, h } = FMT[exportState.fmt];
  const canvas = $('#previewCanvas');
  canvas.width = w; canvas.height = h;
  drawCard(canvas.getContext('2d'), p, w, h);
}

/* Paleta para canvas */
const C = {
  bg0:'#0c0805', bg1:'#160e07', bg2:'#241708', bg3:'#0a0704',
  gold:'#d4af37', goldSoft:'#ecd48a', goldDeep:'#b8912f', goldLine:'#caa338',
  cream:'#f5ede1', dim:'#c9b998', muted:'#8c7c63', wine:'#7b1e2b',
  panel1:'#fbf6ec', panel2:'#eaddc6', ink:'#20160b', inkSoft:'#5c4a33',
};
/* Datos de contacto para el pie de la placa */
const PLACA = {
  ubicacion: 'LA PLATA',
  whatsapp: '221 618 1900',
  envios: 'ENVÍOS A TODO EL PAÍS',
};

function drawCard(ctx, p, W, H){
  const story = H > W;
  ctx.clearRect(0,0,W,H);

  // ---- Fondo oscuro + textura ----
  let g = ctx.createLinearGradient(0,0,0,H);
  g.addColorStop(0, C.bg0); g.addColorStop(.5, C.bg1); g.addColorStop(1, C.bg3);
  ctx.fillStyle = g; ctx.fillRect(0,0,W,H);
  const rg = ctx.createRadialGradient(W*0.5,0,0, W*0.5,0, W*0.95);
  rg.addColorStop(0,'rgba(212,175,55,0.10)'); rg.addColorStop(1,'rgba(212,175,55,0)');
  ctx.fillStyle = rg; ctx.fillRect(0,0,W,H);
  drawDotTexture(ctx, W, H);
  drawDiagonalAccents(ctx, W, H);

  // ---- Marco dorado ----
  const m = Math.round(W*0.035);
  ctx.strokeStyle = 'rgba(212,175,55,0.75)'; ctx.lineWidth = Math.max(2, W*0.0022);
  strokeRoundRect(ctx, m, m, W-2*m, H-2*m, 14);
  ctx.strokeStyle = 'rgba(212,175,55,0.28)'; ctx.lineWidth = 1;
  strokeRoundRect(ctx, m+8, m+8, W-2*m-16, H-2*m-16, 10);
  drawCorners(ctx, m, W, H);

  const cx = W/2;
  const pad = m + Math.round(W*0.045);
  const u = H;

  // ---- Encabezado: corona + wordmark + regla ----
  let y = u*(story?0.060:0.078);
  drawCrown(ctx, cx, y, W*0.044, C.gold);
  y += W*0.044 + u*(story?0.022:0.028);
  ctx.textAlign = 'center';
  ctx.fillStyle = C.goldSoft;
  ctx.font = `700 ${Math.round(W*0.036)}px "Playfair Display", Georgia, serif`;
  ctx.fillText('EL ZAR DE LAS FRAGANCIAS', cx, y);
  y += u*(story?0.017:0.021);
  drawRule(ctx, cx, y, W*0.32);
  y += u*(story?0.016:0.019);
  ctx.fillStyle = C.muted;
  ctx.font = `600 ${Math.round(W*0.0145)}px "Montserrat", sans-serif`;
  ctx.fillText('P E R F U M E S   O R I G I N A L E S   Y   S E L L A D O S', cx, y);

  // ---- Panel de foto (claro) ----
  const panelY = u*(story?0.150:0.205);
  const panelH = story ? u*0.30 : u*0.275;
  const panelW = W - 2*pad;
  drawPhotoPanel(ctx, p, pad, panelY, panelW, panelH);

  // ---- Bloque de texto ----
  let ty = panelY + panelH + u*(story?0.045:0.052);

  const nlen = (p.nombre||'').length;
  const nameSize = Math.round(W * (nlen > 22 ? 0.050 : (nlen > 13 ? 0.060 : 0.070)));

  if (p.familia_olfativa){
    ctx.fillStyle = C.gold;
    ctx.font = `700 ${Math.round(W*0.020)}px "Montserrat", sans-serif`;
    ctx.fillText(spaced(p.familia_olfativa.toUpperCase(), 2), cx, ty);
    ty += nameSize*0.90;          // deja lugar para que el nombre no pise el eyebrow
  } else {
    ty += nameSize*0.55;
  }

  ctx.fillStyle = C.cream;
  ctx.font = `700 ${nameSize}px "Playfair Display", Georgia, serif`;
  ty = wrapText(ctx, p.nombre, cx, ty, W - 2*pad, nameSize*1.04, 2);
  ty += u*(story?0.026:0.030);

  if (p.formato || p.linea){
    ctx.fillStyle = C.dim;
    ctx.font = `600 ${Math.round(W*0.0185)}px "Montserrat", sans-serif`;
    ctx.fillText((p.formato||p.linea).toUpperCase(), cx, ty);
    ty += u*(story?0.030:0.034);
  }

  if (p.inspirado_en && titleCase(p.inspirado_en).toLowerCase() !== (p.nombre||'').toLowerCase()){
    ctx.fillStyle = C.goldSoft;
    ctx.font = `italic 600 ${Math.round(W*0.026)}px "Playfair Display", Georgia, serif`;
    const insp = 'Inspirado en ' + titleCase(p.inspirado_en) + (p.marca ? '  ·  ' + titleCase(p.marca) : '');
    ty = wrapText(ctx, insp, cx, ty, W - 2*pad, Math.round(W*0.032), 2);
    ty += u*(story?0.022:0.026);
  }

  if (p.descripcion){
    ctx.fillStyle = C.muted;
    ctx.font = `400 ${Math.round(W*0.0185)}px "Montserrat", sans-serif`;
    ty = wrapText(ctx, p.descripcion, cx, ty, W - 2*pad*0.96, Math.round(W*0.028), story ? 3 : 2);
  }

  // ---- Precio (fluye debajo del texto, sin pisar el pie) ----
  const priceMax = H - m - u*(story ? 0.140 : 0.150);
  const priceY = Math.min(ty + u*0.085, priceMax);
  drawPrice(ctx, p, cx, priceY, W);

  // ---- Pie ----
  drawFooter(ctx, W, H, m, pad, u, story);
}

/* ---- Fondo: textura de puntos en dos esquinas ---- */
function drawDotTexture(ctx, W, H){
  ctx.save();
  ctx.fillStyle = 'rgba(212,175,55,0.07)';
  const step = W*0.030, r = Math.max(1, W*0.0016), span = W*0.30;
  for (let dx=0; dx<span; dx+=step) for (let dy=0; dy<span; dy+=step){
    ctx.beginPath(); ctx.arc(dx + W*0.045, dy + W*0.045, r, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.arc(W - dx - W*0.045, H - dy - W*0.045, r, 0, 7); ctx.fill();
  }
  ctx.restore();
}

/* ---- Fondo: rayas doradas diagonales en esquinas ---- */
function drawDiagonalAccents(ctx, W, H){
  ctx.save();
  ctx.lineCap = 'round';
  const stroke = (a, x1,y1,x2,y2, lw) => { ctx.strokeStyle=`rgba(212,175,55,${a})`; ctx.lineWidth=lw; ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke(); };
  const lw = Math.max(2, W*0.003);
  stroke(0.55, -W*0.02, H*0.09, W*0.15, -H*0.02, lw);
  stroke(0.25, -W*0.02, H*0.135, W*0.21, -H*0.02, lw*0.8);
  stroke(0.55, W*1.02, H*0.91, W*0.85, H*1.02, lw);
  stroke(0.25, W*1.02, H*0.865, W*0.79, H*1.02, lw*0.8);
  ctx.restore();
}

/* ---- Regla dorada con rombo central ---- */
function drawRule(ctx, cx, y, w){
  ctx.save();
  ctx.strokeStyle = 'rgba(212,175,55,0.6)'; ctx.lineWidth = 1.5;
  const gap = w*0.045;
  ctx.beginPath(); ctx.moveTo(cx - w/2, y); ctx.lineTo(cx - gap, y); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx + gap, y); ctx.lineTo(cx + w/2, y); ctx.stroke();
  ctx.fillStyle = C.gold;
  ctx.translate(cx, y); ctx.rotate(Math.PI/4);
  const s = Math.max(4, w*0.018); ctx.fillRect(-s/2, -s/2, s, s);
  ctx.restore();
}

/* ---- Panel claro con la foto del frasco ---- */
function drawPhotoPanel(ctx, p, x, y, w, h){
  const g = ctx.createLinearGradient(x, y, x, y+h);
  g.addColorStop(0, C.panel1); g.addColorStop(1, C.panel2);
  ctx.fillStyle = g; fillRoundRect(ctx, x, y, w, h, 16);
  ctx.strokeStyle = 'rgba(212,175,55,0.9)'; ctx.lineWidth = Math.max(2, w*0.006);
  strokeRoundRect(ctx, x, y, w, h, 16);
  ctx.strokeStyle = 'rgba(32,22,11,0.10)'; ctx.lineWidth = 1;
  strokeRoundRect(ctx, x+6, y+6, w-12, h-12, 12);

  const img = exportState._img;
  if (img && img.complete && img.naturalWidth){
    ctx.save();
    pathRoundRect(ctx, x+6, y+6, w-12, h-12, 12); ctx.clip();
    const pw = w - w*0.10, ph = h - h*0.07;
    const scale = Math.min(pw/img.naturalWidth, ph/img.naturalHeight);
    const dw = img.naturalWidth*scale, dh = img.naturalHeight*scale;
    ctx.drawImage(img, x+(w-dw)/2, y+(h-dh)/2, dw, dh);
    ctx.restore();
  } else {
    const px = x+w/2, py = y+h/2;
    drawCrown(ctx, px, py - h*0.14, w*0.10, C.goldDeep);
    ctx.fillStyle = C.ink; ctx.textAlign = 'center';
    ctx.font = `italic 700 ${Math.round(w*0.07)}px "Playfair Display", Georgia, serif`;
    wrapText(ctx, p.nombre, px, py + h*0.08, w*0.8, w*0.075, 2);
    ctx.fillStyle = C.inkSoft;
    ctx.font = `600 ${Math.round(w*0.03)}px "Montserrat", sans-serif`;
    ctx.fillText(p.codigo, px, py + h*0.30);
  }
}

/* ---- Pie: contacto + handle ---- */
function drawFooter(ctx, W, H, m, pad, u, story){
  const y = H - m - u*(story ? 0.052 : 0.066);
  ctx.strokeStyle = 'rgba(212,175,55,0.35)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(pad, y - u*0.030); ctx.lineTo(W-pad, y - u*0.030); ctx.stroke();
  ctx.textAlign = 'center';
  ctx.fillStyle = C.dim;
  ctx.font = `600 ${Math.round(W*0.0165)}px "Montserrat", sans-serif`;
  const sep = '     ·     ';
  ctx.fillText(`${PLACA.ubicacion}${sep}WhatsApp ${PLACA.whatsapp}${sep}${PLACA.envios}`, W/2, y);
  const handle = ($('#handleInput')?.value || ('@' + CONFIG.INSTAGRAM_USER)).trim();
  ctx.fillStyle = C.goldSoft;
  ctx.font = `700 ${Math.round(W*0.020)}px "Montserrat", sans-serif`;
  ctx.fillText(handle, W/2, y + u*0.030);
}

function drawPrice(ctx, p, cx, y, W){
  ctx.textAlign='center';
  const now = fmtPrice(p.precio);
  const nowSize = Math.round(W*0.072);
  ctx.font = `700 ${nowSize}px "Playfair Display", Georgia, serif`;
  const nowW = ctx.measureText(now).width;

  let wasW = 0, gap = Math.round(W*0.03);
  const was = p.precio_regular ? fmtPrice(p.precio_regular) : '';
  const wasSize = Math.round(W*0.032);
  if (was){ ctx.font = `500 ${wasSize}px "Montserrat", sans-serif`; wasW = ctx.measureText(was).width; }

  const totalW = nowW + (was ? gap + wasW : 0);
  let sx = cx - totalW/2;

  ctx.textAlign='left';
  ctx.fillStyle = C.goldSoft;
  ctx.font = `700 ${nowSize}px "Playfair Display", Georgia, serif`;
  ctx.fillText(now, sx, y);
  if (was){
    const wx = sx + nowW + gap;
    ctx.fillStyle = C.muted;
    ctx.font = `500 ${wasSize}px "Montserrat", sans-serif`;
    ctx.fillText(was, wx, y - nowSize*0.28);
    // tachado
    ctx.strokeStyle = C.muted; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(wx, y - nowSize*0.28 - wasSize*0.32); ctx.lineTo(wx + wasW, y - nowSize*0.28 - wasSize*0.32); ctx.stroke();
    // badge % off
    if (p.descuento_pct){
      const bt = `-${p.descuento_pct}%`;
      ctx.font = `700 ${Math.round(W*0.024)}px "Montserrat", sans-serif`;
      const bw = ctx.measureText(bt).width + Math.round(W*0.03);
      const bh = Math.round(W*0.045);
      const bx = wx, by = y + Math.round(W*0.005);
      ctx.fillStyle = C.wine; fillRoundRect(ctx, bx, by, bw, bh, bh/2);
      ctx.fillStyle = '#ffe9ec'; ctx.textAlign='center';
      ctx.fillText(bt, bx + bw/2, by + bh*0.7);
    }
  }
  ctx.textAlign='center';
}

/* ---- primitives ---- */
function strokeRoundRect(ctx,x,y,w,h,r){ pathRoundRect(ctx,x,y,w,h,r); ctx.stroke(); }
function fillRoundRect(ctx,x,y,w,h,r){ pathRoundRect(ctx,x,y,w,h,r); ctx.fill(); }
function clipRoundRect(ctx,x,y,w,h,r){ pathRoundRect(ctx,x,y,w,h,r); }
function pathRoundRect(ctx,x,y,w,h,r){
  ctx.beginPath();
  ctx.moveTo(x+r,y);
  ctx.arcTo(x+w,y,x+w,y+h,r);
  ctx.arcTo(x+w,y+h,x,y+h,r);
  ctx.arcTo(x,y+h,x,y,r);
  ctx.arcTo(x,y,x+w,y,r);
  ctx.closePath();
}
function drawCrown(ctx, cx, cy, s, color){
  ctx.save();
  ctx.translate(cx - s, cy - s*0.5);
  ctx.fillStyle = color;
  ctx.beginPath();
  const u = s/12;
  ctx.moveTo(0*u, 4*u);
  ctx.lineTo(3.5*u, 7*u);
  ctx.lineTo(12*u, 0*u);
  ctx.lineTo(20.5*u, 7*u);
  ctx.lineTo(24*u, 4*u);
  ctx.lineTo(22.4*u, 15.2*u);
  ctx.lineTo(1.6*u, 15.2*u);
  ctx.closePath();
  ctx.fill();
  // gemas
  ctx.fillStyle = C.wine;
  [ [4,12],[12,12],[20,12] ].forEach(([gx,gy])=>{ ctx.beginPath(); ctx.arc(gx*u,gy*u,1.4*u,0,7); ctx.fill(); });
  ctx.restore();
}
function drawCorners(ctx, m, W, H){
  ctx.strokeStyle = C.gold; ctx.lineWidth = 2;
  const L = Math.round(W*0.03), o = m+4;
  const corner = (x,y,dx,dy)=>{ ctx.beginPath(); ctx.moveTo(x, y+dy*L); ctx.lineTo(x,y); ctx.lineTo(x+dx*L, y); ctx.stroke(); };
  corner(o,o,1,1); corner(W-o,o,-1,1); corner(o,H-o,1,-1); corner(W-o,H-o,-1,-1);
}
function wrapText(ctx, text, cx, y, maxW, lh, maxLines){
  const words = (text||'').split(/\s+/);
  const lines = []; let line = '';
  for (const w of words){
    const test = line ? line+' '+w : w;
    if (ctx.measureText(test).width > maxW && line){ lines.push(line); line = w; }
    else line = test;
  }
  if (line) lines.push(line);
  const use = lines.slice(0, maxLines);
  if (lines.length > maxLines) use[maxLines-1] = use[maxLines-1].replace(/\s+\S*$/,'') + '…';
  use.forEach((ln,i)=> ctx.fillText(ln, cx, y + i*lh));
  return y + (use.length-1)*lh;
}
function spaced(s, n){ return s.split('').join(' '.repeat(n>1?1:0)); }

async function downloadCard(){
  const p = exportState.producto;
  if (!p) return;
  await ensureFonts();
  if (!exportState._img) exportState._img = await loadProductImage(p);
  const { w, h } = FMT[exportState.fmt];
  const fmtName = exportState.fmt === 'post' ? '1080x1080' : '1080x1920';
  const save = () => {
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    drawCard(canvas.getContext('2d'), p, w, h);
    canvas.toBlob(blob => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `elzar_${p.codigo}_${fmtName}.png`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1500);
    }, 'image/png');
  };
  try{ save(); }
  catch(err){ exportState._img = null; save(); }   // si el canvas quedó "tainted", usar emblema
}
function loadProductImage(p){
  return new Promise(resolve => {
    if (!p.imagen || p.imagen_placeholder !== false) return resolve(null);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = p.imagen;
  });
}

/* arranque */
document.addEventListener('DOMContentLoaded', init);
