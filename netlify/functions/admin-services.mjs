import {
  getAdminSession, json, methodNotAllowed, readJson, readServicesFromDatabase,
  sameOrigin, saveServicesToDatabase, validateServices,
} from '../lib/shared.mjs';

export default async function handler(request) {
  if (!['GET', 'PUT'].includes(request.method)) return methodNotAllowed(['GET', 'PUT']);
  if (request.method === 'PUT' && !sameOrigin(request)) {
    return json(403, { error: 'Solicitud rechazada por validación de origen.' });
  }
  if (!getAdminSession(request)) return json(401, { error: 'Tu sesión venció. Iniciá sesión nuevamente.' });

  try {
    const current = await readServicesFromDatabase();
    if (request.method === 'GET') return json(200, { services: current });

    const body = await readJson(request);
    const result = validateServices(current, body?.services);
    if (result.error) return json(400, { error: result.error });
    await saveServicesToDatabase(result.services);
    return json(200, { ok: true, services: result.services });
  } catch (error) {
    console.error('Admin services error:', error.message);
    return json(503, { error: 'No se pudieron cargar o guardar los servicios. Revisá la configuración de Supabase.' });
  }
}
