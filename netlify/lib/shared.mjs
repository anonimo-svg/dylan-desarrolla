import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

export const SESSION_COOKIE = 'blackout_admin';
export const SESSION_DURATION_SECONDS = 2 * 60 * 60;
const TABLE_CONTENT = 'blackout_site_content';

let cachedSupabase = null;

export function json(status, body, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store, max-age=0',
      'x-content-type-options': 'nosniff',
      ...extraHeaders,
    },
  });
}

export function methodNotAllowed(allowed) {
  return json(405, { error: 'Método no permitido.' }, { allow: allowed.join(', ') });
}

export function sameOrigin(request) {
  const origin = request.headers.get('origin');
  if (!origin) return false;
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

export async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

export function safeEqual(a, b) {
  const hashA = crypto.createHash('sha256').update(String(a ?? ''), 'utf8').digest();
  const hashB = crypto.createHash('sha256').update(String(b ?? ''), 'utf8').digest();
  return crypto.timingSafeEqual(hashA, hashB);
}

export function adminConfig() {
  const username = process.env.ADMIN_USER;
  const password = process.env.ADMIN_PASSWORD;
  const secret = process.env.SESSION_SECRET;
  if (!username || !password || !secret || secret.length < 32) {
    throw new Error('Faltan ADMIN_USER, ADMIN_PASSWORD o SESSION_SECRET (mínimo 32 caracteres).');
  }
  return { username, password, secret };
}

function sign(value, secret) {
  return crypto.createHmac('sha256', secret).update(value).digest('base64url');
}

export function createSessionCookie(username, secret) {
  const payload = Buffer.from(JSON.stringify({
    user: username,
    exp: Math.floor(Date.now() / 1000) + SESSION_DURATION_SECONDS,
  })).toString('base64url');
  const token = `${payload}.${sign(payload, secret)}`;
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_DURATION_SECONDS}`;
}

export function clearSessionCookie() {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;
}

export function getAdminSession(request) {
  let config;
  try { config = adminConfig(); } catch { return false; }
  const cookieHeader = request.headers.get('cookie') || '';
  const pair = cookieHeader.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${SESSION_COOKIE}=`));
  if (!pair) return false;
  const token = pair.slice(SESSION_COOKIE.length + 1);
  const separator = token.lastIndexOf('.');
  if (separator <= 0) return false;
  const payload = token.slice(0, separator);
  const signature = token.slice(separator + 1);
  if (!safeEqual(signature, sign(payload, config.secret))) return false;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return data.user === config.username && Number.isInteger(data.exp) && data.exp > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}

export function getClientIp(request) {
  const netlifyIp = request.headers.get('x-nf-client-connection-ip');
  if (netlifyIp) return netlifyIp.trim();
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',').at(-1).trim();
  return 'unknown';
}

export function hashClientIp(ip, secret) {
  return crypto.createHmac('sha256', secret).update(ip).digest('hex');
}

export function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !secretKey) throw new Error('Faltan SUPABASE_URL y SUPABASE_SECRET_KEY en las variables de Netlify.');
  if (!cachedSupabase) {
    cachedSupabase = createClient(url, secretKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
  }
  return cachedSupabase;
}

export async function readServicesFromDatabase() {
  const client = getSupabaseAdmin();
  const { data, error } = await client
    .from(TABLE_CONTENT)
    .select('services')
    .eq('id', 1)
    .maybeSingle();
  if (error) {
    console.error('Supabase read error:', error.message);
    throw new Error('No se pudo leer la configuración de servicios en Supabase. Revisá el SQL de instalación y las variables de Netlify.');
  }
  if (!data || !Array.isArray(data.services)) {
    throw new Error('Falta cargar la fila inicial de servicios en Supabase. Ejecutá el archivo supabase/setup.sql.');
  }
  return data.services;
}

