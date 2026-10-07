const express = require("express");
const { createHash } = require("node:crypto");
const { fail, run } = require("./http");
const { string, contact, uuid } = require("./validation");
const hash = value => createHash("sha256").update(value).digest("hex");

function createOrders({ db, rate, customers, now }) {
  const router = express.Router();
  async function findOrder(req) {
    rate(req, "tracking", 20);
    const b = req.body || {};
    if (!uuid.test(b.id) || !/^[a-f0-9]{64}$/.test(b.accessCode))
      throw fail(404, "Order not found. Check your order ID and access code.");
    const rows = await db(
      `quicksub_orders?id=eq.${b.id}&tracking_hash=eq.${hash(b.accessCode)}&select=id,product_name,package_name,amount_bdt,status,payment_status,delivery_note,created_at,updated_at,customer_name,contact,receipt_email,game_account,package_details,product_category,subscription_period,subscription_started_at,expires_at,payment_method,payment_reference,renewal_of,payment_confirmed_at`,
    );
    if (!rows[0])
      throw fail(404, "Order not found. Check your order ID and access code.");
    return rows[0];
  }
  router.post(
    "/orders",
    run(async (req, res) => {
      rate(req, "order", 5);
      const b = req.body || {};
      if (
        !uuid.test(b.id) ||
        !uuid.test(b.packageId) ||
        !/^[a-f0-9]{64}$/.test(b.accessCode)
      )
        throw fail(400, "Invalid order details.");
      if (!Number.isFinite(b.expectedPrice) || b.expectedPrice <= 0)
        throw fail(400, "Refresh packages and confirm the current price.");
      if (b.fromCart !== undefined && typeof b.fromCart !== 'boolean') throw fail(400, 'Invalid checkout source.');
      if (b.renewalOf !== undefined && !uuid.test(b.renewalOf)) throw fail(400, 'Invalid renewal subscription.');
      if (b.points !== undefined && (!Number.isInteger(b.points) || b.points < 0 || b.points > 1000000)) throw fail(400, 'Choose a valid number of reward points.');
      const customer = await customers.user(req, b.fromCart === true || !!b.renewalOf);
      const receiptEmail = b.email === undefined ? (String(b.contact).includes('@') ? contact(b.contact) : '') : contact(b.email);
      if (receiptEmail && !receiptEmail.includes('@')) throw fail(400, 'Enter a valid receipt email.');
      const rpcBody = {
          p_user: customer?.id || null,
          p_cart: b.fromCart === true,
          p_email: receiptEmail,
          p_game: b.gameAccount === undefined ? '' : string(b.gameAccount, 160, 0),
          p_renewal: b.renewalOf || null,
          p_points: b.points || 0,
          p_id: b.id,
          p_hash: hash(b.accessCode),
          p_package: b.packageId,
          p_name: string(b.name, 120),
          p_contact: contact(b.contact),
          p_note: string(b.note, 1000, 0),
          p_expected: b.expectedPrice,
      };
      let order;
      try { order = await db("rpc/quicksub_place_order", {
        method: "POST",
        body: rpcBody,
      }); } catch (error) {
        // Zero-point orders remain available during a rolling deployment before
        // the loyalty migration is applied. Redemption always fails closed.
        if (rpcBody.p_points) throw error;
        const { p_points: _points, ...legacyBody } = rpcBody;
        order = await db("rpc/quicksub_place_order", { method: "POST", body: legacyBody });
      }
      res.status(201).json({ order });
    }),
  );
  router.post(
    "/orders/track",
    run(async (req, res) => res.json({ order: await findOrder(req) })),
  );
  router.post(
    "/orders/payment",
    run(async (req, res) => {
      const order = await findOrder(req);
      const method = string(req.body.method, 20).toLowerCase();
      if (!['bkash','nagad','rocket','bank_transfer'].includes(method))
        throw fail(400, 'Choose a supported payment method. Cards must use secure online checkout.');
      const reference = string(req.body.reference, 80, 4).toUpperCase();
      if (!/^[A-Z0-9][A-Z0-9._/-]{3,79}$/.test(reference))
        throw fail(400, 'Enter a valid transaction reference using letters and numbers.');
      let phone = null;
      if (['bkash','nagad','rocket'].includes(method)) {
        const digits = String(req.body.phone || '').replace(/\D/g, '');
        phone = digits.startsWith('880') ? '+' + digits : digits.startsWith('0') ? '+88' + digits : '';
        if (!/^\+8801[3-9]\d{8}$/.test(phone))
          throw fail(400, 'Enter a valid Bangladesh mobile number.');
      }
      const payerName = method === 'bank_transfer' ? string(req.body.payerName, 120, 2) : '';
      const senderBank = method === 'bank_transfer' ? string(req.body.senderBank, 120, 2) : '';
      const accountLast4 = req.body.accountLast4 ? string(req.body.accountLast4, 4, 4) : '';
      if (accountLast4 && !/^\d{4}$/.test(accountLast4))
        throw fail(400, 'Enter only the last four account digits.');
      try {
        const manualPayment = await db('rpc/quicksub_submit_manual_payment', {
          method: 'POST',
          body: {
            p_order: order.id,
            p_hash: hash(req.body.accessCode),
            p_method: method,
            p_reference: reference,
            p_phone: phone,
            p_name: payerName,
            p_bank: senderBank,
            p_last_four: accountLast4,
          },
        });
        res.json({ ok: true, manualPayment, order: await findOrder(req) });
      } catch (error) {
        if (String(error.message || '').toLowerCase().includes('unique'))
          throw fail(409, 'This transaction reference has already been submitted.');
        throw error;
      }
    }),
  );
  return { router, findOrder };
}
module.exports = { createOrders };
