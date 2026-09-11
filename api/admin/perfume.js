// POST/PATCH /api/admin/perfume -> crea o actualiza un perfume en Airtable
// (upsert por Codigo). Protegido por sesión de admin.
import { env, toFields, upsertByCodigo } from '../_lib/airtable.js';
import { requireAdmin } from './_guard.js';
import { readJson } from './_http.js';

export default async function handler(req, res) {
  const gate = requireAdmin(req);           // sesión Google + allowlist (re-chequeada)
  if (!gate.ok) return res.status(gate.status).json({ error: gate.error });
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
