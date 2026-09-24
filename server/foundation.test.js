const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { run, errorHandler } = require('./http');
const { validateBody, authSchemas } = require('./validation');
const { createAdminRouter } = require('./admin');

test('auth schemas reject malformed bodies and privilege injection, preserving passwords', () => {
  for (const body of [null, [], 'text', {}, { email: 'bad', password: 'valid' }, { email: 'user@example.test', password: 'valid', role: 'owner' }]) {
    assert.throws(() => validateBody(body, authSchemas.login), { status: 400 });
  }
  const body = { email: 'user@example.test', password: ' padded password ' };
  validateBody(body, authSchemas.login);
  assert.equal(body.password, ' padded password ');
});

async function serve(t, app) {
  const server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  t.after(() => new Promise(resolve => server.close(resolve)));
  return 'http://127.0.0.1:' + server.address().port;
}

test('HTTP errors distinguish malformed bodies, oversized payloads and safe server errors', async t => {
  const app = express();
  app.use(express.json({ limit: '100b' }));
  app.post('/echo', (req, res) => res.json(req.body));
  app.get('/sync', run(() => { throw Error('secret database credentials'); }));
  app.get('/async', run(async () => { throw Error('secret upstream details'); }));
  app.use(errorHandler);
  const base = await serve(t, app);
  for (const [body, status] of [['{', 400], [JSON.stringify({ value: 'x'.repeat(200) }), 413]]) {
    const response = await fetch(base + '/echo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
    assert.equal(response.status, status);
    assert.equal(typeof (await response.json()).error, 'string');
  }
  for (const path of ['/sync', '/async']) {
    const response = await fetch(base + path);
    assert.equal(response.status, 500);
    assert.doesNotMatch(await response.text(), /secret|credentials|upstream/);
  }
});

test('invalid signup and unexpected admin login fields never reach the database or auth provider', async t => {
  let calls = 0;
  const app = express();
  app.use(express.json());
  app.use('/api', createAdminRouter({ url: 'https://test.example', key: 'secret', fetchImpl: async () => { calls++; throw Error('unexpected'); } }));
  const base = await serve(t, app);
  for (const [path, body] of [['/account/signup', { name: 'Customer', email: 'invalid', password: 'long-password' }], ['/admin/login', { email: 'admin@example.test', password: 'password', role: 'owner' }]]) {
    const response = await fetch(base + '/api' + path, { method: 'POST', headers: { Origin: base, 'Content-Type': 'application/json', 'X-QuickSub-Client': 'web' }, body: JSON.stringify(body) });
    assert.equal(response.status, 400);
    assert.ok((await response.json()).fields);
  }
  assert.equal(calls, 0);
});

test('malformed shared session expiry fails closed before provider authentication', async t => {
  const { installAdminAuth } = require('./auth');
  let providerCalls = 0;
  const app = express();
  const router = express.Router();
  installAdminAuth({ router, sharedSessions: true, now: Date.now, rate: () => {},
    db: async () => [{ user_id: 'user', token: 'secret', expires_at: 'invalid-date' }],
    remote: async () => { providerCalls++; return { id: 'user' }; },
  });
  router.get('/admin/session', (req, res) => res.json(req.admin));
  app.use(router);
  app.use(errorHandler);
  const base = await serve(t, app);
  const response = await fetch(base + '/admin/session', { headers: { Cookie: 'qs_admin=' + 'a'.repeat(64) } });
  assert.equal(response.status, 401);
  assert.equal(providerCalls, 0);
});
