/* ============================================================================
   Sentry · Server API tests (run: npm test)
   Uses a throwaway data folder.
   ============================================================================ */
import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.SENTRY_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'sentry-'));
const { default: server } = await import('../server/server');

let base;
test.before(() => new Promise<void>(ok => server.listen(0, () => { base = 'http://127.0.0.1:' + (server.address() as import('node:net').AddressInfo).port; ok(); })));
test.after(() => server.close());

async function call(method: string, p: string, body?: unknown, token?: string) {
  const r = await fetch(base + p, { method, headers: Object.assign({ 'Content-Type': 'application/json' }, token ? { Authorization: 'Bearer ' + token } : {}), body: body && JSON.stringify(body) });
  return { status: r.status, body: await r.json() };
}

test('register, save a document, read it back, log out', async () => {
  const reg = await call('POST', '/api/auth/register', { email: 'Priya@TUM.de', password: 'secret123' });
  assert.strictEqual(reg.status, 201);
  const t = reg.body.token;
  assert.strictEqual((await call('PUT', '/api/docs/profile', { name: 'Priya' }, t)).status, 200);
  const me = await call('GET', '/api/me', null, t);
  assert.strictEqual(me.body.user.email, 'priya@tum.de');
  assert.strictEqual(me.body.docs.profile.name, 'Priya');
  await call('POST', '/api/auth/logout', null, t);
  assert.strictEqual((await call('GET', '/api/me', null, t)).status, 401);
});

test('login checks the password; duplicates and weak passwords are refused', async () => {
  assert.strictEqual((await call('POST', '/api/auth/login', { email: 'priya@tum.de', password: 'nope-nope' })).status, 401);
  assert.strictEqual((await call('POST', '/api/auth/login', { email: 'priya@tum.de', password: 'secret123' })).status, 200);
  assert.strictEqual((await call('POST', '/api/auth/register', { email: 'priya@tum.de', password: 'secret123' })).status, 409);
  assert.strictEqual((await call('POST', '/api/auth/register', { email: 'x@y.com', password: 'short' })).status, 400);
});

test('users cannot touch unknown documents or each other’s data', async () => {
  const a = (await call('POST', '/api/auth/register', { email: 'a@a.com', password: 'password1' })).body.token;
  const b = (await call('POST', '/api/auth/register', { email: 'b@b.com', password: 'password1' })).body.token;
  assert.ok((await call('PUT', '/api/docs/../../etc', {}, a)).status >= 400);
  assert.strictEqual((await call('PUT', '/api/docs/secrets', {}, a)).status, 400);
  await call('PUT', '/api/docs/loans', { items: [1] }, a);
  assert.deepStrictEqual((await call('GET', '/api/me', null, b)).body.docs, {});
});

test('delete account removes the user', async () => {
  const t = (await call('POST', '/api/auth/register', { email: 'gone@x.com', password: 'password1' })).body.token;
  assert.strictEqual((await call('DELETE', '/api/account', null, t)).status, 200);
  assert.strictEqual((await call('POST', '/api/auth/login', { email: 'gone@x.com', password: 'password1' })).status, 401);
});

test('mock bank: connect, fetch a feed, revoke consent', async () => {
  const t = (await call('POST', '/api/auth/register', { email: 'bank@x.com', password: 'password1' })).body.token;
  const inst = await call('GET', '/api/bank/institutions?code=GBP', null, t);
  assert.ok(inst.body.abroad.length && inst.body.india.length);
  const c = await call('POST', '/api/bank/connections', { bankId: 'monzo', currencyCode: 'GBP' }, t);
  assert.strictEqual(c.status, 201);
  const id = c.body.connection.id;
  const f = await call('POST', '/api/bank/connections/' + id + '/statement', { from: '2026-09-01', to: '2026-09-10', student: { currencyCode: 'GBP', budgets: { grocery: 400 } } }, t);
  assert.ok(Array.isArray(f.body.lines) && f.body.lines.length > 0);
  assert.strictEqual(f.body.balance.currency, 'GBP');
  assert.strictEqual(typeof f.body.balance.current, 'number');
  assert.strictEqual((await call('DELETE', '/api/bank/connections/' + id, null, t)).status, 200);
  assert.strictEqual((await call('POST', '/api/bank/connections/' + id + '/statement', { from: '2026-09-01', to: '2026-09-10' }, t)).status, 404);
});
