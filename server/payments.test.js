const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createPayments } = require('./payments');
const id = 'qs_' + 'a'.repeat(24);
const config = { PUBLIC_ORIGIN: 'https://store.example', SSLCOMMERZ_MODE: 'sandbox', SSLCOMMERZ_STORE_ID: 'store', SSLCOMMERZ_STORE_PASSWORD: 'secret' };
const payment = { id, order_id: 'order', amount_bdt: 299, status: 'pending' };
function fixture({ env = config, records = [], result = {}, existing, network = false, mailFail = false } = {}) {
  const calls = [];
  const db = async (path, options) => {
    calls.push({ path, options });
    if (path === 'rpc/quicksub_start_payment') return existing || { ...payment, id: options.body.p_id };
    if (path.includes('status=in.')) return records;
    if (path.startsWith('quicksub_payment_mail?')) return options ? null : [{ id: 1, email: 'buyer@example.test', subject: 'Receipt', message: 'Paid' }];
    return [payment];
  };
  const api = createPayments({ db, env, fetchImpl: async url => {
    if (network) throw Error('private upstream error');
    if (url.includes('resend.com')) return new Response('{}', { status: mailFail ? 503 : 200 });
    return new Response(JSON.stringify(result), { status: 200 });
  } });
  return { api, calls };
}
const customer = { email: 'buyer@example.test', phone: '01712345678' };
const order = { id: 'order', product_name: 'Product', package_name: 'Package', customer_name: 'Buyer' };
test('Checkout failure modes never manufacture confirmation or blindly create another session', async () => {
  assert.equal(fixture({ env: {} }).api.enabled, false);
  await assert.rejects(fixture({ env: {} }).api.start(order, customer), /not configured/);
  await assert.rejects(fixture().api.start(order, { ...customer, email: 'bad' }), /valid receipt/);
  await assert.rejects(fixture().api.start(order, { ...customer, phone: 'bad' }), /valid receipt/);
  await assert.rejects(fixture({ network: true }).api.start(order, customer), /provider unavailable/);
  await assert.rejects(fixture({ result: { status: 'FAILED' } }).api.start(order, customer), /Unable to start/);
  await assert.rejects(fixture({ result: {} }).api.start(order, customer), /confirmation pending/);
  await assert.rejects(fixture({ result: { status: 'SUCCESS', GatewayPageURL: 'https://evil.example' } }).api.start(order, customer), /Invalid checkout/);
  await assert.rejects(fixture({ existing: payment }).api.start(order, customer), /awaiting confirmation/);
  await assert.rejects(fixture().api.get('invalid'), /Invalid payment/);
  assert.equal((await fixture().api.get(id)).id, id);
  const api = createPayments({ db: async () => [], env: config });
  await assert.rejects(api.get(id), /not found/);
});
test('Reconciliation distinguishes failed, cancelled, unknown, risky and unavailable transactions', async () => {
  for (const status of ['FAILED','CANCELLED']) {
    const f = fixture({ result: { APIConnect: 'DONE', element: [{ tran_id: id, status }] } });
    await f.api.reconcile(payment);
    assert.equal(f.calls.find(c => c.path === 'rpc/quicksub_settle_payment').options.body.p_status, status.toLowerCase());
  }
  const unknown = fixture({ result: { APIConnect: 'DONE', element: [] } });
  await unknown.api.reconcile(payment);
  assert.equal(unknown.calls.some(c => c.path === 'rpc/quicksub_settle_payment'), false);
  await assert.rejects(fixture().api.reconcile(payment), /verification pending/);
  await assert.rejects(fixture({ result: { APIConnect: 'DONE', element: [{ tran_id: id, status: 'VALID', val_id: '../bad' }] } }).api.reconcile(payment), /Invalid validation/);
  await fixture().api.reconcile({ ...payment, status: 'review' });
  const valid = { status: 'VALIDATED', tran_id: id, amount: 299, currency: 'BDT', bank_tran_id: 'bank', risk_level: '1' };
  assert.equal(fixture().api.validate(valid, payment), 'review');
  assert.equal(fixture().api.validate({ ...valid, risk_level: '0' }, payment), 'verified');
});
test('Worker retains failed emails for retry and continues after provider outages', async () => {
  const env = { ...config, RESEND_API_KEY: 'secret', PAYMENT_RECEIPT_FROM: 'receipts@example.test' };
  const f = fixture({ env, mailFail: true, records: [payment] });
  assert.deepEqual(await f.api.work(), { checked: 0, sent: 0, errors: 2 });
  assert.equal(f.calls.some(c => c.path.startsWith('quicksub_payment_mail') && c.options?.body?.sent_at), false);
  assert.deepEqual(await fixture().api.work(), { checked: 0, sent: 0, errors: 0 });
});
