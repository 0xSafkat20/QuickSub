import { test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { packageId, startTestServer } from "./admin-test-server.mjs";

test("admin notifications use real unread data and exclude demo records", async (t) => {
  const env = await startTestServer();
  t.after(() => env.close());

  async function call(path, body, cookie = "") {
    const response = await fetch(env.base + "/api" + path, {
      method: body === undefined ? "GET" : "POST",
      headers: {
        Origin: env.base,
        "Content-Type": "application/json",
        "X-QuickSub-Client": "web",
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

  await call("/requests", {
    kind: "support",
    contact: "notification@example.test",
    message: "A real support request",
  });
  await call("/orders", {
    id: randomUUID(),
    accessCode: randomBytes(32).toString("hex"),
    packageId,
    name: "Real Customer",
    contact: "real@example.test",
    note: "",
    expectedPrice: 299,
  });
  await env.db.query(
    `insert into quicksub_orders(
      id,tracking_hash,package_id,product_name,package_name,amount_bdt,
      customer_name,contact,customer_note,is_demo
    ) values(
      'd0000000-0000-4000-8000-000000000099',repeat('d',64),$1,
      'Demo Product','Demo Package',299,'[DEMO] Customer',
      'demo@example.test','',true
    )`,
    [packageId],
  );

  const ownerLogin = await call("/admin/login", {
    email: "owner@example.test",
    password: "test-password",
  });
  const staffLogin = await call("/admin/login", {
    email: "staff@example.test",
    password: "test-password",
  });
  assert.equal(ownerLogin.status, 200);
  assert.equal(staffLogin.status, 200);

  const initial = await call("/admin/data", undefined, ownerLogin.cookie);
  assert.equal(initial.status, 200);
  assert.equal(initial.body.overview.orders, 1);
  assert.equal(initial.body.overview.pending, 1);
  assert.equal(initial.body.orders.length, 1);
  assert.equal(initial.body.orders[0].customer_name, "Real Customer");
  assert.deepEqual(initial.body.customers.map((customer) => customer.name), ["Real Customer"]);
  assert.equal(initial.body.notifications.Orders, 1);
  assert.equal(initial.body.notifications.Inbox, 1);

  const readOrders = await call(
    "/admin/notifications/read",
    { section: "Orders" },
    ownerLogin.cookie,
  );
  assert.equal(readOrders.status, 200);
  assert.equal((await call("/admin/data", undefined, ownerLogin.cookie)).body.notifications.Orders, 0);
  assert.equal((await call("/admin/data", undefined, staffLogin.cookie)).body.notifications.Orders, 1);

  assert.equal(
    (await call("/admin/notifications/read", { section: "all" }, ownerLogin.cookie)).status,
    200,
  );
  const cleared = (await call("/admin/data", undefined, ownerLogin.cookie)).body.notifications;
  assert.ok(Object.values(cleared).every((count) => count === 0));

  await env.db.query(
    "insert into quicksub_requests(kind,contact,message,created_at) values('support','new@example.test','New unread request',now()+interval '1 second')",
  );
  const afterNewRequest = (await call("/admin/data", undefined, ownerLogin.cookie)).body.notifications;
  assert.equal(afterNewRequest.Inbox, 1);
  assert.equal(afterNewRequest.Overview, 1);

  assert.equal(
    (await call("/admin/notifications/read", { section: "Unknown" }, ownerLogin.cookie)).status,
    400,
  );
});
