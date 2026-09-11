// Helpers compartidos para hablar con Airtable desde las funciones serverless.
// El token vive SOLO del lado del servidor (variable de entorno en Vercel).

const API = 'https://api.airtable.com/v0';

export function env() {
  const token = process.env.AIRTABLE_TOKEN;
  if (!token) throw new Error('Falta AIRTABLE_TOKEN');
  return {
    token,
    base: process.env.AIRTABLE_BASE || 'appNFFIDioekqNCEV',
    table: process.env.AIRTABLE_TABLE || 'Perfumes',
  };
}

async function apiFetch(e, { method = 'GET', path = '', body } = {}) {
  const url = `${API}/${e.base}/${encodeURIComponent(e.table)}${path}`;
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${e.token}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    const err = new Error(`Airtable ${res.status}: ${txt.slice(0, 300)}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

export async function fetchAll(e) {
  const out = [];
  let offset;
  do {
    const q = new URLSearchParams({ pageSize: '100' });
    if (offset) q.set('offset', offset);
    const data = await apiFetch(e, { path: `?${q}` });
    out.push(...(data.records || []));
    offset = data.offset;
  } while (offset);
  return out;
}

export async function findByCodigo(e, codigo) {
  const q = new URLSearchParams({
    maxRecords: '1',
    filterByFormula: `{Codigo}='${String(codigo).replace(/'/g, "\\'")}'`,
  });
  const data = await apiFetch(e, { path: `?${q}` });
  return (data.records || [])[0] || null;
}

export async function upsertByCodigo(e, fields) {
  return apiFetch(e, {
    method: 'PATCH',
    body: {
      performUpsert: { fieldsToMergeOn: ['Codigo'] },
      records: [{ fields }],
      typecast: true,
    },
  });
}

export async function updateRecord(e, id, fields) {
  return apiFetch(e, {
    method: 'PATCH',
    body: { records: [{ id, fields }], typecast: true },
  });
}

function slugify(s) {
  return (s || '')
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'item';
}

// Convierte un registro de Airtable al shape que usa la web (igual a productos.json).
export function mapRecord(rec) {
  const f = rec.fields || {};
  const cod = (f.Codigo || '').trim();
  const fotoUrl = (f['Foto URL'] || '').trim();
  const tieneFotoAdjunta = Array.isArray(f.Foto) && f.Foto.length > 0;
  const revisar = (f['Foto estado'] || '').trim() === 'Revisar';
  const hayFoto = !revisar && (fotoUrl || tieneFotoAdjunta);
  // Preferimos la versión normalizada commiteada (assets/productos/<cod>.jpg);
  // si el panel subió una nueva a Blob, usamos esa Foto URL.
  const imagen = revisar ? '' : (fotoUrl || (cod ? `assets/productos/${cod}.jpg` : ''));
  return {
    id: `${slugify(f.Nombre)}-${cod.toLowerCase()}`,
    codigo: cod,
    nombre: f.Nombre || '',
    formato: f.Formato || '',
    familia_olfativa: f['Familia olfativa'] || '',
    inspirado_en: f['Inspirado en'] || '',
    marca: f.Marca || '',
    precio: f.Precio ?? null,
    precio_regular: f['Precio regular'] ?? null,
    descuento_pct: f['Descuento %'] || 0,
    descripcion: f.Descripcion || '',
    genero: f.Genero || '',
    linea: f.Linea || '',
    es_arabe: !!f['Es arabe'],
    ocasion: f.Ocasion || '',
    categorias: f.Categorias || [],
    etiquetas: f.Etiquetas || [],
    pagina: f.Pagina ?? null,
    stock: f.Stock || 'A pedido',
    imagen,
    imagen_placeholder: !hayFoto,
  };
}

// Mapeo clave-web -> campo Airtable (para escribir desde el panel).
const WRITE_FIELDS = [
  ['Codigo', 'codigo', 'text'], ['Nombre', 'nombre', 'text'],
  ['Precio', 'precio', 'num'], ['Precio regular', 'precio_regular', 'num'],
  ['Descuento %', 'descuento_pct', 'num'], ['Descripcion', 'descripcion', 'text'],
  ['Inspirado en', 'inspirado_en', 'text'], ['Marca', 'marca', 'text'],
  ['Formato', 'formato', 'text'], ['Familia olfativa', 'familia_olfativa', 'text'],
  ['Genero', 'genero', 'text'], ['Linea', 'linea', 'text'],
  ['Ocasion', 'ocasion', 'text'], ['Es arabe', 'es_arabe', 'bool'],
  ['Categorias', 'categorias', 'list'], ['Etiquetas', 'etiquetas', 'list'],
  ['Stock', 'stock', 'text'], ['Foto URL', 'foto_url', 'text'],
];

// Convierte los datos del formulario (claves web) a campos de Airtable.
export function toFields(p) {
  const f = {};
  for (const [aname, pkey, kind] of WRITE_FIELDS) {
    let v = p[pkey];
    if (v === undefined) continue;
    if (kind === 'num') {
      if (v === '' || v === null) { f[aname] = null; continue; }
      const n = Number(v); if (!Number.isNaN(n)) f[aname] = n;
    } else if (kind === 'bool') {
      f[aname] = !!v;
    } else if (kind === 'list') {
      f[aname] = Array.isArray(v) ? v : (v ? String(v).split(',').map((s) => s.trim()).filter(Boolean) : []);
    } else {
      f[aname] = (v == null) ? '' : String(v);
    }
  }
  f.Publicar = true;
  return f;
}

export function buildCatalogo(records) {
  const productos = records
    .filter((r) => {
      const f = r.fields || {};
      return (f.Codigo || '').trim() && f.Publicar !== false;
    })
    .map(mapRecord)
    .sort((a, b) => a.codigo.localeCompare(b.codigo));
  return {
    meta: {
      marca: 'El Zar de las Fragancias',
      total: productos.length,
      moneda: 'ARS',
      fuente: 'airtable-live',
    },
    productos,
  };
}
