require('dotenv').config();
const express = require('express');
const cookieSession = require('cookie-session');
const helmet = require('helmet');
const { rateLimit } = require('express-rate-limit');
const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');

const app = express();
const PORT = Number(process.env.PORT || 3000);
const ADMIN_USER = process.env.ADMIN_USER;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const SESSION_SECRET = process.env.SESSION_SECRET;
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const SESSION_DURATION_MS = 2 * 60 * 60 * 1000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const SERVICES_FILE = path.join(DATA_DIR, 'services.json');

if (!ADMIN_USER || !ADMIN_PASSWORD || !SESSION_SECRET || SESSION_SECRET.length < 32) {
  console.error('Configuración incompleta. Revisá ADMIN_USER, ADMIN_PASSWORD y SESSION_SECRET en .env. SESSION_SECRET debe tener al menos 32 caracteres.');
  process.exit(1);
}

if (IS_PRODUCTION) app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
      imgSrc: ["'self'", 'data:'],
      connectSrc: ["'self'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'none'"],
      objectSrc: ["'none'"]
    }
  }
}));
app.use(express.json({ limit: '32kb' }));
app.use(cookieSession({
  name: 'blackout_admin',
  keys: [SESSION_SECRET],
  maxAge: SESSION_DURATION_MS,
  httpOnly: true,
  sameSite: 'strict',
  secure: IS_PRODUCTION,
  path: '/'
}));

function sameOrigin(req, res, next) {
  const origin = req.get('origin');
  const expectedOrigin = `${req.protocol}://${req.get('host')}`;
  if (!origin || origin !== expectedOrigin) {
    return res.status(403).json({ error: 'Solicitud rechazada por validación de origen.' });
  }
  next();
}

function safeEqual(a, b) {
  const hashA = crypto.createHash('sha256').update(String(a)).digest();
  const hashB = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(hashA, hashB);
}

function requireAdmin(req, res, next) {
  const session = req.session;
  if (!session || session.authenticated !== true || session.adminUser !== ADMIN_USER ||
      !Number.isFinite(session.expiresAt) || Date.now() > session.expiresAt) {
    req.session = null;
    return res.status(401).json({ error: 'Tu sesión venció. Iniciá sesión nuevamente.' });
  }
  next();
}

async function readServices() {
  let raw;
  try {
    raw = await fs.readFile(SERVICES_FILE, 'utf8');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    // En alojamientos con disco persistente, el disco comienza vacío. Copiamos
    // los servicios iniciales desde un archivo que queda fuera del punto de montaje.
    const seedPath = path.join(__dirname, 'services.default.json');
    const seedRaw = await fs.readFile(seedPath, 'utf8');
    const seed = JSON.parse(seedRaw);
    if (!Array.isArray(seed)) throw new Error('El archivo inicial de servicios no contiene una lista válida.');
    await fs.mkdir(DATA_DIR, { recursive: true });
    try {
      await fs.writeFile(SERVICES_FILE, `${JSON.stringify(seed, null, 2)}\n`, { encoding: 'utf8', flag: 'wx', mode: 0o600 });
      raw = await fs.readFile(SERVICES_FILE, 'utf8');
    } catch (writeError) {
      // Si dos solicitudes iniciales compiten, usamos el archivo creado primero.
      if (writeError.code !== 'EEXIST') throw writeError;
      raw = await fs.readFile(SERVICES_FILE, 'utf8');
    }
  }
  const services = JSON.parse(raw);
  if (!Array.isArray(services)) throw new Error('El archivo de servicios no contiene una lista válida.');
  return services;
}

