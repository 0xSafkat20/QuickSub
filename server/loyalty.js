const express = require('express');
const { timingSafeEqual } = require('node:crypto');
const { run, fail } = require('./http');
const { string, uuid } = require('./validation');

const defaultSettings = Object.freeze({
  enabled: false,
  points_per_10_bdt: 1,
  bdt_per_point: 0.25,
  minimum_redemption: 100,
  maximum_discount_percent: 20,
  referral_reward: 100,
  referred_reward: 50,
  referral_wait_days: 7,
  monthly_referral_limit: 10,
});
const migrationMissing = error => /PGRST20[234]|quicksub_(loyalty|process_referrals)|schema cache|does not exist/i.test(
  String(error?.providerCode || '') + ' ' + String(error?.providerMessage || '') + ' ' + String(error?.message || ''),
);

function createLoyalty({ db, customers, rate, now = Date.now, cronSecret = process.env.CRON_SECRET }) {
  const router = express.Router();
  const process = () => db('rpc/quicksub_process_referrals', { method: 'POST', body: { p_now: new Date(now()).toISOString() } });

  router.get('/account/rewards', run(async (req, res) => {
    rate(req, 'customer-rewards', 40);
    const customer = await customers.user(req);
    try {
      await process();
      const summary = await db('rpc/quicksub_loyalty_summary', { method: 'POST', body: { p_user: customer.id } });
      summary.settings = { ...summary.settings, bdt_per_point: 0.25 };
      res.json(summary);
    } catch (error) {
      if (!migrationMissing(error)) throw error;
      // Rolling-deploy compatibility: before the loyalty migration exists, show
      // a safe read-only balance derived from completed purchases. Redemption
      // stays disabled until the transactional ledger is installed.
      const orders = await db(`quicksub_orders?customer_id=eq.${customer.id}&status=eq.delivered&payment_status=eq.verified&select=id,amount_bdt,product_name,package_name,customer_name,created_at&order=created_at.desc&limit=5000`);
      const transactions = orders.filter(order => !/^\[DEMO\]/i.test(String(order.customer_name || ''))).map(order => ({
        id: `purchase-${order.id}`,
        order_id: order.id,
        kind: 'purchase',
        points: Math.max(0, Math.floor(Number(order.amount_bdt || 0) / 10) * defaultSettings.points_per_10_bdt),
        description: `Points earned from ${order.product_name || order.package_name || 'completed purchase'}`,
        created_at: order.created_at,
      })).filter(item => item.points > 0);
      const balance = transactions.reduce((total, item) => total + item.points, 0);
      res.json({
        balance,
        lifetimeEarned: balance,
        lifetimeRedeemed: 0,
        referralCode: '',
        locale: 'en-BD',
        referrals: { total: 0, pending: 0, rewarded: 0 },
        settings: defaultSettings,
        transactions,
        programReady: false,
      });
    }
  }));
  router.post('/account/referral', run(async (req, res) => {
    rate(req, 'customer-referral', 8);
    const customer = await customers.user(req);
    const referral = await db('rpc/quicksub_attach_referral', { method: 'POST', body: { p_user: customer.id, p_code: string(req.body?.code, 32, 4) } });
    res.json({ referral });
  }));
  router.post('/account/locale', run(async (req, res) => {
    rate(req, 'customer-locale', 20);
    const customer = await customers.user(req);
    const locale = req.body?.locale;
    if (!['en-BD','bn-BD'].includes(locale)) throw fail(400, 'Choose a supported language.');
    await db(`quicksub_customers?user_id=eq.${customer.id}`, { method: 'PATCH', body: { preferred_locale: locale, updated_at: new Date(now()).toISOString() } });
    res.json({ locale });
  }));

  router.get('/admin/loyalty', run(async (req, res) => {
    if (req.admin.role !== 'owner') throw fail(403, 'Owner access required.');
    await process();
    const result = await db('rpc/quicksub_admin_loyalty', { method: 'POST', body: { p_actor: req.admin.id } });
    result.settings = { ...result.settings, bdt_per_point: 0.25 };
    res.json(result);
  }));
  router.put('/admin/loyalty/settings', run(async (req, res) => {
    if (req.admin.role !== 'owner') throw fail(403, 'Owner access required.');
    const b = req.body || {};
    const integer = (name, min, max) => {
      const value = b[name];
      if (!Number.isInteger(value) || value < min || value > max) throw fail(400, `Check ${name.replaceAll('_',' ')}.`);
      return value;
    };
    if (typeof b.enabled !== 'boolean') throw fail(400, 'Check loyalty settings.');
    const data = {
      enabled: b.enabled,
      points_per_10_bdt: integer('points_per_10_bdt',0,100), bdt_per_point: 0.25,
      minimum_redemption: integer('minimum_redemption',1,1000000), maximum_discount_percent: integer('maximum_discount_percent',1,100),
      referral_reward: integer('referral_reward',0,1000000), referred_reward: integer('referred_reward',0,1000000),
      referral_wait_days: integer('referral_wait_days',0,90), monthly_referral_limit: integer('monthly_referral_limit',1,10000),
    };
    res.json({ settings: await db('rpc/quicksub_admin_loyalty_settings', { method: 'POST', body: { p_actor: req.admin.id, p_data: data } }) });
  }));
  router.post('/admin/loyalty/adjust', run(async (req, res) => {
    if (req.admin.role !== 'owner') throw fail(403, 'Owner access required.');
    if (!uuid.test(req.body?.customerId) || !Number.isInteger(req.body?.points) || req.body.points === 0 || Math.abs(req.body.points) > 100000) throw fail(400, 'Check customer and points.');
    const transaction = await db('rpc/quicksub_admin_loyalty_adjust', { method: 'POST', body: { p_actor: req.admin.id, p_customer: req.body.customerId, p_points: req.body.points, p_reason: string(req.body?.reason, 240, 5) } });
    res.json({ transaction });
  }));
  router.get('/jobs/loyalty', run(async (req, res) => {
    if (!cronSecret) throw fail(503, 'Job secret is not configured.');
    const supplied = req.get('authorization') || '', expected = `Bearer ${cronSecret}`;
    if (supplied.length !== expected.length || !timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))) throw fail(401, 'Job authorization failed.');
    res.json(await process());
  }));
  return router;
}
module.exports = { createLoyalty };
