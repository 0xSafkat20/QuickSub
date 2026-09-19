import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, randomBytes } from 'node:crypto';
import { startTestServer } from './admin-test-server.mjs';

test('Demo packages are explicit, never override real packages, and cannot create paid orders', async t => {
  const env = await startTestServer({ demoCheckout: true }); t.after(() => env.close());
  const get = async path => (await fetch(env.base + '/api' + path)).json();
  const real = await get('/packages/1');
  assert.equal(real.packages.length, 1); assert.equal(real.packages[0].demo, undefined);
  const demo = await get('/packages/3');
  assert.deepEqual(demo.packages.map(p => p.price_bdt), [120,600,1200]);
  assert.ok(demo.packages.every(p => p.demo === true && p.id.startsWith('demo-')));
  await env.db.query("update quicksub_products set in_stock=false where id='3'");
  assert.deepEqual((await get('/packages/3')).packages, []);
  assert.deepEqual((await get('/packages/unknown')).packages, []);
  const response = await fetch(env.base + '/api/orders', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: env.base, 'X-QuickSub-Client': 'web' }, body: JSON.stringify({ id: randomUUID(), accessCode: randomBytes(32).toString('hex'), packageId: demo.packages[0].id, name: 'Demo', contact: 'demo@example.test', note: '', expectedPrice: 120 }) });
  assert.equal(response.status, 400);
  assert.equal((await env.db.query('select count(*) as n from quicksub_orders')).rows[0].n, 0);
});
