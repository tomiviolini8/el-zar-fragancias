// POST/PATCH /api/admin/perfume -> crea o actualiza un perfume en Airtable
// (upsert por Codigo). Protegido por sesión de admin.
import { env, toFields, upsertByCodigo } from '../_lib/airtable.js';
import { requireAuth } from './_auth.js';
import { readJson } from './_http.js';

export default async function handler(req, res) {
  if (!requireAuth(req)) return res.status(401).json({ error: 'No autorizado' });
  if (!['POST', 'PATCH'].includes(req.method)) {
    res.setHeader('Allow', 'POST, PATCH');
    return res.status(405).json({ error: 'Método no permitido' });
  }
  try {
    const data = await readJson(req);
    const codigo = (data.codigo || '').trim();
    if (!codigo) return res.status(400).json({ error: 'Falta el código del perfume.' });
    if (!(data.nombre || '').trim()) return res.status(400).json({ error: 'Falta el nombre del perfume.' });
    const fields = toFields({ ...data, codigo });
    const r = await upsertByCodigo(env(), fields);
    const rec = r.records?.[0];
    return res.status(200).json({ ok: true, id: rec?.id, codigo, creado: r.createdRecords?.includes(rec?.id) });
  } catch (err) {
    return res.status(500).json({ error: 'No se pudo guardar', detail: String(err.message || err) });
  }
}
