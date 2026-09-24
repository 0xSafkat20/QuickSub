const { randomBytes } = require('node:crypto');
const express = require('express');
const fail = (status, message) => Object.assign(new Error(message), { status });
const paymentId = /^qs_[a-f0-9]{24}$/;
const publicFields = 'id,order_id,amount_bdt,currency,status,bank_reference,verified_at,created_at,refund_status,refund_reference,refund_updated_at';
function createPayments({ db, fetchImpl = fetch, env = process.env }) {
  const host = env.SSLCOMMERZ_MODE === 'live' ? 'https://securepay.sslcommerz.com' : 'https://sandbox.sslcommerz.com';
  const origin = (env.PUBLIC_ORIGIN || '').replace(/\/$/, '');
  const enabled = !!(env.SSLCOMMERZ_STORE_ID && env.SSLCOMMERZ_STORE_PASSWORD && /^https:\/\//.test(origin) && ['sandbox','live'].includes(env.SSLCOMMERZ_MODE));
  async function gateway(path, params, method = 'GET') {
    if (!enabled) throw fail(503, 'Online payment is not configured. Please use manual payment.');
    const data = new URLSearchParams({ store_id: env.SSLCOMMERZ_STORE_ID, store_passwd: env.SSLCOMMERZ_STORE_PASSWORD, format: 'json', ...params });
    try {
      const response = await fetchImpl(host + path + (method === 'GET' ? '?' + data : ''), {
        method, ...(method === 'POST' ? { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: data.toString() } : {}),
        signal: AbortSignal.timeout(8000), redirect: 'error',
      });
      if (!response.ok) throw Error('gateway');
      return await response.json();
    } catch { throw fail(503, 'Payment provider unavailable. Check payment status before trying again.'); }
  }
  const rpc = (name, body) => db('rpc/' + name, { method: 'POST', body });
  async function get(id) {
    if (!paymentId.test(id || '')) throw fail(400, 'Invalid payment ID.');
    const rows = await db(`quicksub_payments?id=eq.${id}&select=*`);
    if (!rows[0]) throw fail(404, 'Payment not found.');
    return rows[0];
  }
  function validate(result, payment) {
    if (!['VALID','VALIDATED'].includes(result.status) || result.tran_id !== payment.id ||
      result.currency !== 'BDT' || !Number.isFinite(Number(result.amount)) ||
      Math.round(Number(result.amount) * 100) !== Math.round(Number(payment.amount_bdt) * 100) ||
      (result.store_id && result.store_id !== env.SSLCOMMERZ_STORE_ID) ||
      typeof result.bank_tran_id !== 'string' || !result.bank_tran_id || result.bank_tran_id.length > 160)
      throw fail(409, 'Payment details did not match. Contact support.');
    return String(result.risk_level) === '0' ? 'verified' : 'review';
  }
  async function verify(payment, valId) {
    if (typeof valId !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(valId)) throw fail(400, 'Invalid validation ID.');
    const result = await gateway('/validator/api/validationserverAPI.php', { val_id: valId });
    const status = validate(result, payment);
    await rpc('quicksub_settle_payment', { p_id: payment.id, p_status: status, p_reference: result.bank_tran_id });
    if(status==='verified' && typeof result.card_type==='string' && result.card_type.trim()) await db(`quicksub_orders?id=eq.${payment.order_id}&payment_reference=eq.SSLCOMMERZ:${payment.id}`, {method:'PATCH',body:{payment_method:'Online / '+result.card_type.trim().slice(0,60)+' (SSLCommerz)'}});
  }
  async function reconcile(payment) {
    if (['verified','review'].includes(payment.status)) return;
    const result = await gateway('/validator/api/merchantTransIDvalidationAPI.php', { tran_id: payment.id });
    if (result.APIConnect !== 'DONE' || !Array.isArray(result.element)) throw fail(503, 'Payment verification pending. Please check again shortly.');
    const records = result.element.filter(x => x.tran_id === payment.id);
    const paid = records.find(x => ['VALID','VALIDATED'].includes(x.status));
    if (paid) await verify(payment, paid.val_id);
    else if (records.length && records.every(x => ['FAILED','CANCELLED'].includes(x.status))) {
      await rpc('quicksub_settle_payment', { p_id: payment.id, p_status: records.some(x => x.status === 'FAILED') ? 'failed' : 'cancelled', p_reference: null });
    }
    await db(`quicksub_payments?id=eq.${payment.id}`, { method: 'PATCH', body: { checked_at: new Date().toISOString() } });
  }
  async function start(order, body) {
    if (!enabled) throw fail(503, 'Online payment is not configured.');
    if (typeof body.email !== 'string' || body.email.length > 50 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email) ||
      typeof body.phone !== 'string' || !/^\+?[0-9]{8,20}$/.test(body.phone)) throw fail(400, 'Enter a valid receipt email and phone number.');
    const id = 'qs_' + randomBytes(12).toString('hex');
    const payment = await rpc('quicksub_start_payment', { p_order: order.id, p_id: id, p_email: body.email });
    if (payment.id !== id) {
      if (payment.checkout_url) return { url: payment.checkout_url };
      throw fail(409, 'A payment is awaiting confirmation. Check payment status before retrying.');
    }
    await db(`quicksub_orders?id=eq.${order.id}`, {method:'PATCH',body:{payment_method:'Online payment (SSLCommerz)',receipt_email:body.email}});
    const callback = origin + '/api/payments/return';
    const result = await gateway('/gwprocess/v4/api.php', {
      tran_id: id, total_amount: Number(payment.amount_bdt).toFixed(2), currency: 'BDT',
      success_url: callback, fail_url: callback, cancel_url: callback, ipn_url: origin + '/api/payments/ipn',
      cus_name: (order.customer_name || 'QuickSub customer').slice(0,50), cus_email: body.email, cus_phone: body.phone,
      cus_country: 'Bangladesh', shipping_method: 'NO', num_of_item: '1',
      product_name: (order.product_name + ' / ' + order.package_name).slice(0,255), product_category: 'Digital services', product_profile: 'non-physical-goods', emi_option: '0',
    }, 'POST');
    if (result.status === 'FAILED') {
      await rpc('quicksub_settle_payment', { p_id: id, p_status: 'failed', p_reference: null });
      throw fail(503, 'Unable to start checkout. Please check your details and retry.');
    }
    let url;
    try { url = new URL(result.GatewayPageURL); } catch { throw fail(503, 'Checkout confirmation pending. Check payment status.'); }
    if (result.status !== 'SUCCESS' || url.origin !== host || url.username || url.password) throw fail(503, 'Invalid checkout response. Contact support.');
    await db(`quicksub_payments?id=eq.${id}`, { method: 'PATCH', body: { checkout_url: url.href } });
    return { url: url.href };
  }
  async function history(orderId, admin = false) { return db(`quicksub_payments?order_id=eq.${orderId}&select=${publicFields}${admin ? ",refund_note" : ""}&order=created_at.desc&limit=50`); }
  async function work() {
    const pending = await db('quicksub_payments?status=in.(pending,failed,cancelled)&select=*&order=checked_at.asc.nullsfirst,created_at.asc&limit=1');
    let checked = 0, sent = 0, errors = 0;
        for (const payment of pending) {
      try { await reconcile(payment); checked++; } catch { errors++; }
      finally { await db(`quicksub_payments?id=eq.${payment.id}`, { method: 'PATCH', body: { checked_at: new Date().toISOString() } }); }
    }
    if (env.RESEND_API_KEY && env.PAYMENT_RECEIPT_FROM) {
      const mails = await db('quicksub_payment_mail?sent_at=is.null&select=*&order=attempted_at.asc.nullsfirst,id.asc&limit=1');
      for (const mail of mails) {
        try {
          await db(`quicksub_payment_mail?id=eq.${mail.id}`, { method: 'PATCH', body: { attempted_at: new Date().toISOString() } });
          const response = await fetchImpl('https://api.resend.com/emails', { method: 'POST', headers: {
            Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json', 'Idempotency-Key': `quicksub-payment-${mail.id}`,
          }, body: JSON.stringify({ from: env.PAYMENT_RECEIPT_FROM, to: [mail.email], subject: mail.subject, text: mail.message }), signal: AbortSignal.timeout(10000) });
          if (!response.ok) throw Error('mail');
          await db(`quicksub_payment_mail?id=eq.${mail.id}`, { method: 'PATCH', body: { sent_at: new Date().toISOString() } }); sent++;
        } catch { errors++; }
      }
    }
    return { checked, sent, errors };
  }
  function callbacks(router, run) {
    router.post('/payments/ipn', express.urlencoded({ extended: false, limit: '16kb' }), run(async (req,res) => {
      const payment = await get(req.body?.tran_id);
      if (req.body.val_id) await verify(payment, req.body.val_id); else await reconcile(payment);
      res.json({ ok: true });
    }));
    router.all('/payments/return', express.urlencoded({ extended: false, limit: '16kb' }), (_req,res) => {
      res.redirect(303, '/?payment=return');
    });
    router.post('/payments/jobs', run(async (req,res) => {
      if (!env.PAYMENT_JOB_SECRET || req.get('authorization') !== `Bearer ${env.PAYMENT_JOB_SECRET}`) throw fail(401, 'Unauthorized.');
      res.json(await work());
    }));
  }
  return { enabled, start, history, reconcile, get, callbacks, validate, work };
}
module.exports = { createPayments };
