/* Panel admin El Zar — vanilla JS. Login + Alta/Edición contra /api/admin/* */
const $ = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => [...c.querySelectorAll(s)];
const api = (path, opts = {}) => fetch(path, { credentials: 'same-origin', headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) }, ...opts });
const fmt = (n) => (n || n === 0) ? '$' + Number(n).toLocaleString('es-AR') : '—';

let CATALOGO = [];

const FIELDS = [
  { k: 'codigo', label: 'Código', req: true },
  { k: 'nombre', label: 'Nombre', req: true },
  { k: 'marca', label: 'Marca (casa)' },
  { k: 'inspirado_en', label: 'Inspirado en' },
  { k: 'genero', label: 'Género', type: 'select', opts: ['', 'Hombre', 'Mujer', 'Unisex'] },
  { k: 'linea', label: 'Línea' },
  { k: 'familia_olfativa', label: 'Familia olfativa' },
  { k: 'formato', label: 'Formato' },
  { k: 'ocasion', label: 'Ocasión', type: 'select', opts: ['', 'Día', 'Noche', 'Citas', 'Ecléctica'] },
  { k: 'precio', label: 'Precio ($)', type: 'number' },
  { k: 'precio_regular', label: 'Precio regular ($)', type: 'number' },
  { k: 'descuento_pct', label: 'Descuento (%)', type: 'number' },
  { k: 'stock', label: 'Stock', type: 'select', opts: ['A pedido', 'En stock', 'Sin stock'] },
  { k: 'categorias', label: 'Categorías (coma)' },
  { k: 'etiquetas', label: 'Etiquetas (coma): NUEVO, BEST, OFERTA, ÁRABE' },
  { k: 'descripcion', label: 'Descripción', type: 'textarea', full: true },
];

function fieldHTML(f) {
  const id = 'f_' + f.k;
  let input;
  if (f.type === 'select') {
    input = `<select id="${id}" data-k="${f.k}">${f.opts.map((o) => `<option value="${o}">${o || '—'}</option>`).join('')}</select>`;
  } else if (f.type === 'textarea') {
    input = `<textarea id="${id}" data-k="${f.k}"></textarea>`;
  } else {
    input = `<input id="${id}" data-k="${f.k}" ${f.type === 'number' ? 'type="number" inputmode="numeric"' : ''}>`;
  }
  return `<div class="${f.full ? 'full' : ''}"><label for="${id}">${f.label}${f.req ? ' *' : ''}</label>${input}</div>`;
}

function formHTML(mode) {
  return `
    <div class="grid2">
      ${FIELDS.map(fieldHTML).join('')}
      <div class="row-check full">
        <input type="checkbox" id="f_es_arabe" data-k="es_arabe">
        <label for="f_es_arabe" style="margin:0;text-transform:none;letter-spacing:0;font-size:.9rem;color:var(--cream)">Es árabe (línea árabe)</label>
      </div>
      <div class="full">
        <label>Foto</label>
        <div class="foto-box">
          <img id="fotoPreview" alt="" src="" onerror="this.style.visibility='hidden'">
          <div class="hint" id="fotoHint">La carga/cambio de foto se habilita en el próximo paso (subida + recorte automático).</div>
        </div>
      </div>
    </div>
    <div class="actions">
      <button class="btn btn-gold" id="saveBtn">${mode === 'alta' ? 'Crear perfume' : 'Guardar cambios'}</button>
      ${mode === 'editar' ? '<button class="btn btn-ghost" id="cancelBtn">Cerrar</button>' : '<button class="btn btn-ghost" id="clearBtn">Limpiar</button>'}
    </div>
    <div class="msg" id="formMsg"></div>`;
}

function readForm(root) {
  const data = {};
  $$('[data-k]', root).forEach((el) => {
    if (el.type === 'checkbox') data[el.dataset.k] = el.checked;
    else data[el.dataset.k] = el.value.trim();
  });
  return data;
}
function fillForm(root, p) {
  $$('[data-k]', root).forEach((el) => {
    const v = p[el.dataset.k];
    if (el.type === 'checkbox') el.checked = !!v;
    else if (Array.isArray(v)) el.value = v.join(', ');
    else el.value = (v ?? '');
  });
  const img = $('#fotoPreview', root);
  if (img) {
    if (p.imagen && !p.imagen_placeholder) {
      const src = p.imagen.startsWith('http') ? p.imagen : '../' + p.imagen;
      img.src = src; img.style.visibility = 'visible';
    } else { img.removeAttribute('src'); img.style.visibility = 'hidden'; }
  }
}

function wireAutoDescuento(root) {
  const pr = $('#f_precio', root), reg = $('#f_precio_regular', root), off = $('#f_descuento_pct', root);
  const calc = () => {
    const a = Number(pr.value), b = Number(reg.value);
    if (b > 0 && a > 0 && a < b) off.value = Math.round((1 - a / b) * 100);
  };
  pr?.addEventListener('input', calc); reg?.addEventListener('input', calc);
}

async function save(root, mode, msgEl) {
  const data = readForm(root);
  if (!data.codigo) return showMsg(msgEl, 'err', 'Falta el código.');
  if (!data.nombre) return showMsg(msgEl, 'err', 'Falta el nombre.');
  const btn = $('#saveBtn', root); btn.disabled = true; const orig = btn.textContent; btn.textContent = 'Guardando…';
  try {
    const res = await api('/api/admin/perfume', { method: mode === 'alta' ? 'POST' : 'PATCH', body: JSON.stringify(data) });
    const j = await res.json();
    if (!res.ok) throw new Error(j.error || 'Error al guardar');
    showMsg(msgEl, 'ok', mode === 'alta' ? `✓ Perfume "${data.nombre}" creado.` : `✓ Cambios guardados en ${data.codigo}.`);
    await loadCatalogo();
    if (mode === 'alta') { $$('[data-k]', root).forEach((el) => { if (el.type === 'checkbox') el.checked = false; else el.value = ''; }); }
  } catch (e) {
    showMsg(msgEl, 'err', e.message);
  } finally { btn.disabled = false; btn.textContent = orig; }
}