async function writeServices(services) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const tempFile = `${SERVICES_FILE}.${process.pid}.tmp`;
  await fs.writeFile(tempFile, `${JSON.stringify(services, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
  await fs.rename(tempFile, SERVICES_FILE);
}

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 6,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Demasiados intentos de acceso. Esperá 15 minutos y volvé a intentar.' }
});

app.get('/health', (_req, res) => res.status(200).json({ ok: true }));

app.get('/api/services', async (_req, res) => {
  try {
    res.set('Cache-Control', 'no-store');
    res.json(await readServices());
  } catch (error) {
    console.error('No se pudieron leer los servicios:', error.message);
    res.status(500).json({ error: 'No se pudieron cargar los servicios.' });
  }
});

app.post('/api/admin/login', sameOrigin, loginLimiter, (req, res) => {
  const username = req.body && req.body.username;
  const password = req.body && req.body.password;
  if (typeof username !== 'string' || typeof password !== 'string' || username.length > 80 || password.length > 200) {
    return res.status(400).json({ error: 'Ingresá un usuario y contraseña válidos.' });
  }
  const usernameOk = safeEqual(username, ADMIN_USER);
  const passwordOk = safeEqual(password, ADMIN_PASSWORD);
  if (!(usernameOk & passwordOk)) {
    return res.status(401).json({ error: 'Usuario o contraseña incorrectos.' });
  }
  req.session = {
    authenticated: true,
    adminUser: ADMIN_USER,
    expiresAt: Date.now() + SESSION_DURATION_MS
  };
  res.json({ ok: true, expiresInMinutes: 120 });
});

app.post('/api/admin/logout', sameOrigin, requireAdmin, (req, res) => {
  req.session = null;
  res.clearCookie('blackout_admin', { path: '/' });
  res.json({ ok: true });
});

app.get('/api/admin/services', requireAdmin, async (_req, res) => {
  try {
    res.set('Cache-Control', 'no-store');
    res.json({ services: await readServices() });
  } catch (error) {
    console.error('No se pudieron leer los servicios para administración:', error.message);
    res.status(500).json({ error: 'No se pudieron cargar los servicios para edición.' });
  }
});

app.put('/api/admin/services', sameOrigin, requireAdmin, async (req, res) => {
  try {
    const current = await readServices();
    const submitted = req.body && req.body.services;
    if (!Array.isArray(submitted) || submitted.length !== current.length) {
      return res.status(400).json({ error: 'La lista de servicios no tiene el formato esperado.' });
    }

    const submittedById = new Map();
    for (const item of submitted) {
      if (!item || typeof item.id !== 'string' || submittedById.has(item.id)) {
        return res.status(400).json({ error: 'Hay un servicio inválido o duplicado.' });
      }
      submittedById.set(item.id, item);
    }

    const sanitized = [];
    for (const original of current) {
      const item = submittedById.get(original.id);
      if (!item) return res.status(400).json({ error: 'No se puede agregar o quitar servicios desde este panel.' });
      if (typeof item.title !== 'string' || item.title.trim().length < 2 || item.title.trim().length > 80) {
        return res.status(400).json({ error: `El título del servicio ${original.id} debe tener entre 2 y 80 caracteres.` });
      }
      if (typeof item.description !== 'string' || item.description.trim().length < 5 || item.description.trim().length > 300) {
        return res.status(400).json({ error: `La descripción del servicio ${original.id} debe tener entre 5 y 300 caracteres.` });
      }
      if (typeof item.quote !== 'boolean') {
        return res.status(400).json({ error: `El tipo de precio del servicio ${original.id} no es válido.` });
      }
      let price = null;
      if (!item.quote) {
        if (!Number.isSafeInteger(item.price) || item.price < 1 || item.price > 1000000000) {
          return res.status(400).json({ error: `El precio del servicio ${original.id} debe ser un entero entre 1 y 1.000.000.000.` });
        }
        price = item.price;
      }
      sanitized.push({
        id: original.id,
        title: item.title.trim(),
        description: item.description.trim(),
        price,
        quote: item.quote
      });
    }

    await writeServices(sanitized);
    res.set('Cache-Control', 'no-store');
    res.json({ ok: true, services: sanitized });
  } catch (error) {
    console.error('No se pudieron guardar los servicios:', error.message);
    res.status(500).json({ error: 'No se pudieron guardar los cambios. Revisá los permisos del proyecto.' });
  }
});

app.get('/admin', (_req, res) => res.redirect('/admin.html'));
app.use(express.static(PUBLIC_DIR, { dotfiles: 'ignore', index: 'index.html', etag: true }));
app.use((req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'Ruta API inexistente.' });
  res.status(404).send('No se encontró esa página. <a href="/">Volver al inicio</a>');
});
app.use((error, _req, res, _next) => {
  console.error('Error del servidor:', error.message);
  res.status(500).json({ error: 'Ocurrió un error interno del servidor.' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`BLACKOUT disponible en http://localhost:${PORT}`);
  console.log(`Panel de administración: http://localhost:${PORT}/admin`);
  if (IS_PRODUCTION) console.log('Modo producción: asegurate de servir el sitio por HTTPS.');
});
