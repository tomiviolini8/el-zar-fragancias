// POST /api/admin/login  {user, pass} -> setea cookie de sesión.
import { safeEq, makeToken, setCookie, configured } from './_auth.js';
import { readJson } from './_http.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'Método no permitido' }); }
  if (!configured()) return res.status(500).json({ error: 'El panel no está configurado (faltan ADMIN_USER / ADMIN_PASS / SESSION_SECRET en Vercel).' });
  const { user, pass } = await readJson(req);
  const okU = safeEq(user, process.env.ADMIN_USER);
  const okP = safeEq(pass, process.env.ADMIN_PASS);
  if (!okU || !okP) return res.status(401).json({ error: 'Usuario o contraseña incorrectos.' });
  setCookie(res, makeToken(process.env.ADMIN_USER));
  return res.status(200).json({ ok: true, user: process.env.ADMIN_USER });
}
