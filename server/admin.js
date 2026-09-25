const express = require("express");
const { createPayments } = require("./payments");
const { randomUUID } = require("node:crypto");
const { toProduct } = require("./catalog");
const { fail, run, errorHandler } = require("./http");
const { string, contact, uuid } = require("./validation");
function createAdminRouter({
  url = process.env.SUPABASE_URL,
  key = process.env.SUPABASE_SERVICE_ROLE_KEY,
  fetchImpl = fetch,
  invalidate = () => {},
  now = Date.now,
  paymentEnv = process.env,
  demoCheckout = process.env.QUICKSUB_DEMO_CHECKOUT === "true",
  previewCheckout = process.env.QUICKSUB_PREVIEW_CHECKOUT === "true",
  sharedSessions = process.env.VERCEL === "1" || process.env.NODE_ENV === "production",
} = {}) {
  const router = express.Router();
  const limits = new Map();
  const configured = !!url && !!key;
  const base = (url || "").replace(/\/$/, "");
  async function remote(
    path,
    { method = "GET", body, token = key, headers = {} } = {},
  ) {
    if (!configured)
      throw fail(503, "Supabase is not configured yet. Follow ADMIN-SETUP.md.");
    let response;
    try {
      response = await fetchImpl(base + path, {
        method,
        headers: {
          apikey: key,
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          ...headers,
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(10000),
      });
    } catch {
      throw path.startsWith("/auth/")
        ? Object.assign(fail(503, "Authentication service is temporarily unavailable. Please try again."), { expose: true })
        : fail(503, "Database unavailable. Please try again.");
    }
    if (!response.ok) {
      if (path.startsWith("/auth/")) {
        let provider = {};
        try { provider = await response.json(); } catch {}
        if (!provider || typeof provider !== 'object') provider = {};
        const error = response.status === 429
          ? fail(429, "Too many authentication attempts. Please wait a few minutes and try again.")
          : response.status >= 500
            ? Object.assign(fail(503, "Authentication service is temporarily unavailable. Please try again."), { expose: true })
            : fail(401, "Email or password is incorrect. Try again or reset your password.");
        throw Object.assign(error, {
          providerStatus: response.status,
          providerCode: provider.error_code || provider.code || '',
          providerMessage: provider.msg || provider.message || provider.error_description || '',
        });
      }
      throw fail(
        response.status === 400 || response.status === 409 ? 409 : 503,
        response.status === 400 || response.status === 409
          ? "The update conflicts with the current record. Check availability, payment reference and order status, then refresh."
          : "Database unavailable. Check configuration and migrations.",
      );
    }
    if (response.status === 204) return null;
    const text = await response.text();
    if (!text.trim()) return null;
    try { return JSON.parse(text); }
    catch { throw fail(503, "The database returned an invalid response. Please try again."); }
  }
  const db = (path, options) => remote("/rest/v1/" + path, options);
  const payments = createPayments({ db, fetchImpl, env: paymentEnv });
  router.use('/payments', (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    try { rate(req, 'payment-endpoint', 60); next(); } catch (err) { next(err); }
  });
  payments.callbacks(router, run);
  router.use((req, res, next) => {
    res.set("Cache-Control", "no-store");
    if (!["GET", "HEAD"].includes(req.method)) {
      const origin = req.get("origin");
      const allowed =
        process.env.PUBLIC_ORIGIN || `${req.protocol}://${req.get("host")}`;
      if (
        !origin ||
        origin !== allowed ||
        req.get("x-quicksub-client") !== "web"
      )
        return res.status(403).json({ error: "Request origin not allowed." });
    }
    next();
  });
  function rate(req, name, maximum) {
    const time = now();
    for (const [id, item] of limits) if (item.until <= time) limits.delete(id);
    const id = name + ":" + req.ip;
    const item = limits.get(id) || { count: 0, until: time + 60000 };
    if (limits.size >= 10000 && !limits.has(id))
      throw fail(429, "Please try again in a minute.");
    limits.set(id, item);
    if (++item.count > maximum)
      throw fail(429, "Too many requests. Please try again in a minute.");
  }
  require("./auth").installAdminAuth({ router, db, remote, rate, now, sharedSessions });
  const customers = require("./customers").installCustomers({router,run,db,remote,rate,string,contact,now});
  const { router: ordersRouter, findOrder } = require("./orders").createOrders({ db, rate, customers, now });
  router.use(ordersRouter);
  router.use(require('./reviews').createReviews({ db, customers, rate }));
  router.use(require("./cart").createCartRouter({ db, customers, rate }));
  router.use(require("./subscriptions").createSubscriptions({ db, customers, rate, now }));
  router.get("/admin/session", (req, res) => res.json(req.admin));
  function reportPeriod(query) {
    const iso = /^\d{4}-\d{2}-\d{2}$/;
    const from = typeof query.from === "string" && iso.test(query.from) ? new Date(query.from + "T00:00:00+06:00") : null;
    const last = typeof query.to === "string" && iso.test(query.to) ? new Date(query.to + "T00:00:00+06:00") : null;
    const bucket = ["day", "week", "month"].includes(query.bucket) ? query.bucket : "day";
    if (!from || !last || Number.isNaN(+from) || Number.isNaN(+last)) throw fail(400, "Choose a valid reporting date range.");
    const to = new Date(+last + 86400000);
    if (from >= to || +to - +from > 732 * 86400000) throw fail(400, "Reporting ranges must be between 1 day and 2 years.");
    return { from: from.toISOString(), to: to.toISOString(), bucket };
  }
  async function report(query) {
    const period = reportPeriod(query);
    const data = await db("rpc/quicksub_admin_report", { method: "POST", body: { p_from: period.from, p_to: period.to, p_bucket: period.bucket } });
    return { period: { from: query.from, to: query.to, bucket: period.bucket, timezone: "Asia/Dhaka" }, ...data, generatedAt: new Date(now()).toISOString() };
  }
  const csvCell = (value) => {
    let text = value == null ? "" : String(value);
    if (/^[=+\-@]/.test(text)) text = "'" + text;
    return /[",\r\n]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
  };
  const csv = (headers, rows) => "\ufeff" + [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n") + "\r\n";
  router.get("/admin/reports", run(async (req, res) => {
    rate(req, "admin-reports", 60);
    const result = await report(req.query);
    if (req.admin.role !== "owner") result.expiring = result.expiring.map(({ contact: _contact, ...row }) => row);
    res.json(result);
  }));
  router.get("/admin/reports/export", run(async (req, res) => {
    rate(req, "admin-report-export", 12);
    const type = typeof req.query.type === "string" ? req.query.type : "";
    if (!["trends", "products", "payments", "expiring"].includes(type)) throw fail(400, "Choose a valid export type.");
    if (type === "expiring" && req.admin.role !== "owner") throw fail(403, "Owner access required for customer contact exports.");
    const result = await report(req.query);
    let headers, rows;
    if (type === "trends") {
      headers = ["Period", "Orders", "Paid orders", "Gross revenue BDT", "Refunds BDT", "Net revenue BDT"];
      rows = result.trends.map((x) => [x.bucket, x.orders, x.paid_orders, x.gross_revenue, x.refunds, x.net_revenue]);
    } else if (type === "products") {
      headers = ["Product", "Package", "Paid orders", "Refunded orders", "Gross revenue BDT", "Refunds BDT", "Net revenue BDT"];
      rows = result.products.map((x) => [x.product_name, x.package_name, x.paid_orders, x.refunded_orders, x.gross_revenue, x.refunds || 0, x.net_revenue]);
    } else if (type === "payments") {
      headers = ["Transaction", "Order", "Product", "Package", "Amount BDT", "Payment status", "Refund status", "Created at", "Checked at", "Refund updated at"];
      rows = result.payment_issues.map((x) => [x.id, x.order_id, x.product_name, x.package_name, x.amount_bdt, x.status, x.refund_status, x.created_at, x.checked_at, x.refund_updated_at]);
    } else {
      headers = ["Order", "Customer", "Contact", "Product", "Package", "Amount BDT", "Expires at", "Days remaining"];
      rows = result.expiring.map((x) => [x.id, x.customer_name, x.contact, x.product_name, x.package_name, x.amount_bdt, x.expires_at, x.days_remaining]);
    }
    await db("quicksub_audit", { method: "POST", body: { actor: req.admin.id, action: "report-export:" + type, record_id: result.period.from + ":" + result.period.to } });
    const filename = `quicksub-${type}-${result.period.from}-to-${result.period.to}.csv`;
    res.set({ "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${filename}"`, "X-Content-Type-Options": "nosniff" }).send(csv(headers, rows));
  }));
  router.get('/payments/config', (_req,res) => res.json({ enabled: payments.enabled }));
  router.post('/orders/checkout', run(async (req,res) => {
    rate(req, 'checkout', 5);
    const order = await findOrder(req);
    res.json(await payments.start(order, req.body));
  }));
  router.post('/orders/payments', run(async (req,res) => {
    const order = await findOrder(req);
    res.json({ payments: await payments.history(order.id) });
  }));
  router.post('/orders/payments/check', run(async (req,res) => {
    rate(req, 'payment-check', 5);
    const order = await findOrder(req);
    const rows = await payments.history(order.id);
    for (const row of rows.filter(p => ['pending','failed','cancelled'].includes(p.status)).slice(0,2)) await payments.reconcile(row);
    res.json({ order: await findOrder(req), payments: await payments.history(order.id) });
  }));
  router.get('/admin/payment-search', run(async (req,res) => {
    const reference = string(req.query.reference, 160, 3);
    const column = /^qs_[a-f0-9]{24}$/.test(reference) ? 'id' : 'bank_reference';
    const rows = await db(`quicksub_payments?${column}=eq.${encodeURIComponent(reference)}&select=order_id&limit=10`);
    res.json({ orders: rows.map(p => p.order_id) });
  }));
  router.post('/admin/payments/:id/check', run(async (req,res) => {
    rate(req, 'admin-payment-check', 10);
    await payments.reconcile(await payments.get(req.params.id));
    res.json({ ok: true });
  }));
  router.post('/admin/payments/:id/approve', run(async (req,res) => {
    if (req.admin.role !== 'owner') throw fail(403, 'Owner access required.');
    const payment = await payments.get(req.params.id);
    await db('rpc/quicksub_review_payment', { method: 'POST', body: { p_actor: req.admin.id, p_id: payment.id, p_note: string(req.body?.note, 1000, 10) } });
    res.json({ ok: true });
  }));
  router.get('/admin/payments/:id', run(async (req,res) => {
    if (!uuid.test(req.params.id)) throw fail(400, 'Invalid order ID.');
    res.json({ payments: await payments.history(req.params.id, true) });
  }));
  router.post('/admin/payments/:id/refund', run(async (req,res) => {
    const payment = await payments.get(req.params.id);
    if (!['requested','pending','completed','failed'].includes(req.body?.status)) throw fail(400, 'Invalid refund status.');
    await db('rpc/quicksub_record_refund', { method: 'POST', body: {
      p_actor: req.admin.id, p_id: payment.id, p_status: req.body.status,
      p_reference: string(req.body.reference || '', 160, 0), p_note: string(req.body.note || '', 1000, 0),
    } });
    res.json({ ok: true });
  }));
  router.get(
    "/admin/data",
    run(async (req, res) => {
      const offset = Math.max(
        0,
        Math.min(1000000, Math.floor(Number(req.query.offset) || 0)),
      );
      const [
        products,
        packages,
        orders,
        content,
        requests,
        audit,
        overview,
        customers,
      ] = await Promise.all([
        db("quicksub_products?select=*&order=sort_order.asc,id.asc&limit=1000"),
        db("quicksub_packages?select=*&order=name.asc&limit=1000"),
        db(
          `quicksub_orders?select=id,package_id,product_name,package_name,amount_bdt,customer_name,contact,customer_note,status,payment_status,payment_reference,delivery_note,created_at,updated_at&order=created_at.desc,id.desc&limit=50&offset=${offset}`,
        ),
        db("quicksub_content?select=*"),
        db("quicksub_requests?select=*&order=created_at.desc&limit=100"),
        req.admin.role === "owner"
          ? db("quicksub_audit?select=*&order=created_at.desc&limit=100")
          : [],
        db("rpc/quicksub_overview", { method: "POST", body: {} }),
        db("rpc/quicksub_customers", {
          method: "POST",
          body: { p_offset: offset },
        }),
      ]);
      res.json({
        products: products.map((p) => ({
          ...p,
          price_bdt: Number(p.price_bdt),
        })),
        packages: packages.map((p) => ({
          ...p,
          price_bdt: Number(p.price_bdt),
        })),
        orders,
        content,
        requests,
        audit,
        overview,
        customers,
        offset,
      });
    }),
  );
  router.put(
    "/admin/:kind/:id",
    run(async (req, res) => {
      const { kind, id } = req.params;
      let data = req.body || {};
      if (!["product", "package", "order", "content", "request"].includes(kind))
        throw fail(404, "Unknown action.");
      if (!["order", "request"].includes(kind) && req.admin.role !== "owner")
        throw fail(403, "Owner access required.");
      if (["package", "order", "request"].includes(kind) && !uuid.test(id))
        throw fail(400, "Invalid record ID.");
      if (kind === "product") {
        if (!/^[a-zA-Z0-9_-]{1,64}$/.test(id))
          throw fail(400, "Invalid product ID.");
        try {
          toProduct({ ...data, id });
        } catch {
          throw fail(
            400,
            "Check product fields, image URL, price and category.",
          );
        }
        if (
          !Number.isFinite(data.price_bdt) ||
          data.price_bdt > 10000000 ||
          typeof data.active !== "boolean" ||
          !Number.isInteger(data.sort_order)
        )
          throw fail(400, "Invalid product price or display order.");
        string(data.data.name, 160);
        string(data.data.slug, 160);
      } else if (kind === "package") {
        data = {
          product_id: string(data.product_id, 64),
          name: string(data.name, 160),
          details: string(data.details, 2000, 0),
          price_bdt: data.price_bdt,
          active: data.active,
        };
        if (
          !Number.isFinite(data.price_bdt) ||
          data.price_bdt <= 0 ||
          data.price_bdt > 10000000 ||
          typeof data.active !== "boolean"
        )
          throw fail(400, "Enter a valid package price.");
      } else if (kind === "order") {
        if (
          !["pending", "processing", "delivered", "cancelled"].includes(
            data.status,
          ) ||
          !["unpaid", "submitted", "verified", "rejected", "refunded"].includes(
            data.payment_status,
          )
        )
          throw fail(400, "Invalid order status.");
        data = {
          status: data.status,
          payment_status: data.payment_status,
          delivery_note: string(data.delivery_note, 2000, 0),
        };
        if (data.status === "delivered" && !data.delivery_note)
          throw fail(
            400,
            "Add a customer delivery note. Do not include passwords.",
          );
      } else if (kind === "request") {
        if (!["open", "resolved"].includes(data.status))
          throw fail(400, "Invalid request status.");
        data = { status: data.status };
      } else {
        if (id === "store") {
          if (
            !Array.isArray(data.faq) ||
            data.faq.length > 40 ||
            !data.policies ||
            !data.operations
          )
            throw fail(400, "Invalid store content.");
          data.faq.forEach((f) => {
            if (!f || typeof f !== "object") throw fail(400, "Invalid FAQ entry.");
            string(f.id, 64);
            string(f.question, 300);
            string(f.answer, 2000);
          });
          if (
            typeof data.policies !== "object" ||
            Array.isArray(data.policies) ||
            typeof data.operations !== "object" ||
            Array.isArray(data.operations)
          )
            throw fail(400, "Invalid content.");
          Object.values(data.operations).forEach((v) => string(v, 4000, 0));
          Object.values(data.policies).forEach((p) => {
            if (!p || typeof p !== "object") throw fail(400, "Invalid policy.");
            string(p.title, 160);
            string(p.lastUpdated, 80);
            if (!Array.isArray(p.sections) || p.sections.length > 30)
              throw fail(400, "Invalid policy.");
            p.sections.forEach((s) => {
              if (!s || typeof s !== "object") throw fail(400, "Invalid policy section.");
              string(s.heading, 200);
              string(s.body, 8000, 0);
            });
          });
        } else if (id === "settings") {
          const deals = data.deals;
          if (
            deals !== undefined &&
            (!Array.isArray(deals) ||
              deals.length > 12 ||
              !deals.every(
                (d) =>
                  d &&
                  typeof d.productId === "string" &&
                  Number.isFinite(d.oldPrice) &&
                  d.oldPrice > 0 &&
                  d.oldPrice <= 10000000,
              ))
          )
            throw fail(400, "Check offer products and previous prices.");
          data = {
            paymentInstructions: string(data.paymentInstructions, 2000, 0),
            supportHours: string(data.supportHours, 160, 0),
            dealEndsAt: string(data.dealEndsAt, 50, 0),
            ...(deals ? { deals } : {}),
          };
          if (data.dealEndsAt && !Number.isFinite(Date.parse(data.dealEndsAt)))
            throw fail(400, "Invalid countdown date.");
        } else throw fail(400, "Invalid content record.");
      }
      await db("rpc/quicksub_admin_write", {
        method: "POST",
        body: { p_actor: req.admin.id, p_kind: kind, p_id: id, p_data: data },
      });
      invalidate();
      res.json({ ok: true });
    }),
  );
  router.post(
    "/admin/images",
    express.raw({
      type: ["image/jpeg", "image/png", "image/webp"],
      limit: "6mb",
    }),
    run(async (req, res) => {
      if (req.admin.role !== "owner") throw fail(403, "Owner access required.");
      const bytes = req.body;
      const type = req.get("content-type");
      const valid =
        Buffer.isBuffer(bytes) &&
        ((type === "image/jpeg" &&
          bytes.subarray(0, 3).equals(Buffer.from([255, 216, 255]))) ||
          (type === "image/png" &&
            bytes
              .subarray(0, 8)
              .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) ||
          (type === "image/webp" &&
            bytes.toString("ascii", 0, 4) === "RIFF" &&
            bytes.toString("ascii", 8, 12) === "WEBP"));
      if (!valid)
        throw fail(400, "Upload a JPEG, PNG or WebP image (maximum 6 MB).");
      const name = `admin/${randomUUID()}.${type.split("/")[1]}`;
      const response = await fetchImpl(
        `${base}/storage/v1/object/quicksub-products/${name}`,
        {
          method: "POST",
          headers: {
            apikey: key,
            Authorization: `Bearer ${key}`,
            "Content-Type": type,
            "x-upsert": "false",
          },
          body: bytes,
          signal: AbortSignal.timeout(20000),
        },
      );
      if (!response.ok)
        throw fail(
          503,
          "Image upload failed. Check the Storage bucket configuration.",
        );
      res.json({
        url: `${base}/storage/v1/object/public/quicksub-products/${name}`,
      });
    }),
  );
  router.get(
    "/store",
    run(async (_req, res) => {
      if (!configured) return res.json({ settings: {}, faq: null });
      const rows = await db("quicksub_content?select=id,data");
      res.json({
        settings: rows.find((r) => r.id === "settings")?.data || {},
        faq: rows.find((r) => r.id === "store")?.data.faq || null,
        policies: rows.find((r) => r.id === "store")?.data.policies || null,
      });
    }),
  );
  router.get(
    "/packages/:productId",
    run(async (req, res) => {
      const examples = previewCheckout
        ? require('./packages.json').filter((p) => p.product_id === req.params.productId && p.active).map(({ product_id, active, ...p }) => ({ ...p, id: `preview-${p.id}`, demo: true }))
        : demoCheckout ? require('./demo-packages.json')[req.params.productId] || [] : [];
      if (!configured) {
        const available = require('./catalog.json').some(p => p.id === req.params.productId && !p.outOfStock);
        return res.json({ packages: available ? examples : [] });
      }
      const id = encodeURIComponent(string(req.params.productId, 64));
      const products = await db(
        `quicksub_products?id=eq.${id}&active=eq.true&in_stock=eq.true&select=id`,
      );
      const packages = products.length
        ? await db(
            `quicksub_packages?product_id=eq.${id}&active=eq.true&select=id,name,details,price_bdt&order=price_bdt.asc`,
          )
        : [];
      res.json({
        packages: (packages.length ? packages : products.length ? examples : []).map((p) => ({
          ...p,
          price_bdt: Number(p.price_bdt),
        })),
      });
    }),
  );
  router.post(
    "/requests",
    run(async (req, res) => {
      rate(req, "request", 5);
      const b = req.body || {};
      if (!["support", "restock", "newsletter"].includes(b.kind))
        throw fail(400, "Invalid request type.");
      await db("quicksub_requests", {
        method: "POST",
        headers: { Prefer: "return=minimal" },
        body: {
          kind: b.kind,
          contact: contact(b.contact),
          message: string(b.message || "", 2000, 0),
        },
      });
      res.json({ ok: true });
    }),
  );
  router.use(errorHandler);
  return router;
}
module.exports = { createAdminRouter };
