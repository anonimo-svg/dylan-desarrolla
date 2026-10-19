import {
  adminConfig, checkLoginRateLimit, clearLoginFailures, createSessionCookie,
  getClientIp, hashClientIp, json, methodNotAllowed, readJson,
  recordFailedLogin, safeEqual, sameOrigin,
} from '../lib/shared.mjs';

export default async function handler(request) {
  if (request.method !== 'POST') return methodNotAllowed(['POST']);
  if (!sameOrigin(request)) return json(403, { error: 'Solicitud rechazada por validación de origen.' });
  const body = await readJson(request);
  const username = body?.username;
  const password = body?.password;
  if (typeof username !== 'string' || typeof password !== 'string' || username.length > 80 || password.length > 200) {
    return json(400, { error: 'Ingresá un usuario y contraseña válidos.' });
  }
  let config;
  try {
    config = adminConfig();
    const ipHash = hashClientIp(getClientIp(request), config.secret);
    const limit = await checkLoginRateLimit(ipHash);
    if (limit.blocked) return json(429, { error: 'Demasiados intentos de acceso. Esperá 15 minutos y volvé a intentar.' });
    const usernameOk = safeEqual(username, config.username);
    const passwordOk = safeEqual(password, config.password);
    if (!(usernameOk && passwordOk)) {
      await recordFailedLogin(ipHash, limit.row);
      return json(401, { error: 'Usuario o contraseña incorrectos.' });
    }
    await clearLoginFailures(ipHash);
    return json(200, { ok: true, expiresInMinutes: 120 }, { 'set-cookie': createSessionCookie(config.username, config.secret) });
  } catch (error) {
    console.error('Admin login error:', error.message);
    return json(503, { error: 'El acceso administrativo no está configurado por completo. Revisá las variables de Netlify y el SQL de Supabase.' });
  }
}
