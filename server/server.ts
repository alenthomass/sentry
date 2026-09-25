/* ============================================================================
   Sentry · Server (Node 18+)
   Serves the built app from dist/ (or through Vite with --dev) and provides:
     accounts      register / sign in / demo / sign out / delete account
     documents     each user's saved JSON documents
     live rates    ECB reference rates through frankfurter.app (cached 1 h)
     mock banks    connect, fetch a statement, revoke consent
   Passwords are hashed with scrypt. Data lives in server/data/db.json.
   ============================================================================ */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { banksFor, createBankConnection, fetchBankBalance, fetchBankStatement } from '../src/modules/banking/mock-bank';
import { addMonths, startOfToday, toIsoDate } from '../src/shared/dates';

const SERVER_FOLDER = path.dirname(fileURLToPath(import.meta.url));
const DEV_MODE = process.argv.includes('--dev');

// ── START: Settings ────────────────────────────────────────────────────────
const PORT = Number(process.env.PORT) || 3000;
const PUBLIC_FOLDER = path.join(SERVER_FOLDER, '..', 'dist');
const DATA_FOLDER = process.env.SENTRY_DATA_DIR || path.join(SERVER_FOLDER, 'data');
const DATABASE_FILE = path.join(DATA_FOLDER, 'db.json');
const SESSION_DAYS = 30;
const MAX_BODY_BYTES = 512 * 1024;
const ALLOWED_DOCUMENTS = /^(profile|remits|loans|history|ledger-\d{4}-\d{2})$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const LIVE_RATE_CURRENCIES = ['GBP', 'USD', 'CAD', 'AUD', 'EUR'];
const CONTENT_TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' };
// ── END: Settings ──────────────────────────────────────────────────────────


// ── START: Database file ───────────────────────────────────────────────────
let database: { users: Record<string, any>; sessions: Record<string, any>; documents: Record<string, any>; bankConnections: Record<string, any> } = { users: {}, sessions: {}, documents: {}, bankConnections: {} };
let saveTimer = null;

function loadDatabase() {
  try {
    database = Object.assign(database, JSON.parse(fs.readFileSync(DATABASE_FILE, 'utf8')));
  } catch (error) {
    if (error.code === 'ENOENT') return;
    console.error('Could not read', DATABASE_FILE, error.message);
    process.exit(1);
  }
}

function saveDatabase() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(function () {
    fs.mkdirSync(DATA_FOLDER, { recursive: true });
    const temporaryFile = DATABASE_FILE + '.tmp';
    fs.writeFileSync(temporaryFile, JSON.stringify(database));
    fs.renameSync(temporaryFile, DATABASE_FILE);
  }, 50);
}
// ── END: Database file ─────────────────────────────────────────────────────


// ── START: Passwords and sessions ──────────────────────────────────────────
function hashPassword(password, salt) {
  return new Promise(function (resolve, reject) {
    crypto.scrypt(password, salt, 64, { N: 16384, r: 8, p: 1 }, function (error, key) {
      if (error) reject(error);
      else resolve(key.toString('hex'));
    });
  });
}

