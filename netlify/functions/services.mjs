import { json, methodNotAllowed, readServicesFromDatabase } from '../lib/shared.mjs';

export default async function handler(request) {
  if (request.method !== 'GET') return methodNotAllowed(['GET']);
  try {
    const services = await readServicesFromDatabase();
    return json(200, services);
  } catch (error) {
    console.error('Public services error:', error.message);
    return json(503, { error: 'Los servicios todavía no están configurados. Revisá la conexión con la base de datos.' });
  }
}
