Payment update: see [PAYMENT-SETUP.md](PAYMENT-SETUP.md) for gateway checkout, receipts, risk review, refunds, and the required payment migration. It supersedes the manual-only payment notes below.

# QuickSub Admin — setup and operations

The admin dashboard is at `/admin`. It shares the existing Node API and Supabase database with the customer website. The storefront's visual design is preserved; checkout and tracking are added inside its existing dialogs. The admin JavaScript and styles are loaded separately.

## Activate your database

1. Use Node.js 22.18 or newer. Run `npm ci` in the project root, then `npm ci --prefix server`.
2. In your Supabase project's SQL Editor, run these migrations in order (skip a migration if already applied):
   - `supabase/migrations/20260916000000_product_catalog.sql`
   - `supabase/migrations/20260917000000_admin_orders.sql`
3. Copy `server/.env.example` to `server/.env` if you do not have one. Privately configure `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `GEMINI_API_KEY`. The existing private file has blank values. Never put these keys in a `VITE_` variable or send them in chat.
4. Run `npm run db:seed` to import the original catalog and content. Existing records are preserved. To copy original images to Storage for newly imported products, use `npm run db:seed -- --upload-images`. Images can also be uploaded individually from the admin product editor.
5. In Supabase Authentication → Users, create your own email/password account. Copy its user UUID. Run the following SQL with your actual UUID:

```sql
insert into public.quicksub_admins(user_id, role)
values ('YOUR-AUTH-USER-UUID', 'owner');
```

To provision staff, create another Auth account and insert its UUID with role `staff`. Only owners edit products, packages, offers, content and settings. Staff can read the catalog/customers and handle orders and inbox requests. Role changes take effect on the next API request. Account provisioning remains in Supabase; the website has no public admin registration or default admin password.

6. Run `npm run build`, then `npm start`. Open `http://localhost:4000/admin` and sign in. For development, run `npm run dev` to start the backend and Vite together. An existing backend on port 4000 is reused.
7. For production, deploy the Node server together with `dist`, use HTTPS, set `NODE_ENV=production` and `PUBLIC_ORIGIN=https://your-exact-domain.example` (no trailing slash). Set `TRUST_PROXY_HOPS` only to the exact number of trusted reverse proxies in your deployment. A static-only host cannot provide admin login or checkout.

## Publish your first purchasable package

- Products: edit names, descriptions, category, images, advertised starting prices, display order, publication and stock. Hide records instead of deleting order history.
- Packages: add the actual duration/quantity, details and exact BDT price. Do not assume an advertised starting price is a verified package price. Active package changes synchronize the product's starting price to the lowest active package price.
- Settings: enter your real merchant payment instructions and support hours. The migration initializes a shared one-calendar-month countdown. Choose **Set one month from today**, then save to restart it when you launch a new campaign. It persists in the database and does not reset when customers refresh.
- Offers: choose products and genuine previous prices. Current prices come from the catalog. Expired, unavailable or non-discounted offers are hidden. Empty saved offers hide the offers section. Bundles can be modeled as a product with a package describing all included items.
- Open the customer website, view product details, select a package, and place an order. Products without a configured active package retain the WhatsApp support path.

## Orders and payments

The server reads the exact package price inside a database transaction and checks the customer's quoted price. Stale prices or unavailable products reject checkout. A retry uses the same order ID/access code and returns the existing order instead of creating a duplicate.

Customers receive a receipt containing an order UUID and a private access code. They should download the receipt. The latest receipt for each product remains in page memory if its dialog is closed and reopened, but does not survive a page reload. The access code is not stored in browser storage; only its SHA-256 hash is stored in the database. The Track Order dialog requires both values. Losing the receipt requires contacting human support and verifying ownership; there is no public email-only lookup.

Customers submit their payment method and transaction reference. This does **not** verify payment. Staff must check the actual merchant account, mark payment verified, and then process/deliver the order. A customer-facing delivery note is required for delivery. Do not store account passwords, OTPs, payment PINs or card numbers in these notes. The site does not activate third-party subscriptions or move/refund money automatically. Record a refund only after processing it through your payment provider.

The overview uses all-order database totals. Orders and customer directory are paginated in groups of 50. Search filters the displayed page. The customer directory aggregates each contact's complete history. Revenue includes verified payments and excludes records marked refunded. Current analytics do not attempt to reconcile external merchant statements.

## Content and inbox

FAQs and policies update both customer content and Gemini's store knowledge. The assistant never receives private orders, customer directory or payment references from the database. It cannot verify payments or read private order status. The customer's receipt-based tracker is the authoritative order view.

Support forms, restock requests and new newsletter subscriptions go to the admin inbox. Staff can mark them resolved/reopen them. Notifications, newsletters, replies, renewal reminders and fulfillment remain manual; no messages are automatically sent to customers. The old hardcoded newsletter service is no longer used for new signups. Existing subscribers in that external service are not automatically imported.

The original four category groups and existing customer reviews remain part of the storefront. This release does not add review moderation, automated recurring billing, automated delivery, marketing mail delivery or payment gateway integration.

## Security and deployment notes

- Supabase Auth checks identity; a private role table checks authorization. Tables and RPCs reject direct anonymous/authenticated access. The server service key stays private.
- Admin sessions use random HttpOnly, SameSite=Strict cookies, expire after at most one hour, and are held in server memory. A restart requires signing in again. Use one Node instance or sticky sessions; use a shared session/rate-limit store before horizontally scaling.
- Mutations require an exact same-origin request and a custom header. Login, order creation, tracking and public forms have per-IP rate limits. Set proxy configuration correctly.
- Record changes and their audit entries commit together. Uploaded product images use randomized Storage names; only JPEG, PNG and WebP are accepted, with a 6 MB limit. Images are public; never upload private customer documents.
- Catalog requests are cached for up to 60 seconds; admin changes invalidate the server cache. Customer pages refresh on focus and every 60 seconds while visible. Already-open package dialogs are rechecked against the database at checkout.
- During database/network failure, the existing catalog stays visible, but admin changes and checkout fail explicitly rather than reporting success. Gemini uses its honest fallback when unavailable.
- Configure your Supabase backup, retention, account recovery and access policies for your actual business before accepting live orders.

## Validation

- `npm run typecheck`
- `npm run lint`
- `npm run test:chat`
- `npm run test:admin` — real local PostgreSQL (PGlite), simulated Supabase Auth/HTTP transport.
- `npm run build`
- `npm run check:admin` — Chrome browser flow against the local SQL test server.
- `node scripts/check-chat.mjs` and `node scripts/check-privacy.mjs`

Tests do not use real keys, send payments or contact customers. The browser fixture accounts are test-only and are never used by the production server. Live Supabase Auth, Storage and Gemini still require your credentials and deployment verification.
