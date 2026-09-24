const express = require('express');
const { timingSafeEqual } = require('node:crypto');
const { run, fail } = require('./http');
const { uuid, string } = require('./validation');

const publicFields = 'id,order_id,package_id,product_id,renewed_from,product_name,package_name,amount_bdt,status,starts_at,ends_at,payment_confirmed_at,device_limit,account_reference,delivery_instructions,created_at,updated_at';

function createSubscriptions({ db, customers, rate, now = Date.now, cronSecret = process.env.CRON_SECRET }) {
  const router = express.Router();
  const process = () => db('rpc/quicksub_process_subscriptions', { method: 'POST', body: { p_now: new Date(now()).toISOString() } });
  const customer = path => run(async (req, res, next) => { req.customer = await customers.user(req); rate(req, 'subscriptions', 60); next(); });
  router.use('/account/subscriptions', customer());

  router.get('/account/subscriptions', run(async (req, res) => {
    await process();
    const rows = await db(`quicksub_subscriptions?customer_id=eq.${req.customer.id}&select=${publicFields}&order=ends_at.desc,id.desc&limit=100`);
    const [profile] = await db(`quicksub_customers?user_id=eq.${req.customer.id}&select=renewal_reminders`);
    const reminderRows = profile?.renewal_reminders === false ? [] : await db(`quicksub_subscription_reminders?customer_id=eq.${req.customer.id}&read_at=is.null&select=id,subscription_id,kind,due_at,message&order=due_at.desc&limit=100`);
    const current = now();
    const reminders = reminderRows.filter(row => Date.parse(row.due_at) <= current).slice(0, 50);
    res.json({ subscriptions: rows.map(row => ({ ...row, amount_bdt: Number(row.amount_bdt) })), reminders });
  }));
  router.get('/account/subscriptions/:id', run(async (req, res) => {
    if (!uuid.test(req.params.id)) throw fail(400, 'Invalid subscription.');
    await process();
    const rows = await db(`quicksub_subscriptions?id=eq.${req.params.id}&customer_id=eq.${req.customer.id}&select=${publicFields}`);
    if (!rows[0]) throw fail(404, 'Subscription not found.');
    res.json({ subscription: { ...rows[0], amount_bdt: Number(rows[0].amount_bdt) } });
  }));
  router.post('/account/subscriptions/:id/renew', run(async (req, res) => {
    if (!uuid.test(req.params.id)) throw fail(400, 'Invalid subscription.');
    const rows = await db(`quicksub_subscriptions?id=eq.${req.params.id}&customer_id=eq.${req.customer.id}&status=in.(active,expired)&select=${publicFields}`);
    if (!rows[0]) throw fail(409, 'This subscription is not currently eligible for renewal.');
    const s = rows[0];
    res.json({ checkout: `/checkout?product=${encodeURIComponent(s.product_id)}&package=${encodeURIComponent(s.package_id)}&renewal=${encodeURIComponent(s.id)}` });
  }));
  router.get('/account/subscriptions/:id/receipts', run(async (req, res) => {
    if (!uuid.test(req.params.id)) throw fail(400, 'Invalid subscription.');
    const subscriptions = await db(`quicksub_subscriptions?id=eq.${req.params.id}&customer_id=eq.${req.customer.id}&select=order_id`);
    if (!subscriptions[0]) throw fail(404, 'Subscription not found.');
    const orders = await db(`quicksub_orders?id=eq.${subscriptions[0].order_id}&customer_id=eq.${req.customer.id}&select=id,product_name,package_name,amount_bdt,status,payment_status,created_at,receipt_email,package_details,subscription_period,subscription_started_at,expires_at,payment_method,payment_reference`);
    res.json({ receipts: orders.map(row => ({ ...row, amount_bdt: Number(row.amount_bdt) })) });
  }));
  router.post('/account/subscriptions/reminders/:id/read', run(async (req, res) => {
    if (!uuid.test(req.params.id)) throw fail(400, 'Invalid reminder.');
    const rows = await db(`quicksub_subscription_reminders?id=eq.${req.params.id}&customer_id=eq.${req.customer.id}&read_at=is.null`, { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: { read_at: new Date(now()).toISOString() } });
    if (!rows.length) throw fail(404, 'Reminder not found.');
    res.json({ ok: true });
  }));

  router.get('/admin/subscriptions', run(async (req, res) => {
    await process();
    const status = typeof req.query.status === 'string' && ['upcoming','active','expired','suspended','cancelled'].includes(req.query.status) ? `&status=eq.${req.query.status}` : '';
    const rows = await db(`quicksub_subscriptions?select=${publicFields},customer_id${status}&order=ends_at.asc,id.asc&limit=250`);
    res.json({ subscriptions: rows.map(row => ({ ...row, amount_bdt: Number(row.amount_bdt) })) });
  }));
  router.put('/admin/subscriptions/:id', run(async (req, res) => {
    if (!uuid.test(req.params.id)) throw fail(400, 'Invalid subscription.');
    const b = req.body || {};
    if (!['upcoming','active','expired','suspended','cancelled'].includes(b.status) || typeof b.ends_at !== 'string' || !Number.isFinite(Date.parse(b.ends_at)) || !Number.isInteger(b.device_limit) || b.device_limit < 1 || b.device_limit > 100) throw fail(400, 'Check subscription status, expiry and device limit.');
    const subscription = await db('rpc/quicksub_admin_subscription', { method: 'POST', body: { p_actor: req.admin.id, p_id: req.params.id, p_status: b.status, p_ends: new Date(b.ends_at).toISOString(), p_device: b.device_limit, p_account: string(b.account_reference || '',160,0), p_instructions: string(b.delivery_instructions || '',2000,0) } });
    res.json({ subscription });
  }));
  router.post('/admin/subscriptions/process', run(async (_req, res) => res.json(await process())));
  router.get('/jobs/subscriptions', run(async (req, res) => {
    if (!cronSecret) throw fail(503, 'Subscription job secret is not configured.');
    const supplied = req.get('authorization') || '';
    const expected = `Bearer ${cronSecret}`;
    if (supplied.length !== expected.length || !timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))) throw fail(401, 'Job authorization failed.');
    res.json(await process());
  }));
  return router;
}
module.exports = { createSubscriptions };