function sameHash(first, second) {
  const a = Buffer.from(first, 'hex');
  const b = Buffer.from(second, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function startSession(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  database.sessions[token] = { userId: userId, expires: Date.now() + SESSION_DAYS * 86400000 };
  saveDatabase();
  return token;
}

function publicUser(user) {
  return { id: user.id, email: user.email };
}

function signedInUser(request) {
  const match = /^Bearer ([a-f0-9]{64})$/.exec(request.headers.authorization || '');
  const session = match && database.sessions[match[1]];
  if (!session) return null;
  if (session.expires < Date.now()) {
    delete database.sessions[match[1]];
    saveDatabase();
    return null;
  }
  const user = Object.values(database.users).find(function (item) { return item.id === session.userId; });
  return user ? { user: user, token: match[1] } : null;
}

const recentAttempts = new Map();
function tooManyAttempts(request) {
  const address = request.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const attempts = (recentAttempts.get(address) || []).filter(function (time) { return now - time < 60000; });
  attempts.push(now);
  recentAttempts.set(address, attempts);
  return attempts.length > 10;
}
// ── END: Passwords and sessions ────────────────────────────────────────────


// ── START: Live exchange rates ─────────────────────────────────────────────
const rateCache = {};

async function liveRates(currencyCode) {
  const cached = rateCache[currencyCode];
  if (cached && Date.now() - cached.fetchedAt < 3600000) return cached.data;
  const end = new Date();
  const start = new Date(end.getTime() - 45 * 86400000);
  const url = 'https://api.frankfurter.app/' + start.toISOString().slice(0, 10) + '..' + end.toISOString().slice(0, 10) + '?from=' + currencyCode + '&to=INR';
  const response = await fetch(url);
  if (!response.ok) throw new Error('Frankfurter ' + response.status);
  const body = await response.json();
  const days = Object.keys(body.rates || {}).sort();
  const closes = days.map(function (day) { return body.rates[day].INR; }).filter(Number.isFinite);
  if (closes.length < 10) throw new Error('Not enough rate history');
  const series = closes.slice(-31);
  while (series.length < 31) series.unshift(series[0]);
  const data = { code: currencyCode, rate: series[series.length - 1], asOf: days[days.length - 1], series: series, source: 'ECB via frankfurter.app' };
  rateCache[currencyCode] = { fetchedAt: Date.now(), data: data };
  return data;
}
// ── END: Live exchange rates ───────────────────────────────────────────────


// ── START: Request and response helpers ────────────────────────────────────
function reply(response, status, body) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  response.end(JSON.stringify(body));
}

function replyError(response, status, code, message) {
  reply(response, status, { code: code, error: message });
}

function readJsonBody(request): Promise<any> {
  return new Promise(function (resolve, reject) {
    let size = 0;
    const chunks = [];
    request.on('data', function (chunk) {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(Object.assign(new Error('Too large'), { status: 413 }));
        request.destroy();
      } else {
        chunks.push(chunk);
      }
    });
    request.on('end', function () {
      if (!chunks.length) return resolve({});
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); } catch (error) { reject(Object.assign(new Error('Invalid JSON'), { status: 400 })); }
    });
    request.on('error', reject);
  });
}

