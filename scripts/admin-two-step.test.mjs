import { test } from "node:test";
import assert from "node:assert/strict";
import { startTestServer } from "./admin-test-server.mjs";

const request = async (base, path, body, cookie = "") => {
  const response = await fetch(base + "/api" + path, {
    method: "POST",
    headers: {
      Origin: base,
      "Content-Type": "application/json",
      "X-QuickSub-Client": "web",
      Cookie: cookie,
    },
    body: JSON.stringify(body),
  });
  return {
    status: response.status,
    data: await response.json(),
    cookie: response.headers.get("set-cookie") || "",
  };
};

test("admin email two-step verification gates privileged sessions", async (t) => {
  let delivered;
  const env = await startTestServer({
    adminTwoStep: true,
    sendAdminCode: async (message) => {
      delivered = message;
    },
  });
  t.after(() => env.close());

  const login = await request(env.base, "/admin/login", {
    email: "owner@example.test",
    password: "test-password",
  });
  assert.equal(login.status, 202);
  assert.deepEqual(login.data, {
    requiresTwoStep: true,
    email: "o***@example.test",
  });
  assert.equal(login.data.code, undefined);
  assert.match(login.cookie, /qs_admin_challenge=[a-f0-9]{64}/);
  assert.match(login.cookie, /HttpOnly/i);
  assert.match(login.cookie, /SameSite=Strict/i);
  assert.match(login.cookie, /Path=\/api\/admin/);
  assert.match(delivered.code, /^\d{6}$/);
  assert.equal(delivered.email, "owner@example.test");
  const challengeCookie = login.cookie.match(/qs_admin_challenge=[a-f0-9]{64}/)[0];

  const blocked = await fetch(env.base + "/api/admin/session", {
    headers: { Cookie: challengeCookie },
  });
  assert.equal(blocked.status, 401);

  const wrong = await request(
    env.base,
    "/admin/verify",
    { code: delivered.code === "000000" ? "000001" : "000000" },
    challengeCookie,
  );
  assert.equal(wrong.status, 401);

  const verified = await request(
    env.base,
    "/admin/verify",
    { code: delivered.code },
    challengeCookie,
  );
  assert.equal(verified.status, 200);
  assert.deepEqual(verified.data, {
    email: "owner@example.test",
    role: "owner",
  });
  assert.match(verified.cookie, /qs_admin=[a-f0-9]{64}/);
  assert.equal(verified.data.access_token, undefined);

  const replay = await request(
    env.base,
    "/admin/verify",
    { code: delivered.code },
    challengeCookie,
  );
  assert.equal(replay.status, 401);
});

test("admin two-step challenge locks after five incorrect codes", async (t) => {
  let delivered;
  const env = await startTestServer({
    adminTwoStep: true,
    sendAdminCode: async (message) => {
      delivered = message;
    },
  });
  t.after(() => env.close());
  const login = await request(env.base, "/admin/login", {
    email: "owner@example.test",
    password: "test-password",
  });
  const cookie = login.cookie.match(/qs_admin_challenge=[a-f0-9]{64}/)[0];
  const wrongCode = delivered.code === "111111" ? "222222" : "111111";
  for (let attempt = 0; attempt < 5; attempt += 1)
    assert.equal(
      (await request(env.base, "/admin/verify", { code: wrongCode }, cookie))
        .status,
      401,
    );
  assert.equal(
    (await request(env.base, "/admin/verify", { code: delivered.code }, cookie))
      .status,
    401,
  );
});

test("admin two-step fails closed when email delivery fails", async (t) => {
  const env = await startTestServer({
    adminTwoStep: true,
    sendAdminCode: async () => {
      throw new Error("simulated mail failure");
    },
  });
  t.after(() => env.close());
  const login = await request(env.base, "/admin/login", {
    email: "owner@example.test",
    password: "test-password",
  });
  assert.equal(login.status, 503);
  assert.match(login.data.error, /could not be sent/i);
  assert.doesNotMatch(login.cookie, /qs_admin=/);
});
