import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, randomBytes } from 'node:crypto';
import { startTestServer, packageId } from './admin-test-server.mjs';

test('Gateway lifecycle with real PostgreSQL, authenticated routes and simulated provider', async t => {
  const provider = new Map(); let initiated = 0, mails = 0, bad = null;
  const env = await startTestServer({ paymentEnv: {
    PUBLIC_ORIGIN: 'https://shop.example', SSLCOMMERZ_MODE: 'sandbox', SSLCOMMERZ_STORE_ID: 'merchant', SSLCOMMERZ_STORE_PASSWORD: 'secret', PAYMENT_JOB_SECRET: 'job-secret', RESEND_API_KEY: 'mail-secret', PAYMENT_RECEIPT_FROM: 'receipts@example.test',
  }, paymentFetch: async (url, options) => {
    const u = new URL(url), params = options.method === 'POST' && u.hostname.includes('sslcommerz') ? new URLSearchParams(options.body) : u.searchParams;
    const response = x => new Response(JSON.stringify(x), { headers: { 'content-type': 'application/json' } });
    if (u.hostname === 'api.resend.com') { mails++; return response({ id: 'mail' }); }
    assert.equal(params.get('store_id'), 'merchant');
    assert.equal(params.get('store_passwd'), 'secret');
    if (u.pathname.endsWith('/api.php')) {
      initiated++; const id = params.get('tran_id'); assert.equal(params.get('total_amount'), '299.00');
      provider.set(id, { tran_id: id, val_id: id, status: 'PENDING', amount: '299.00', currency: 'BDT', risk_level: '0', bank_tran_id: 'bank-' + id });
      return response({ status: 'SUCCESS', GatewayPageURL: 'https://sandbox.sslcommerz.com/pay/' + id });
    }
    if (u.pathname.includes('merchantTransID')) return response({ APIConnect: 'DONE', element: [provider.get(params.get('tran_id'))] });
    return response({ ...provider.get(params.get('val_id')), ...(bad || {}) });
  } });
  t.after(() => env.close());
  async function call(path, body, cookie = '', headers = {}) {
    const res = await fetch(env.base + '/api' + path, { method: body === undefined ? 'GET' : 'POST', headers: { 'Content-Type': 'application/json', Origin: env.base, 'X-QuickSub-Client': 'web', Cookie: cookie, ...headers }, body: body === undefined ? undefined : JSON.stringify(body), redirect: 'manual' });
    return { status: res.status, body: res.headers.get('content-type')?.includes('application/json') ? await res.json() : null, cookie: res.headers.get('set-cookie')?.split(';')[0], location: res.headers.get('location') };
  }
  async function order() {
    const credentials = { id: randomUUID(), accessCode: randomBytes(32).toString('hex') };
    assert.equal((await call('/orders', { ...credentials, packageId, name: 'Buyer', contact: 'buyer@example.test', note: '', expectedPrice: 299 })).status, 201);
    return credentials;
  }
  const c = await order();
  assert.equal((await call('/payments/config')).body.enabled, true);
  assert.equal((await call('/orders/checkout', { ...c, accessCode: '0'.repeat(64), email: 'buyer@example.test', phone: '01712345678' })).status, 404);
  const checkout = await call('/orders/checkout', { ...c, email: 'buyer@example.test', phone: '01712345678', amount: 1 });
  assert.equal(checkout.status, 200);
  const id = checkout.body.url.split('/').pop();
  assert.equal((await call('/orders/checkout', { ...c, email: 'buyer@example.test', phone: '01712345678' })).body.url, checkout.body.url);
  assert.equal(initiated, 1);
  assert.equal((await call('/orders/payment', { ...c, reference: 'bKash-1234' })).status, 409);
  assert.equal((await call('/payments/return', { tran_id: id, status: 'VALID' })).status, 303);
  assert.equal((await call('/orders/track', c)).body.order.payment_status, 'unpaid');
  provider.get(id).status = 'VALID';
  for (const mismatch of [{ amount: '1' }, { currency: 'USD' }, { tran_id: 'wrong' }, { store_id: 'wrong' }, { bank_tran_id: '' }]) {
    bad = mismatch;
    assert.equal((await call('/payments/ipn', { tran_id: id, val_id: id }, '', { Origin: 'https://provider.example' })).status, 409);
  }
  bad = null;
  assert.equal((await call('/payments/ipn', { tran_id: id, val_id: id }, '', { Origin: 'https://provider.example' })).status, 200);
  assert.equal((await call('/payments/ipn', { tran_id: id, val_id: id })).status, 200);
  assert.equal((await call('/orders/track', c)).body.order.payment_status, 'verified');
  assert.equal((await env.db.query('select count(*) as n from quicksub_payment_mail')).rows[0].n, 1);
  assert.equal((await call('/payments/jobs', {})).status, 401);
  assert.equal((await call('/payments/jobs', {}, '', { Authorization: 'Bearer job-secret' })).body.sent, 1);
  assert.equal((await call('/payments/jobs', {}, '', { Authorization: 'Bearer job-secret' })).body.sent, 0);
  assert.equal(mails, 1);
  assert.equal((await call('/admin/payments/' + c.id)).status, 401);
  const admin = await call('/admin/login', { email: 'owner@example.test', password: 'test-password' });
  assert.equal((await call('/admin/payments/' + c.id, undefined, admin.cookie)).body.payments.length, 1);
  assert.equal((await call('/admin/payments/' + id + '/refund', { status: 'completed', reference: '' }, admin.cookie)).status, 409);
  assert.equal((await call('/admin/payments/' + id + '/refund', { status: 'pending', reference: '' }, admin.cookie)).status, 200);
  await assert.rejects(env.db.query("update quicksub_orders set status='processing' where id=$1", [c.id]));
  assert.equal((await call('/admin/payments/' + id + '/refund', { status: 'completed', reference: 'refund-1234', note: 'Private staff note' }, admin.cookie)).status, 200);
  assert.equal((await call('/orders/track', c)).body.order.payment_status, 'refunded');
  assert.equal((await call('/orders/payments', c)).body.payments[0].refund_note, undefined);
  assert.equal((await call('/payments/ipn', { tran_id: id, val_id: id })).status, 200);
  assert.equal((await call('/orders/track', c)).body.order.payment_status, 'refunded');
  assert.deepEqual((await call('/admin/payment-search?reference=' + id, undefined, admin.cookie)).body.orders, [c.id]);
  assert.deepEqual((await call('/admin/payment-search?reference=bank-' + id, undefined, admin.cookie)).body.orders, [c.id]);
  assert.equal((await call('/admin/payments/not-an-id', undefined, admin.cookie)).status, 400);
  assert.equal((await call('/admin/payments/' + id + '/check', {}, admin.cookie)).status, 200);
  const risky = await order();
  const riskCheckout = await call('/orders/checkout', { ...risky, email: 'buyer@example.test', phone: '01712345678' });
  const riskId = riskCheckout.body.url.split('/').pop();
  provider.get(riskId).status = 'VALID'; provider.get(riskId).risk_level = '1';
  const checked = await call('/orders/payments/check', risky);
  assert.equal(checked.status, 200);
  assert.equal(checked.body.order.payment_status, 'unpaid');
  assert.equal(checked.body.payments[0].status, 'review');
  const staff = await call('/admin/login', { email: 'staff@example.test', password: 'test-password' });
  assert.equal((await call('/admin/payments/' + riskId + '/approve', { note: 'Confirmed risk with provider' }, staff.cookie)).status, 403);
  assert.equal((await call('/admin/payments/' + riskId + '/approve', { note: 'Confirmed risk with provider' }, admin.cookie)).status, 200);
  assert.equal((await call('/orders/track', risky)).body.order.payment_status, 'verified');
  assert.equal((await call('/admin/payments/' + riskId + '/refund', { status: 'unknown' }, admin.cookie)).status, 400);
  for (const role of ['anon','authenticated']) {
    await env.db.exec('set role ' + role);
    await assert.rejects(env.db.query('select * from quicksub_payments'));
    await assert.rejects(env.db.query('select * from quicksub_payment_mail'));
    await assert.rejects(env.db.query('select quicksub_start_payment($1,$2,$3)', [risky.id,'unauthorized','buyer@example.test']));
    await env.db.exec('reset role');
  }
});

test('Database settlement preserves late and duplicate money without double fulfillment', async t => {
  const env = await startTestServer(); t.after(() => env.close());
  const order = randomUUID();
  await env.db.query('select quicksub_create_order($1,$2,$3,$4,$5,$6,$7)', [order, 'a'.repeat(64), packageId, 'Buyer','buyer@example.test','',299]);
  const start = id => env.db.query('select quicksub_start_payment($1,$2,$3)', [order,id,'buyer@example.test']);
  const settle = (id,status,ref = null) => env.db.query('select quicksub_settle_payment($1,$2,$3)', [id,status,ref]);
  await start('one'); await settle('one','failed'); await start('two');
  await settle('one','verified','bank-one');
  assert.equal((await env.db.query("select status from quicksub_payments where id='one'")).rows[0].status, 'review');
  await settle('two','verified','bank-two');
  assert.equal((await env.db.query('select payment_status from quicksub_orders where id=$1',[order])).rows[0].payment_status, 'unpaid');
  assert.equal((await env.db.query("select count(*) as n from quicksub_payments where status='review'")).rows[0].n, 2);
  await assert.rejects(start('three'));
  await assert.rejects(env.db.query("update quicksub_orders set payment_status='verified', payment_reference='manual' where id=$1", [order]));
});
