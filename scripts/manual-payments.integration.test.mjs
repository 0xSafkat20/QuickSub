import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { packageId, startTestServer } from './admin-test-server.mjs';

test('manual payment details are validated, fixed to the order total, and visible to admins', async t => {
  const env = await startTestServer();
  t.after(() => env.close());
  const request = async (path, { body, cookie = '', method = body === undefined ? 'GET' : 'POST' } = {}) => {
    const response = await fetch(env.base + '/api' + path, {
      method,
      headers: { Origin: env.base, 'X-QuickSub-Client': 'web', Cookie: cookie, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: response.status, body: await response.json(), cookie: response.headers.get('set-cookie')?.split(';')[0] || '' };
  };
  const credentials = { id: randomUUID(), accessCode: randomBytes(32).toString('hex') };
  assert.equal((await request('/orders', { body: { ...credentials, packageId, expectedPrice: 299, name: 'Wallet Buyer', contact: 'buyer@example.test', note: '' } })).status, 201);

  assert.equal((await request('/orders/payment', { body: { ...credentials, method: 'bkash', reference: 'ABC12345' } })).status, 400);
  assert.equal((await request('/orders/payment', { body: { ...credentials, method: 'visa', reference: 'ABC12345', phone: '01712345678' } })).status, 400);

  const submitted = await request('/orders/payment', { body: {
    ...credentials, method: 'bkash', reference: 'abc12345', phone: '01712 345678', amount: 1,
  } });
  assert.equal(submitted.status, 200);
  assert.equal(submitted.body.order.payment_status, 'submitted');
  assert.equal(submitted.body.order.payment_method, 'bKash');
  assert.equal(submitted.body.order.payment_reference, 'ABC12345');
  const stored = (await env.db.query('select * from quicksub_manual_payments where order_id=$1', [credentials.id])).rows[0];
  assert.equal(Number(stored.amount_bdt), 299);
  assert.equal(stored.payer_phone, '+8801712345678');
  assert.equal(stored.transaction_reference, 'ABC12345');

  const admin = await request('/admin/login', { body: { email: 'owner@example.test', password: 'test-password' } });
  const adminPayments = await request('/admin/manual-payments/' + credentials.id, { cookie: admin.cookie });
  assert.equal(adminPayments.status, 200);
  assert.equal(adminPayments.body.payments.length, 1);
  assert.equal(adminPayments.body.payments[0].payer_phone, '+8801712345678');

  const verified = await request('/admin/order/' + credentials.id, {
    cookie: admin.cookie,
    method: 'PUT',
    body: { status: 'processing', payment_status: 'verified', delivery_note: '' },
  });
  assert.equal(verified.status, 200);
  assert.equal((await env.db.query('select status from quicksub_manual_payments where order_id=$1', [credentials.id])).rows[0].status, 'verified');
});

test('bank transfer stores sender details without a full account or card number', async t => {
  const env = await startTestServer();
  t.after(() => env.close());
  const call = async (path, body) => {
    const response = await fetch(env.base + '/api' + path, { method: 'POST', headers: { Origin: env.base, 'X-QuickSub-Client': 'web', 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    return { status: response.status, body: await response.json() };
  };
  const credentials = { id: randomUUID(), accessCode: randomBytes(32).toString('hex') };
  await call('/orders', { ...credentials, packageId, expectedPrice: 299, name: 'Bank Buyer', contact: 'bank@example.test', note: '' });
  assert.equal((await call('/orders/payment', { ...credentials, method: 'bank_transfer', reference: 'BANK-7788', payerName: 'Bank Buyer', senderBank: 'Example Bank', accountLast4: '1234567890123456' })).status, 400);
  assert.equal((await call('/orders/payment', { ...credentials, method: 'bank_transfer', reference: 'BANK-7788', payerName: 'Bank Buyer', senderBank: 'Example Bank', accountLast4: '3456' })).status, 200);
  const row = (await env.db.query('select payer_name,sender_bank,account_last_four,payer_phone from quicksub_manual_payments where order_id=$1', [credentials.id])).rows[0];
  assert.deepEqual(row, { payer_name: 'Bank Buyer', sender_bank: 'Example Bank', account_last_four: '3456', payer_phone: null });
});
