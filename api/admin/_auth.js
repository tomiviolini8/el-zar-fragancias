// Sesión de admin: token firmado con HMAC en cookie HttpOnly (sin dependencias).
import { createHmac, timingSafeEqual } from 'node:crypto';

const COOKIE = 'zar_admin';
const TTL_SEC = 60 * 60 * 8; // 8 horas

function secret() { return process.env.SESSION_SECRET || ''; }

export function safeEq(a, b) {
  const ba = Buffer.from(String(a || ''));
  const bb = Buffer.from(String(b || ''));
  if (ba.length !== bb.length) return false;
  try { return timingSafeEqual(ba, bb); } catch { return false; }
}

export function sign(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const mac = createHmac('sha256', secret()).update(body).digest('base64url');
  return `${body}.${mac}`;
}

export function verify(token) {
  if (!token || !secret()) return null;
  const [body, mac] = String(token).split('.');
  if (!body || !mac) return null;
  const expected = createHmac('sha256', secret()).update(body).digest('base64url');
  const a = Buffer.from(mac), b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const obj = JSON.parse(Buffer.from(body, 'base64url').toString());
    if (obj.exp && Date.now() > obj.exp) return null;
    return obj;
  } catch { return null; }
}

export function makeToken(user) {
  return sign({ u: user, exp: Date.now() + TTL_SEC * 1000 });
}

export function setCookie(res, token) {
  res.setHeader('Set-Cookie', `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=${TTL_SEC}`);
}
export function clearCookie(res) {
  res.setHeader('Set-Cookie', `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=0`);
}

export function tokenFrom(req) {
  const c = req.headers.cookie || '';
  const m = c.match(/(?:^|;\s*)zar_admin=([^;]+)/);
  return m ? m[1] : null;
}
export function requireAuth(req) { return verify(tokenFrom(req)); }

export function configured() {
  return !!(process.env.ADMIN_USER && process.env.ADMIN_PASS && process.env.SESSION_SECRET);
}
