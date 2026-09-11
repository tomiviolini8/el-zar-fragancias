// GET /api/admin/me -> ¿hay sesión válida?
import { requireAuth, configured } from './_auth.js';

export default async function handler(req, res) {
  const sess = requireAuth(req);
  return res.status(200).json({ auth: !!sess, user: sess?.u || null, configured: configured() });
}
