// GET /api/admin/me -> estado de sesión para el panel vanilla.
import { getSession, isAllowed, oauthConfigured } from './_guard.js';

export default async function handler(req, res) {
  const s = getSession(req);
  const email = s?.email || null;
  return res.status(200).json({
    auth: !!email,
    email,
    name: s?.name || null,
    isAdmin: isAllowed(email),
    configured: oauthConfigured(),
  });
}