export function validateServices(current, submitted) {
  if (!Array.isArray(submitted) || submitted.length !== current.length) {
    return { error: 'La lista de servicios no tiene el formato esperado.' };
  }
  const byId = new Map();
  for (const item of submitted) {
    if (!item || typeof item.id !== 'string' || byId.has(item.id)) {
      return { error: 'Hay un servicio inválido o duplicado.' };
    }
    byId.set(item.id, item);
  }
  const clean = [];
  for (const original of current) {
    const item = byId.get(original.id);
    if (!item) return { error: 'No se puede agregar ni quitar servicios desde este panel.' };
    if (typeof item.title !== 'string' || item.title.trim().length < 2 || item.title.trim().length > 80) {
      return { error: `El título de “${original.id}” debe tener entre 2 y 80 caracteres.` };
    }
    if (typeof item.description !== 'string' || item.description.trim().length < 5 || item.description.trim().length > 300) {
      return { error: `La descripción de “${original.id}” debe tener entre 5 y 300 caracteres.` };
    }
    if (typeof item.quote !== 'boolean') {
      return { error: `El tipo de precio de “${original.id}” no es válido.` };
    }
    let price = null;
    if (!item.quote) {
      if (!Number.isSafeInteger(item.price) || item.price < 1 || item.price > 1_000_000_000) {
        return { error: `El precio de “${original.id}” debe ser un entero entre 1 y 1.000.000.000.` };
      }
      price = item.price;
    }
    clean.push({ id: original.id, title: item.title.trim(), description: item.description.trim(), price, quote: item.quote });
  }
  return { services: clean };
}

export async function saveServicesToDatabase(services) {
  const client = getSupabaseAdmin();
  const { error } = await client
    .from(TABLE_CONTENT)
    .update({ services, updated_at: new Date().toISOString() })
    .eq('id', 1);
  if (error) {
    console.error('Supabase write error:', error.message);
    throw new Error('No se pudieron guardar los cambios en Supabase. Revisá la tabla y sus permisos.');
  }
}

export async function checkLoginRateLimit(ipHash) {
  const client = getSupabaseAdmin();
  const { data, error } = await client
    .from('blackout_admin_login_attempts')
    .select('attempts, window_started_at, blocked_until')
    .eq('ip_hash', ipHash)
    .maybeSingle();
  if (error) {
    console.error('Supabase login rate-limit read error:', error.message);
    throw new Error('No se pudo verificar el control de intentos. Ejecutá el SQL de instalación de Supabase.');
  }
  if (!data) return { blocked: false, row: null };
  const now = Date.now();
  if (data.blocked_until && new Date(data.blocked_until).getTime() > now) return { blocked: true, row: data };
  const windowStarted = new Date(data.window_started_at).getTime();
  if (!Number.isFinite(windowStarted) || now - windowStarted > 15 * 60 * 1000) return { blocked: false, row: null };
  return { blocked: Number(data.attempts) >= 6, row: data };
}

export async function recordFailedLogin(ipHash, previousRow) {
  const client = getSupabaseAdmin();
  const now = Date.now();
  const start = previousRow?.window_started_at ? new Date(previousRow.window_started_at).getTime() : 0;
  const withinWindow = Number.isFinite(start) && now - start <= 15 * 60 * 1000;
  const attempts = withinWindow ? Number(previousRow?.attempts || 0) + 1 : 1;
  const windowStarted = withinWindow ? new Date(start).toISOString() : new Date(now).toISOString();
  const blockedUntil = attempts >= 6 ? new Date(now + 15 * 60 * 1000).toISOString() : null;
  const { error } = await client.from('blackout_admin_login_attempts').upsert({
    ip_hash: ipHash,
    attempts,
    window_started_at: windowStarted,
    blocked_until: blockedUntil,
  }, { onConflict: 'ip_hash' });
  if (error) {
    console.error('Supabase login rate-limit write error:', error.message);
    throw new Error('No se pudo guardar el control de intentos de acceso.');
  }
}

export async function clearLoginFailures(ipHash) {
  const client = getSupabaseAdmin();
  const { error } = await client.from('blackout_admin_login_attempts').delete().eq('ip_hash', ipHash);
  if (error) console.error('Supabase login attempt cleanup error:', error.message);
}
