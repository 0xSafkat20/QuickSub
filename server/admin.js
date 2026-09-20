const express = require("express");
const { createPayments } = require("./payments");
const { randomBytes, createHash, randomUUID } = require("node:crypto");
const { toProduct } = require("./catalog");
const uuid =
  /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const hash = (value) => createHash("sha256").update(value).digest("hex");
const fail = (status, message) => Object.assign(new Error(message), { status });
function string(value, max, min = 1, trim = true) {
  if (
    typeof value !== "string" ||
    (trim ? value.trim() : value).length < min ||
    value.length > max
  )
    throw fail(400, "Please check the required fields.");
  return trim ? value.trim() : value;
}
function contact(value) {
  const result = string(value, 160, 5);
  if (
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result) &&
    (!/^\+?[\d ()-]{8,24}$/.test(result) || result.replace(/\D/g, "").length < 8)
  )
    throw fail(400, "Enter a valid email or phone number.");
  return result;
}
function createAdminRouter({
  url = process.env.SUPABASE_URL,
  key = process.env.SUPABASE_SERVICE_ROLE_KEY,
  fetchImpl = fetch,
  invalidate = () => {},
  now = Date.now,
  paymentEnv = process.env,
  demoCheckout = process.env.QUICKSUB_DEMO_CHECKOUT === "true",
  sharedSessions = process.env.VERCEL === "1",
} = {}) {
  const router = express.Router();
  const sessions = new Map();
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
      throw fail(503, "Database unavailable. Please try again.");
    }
    if (!response.ok) {
      if (path.startsWith("/auth/"))
        throw Object.assign(fail(401, "Sign-in failed or your session expired."), { providerStatus: response.status });
      throw fail(
        response.status === 400 || response.status === 409 ? 409 : 503,
        response.status === 400 || response.status === 409
          ? "The update conflicts with the current record. Check availability, payment reference and order status, then refresh."
          : "Database unavailable. Check configuration and migrations.",
      );
    }
    return response.status === 204 ? null : response.json();
  }
  const db = (path, options) => remote("/rest/v1/" + path, options);
  const run = (handler) => (req, res, next) =>
    Promise.resolve(handler(req, res)).catch(next);
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
  const cookieId = (req) =>
    (req.headers.cookie || "")
      .split(";")
      .map((s) => s.trim())
      .find((s) => s.startsWith("qs_admin="))
      ?.slice(9);
  const cookieOptions = (req) => ({
    httpOnly: true,
    secure: req.secure || process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/api/admin",
  });
  router.post(
    "/admin/login",
    run(async (req, res) => {
      rate(req, "login", 6);
      const email = string(req.body?.email, 254),
        password = string(req.body?.password, 256, 1, false);
      const auth = await remote("/auth/v1/token?grant_type=password", {
        method: "POST",
        body: { email, password },
      });
      const roles = await db(
        `quicksub_admins?user_id=eq.${encodeURIComponent(auth.user.id)}&select=role`,
      );
      if (!["owner", "staff"].includes(roles[0]?.role))
        throw fail(403, "This account does not have admin access.");
      for (const [id, session] of sessions)
        if (session.expires <= now()) sessions.delete(id);
      if (sessions.size >= 1000)
        throw fail(503, "Please try signing in later.");
      const id = randomBytes(32).toString("hex");
      const duration = Math.min(Number(auth.expires_in) || 3600, 3600) * 1000;
      const session = {
        userId: auth.user.id,
        token: auth.access_token,
        expires: now() + duration,
      };
      if (sharedSessions) {
        await db("quicksub_admin_sessions", { method: "POST", body: {
          id: hash(id), user_id: session.userId, token: session.token,
          expires_at: new Date(session.expires).toISOString(),
        } });
      } else sessions.set(id, session);
      res.cookie("qs_admin", id, { ...cookieOptions(req), maxAge: duration });
      res.json({ email: auth.user.email, role: roles[0].role });
    }),
  );
  router.post("/admin/logout", run(async (req, res) => {
    const id = cookieId(req);
    if (sharedSessions && /^[a-f0-9]{64}$/.test(id || "")) {
      await db(`quicksub_admin_sessions?id=eq.${hash(id)}`, { method: "DELETE" });
    }
    sessions.delete(cookieId(req));
    res.clearCookie("qs_admin", cookieOptions(req));
    res.json({ ok: true });
  }));
  // Authentication is checked against Supabase, and role membership is checked on every request.
  router.use("/admin", (req, res, next) => {
    (async () => {
      const id = cookieId(req);
      let session;
      if (sharedSessions && /^[a-f0-9]{64}$/.test(id || "")) {
        const rows = await db(`quicksub_admin_sessions?id=eq.${hash(id)}&select=user_id,token,expires_at`);
        if (rows[0]) session = { userId: rows[0].user_id, token: rows[0].token, expires: Date.parse(rows[0].expires_at) };
      } else if (!sharedSessions) session = sessions.get(id);
      if (!session || session.expires <= now()) {
        sessions.delete(cookieId(req));
        throw fail(401, "Please sign in to the admin dashboard.");
      }
      const user = await remote("/auth/v1/user", { token: session.token });
      if (user.id !== session.userId) throw fail(401, "Please sign in again.");
      const roles = await db(
        `quicksub_admins?user_id=eq.${encodeURIComponent(user.id)}&select=role`,
      );
      if (!["owner", "staff"].includes(roles[0]?.role))
        throw fail(403, "Admin access has been removed.");
      req.admin = { id: user.id, email: user.email, role: roles[0].role };
      next();
    })().catch(next);
  });
  const customers = require("./customers").installCustomers({router,run,db,remote,rate,string,contact,now});
  router.get("/admin/session", (req, res) => res.json(req.admin));
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
      const examples = demoCheckout ? require('./demo-packages.json')[req.params.productId] || [] : [];
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
      const customer = await customers.user(req, false);
      const order = await db(customer ? "rpc/quicksub_customer_order" : "rpc/quicksub_create_order", {
        method: "POST",
        body: {
          ...(customer ? { p_user: customer.id } : {}),
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
  async function findOrder(req) {
    rate(req, "tracking", 20);
    const b = req.body || {};
    if (!uuid.test(b.id) || !/^[a-f0-9]{64}$/.test(b.accessCode))
      throw fail(404, "Order not found. Check your order ID and access code.");
    const rows = await db(
      `quicksub_orders?id=eq.${b.id}&tracking_hash=eq.${hash(b.accessCode)}&select=id,product_name,package_name,amount_bdt,status,payment_status,delivery_note,created_at,updated_at`,
    );
    if (!rows[0])
      throw fail(404, "Order not found. Check your order ID and access code.");
    return rows[0];
  }
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
  router.use((err, req, res, _next) => {
    if (err.status === 429) res.set("Retry-After", "60");
    res
      .status(err.status || (err.type === "entity.too.large" ? 413 : 500))
      .json({
        error: err.status
          ? err.message
          : err.type === "entity.too.large"
            ? "Image is too large."
            : "Unable to complete the request. Please try again.",
      });
  });
  return router;
}
module.exports = { createAdminRouter };
