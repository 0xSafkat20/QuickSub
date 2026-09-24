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
      const customer = await customers.user(req, b.fromCart === true || !!b.renewalOf);
      const receiptEmail = b.email === undefined ? (String(b.contact).includes('@') ? contact(b.contact) : '') : contact(b.email);
      if (receiptEmail && !receiptEmail.includes('@')) throw fail(400, 'Enter a valid receipt email.');
      const order = await db("rpc/quicksub_place_order", {
        method: "POST",
        body: {
          p_user: customer?.id || null,
          p_cart: b.fromCart === true,
          p_email: receiptEmail,
          p_game: b.gameAccount === undefined ? '' : string(b.gameAccount, 160, 0),
          p_renewal: b.renewalOf || null,
          p_id: b.id,
          p_hash: hash(b.accessCode),
          p_package: b.packageId,
          p_name: string(b.name, 120),
          p_contact: contact(b.contact),
          p_note: string(b.note, 1000, 0),
          p_expected: b.expectedPrice,
        },
      });
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
      await findOrder(req);
      const reference = string(req.body.reference, 160, 4);
      const rows = await db(
        `quicksub_orders?id=eq.${req.body.id}&tracking_hash=eq.${hash(req.body.accessCode)}&payment_status=in.(unpaid,rejected)&status=eq.pending`,
        {
          method: "PATCH",
          headers: { Prefer: "return=representation" },
          body: {
            payment_reference: reference,
            payment_method: req.body.method === undefined ? 'Manual payment' : string(req.body.method, 60),
            payment_status: "submitted",
            updated_at: new Date(now()).toISOString(),
          },
        },
      );
      if (!rows.length)
        throw fail(
          409,
          "Payment has already been submitted or this order is no longer pending.",
        );
      res.json({ ok: true });
    }),
  );
  return { router, findOrder };
}
module.exports = { createOrders };
