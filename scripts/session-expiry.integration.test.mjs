import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, randomBytes } from 'node:crypto';
import { startTestServer, packageId } from './admin-test-server.mjs';

test('two-hour absolute sessions refresh at one hour and preserve orders/profile after expiry and re-login', async t => {
  const start = Date.now(); let clock = start;
  const env = await startTestServer({ now: () => clock });
  t.after(() => env.close());
  async function call(path, body, cookie = '') {
    const response = await fetch(env.base + '/api' + path, { method: body === undefined ? 'GET' : 'POST',
      headers: { origin: env.base, 'x-quicksub-client': 'web', 'content-type': 'application/json', cookie },
      body: body === undefined ? undefined : JSON.stringify(body) });
    return { status: response.status, data: await response.json(), headers: response.headers, cookie: response.headers.get('set-cookie')?.split(';')[0] };
  }
  const credentials = { email: 'expiry@example.test', password: 'two-hour-password' };
  const signup = await call('/account/signup', { name: 'Saved Customer', ...credentials });
  assert.equal(signup.status, 200);
  assert.match(signup.headers.get('set-cookie'), /Max-Age=7200/);
  const cookie = signup.cookie;
  const deadline = signup.headers.get('x-quicksub-session-expires');
  assert.equal(Date.parse(deadline), start + 7200000);
  await call('/account/profile', { name: 'Saved Customer', contact: 'saved@example.test', renewal_reminders: false }, cookie);
  const payload = { id: randomUUID(), accessCode: randomBytes(32).toString('hex'), packageId, name: 'Saved Customer', contact: 'saved@example.test', note: 'Keep my order', expectedPrice: 299 };
  assert.equal((await call('/orders', payload, cookie)).status, 201);
  const admin = await call('/admin/login', { email: 'owner@example.test', password: 'test-password' });
  assert.match(admin.headers.get('set-cookie'), /Max-Age=7200/);
  clock = start + 3600001;
  const active = await call('/account/session', undefined, cookie);
  assert.equal(active.status, 200);
  assert.equal(active.headers.get('x-quicksub-session-expires'), deadline);
  assert.equal((await call('/admin/session', undefined, admin.cookie)).status, 200);
  const row = (await env.db.query('select token_expires_at, expires_at from quicksub_customer_sessions')).rows[0];
  assert.equal(new Date(row.expires_at).getTime(), start + 7200000);
  assert.ok(new Date(row.token_expires_at).getTime() > start + 3600000);
  clock = start + 7199999;
  assert.equal((await call('/account/orders', undefined, cookie)).status, 200);
  clock = start + 7200000;
  const expired = await call('/account/orders', undefined, cookie);
  assert.equal(expired.status, 401);
  assert.match(expired.headers.get('set-cookie'), /Expires=Thu, 01 Jan 1970/);
  assert.equal((await call('/admin/session', undefined, admin.cookie)).status, 401);
  assert.equal((await env.db.query('select count(*)::int as n from quicksub_orders where id=$1', [payload.id])).rows[0].n, 1);
  const login = await call('/account/login', credentials);
  assert.equal(login.status, 200);
  assert.notEqual(login.cookie, cookie);
  const restored = await call('/account/session', undefined, login.cookie);
  assert.equal(restored.data.profile.name, 'Saved Customer');
  assert.equal(restored.data.profile.contact, 'saved@example.test');
  assert.equal(restored.data.profile.renewal_reminders, false);
  assert.equal((await call('/account/orders', undefined, login.cookie)).data.orders[0].id, payload.id);
  assert.equal((await call('/account/orders', undefined, cookie)).status, 401);
  // New token columns retain the table's private permissions.
  for (const role of ['anon','authenticated']) {
    assert.equal((await env.db.query("select has_table_privilege($1,'quicksub_customer_sessions','select') as allowed", [role])).rows[0].allowed, false);
  }
});
