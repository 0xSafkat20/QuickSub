import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { startTestServer, packageId } from './admin-test-server.mjs';

test('customer signup and login remain usable before the locale and loyalty migration is applied', async t => {
  const env = await startTestServer({ notificationMigration: false });
  t.after(() => env.close());
  let cookie = '';
  const request = async (path, body) => {
    const response = await fetch(env.base + '/api' + path, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { origin: env.base, 'content-type': 'application/json', 'x-quicksub-client': 'web', ...(cookie ? { cookie } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const setCookie = response.headers.get('set-cookie');
    if (setCookie) cookie = setCookie.split(';')[0];
    return { status: response.status, data: await response.json() };
  };
  const credentials = { name: 'Compatibility Customer', email: 'compatibility@example.test', password: 'compatibility-password-123', locale: 'bn-BD' };
  const signup = await request('/account/signup', credentials);
  assert.equal(signup.status, 200, JSON.stringify(signup.data));
  assert.equal((await request('/account/session')).data.profile.preferred_locale, 'en-BD');
  assert.equal((await request('/account/logout', {})).status, 200);
  const login = await request('/account/login', { email: credentials.email, password: credentials.password });
  assert.equal(login.status, 200);
  const session = await request('/account/session');
  assert.equal(session.status, 200);
  assert.equal(session.data.user.email, credentials.email);
  assert.equal(session.data.profile.preferred_locale, 'en-BD');
  const initialRewards = await request('/account/rewards');
  assert.equal(initialRewards.status, 200);
  assert.equal(initialRewards.data.balance, 0);
  assert.equal(initialRewards.data.programReady, false);
  const orderId = randomUUID();
  const order = await request('/orders', { id: orderId, accessCode: randomBytes(32).toString('hex'), packageId, name: credentials.name, contact: credentials.email, note: '', email: credentials.email, gameAccount: '', expectedPrice: 299, fromCart: false, points: 0 });
  assert.equal(order.status, 201);
  await env.db.query("update quicksub_orders set payment_status='verified',status='delivered' where id=$1", [orderId]);
  const earnedRewards = await request('/account/rewards');
  assert.equal(earnedRewards.status, 200);
  assert.equal(earnedRewards.data.balance, 29);
  assert.equal(earnedRewards.data.lifetimeEarned, 29);
  assert.equal(earnedRewards.data.transactions.length, 1);
});
