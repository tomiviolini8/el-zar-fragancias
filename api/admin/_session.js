// Sesión de admin: token propio firmado con HMAC (SESSION_SECRET) + helpers de cookie.
// Stateless: no requiere store con estado. Se usa DESPUÉS de validar el login con Google.
import { createHmac, timingSafeEqual, randomBytes } from 'node:crypto';

export const SESSION_COOKIE = 'zar_admin';
export const OAUTH_COOKIE = 'zar_oauth';

function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error('Falta SESSION_SECRET');
  return s;
}

// Firma un objeto -> "<body>.<hmac>" (body en base64url). Incluir exp (ms epoch).
export function signToken(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const mac = createHmac('sha256', secret()).update(body).digest('base64url');
  return `${body}.${mac}`;
}

// Verifica firma y expiración. Devuelve el payload o null.
export function verifyToken(token) {
  if (!token) return null;
  let sec;
  try { sec = secret(); } catch { return null; }
  const [body, mac] = String(token).split('.');
  if (!body || !mac) return null;
  const expected = createHmac('sha256', sec).update(body).digest('base64url');
  const a = Buffer.from(mac), b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const obj = JSON.parse(Buffer.from(body, 'base64url').toString());
    if (obj.exp && Date.now() > obj.exp) return null;
    return obj;
  } catch { return null; }
}

export function randomToken() { return randomBytes(24).toString('base64url'); }

// Arma un header Set-Cookie. { maxAge } en segundos; { del:true } la borra.
export function cookieStr(name, value, { maxAge = 0, del = false } = {}) {
  return [
    `${name}=${del ? '' : value}`,
    'Path=/', 'HttpOnly', 'SameSite=Lax', 'Secure',
    `Max-Age=${del ? 0 : maxAge}`,
  ].join('; ');
}

export function readCookie(req, name) {
  const c = req.headers.cookie || '';
  const m = c.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return m ? m[1] : null;
}