function showMsg(el, kind, text) { el.className = 'msg ' + kind; el.textContent = text; }

function renderList(filter = '') {
  const q = filter.trim().toLowerCase();
  const items = CATALOGO.filter((p) => !q || (p.nombre + ' ' + p.codigo + ' ' + p.marca).toLowerCase().includes(q)).slice(0, 60);
  $('#plist').innerHTML = items.length ? items.map((p) => `
    <div class="pitem" data-code="${p.codigo}">
      <img src="${p.imagen && !p.imagen_placeholder ? (p.imagen.startsWith('http') ? p.imagen : '../' + p.imagen) : ''}" onerror="this.style.visibility='hidden'" alt="">
      <div><div class="nm">${p.nombre}</div><div class="cd">${p.codigo}</div></div>
      <div class="pr">${fmt(p.precio)}</div>
    </div>`).join('') : '<div style="padding:16px;color:var(--muted)">Sin resultados.</div>';
  $$('#plist .pitem').forEach((it) => it.addEventListener('click', () => openEdit(it.dataset.code)));
}

function openEdit(code) {
  const p = CATALOGO.find((x) => x.codigo === code); if (!p) return;
  const wrap = $('#editFormWrap');
  wrap.hidden = false;
  wrap.innerHTML = `<div style="border-top:1px solid var(--gold-line);margin:6px 0 16px"></div>` + formHTML('editar');
  fillForm(wrap, p);
  $('#f_codigo', wrap).setAttribute('readonly', 'true');   // el código no se cambia al editar
  wireAutoDescuento(wrap);
  $('#saveBtn', wrap).addEventListener('click', () => save(wrap, 'editar', $('#formMsg', wrap)));
  $('#cancelBtn', wrap).addEventListener('click', () => { wrap.hidden = true; wrap.innerHTML = ''; });
  wrap.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function initAlta() {
  const wrap = $('#altaFormWrap');
  wrap.innerHTML = formHTML('alta');
  wireAutoDescuento(wrap);
  $('#f_stock', wrap).value = 'A pedido';
  $('#saveBtn', wrap).addEventListener('click', () => save(wrap, 'alta', $('#formMsg', wrap)));
  $('#clearBtn', wrap).addEventListener('click', () => $$('[data-k]', wrap).forEach((el) => { if (el.type === 'checkbox') el.checked = false; else el.value = ''; }));
}

async function loadCatalogo() {
  try {
    const res = await api('/api/catalogo');
    const j = await res.json();
    CATALOGO = j.productos || [];
    renderList($('#search').value);
  } catch { CATALOGO = []; }
}

/* ---------- sesión (Google OAuth) ---------- */
const AUTH_MSGS = {
  forbidden: 'Esa cuenta de Google no está autorizada como administrador.',
  email: 'Tu email de Google no está verificado.',
  state: 'La sesión de login expiró. Probá de nuevo.',
  nonce: 'No se pudo validar el login. Probá de nuevo.',
  token: 'Google no devolvió un token válido. Probá de nuevo.',
  error: 'Hubo un problema al iniciar sesión. Probá de nuevo.',
};
async function boot() {
  // mensaje de error que viene del callback (?auth=...)
  const params = new URLSearchParams(location.search);
  const authErr = params.get('auth');
  if (authErr) history.replaceState(null, '', location.pathname);

  const me = await api('/api/admin/me').then((r) => r.json()).catch(() => ({ auth: false, isAdmin: false }));
  if (me.auth && me.isAdmin) return showPanel(me.name || me.email);
  if (me.auth && !me.isAdmin) return showDenied(me.email);
  showLogin(authErr ? (AUTH_MSGS[authErr] || AUTH_MSGS.error) : '');
}
function showLogin(errText) {
  $('#loginView').hidden = false; $('#panelView').hidden = true;
  $('#loginBox').hidden = false; $('#deniedBox').hidden = true;
  const msg = $('#loginMsg');
  if (errText) showMsg(msg, 'err', errText); else msg.className = 'msg';
}
function showDenied(email) {
  $('#loginView').hidden = false; $('#panelView').hidden = true;
  $('#loginBox').hidden = true; $('#deniedBox').hidden = false;
  $('#deniedEmail').textContent = email || '';
}
function showPanel(who) {
  $('#loginView').hidden = true; $('#panelView').hidden = false;
  $('#whoami').textContent = who || '';
  initAlta();
  loadCatalogo();
}
async function doLogout() { await api('/api/admin/logout', { method: 'POST' }); location.href = 'index.html'; }
$('#logoutBtn').addEventListener('click', doLogout);
$('#deniedLogout').addEventListener('click', doLogout);
$('#reloadBtn').addEventListener('click', loadCatalogo);
$('#search').addEventListener('input', (e) => renderList(e.target.value));
$$('.tab').forEach((t) => t.addEventListener('click', () => {
  $$('.tab').forEach((x) => x.classList.toggle('active', x === t));
  const tab = t.dataset.tab;
  $('#editarView').hidden = tab !== 'editar';
  $('#altaView').hidden = tab !== 'alta';
}));

boot();
