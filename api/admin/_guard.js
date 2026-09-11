// Guardián de acceso admin: sesión válida (Google) + email en la allowlist.
// La allowlist se re-verifica en CADA request protegido (no solo al loguear).
import { verifyToken, readCookie, SESSION_COOKIE } from './_session.js';

export function adminEmails() {
  return (process.env.ADMIN_EMAILS || '')
    .split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
}

export function isAllowed(email) {
  if (!email) return false;
  return adminEmails().includes(String(email).toLowerCase());
}

export function getSession(req) {
  return verifyToken(readCookie(req, SESSION_COOKIE));
}

// Devuelve { ok, status, error, session, email }.
export function requireAdmin(req) {
  const s = getSession(req);
  if (!s || !s.email) return { ok: false, status: 401, error: 'No autorizado. Iniciá sesión con Google.' };
  if (!isAllowed(s.email)) return { ok: false, status: 403, error: 'Tu cuenta no tiene permisos de administrador.', email: s.email };
  return { ok: true, session: s, email: s.email };
}

export function oauthConfigured() {
  return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
    && process.env.OAUTH_REDIRECT_URI && process.env.SESSION_SECRET);
}
