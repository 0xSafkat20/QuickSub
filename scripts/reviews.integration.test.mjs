import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { startTestServer, packageId } from './admin-test-server.mjs';

const trusted = base => ({ 'content-type': 'application/json', 'x-quicksub-client': 'web', origin: base });
const body = async response => ({ status: response.status, data: await response.json() });

test('verified purchase reviews enforce eligibility, update once, and publish aggregates', async t => {
  const env = await startTestServer();
  t.after(() => env.close());
  const signup = await fetch(env.base + '/api/account/signup', { method: 'POST', headers: trusted(env.base), body: JSON.stringify({ name: 'Review Tester', email: 'reviewer@example.test', password: 'review-password-123' }) });
  assert.equal(signup.status, 200);
  const cookie = signup.headers.get('set-cookie').split(';')[0];
  const headers = { ...trusted(env.base), cookie };
  const orderId = randomUUID();
  const order = await body(await fetch(env.base + '/api/orders', { method: 'POST', headers, body: JSON.stringify({ id: orderId, accessCode: 'a'.repeat(64), packageId, name: 'Review Tester', contact: 'reviewer@example.test', note: '', expectedPrice: 299 }) }));
  assert.equal(order.status, 201);

  const premature = await body(await fetch(env.base + '/api/account/reviews', { method: 'POST', headers, body: JSON.stringify({ orderId, rating: 5, comment: 'This should not publish before completed delivery.' }) }));
  assert.equal(premature.status, 409);
  assert.match(premature.data.error, /paid, delivered/i);

  await env.db.query("update quicksub_orders set status='delivered',payment_status='verified' where id=$1", [orderId]);
  const created = await body(await fetch(env.base + '/api/account/reviews', { method: 'POST', headers, body: JSON.stringify({ orderId, rating: 5, comment: 'Fast delivery and very helpful setup support.' }) }));
  assert.equal(created.status, 201);
  assert.equal(created.data.review.verifiedPurchase, true);
  assert.equal(created.data.review.rating, 5);

  const updated = await body(await fetch(env.base + '/api/account/reviews', { method: 'POST', headers, body: JSON.stringify({ orderId, rating: 4, comment: 'Delivery was fast and the product worked as expected.' }) }));
  assert.equal(updated.status, 201);
  const stored = await env.db.query('select rating,comment from quicksub_reviews where order_id=$1', [orderId]);
  assert.equal(stored.rows.length, 1);
  assert.deepEqual(stored.rows[0], { rating: 4, comment: 'Delivery was fast and the product worked as expected.' });

  const productReviews = await body(await fetch(env.base + '/api/reviews?productId=1'));
  assert.equal(productReviews.status, 200);
  assert.deepEqual(productReviews.data.summary, { count: 1, average: 4 });
  assert.equal(productReviews.data.reviews[0].verifiedPurchase, true);
  assert.equal(productReviews.data.reviews[0].product_name, 'Netflix Premium');

  const badInput = await body(await fetch(env.base + '/api/account/reviews', { method: 'POST', headers, body: JSON.stringify({ orderId, rating: 0, comment: 'short' }) }));
  assert.equal(badInput.status, 400);
  const privileges = await env.db.query("select has_table_privilege('anon','quicksub_reviews','select') as anon_read, has_table_privilege('authenticated','quicksub_reviews','select') as user_read");
  assert.deepEqual(privileges.rows[0], { anon_read: false, user_read: false });
});
