import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID, randomBytes } from "node:crypto";
import {
  startTestServer,
  ownerId,
  staffId,
  packageId,
} from "./admin-test-server.mjs";

test("Admin/customer integration with real local SQL and simulated Supabase Auth", async (t) => {
  const env = await startTestServer();
  t.after(() => env.close());
  async function call(
    path,
    body,
    cookie = "",
    method = body === undefined ? "GET" : "POST",
    origin = env.base,
  ) {
    const response = await fetch(env.base + "/api" + path, {
      method,
      headers: {
        "Content-Type": "application/json",
        "X-QuickSub-Client": "web",
        Origin: origin,
        Cookie: cookie,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return {
      status: response.status,
      body: await response.json(),
      cookie: response.headers.get("set-cookie")?.split(";")[0],
    };
  }
  await t.test(
    "admin requires authentication and blocks cross-origin login",
    async () => {
      assert.equal((await call("/admin/data")).status, 401);
      assert.equal(
        (
          await call(
            "/admin/login",
            { email: "owner@example.test", password: "test-password" },
            "",
            "POST",
            "https://evil.test",
          )
        ).status,
        403,
      );
    },
  );
  const owner = await call("/admin/login", {
    email: "owner@example.test",
    password: "test-password",
  });
  assert.equal(owner.status, 200);
  assert.ok(owner.cookie);
  const staff = await call("/admin/login", {
    email: "staff@example.test",
    password: "test-password",
  });
  assert.equal(staff.status, 200);
  let product = (await call("/admin/data", undefined, owner.cookie)).body
    .products[0];
  await t.test(
    "owner catalog updates immediately reach customer API; staff cannot edit catalog",
    async () => {
      product = {
        ...product,
        price_bdt: 399,
        data: { ...product.data, name: "Netflix Updated" },
      };
      assert.equal(
        (await call("/admin/product/1", product, staff.cookie, "PUT")).status,
        403,
      );
      assert.equal(
        (await call("/admin/product/1", product, owner.cookie, "PUT")).status,
        200,
      );
      const result = await call("/products");
      assert.equal(result.body.products[0].name, "Netflix Updated");
      assert.equal(result.body.products[0].priceBdt, 399);
    },
  );
  const credentials = {
    id: randomUUID(),
    accessCode: randomBytes(32).toString("hex"),
  };
  const payload = {
    ...credentials,
    packageId,
    name: "Test Customer",
    contact: "buyer@example.test",
    note: "Player ID 123",
    expectedPrice: 299,
    amount_bdt: 1,
  };
  await t.test(
    "customer order uses exact database price and retries do not duplicate",
    async () => {
      const result = await call("/orders", payload);
      assert.equal(result.status, 201);
      assert.equal(Number(result.body.order.amount_bdt), 299);
      assert.equal(result.body.order.tracking_hash, undefined);
      assert.equal((await call("/orders", payload)).status, 201);
      assert.equal(
        (await env.db.query("select count(*)::int as n from quicksub_orders"))
          .rows[0].n,
        1,
      );
      assert.equal(
        (await call("/orders", { ...payload, accessCode: "a".repeat(64) }))
          .status,
        409,
      );
    },
  );
  await t.test("tracking code protects customer information", async () => {
    assert.equal(
      (
        await call("/orders/track", {
          ...credentials,
          accessCode: "b".repeat(64),
        })
      ).status,
      404,
    );
    const result = await call("/orders/track", credentials);
    assert.equal(result.status, 200);
    assert.equal(result.body.order.contact, undefined);
    assert.equal(result.body.order.tracking_hash, undefined);
  });
  await t.test(
    "cannot deliver unpaid order; payment reference remains pending manual verification",
    async () => {
      assert.equal(
        (
          await call(
            "/admin/order/" + credentials.id,
            {
              status: "delivered",
              payment_status: "unpaid",
              delivery_note: "Done",
            },
            staff.cookie,
            "PUT",
          )
        ).status,
        409,
      );
      assert.equal(
        (
          await call(
            "/admin/order/" + credentials.id,
            {
              status: "delivered",
              payment_status: "verified",
              delivery_note: "Done",
            },
            staff.cookie,
            "PUT",
          )
        ).status,
        409,
      );
      assert.equal(
        (
          await call("/orders/payment", {
            ...credentials,
            reference: "TEST-BKASH-123",
          })
        ).status,
        200,
      );
      assert.equal(
        (await call("/orders/track", credentials)).body.order.payment_status,
        "submitted",
      );
      assert.equal(
        (
          await call("/orders/payment", {
            ...credentials,
            reference: "OTHER-REF",
          })
        ).status,
        409,
      );
    },
  );
  await t.test(
    "staff delivery updates reach customer tracking and totals",
    async () => {
      assert.equal(
        (
          await call(
            "/admin/order/" + credentials.id,
            {
              status: "delivered",
              payment_status: "verified",
              delivery_note: "Activation complete. Contact support for help.",
            },
            staff.cookie,
            "PUT",
          )
        ).status,
        200,
      );
      const tracked = await call("/orders/track", credentials);
      assert.equal(tracked.body.order.status, "delivered");
      assert.match(tracked.body.order.delivery_note, /Activation/);
      const result = await call("/admin/data", undefined, owner.cookie);
      assert.equal(Number(result.body.overview.revenue), 299);
      assert.equal(result.body.customers[0].contact, "buyer@example.test");
      assert.ok(result.body.audit.some((a) => a.actor === staffId));
    },
  );

  await t.test('stale customer quotes cannot create an order', async () => {
    assert.equal((await call('/orders',{...payload,id:randomUUID(),expectedPrice:1})).status,409);
    assert.equal((await env.db.query('select count(*)::int as n from quicksub_orders')).rows[0].n,1);
  });
  await t.test('package edits update starting prices and Gemini knowledge', async () => {
    const plan={product_id:'1',name:'Updated monthly package',details:'One month',price_bdt:249,active:true};
    assert.equal((await call('/admin/package/'+packageId,plan,owner.cookie,'PUT')).status,200);
    const result=await call('/products');assert.equal(result.body.products[0].priceBdt,249);
    assert.equal(result.body.knowledge.packages[0].priceBdt,249);
    assert.equal((await call('/packages/1')).body.packages[0].price_bdt,249);
  });
  await t.test('offers and countdown settings reach customers and invalid settings are rejected', async () => {
    const settings={paymentInstructions:'Merchant instructions',supportHours:'9 AM–9 PM',dealEndsAt:'2026-10-17T17:59:59Z',deals:[{productId:'1',oldPrice:499}]};
    assert.equal((await call('/admin/content/settings',settings,owner.cookie,'PUT')).status,200);
    assert.deepEqual((await call('/store')).body.settings,settings);
    assert.equal((await call('/admin/content/settings',{...settings,dealEndsAt:'not-a-date'},owner.cookie,'PUT')).status,400);
  });
  await t.test('image uploads require owner access and safe image types', async () => {
    const bytes=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2nS8AAAAASUVORK5CYII=','base64');
    const upload=(cookie,type,body)=>fetch(env.base+'/api/admin/images',{method:'POST',headers:{'Content-Type':type,'X-QuickSub-Client':'web',Origin:env.base,Cookie:cookie},body});
    assert.equal((await upload(staff.cookie,'image/png',bytes)).status,403);
    assert.equal((await upload(owner.cookie,'image/svg+xml','<svg/>')).status,400);
    const result=await upload(owner.cookie,'image/png',bytes);assert.equal(result.status,200);assert.match((await result.json()).url,/storage\/v1\/object\/public\/quicksub-products\/admin\//);
  });
  await t.test("hidden products cannot receive orders", async () => {
    await call(
      "/admin/product/1",
      { ...product, active: false },
      owner.cookie,
      "PUT",
    );
    assert.deepEqual((await call("/packages/1")).body.packages, []);
    assert.equal(
      (await call("/orders", { ...payload, id: randomUUID() })).status,
      409,
    );
  });
  await t.test("FAQ and support request connect to both pages", async () => {
    const data = (await call("/admin/data", undefined, owner.cookie)).body;
    const store = data.content.find((c) => c.id === "store").data;
    store.faq = [{ id: "1", question: "New FAQ?", answer: "Updated answer" }];
    assert.equal(
      (await call("/admin/content/store", store, owner.cookie, "PUT")).status,
      200,
    );
    assert.equal((await call("/store")).body.faq[0].answer, "Updated answer");
    assert.equal(
      (
        await call("/requests", {
          kind: "support",
          contact: "help@example.test",
          message: "Help please",
        })
      ).status,
      200,
    );
    assert.equal(
      (await call("/admin/data", undefined, staff.cookie)).body.requests[0]
        .message,
      "Help please",
    );
  });
  await t.test(
    "revoked roles stop existing sessions; RPCs have no public execute permission",
    async () => {
      await env.db.query("delete from quicksub_admins where user_id=$1", [
        ownerId,
      ]);
      assert.equal(
        (await call("/admin/data", undefined, owner.cookie)).status,
        403,
      );
      const result = await env.db.query(
        "select has_function_privilege('anon','quicksub_admin_write(uuid,text,text,jsonb)','execute') as allowed",
      );
      assert.equal(result.rows[0].allowed, false);
    },
  );
  await t.test("logout removes session", async () => {
    assert.equal((await call("/admin/logout", {}, staff.cookie)).status, 200);
    assert.equal(
      (await call("/admin/data", undefined, staff.cookie)).status,
      401,
    );
  });
});
