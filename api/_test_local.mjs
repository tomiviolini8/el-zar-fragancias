// Test local: carga scripts/.env, lee Airtable y valida el catálogo.
// Uso: node api/_test_local.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const envPath = join(here, '..', 'scripts', '.env');
try {
  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
    if (m && !line.trim().startsWith('#')) process.env[m[1]] = m[2];
  }
} catch { console.warn('(no se pudo leer scripts/.env)'); }

const { env, fetchAll, buildCatalogo } = await import('./_lib/airtable.js');
const cat = buildCatalogo(await fetchAll(env()));
console.log('productos:', cat.productos.length);
console.log('con foto :', cat.productos.filter((p) => !p.imagen_placeholder).length);
console.log('placeholder:', cat.productos.filter((p) => p.imagen_placeholder).length);
const s = cat.productos[0];
console.log('ejemplo  :', JSON.stringify({ codigo: s.codigo, nombre: s.nombre, precio: s.precio, imagen: s.imagen, ph: s.imagen_placeholder }));
// chequeo de forma vs productos.json
const local = JSON.parse(readFileSync(join(here, '..', 'data', 'productos.json'), 'utf8'));
const keysLocal = Object.keys(local.productos[0]).sort().join(',');
const keysApi = Object.keys(s).sort().join(',');
console.log('keys iguales a productos.json:', keysLocal === keysApi ? 'SÍ' : `NO\n  local=${keysLocal}\n  api  =${keysApi}`);
