// Test-only Supabase transport. Uses real PostgreSQL via PGlite; Auth is simulated.
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const express = require("../server/node_modules/express");
const { createAdminRouter } = require("../server/admin");
const { createCatalog } = require("../server/catalog");
export const ownerId = "10000000-0000-4000-8000-000000000001";
export const staffId = "10000000-0000-4000-8000-000000000002";
export const packageId = "20000000-0000-4000-8000-000000000001";
export async function startTestServer({ port = 0, now = Date.now, password = "test-password" } = {}) {
  const db = new PGlite();
  await db.exec(
    `create role anon; create role authenticated; create role service_role; create schema auth; create table auth.users(id uuid primary key); create schema storage; create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);`,
  );
  for (const name of [
    "20260916000000_product_catalog.sql",
    "20260917000000_admin_orders.sql",
  ])
    await db.exec(
      await readFile(
        new URL("../supabase/migrations/" + name, import.meta.url),
        "utf8",
      ),
    );
  await db.query("insert into auth.users values ($1),($2)", [ownerId, staffId]);
  await db.query(
    "insert into quicksub_admins(user_id,role) values($1,'owner'),($2,'staff')",
    [ownerId, staffId],
  );
  const products = JSON.parse(
    await readFile(new URL("../server/catalog.json", import.meta.url), "utf8"),
  );
  const knowledge = JSON.parse(
    await readFile(
      new URL("../server/knowledge.json", import.meta.url),
      "utf8",
    ),
  );
  for (const [i, p] of products.entries())
    await db.query(
      "insert into quicksub_products(id,price_bdt,image_url,in_stock,sort_order,data) values($1,$2,$3,$4,$5,$6)",
      [
        p.id,
        Number(p.startingPrice.replace(/[^\d.]/g, "")),
        p.bannerImage,
        !p.outOfStock,
        i,
        JSON.stringify(p),
      ],
    );
  await db.query(
    "insert into quicksub_content values('store',$1,now()),('settings',$2,now()) on conflict(id) do update set data=excluded.data",
    [
      JSON.stringify(knowledge),
      JSON.stringify({
        paymentInstructions: "Test merchant — do not send real money",
        supportHours: "10 AM–11 PM",
        dealEndsAt: "2026-10-17T17:59:59Z",
      }),
    ],
  );
  await db.query(
    "insert into quicksub_packages(id,product_id,name,price_bdt,details) values($1,$2,$3,$4,$5)",
    [packageId, "1", "Premium · 1 month", 299, "One month package"],
  );
  const response = (body, status = 200) =>
    new Response(status === 204 ? null : JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    });
  const fetchImpl = async (url, options = {}) => {
    const u = new URL(url);
    const method = options.method || "GET";
    const body = typeof options.body === "string" ? JSON.parse(options.body) : null;
    if (u.pathname === "/auth/v1/token") {
      if (body.password !== password) return response({}, 400);
      const id =
        body.email === "owner@example.test"
          ? ownerId
          : body.email === "staff@example.test"
            ? staffId
            : null;
      return id
        ? response({
            user: { id, email: body.email },
            access_token: id,
            expires_in: 3600,
          })
        : response({}, 400);
    }
    if (u.pathname === "/auth/v1/user") {
      const id = options.headers.Authorization.replace("Bearer ", "");
      return [ownerId, staffId].includes(id)
        ? response({
            id,
            email: id === ownerId ? "owner@example.test" : "staff@example.test",
          })
        : response({}, 401);
    }
    if (u.pathname.startsWith("/storage/")) return response({});
    try {
      const path = u.pathname.replace("/rest/v1/", "");
      if (path.startsWith("rpc/")) {
        const name = path.slice(4);
        if (!/^quicksub_[a-z_]+$/.test(name)) throw Error("function");
        const entries = Object.entries(body);
        const args = entries
          .map(([k], i) => {
            if (!/^[a-z_]+$/.test(k)) throw Error("argument");
            return k + " => $" + (i + 1);
          })
          .join(",");
        const result = await db.query(
          `select ${name}(${args}) as result`,
          entries.map(([, v]) =>
            typeof v === "object" ? JSON.stringify(v) : v,
          ),
        );
        return response(result.rows[0].result);
      }
      if (!/^quicksub_[a-z_]+$/.test(path)) throw Error("table");
      const values = [];
      const where = [];
      for (const [k, v] of u.searchParams) {
        if (["select", "order", "limit", "offset"].includes(k)) continue;
        if (!/^[a-z_]+$/.test(k)) throw Error("column");
        if (v.startsWith("eq.")) {
          values.push(v.slice(3));
          where.push(`${k}=$${values.length}`);
        } else if (v.startsWith("in.(")) {
          const members = v.slice(4, -1).split(",");
          where.push(
            `${k} in (${members
              .map((x) => {
                values.push(x);
                return "$" + values.length;
              })
              .join(",")})`,
          );
        } else throw Error("filter");
      }
      const condition = where.length ? " where " + where.join(" and ") : "";
      if (method === "GET") {
        const select = u.searchParams.get("select") || "*";
        if (!/^[a-z_,*]+$/.test(select)) throw Error("select");
        const order = u.searchParams.get("order");
        const sort = order
          ? " order by " +
            order
              .split(",")
              .map((x) => {
                if (!/^[a-z_]+\.(asc|desc)$/.test(x)) throw Error("sort");
                return x.replace(".", " ");
              })
              .join(",")
          : "";
        const limit = Number(u.searchParams.get("limit") || 1000),
          offset = Number(u.searchParams.get("offset") || 0);
        return response(
          (
            await db.query(
              `select ${select} from ${path}${condition}${sort} limit ${limit} offset ${offset}`,
              values,
            )
          ).rows,
        );
      }
      if (method === "PATCH") {
        const updates = Object.entries(body).map(([k, v]) => {
          if (!/^[a-z_]+$/.test(k)) throw Error("field");
          values.push(v);
          return k + "=$" + values.length;
        });
        return response(
          (
            await db.query(
              `update ${path} set ${updates.join(",")}${condition} returning *`,
              values,
            )
          ).rows,
        );
      }
      if (method === "POST") {
        const entries = Object.entries(body);
        await db.query(
          `insert into ${path}(${entries.map(([k]) => k).join(",")}) values(${entries.map((_, i) => "$" + (i + 1)).join(",")})`,
          entries.map(([, v]) => v),
        );
        return response(null, 204);
      }
    } catch (e) {
      return response({ message: e.message }, 400);
    }
    return response({}, 404);
  };
  const catalog = createCatalog({
    localProducts: products,
    localKnowledge: knowledge,
    url: "https://supabase.test",
    key: "test-only-key",
    fetchImpl,
  });
  const app = express();
  app.use(express.json({ limit: "16kb" }));
  app.get("/api/products", async (_req, res) => res.json(await catalog.get()));
  app.use(
    "/api",
    createAdminRouter({
      url: "https://supabase.test",
      key: "test-only-key",
      fetchImpl,
      invalidate: catalog.invalidate,
      now,
    }),
  );
  app.use(
    express.static(
      new URL("../dist", import.meta.url).pathname.replace(
        /^\/([A-Za-z]:)/,
        "$1",
      ),
    ),
  );
  app.get("/admin", (_req, res) =>
    res.sendFile(
      new URL("../dist/index.html", import.meta.url).pathname.replace(
        /^\/([A-Za-z]:)/,
        "$1",
      ),
    ),
  );
  const server = await new Promise((resolve) => {
    const s = app.listen(port, "127.0.0.1", () => resolve(s));
  });
  return {
    db,
    base: "http://127.0.0.1:" + server.address().port,
    close: async () => {
      await new Promise((resolve) => server.close(resolve));
      await db.close();
    },
  };
}