function serveFile(request, response) {
  let file = decodeURIComponent(new URL(request.url, 'http://local').pathname);
  if (file === '/') file = '/index.html';
  const fullPath = path.normalize(path.join(PUBLIC_FOLDER, file));
  if (!fullPath.startsWith(PUBLIC_FOLDER)) return replyError(response, 403, 'forbidden', 'Forbidden');
  fs.readFile(fullPath, function (error, contents) {
    if (error) return replyError(response, 404, 'not_found', 'Not found');
    response.writeHead(200, { 'Content-Type': CONTENT_TYPES[path.extname(fullPath)] || 'application/octet-stream', 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' });
    response.end(contents);
  });
}
// ── END: Request and response helpers ──────────────────────────────────────


// ── START: Account routes ──────────────────────────────────────────────────
async function registerOrSignIn(request, response, isRegistering) {
  if (tooManyAttempts(request)) return replyError(response, 429, 'rate_limited', 'Too many attempts. Wait a minute and try again.');
  const body = await readJsonBody(request);
  const email = String(body.email || '').trim().toLowerCase();
  const password = String(body.password || '');
  if (!EMAIL_PATTERN.test(email)) return replyError(response, 400, 'bad_email', 'That email address doesn’t look right.');

  if (isRegistering) {
    if (password.length < 8) return replyError(response, 400, 'weak_password', 'Choose a password of at least 8 characters.');
    if (database.users[email]) return replyError(response, 409, 'exists', 'An account with this email already exists. Sign in instead.');
    const salt = crypto.randomBytes(16).toString('hex');
    const user = { id: crypto.randomUUID(), email: email, salt: salt, hash: await hashPassword(password, salt), createdAt: new Date().toISOString() };
    database.users[email] = user;
    database.documents[user.id] = {};
    saveDatabase();
    return reply(response, 201, { token: startSession(user.id), user: publicUser(user) });
  }

  const user = database.users[email];
  const passwordMatches = user && !user.demo && sameHash(await hashPassword(password, user.salt), user.hash);
  if (!passwordMatches) return replyError(response, 401, 'bad_login', 'That email and password don’t match an account.');
  return reply(response, 200, { token: startSession(user.id), user: publicUser(user) });
}

function openDemo(response) {
  let user = database.users['demo@sentry.app'];
  if (!user) {
    user = { id: 'demo', email: 'demo@sentry.app', demo: true, createdAt: new Date().toISOString() };
    database.users[user.email] = user;
    database.documents[user.id] = {};
  }
  const connections = database.bankConnections[user.id] || (database.bankConnections[user.id] = {});
  [createBankConnection(banksFor('GBP').abroad[0].id, 'GBP', 'demo01'), createBankConnection('hdfc', 'GBP', 'demo02')].forEach(function (connection) {
    if (!connections[connection.id]) connections[connection.id] = connection;
  });
  saveDatabase();
  reply(response, 200, { token: startSession(user.id), user: publicUser(user) });
}

function deleteUser(response, user) {
  delete database.documents[user.id];
  delete database.bankConnections[user.id];
  delete database.users[user.email];
  Object.keys(database.sessions).forEach(function (token) {
    if (database.sessions[token].userId === user.id) delete database.sessions[token];
  });
  saveDatabase();
  reply(response, 200, { ok: true });
}
// ── END: Account routes ────────────────────────────────────────────────────


// ── START: Document routes ─────────────────────────────────────────────────
async function handleDocument(request, response, documents, documentId) {
  if (!ALLOWED_DOCUMENTS.test(documentId)) return replyError(response, 400, 'bad_document', 'Unknown document');
  if (request.method === 'PUT') {
    const body = await readJsonBody(request);
    if (!body || typeof body !== 'object' || Array.isArray(body)) return replyError(response, 400, 'bad_body', 'Document must be a JSON object');
    documents[documentId] = body;
    saveDatabase();
    return reply(response, 200, { ok: true });
  }
  if (request.method === 'DELETE') {
    delete documents[documentId];
    saveDatabase();
    return reply(response, 200, { ok: true });
  }
  replyError(response, 405, 'method', 'Method not allowed');
}
// ── END: Document routes ───────────────────────────────────────────────────


// ── START: Mock bank routes ────────────────────────────────────────────────
async function handleBanks(request, response, url, user) {
  const connections = database.bankConnections[user.id] || (database.bankConnections[user.id] = {});

  if (request.method === 'GET' && url.pathname === '/api/bank/institutions') {
    return reply(response, 200, banksFor(String(url.searchParams.get('code') || 'GBP').toUpperCase()));
  }

  if (request.method === 'POST' && url.pathname === '/api/bank/connections') {
    const body = await readJsonBody(request);
    try {
      const connection = createBankConnection(String(body.bankId || ''), String(body.currencyCode || 'GBP').toUpperCase(), crypto.randomBytes(4).toString('hex'));
      connections[connection.id] = connection;
      saveDatabase();
      return reply(response, 201, { connection: connection });
    } catch (error) {
      return replyError(response, 400, 'bad_bank', error.message);
    }
  }

  const match = /^\/api\/bank\/connections\/([\w-]+)(\/statement)?$/.exec(url.pathname);
  if (!match) return replyError(response, 404, 'not_found', 'Not found');
  const connection = connections[match[1]];
  if (!connection) return replyError(response, 404, 'no_connection', 'Bank connection not found or consent revoked');

  if (request.method === 'DELETE' && !match[2]) {
    delete connections[match[1]];
    saveDatabase();
    return reply(response, 200, { ok: true });
  }

  if (request.method === 'POST' && match[2]) {
    const body = await readJsonBody(request);
    if (!DATE_PATTERN.test(body.from || '') || !DATE_PATTERN.test(body.to || '') || body.from > body.to) {
      return replyError(response, 400, 'bad_range', 'from and to must be YYYY-MM-DD dates');
    }
    const earliestAllowed = toIsoDate(addMonths(startOfToday(), -12));
    const from = body.from < earliestAllowed ? earliestAllowed : body.from;
    const student = body.student || {};
    let balance = null;
    try { balance = fetchBankBalance(connection, body.to, student); } catch (error) { balance = null; }
    return reply(response, 200, { lines: fetchBankStatement(connection, from, body.to, student), balance: balance });
  }

  replyError(response, 405, 'method', 'Method not allowed');
}
// ── END: Mock bank routes ──────────────────────────────────────────────────


// ── START: Router ──────────────────────────────────────────────────────────
async function handleRequest(request, response) {
  const url = new URL(request.url, 'http://local');
  const route = request.method + ' ' + url.pathname;

  if (!url.pathname.startsWith('/api/')) {
    if (request.method === 'GET') return serveFile(request, response);
    return replyError(response, 405, 'method', 'Method not allowed');
  }

  if (route === 'GET /api/health') return reply(response, 200, { ok: true, app: 'sentry' });
  if (route === 'POST /api/auth/register') return registerOrSignIn(request, response, true);
  if (route === 'POST /api/auth/login') return registerOrSignIn(request, response, false);
  if (route === 'POST /api/auth/demo') return openDemo(response);

  if (route === 'GET /api/fx') {
    const code = String(url.searchParams.get('code') || '').toUpperCase();
    if (LIVE_RATE_CURRENCIES.indexOf(code) < 0) return replyError(response, 400, 'bad_code', 'Unsupported currency');
    try { return reply(response, 200, await liveRates(code)); } catch (error) { return replyError(response, 502, 'fx_unavailable', 'Live FX unavailable: ' + error.message); }
  }

  const session = signedInUser(request);
  if (!session) return replyError(response, 401, 'signed_out', 'Please sign in again.');
  const user = session.user;
  const documents = database.documents[user.id] || (database.documents[user.id] = {});

  if (route === 'POST /api/auth/logout') {
    delete database.sessions[session.token];
    saveDatabase();
    return reply(response, 200, { ok: true });
  }
  if (route === 'GET /api/me') return reply(response, 200, { user: publicUser(user), docs: documents });
  if (route === 'DELETE /api/account') return deleteUser(response, user);

  const documentMatch = /^\/api\/docs\/([^/]+)$/.exec(url.pathname);
  if (documentMatch) return handleDocument(request, response, documents, decodeURIComponent(documentMatch[1]));
  if (url.pathname.startsWith('/api/bank/')) return handleBanks(request, response, url, user);

  replyError(response, 404, 'not_found', 'Not found');
}
// ── END: Router ────────────────────────────────────────────────────────────


// ── START: Start the server ────────────────────────────────────────────────
loadDatabase();
let vite: import('vite').ViteDevServer | null = null;
const server = http.createServer(function (request, response) {
  const isApi = (request.url || '').startsWith('/api/');
  if (vite && !isApi) return vite.middlewares(request, response);
  handleRequest(request, response).catch(function (error) {
    replyError(response, error.status || 500, 'error', error.status ? error.message : 'Server error');
  });
});

const startedDirectly = !!process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (startedDirectly) {
  if (DEV_MODE) {
    const { createServer } = await import('vite');
    vite = await createServer({ root: path.join(SERVER_FOLDER, '..'), server: { middlewareMode: true, hmr: { server } }, appType: 'spa' });
  }
  server.listen(PORT, function () {
    console.log('Sentry running on http://localhost:' + PORT + (DEV_MODE ? '  (dev: live reload)' : '') + '  (data: ' + DATABASE_FILE + ')');
  });
}

export default server;
// ── END: Start the server ──────────────────────────────────────────────────
