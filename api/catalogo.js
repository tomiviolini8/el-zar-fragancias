// GET /api/catalogo — lee Airtable en vivo y devuelve el catálogo (público).
// El token de Airtable vive solo en el servidor (env var de Vercel).
import { env, fetchAll, buildCatalogo } from './_lib/airtable.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Método no permitido' });
  }
  try {
    const records = await fetchAll(env());
    const catalogo = buildCatalogo(records);
    // Cache en el edge: respuesta rápida y fresca (60s), se revalida en background.
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
    return res.status(200).json(catalogo);
  } catch (err) {
    return res.status(500).json({ error: 'No se pudo leer el catálogo', detail: String(err.message || err) });
  }
}
