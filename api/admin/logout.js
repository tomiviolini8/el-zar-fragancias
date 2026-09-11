// POST /api/admin/logout -> borra la cookie.
import { clearCookie } from './_auth.js';

export default async function handler(req, res) {
  clearCookie(res);
  return res.status(200).json({ ok: true });
}
