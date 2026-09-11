// GET /api/admin/auth/login -> 302 a la pantalla de consentimiento de Google.
// Guarda state + nonce en una cookie corta firmada (CSRF + anti-replay del ID token).
import pkg from 'google-auth-library';
import { signToken, cookieStr, randomToken, OAUTH_COOKIE } from '../_session.js';
import { oauthConfigured } from '../_guard.js';

const { OAuth2Client } = pkg;

export default async function handler(req, res) {
  if (!oauthConfigured()) {
    return res.status(500).send('OAuth no configurado (faltan GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / OAUTH_REDIRECT_URI / SESSION_SECRET en Vercel).');
  }
  const state = randomToken();
  const nonce = randomToken();
  const client = new OAuth2Client({
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    redirectUri: process.env.OAUTH_REDIRECT_URI,
  });
  const url = client.generateAuthUrl({
    access_type: 'online',
    scope: ['openid', 'email', 'profile'],
    state,
    nonce,
    prompt: 'select_account',
  });
  const oauthTok = signToken({ state, nonce, exp: Date.now() + 10 * 60 * 1000 });
  res.setHeader('Set-Cookie', cookieStr(OAUTH_COOKIE, oauthTok, { maxAge: 600 }));
  res.writeHead(302, { Location: url });
  res.end();
}
