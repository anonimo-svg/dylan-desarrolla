import { clearSessionCookie, json, methodNotAllowed, sameOrigin } from '../lib/shared.mjs';

export default async function handler(request) {
  if (request.method !== 'POST') return methodNotAllowed(['POST']);
  if (!sameOrigin(request)) return json(403, { error: 'Solicitud rechazada por validación de origen.' });
  return json(200, { ok: true }, { 'set-cookie': clearSessionCookie() });
}
