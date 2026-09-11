// POST /api/admin/logout -> borra la cookie de sesión.
import { cookieStr, SESSION_COOKIE } from './_session.js';

export default async function handler(req, res) {
  res.setHeader('Set-Cookie', cookieStr(SESSION_COOKIE, '', { del: true }));
  return res.status(200).json({ ok: true });
}
