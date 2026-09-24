Current admin and checkout setup: see [ADMIN-SETUP.md](../ADMIN-SETUP.md). The Node server must run alongside the production frontend; static-only hosting cannot support these APIs.

QuickSub backend

This small Express backend exposes two endpoints to keep your WhatsApp contact number out of the frontend code.

- GET /api/contact
  - Returns JSON: { whatsapp: "https://wa.me/..." }
  - Optional query `text` to prefill the WhatsApp message (URL-encoded or plain; server will encode).

- GET /buy
  - Redirects (302) to WhatsApp with the configured number and default message.
  - Optional query `text` to override the default message.

Run:

```bash
cd server
npm install
npm start
```

Notes:
- Configure the number in `server/config.json`. The file currently contains your number as provided and assumes country `880` (Bangladesh). If you want a different country code, update `country`.
- Frontend can call `/api/contact` or link to `/buy` on the same origin (or point to this server's URL in production).
Backend structure
-----------------

- `index.js`: HTTP entry point, catalog/chat routes, static files, CORS and final error handling.
- `auth.js`: admin login/logout, session storage and per-request admin authorization.
- `orders.js`: order creation, access-code authorization, tracking and manual payment submission.
- `customers.js`: customer authentication, profile and subscription routes.
- `validation.js`: shared validators and strict account request schemas. Invalid fields return HTTP 400 with `error` and `fields`; passwords are never trimmed.
- `http.js`: Express 4 async wrapper and safe JSON error handler.
- `admin.js`: composition of these modules and remaining administrative routes.

Existing API URLs are unchanged. Account schemas reject extra fields. Business rules and order idempotency remain enforced by the existing database functions.

Production requirements
-----------------------

Set `NODE_ENV=production`, `PUBLIC_ORIGIN` to the exact HTTPS frontend origin (without a trailing slash), and the existing Supabase credentials. Apply `supabase/migrations/20260918000000_admin_sessions.sql` before deployment: production now uses database-backed admin sessions on every hosting platform, not only Vercel. Local development still uses in-memory admin sessions. Configure `TRUST_PROXY_HOPS` only for the actual trusted proxy chain.

CORS grants access only to `PUBLIC_ORIGIN`; without it, cross-origin browser access is disabled. Existing same-origin write checks and client headers remain required. Payment provider callbacks retain their separate verification flow.

Rate limiting is still per-process. A distributed rate limiter and administrator MFA remain future work; this refactor does not implement them.

Validation
----------

Run `npm test` from the repository root for unit and PostgreSQL-backed integration tests. `server/foundation.test.js` covers strict account validation, rejection before upstream requests, and safe async/parser error handling. Integration tests use PGlite and simulated authentication/payment providers; they do not exercise live Supabase or payment accounts.

Two-hour login sessions
-----------------------

Apply `supabase/migrations/20260924000000_two_hour_sessions.sql` after the previous migrations and before deploying this code. It adds private refresh-token metadata to both session tables; it does not modify orders, profiles, or customer ownership. Existing sessions retain their original expiry; sign in again to start a new two-hour session.

New customer and admin logins have an absolute 7,200-second deadline. Activity and Supabase access-token refresh do not extend it. The backend rejects expired sessions and clears their cookies; account/admin pages also leave the signed-in view on a timer and recheck when a sleeping tab regains focus. Supabase credentials stay on the server. Keep the provider's refresh-token reuse interval enabled for concurrent requests across instances.

Expiry and logout do not delete profiles or orders. Logging in to the same account restores its order history. Checkout fields and the selected package now persist in browser local storage across logout/reload, alongside the existing favorites. This is browser-local draft persistence, not cross-device cart synchronization. Clearing site data, private browsing, or blocked storage can remove/prevent local draft persistence. Do not enter passwords or payment-card details in checkout notes.

Run `node scripts/check-session-expiry.mjs` after `npm run build` for a browser regression check. It uses the local SQL test server and simulated time to check logout, server rejection, re-login, order restoration, and checkout draft recovery without waiting two real hours. `npm test` covers deadline boundaries, provider refresh, concurrent refresh, and logout during refresh.

Account-based cart
------------------

Apply `supabase/migrations/20260925000000_account_cart.sql` after the earlier migrations. Cart data is private to the backend service role. The API always obtains the owner from the validated customer session, never from a request field.

Routes:
- `GET /api/cart`: up to 20 saved packages with current prices and availability.
- `PUT /api/cart/items/:packageId`: save/update `{name, contact, note}`. Repeated saves replace the same package; client prices and owner IDs are rejected.
- `DELETE /api/cart/items/:packageId`: remove that package from the signed-in account only.
- `POST /api/orders` with `fromCart: true`: customer login required; atomically create the order and remove that cart item. Failed transactions keep the cart intact. Retries return the original order without removing items saved again afterward.
- `/cart`: direct browser entry, refresh and navigation supported by Express, React and Vercel rewrites.

Each package has its own order/payment. The cart supports one saved entry per package (no quantities or combined payment). It does not reserve inventory or lock a price. Existing order verification checks live prices/availability at checkout. Inactive packages remain visible as unavailable; deleting a package removes its cart entries through the foreign key.

Saved cart delivery details sync across devices after login. Guest checkout drafts remain browser-local. Login expiry removes access, not stored cart data or orders.

Run `npm run test:cart` and `npm run check:cart` for the API and browser regressions. `npm run demo:cart` starts a disposable simulation at `http://127.0.0.1:4178/cart`, using the demo credentials printed by the command. Build first. The simulation cannot charge real money or change the live database.
