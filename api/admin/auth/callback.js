// GET /api/admin/auth/callback -> canjea el code, verifica el ID token (firma + nonce),
// exige email verificado + allowlist, setea la sesión y vuelve a /admin/.
import pkg from 'google-auth-library';
import { signToken, verifyToken, cookieStr, readCookie, SESSION_COOKIE, OAUTH_COOKIE } from '../_session.js';
import { isAllowed, oauthConfigured } from '../_guard.js';

const { OAuth2Client } = pkg;
const SESSION_TTL_SEC = 8 * 60 * 60;

function bounce(res, reason) {
  res.setHeader('Set-Cookie', cookieStr(OAUTH_COOKIE, '', { del: true }));
  res.writeHead(302, { Location: `/admin/?auth=${reason}` });
  res.end();
}

export default async function handler(req, res) {
  if (!oauthConfigured()) return res.status(500).send('OAuth no configurado.');
  try {
    const { code, state } = req.query || {};
    const saved = verifyToken(readCookie(req, OAUTH_COOKIE));
    if (!code || !state || !saved || state !== saved.state) return bounce(res, 'state');

    const client = new OAuth2Client({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      redirectUri: process.env.OAUTH_REDIRECT_URI,
    });
    const { tokens } = await client.getToken(code);
    if (!tokens.id_token) return bounce(res, 'token');
    const ticket = await client.verifyIdToken({ idToken: tokens.id_token, audience: process.env.GOOGLE_CLIENT_ID });
    const p = ticket.getPayload();

    if (!p || p.nonce !== saved.nonce) return bounce(res, 'nonce');
    if (!p.email || p.email_verified !== true) return bounce(res, 'email');
    if (!isAllowed(p.email)) return bounce(res, 'forbidden');

    const session = signToken({ email: p.email.toLowerCase(), name: p.name || '', exp: Date.now() + SESSION_TTL_SEC * 1000 });
    res.setHeader('Set-Cookie', [
      cookieStr(SESSION_COOKIE, session, { maxAge: SESSION_TTL_SEC }),
      cookieStr(OAUTH_COOKIE, '', { del: true }),
    ]);
    res.writeHead(302, { Location: '/admin/' });
    res.end();
  } catch (err) {
    bounce(res, 'error');
  }
}
