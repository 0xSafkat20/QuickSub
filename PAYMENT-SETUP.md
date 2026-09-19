# QuickSub payments: activation and operations

This release adds SSLCOMMERZ hosted checkout beside manual payment, merchant-API verification, private customer payment history, admin transaction search, owner risk review, staff-managed full-refund records, and queued email receipts.

## Activate in staging

1. Apply all migrations in filename order, including `20260918000000_admin_sessions.sql` and `20260919000000_payments.sql`. Back up an existing database first. The new migration does not change existing manual order records.
2. Obtain a merchant account approved for the products you sell and sandbox credentials. Configure the backend variables in `server/.env.example`: `PUBLIC_ORIGIN` (exact HTTPS origin), `SSLCOMMERZ_MODE=sandbox`, `SSLCOMMERZ_STORE_ID`, and `SSLCOMMERZ_STORE_PASSWORD`. Never use VITE-prefixed secrets.
3. Deploy the Node API and frontend together. The existing Vercel `/api` rewrite supports the new routes. Configure the gateway IPN URL as `https://YOUR-DOMAIN/api/payments/ipn`. Success, failure, and cancellation return URLs are sent when checkout starts.
4. For QuickSub receipt emails, configure `RESEND_API_KEY` and `PAYMENT_RECEIPT_FROM` with a verified sending domain. Without these, receipts remain queued and the downloadable customer receipt still works. Customers must save the private access code before leaving checkout; it is not sent to the gateway or placed in URLs, email, or browser storage.
5. Generate a long random `PAYMENT_JOB_SECRET`. Configure your hosting scheduler to POST `/api/payments/jobs` with `Authorization: Bearer YOUR_SECRET` every minute. This is a backend job, not a Codex automation. Each invocation processes one unresolved payment and one email to stay within serverless request limits. Increase scheduler frequency/capacity as volume grows. Alert on non-2xx responses or a nonzero `errors` count and monitor queue backlog. The scheduler is not provisioned by this code change.
6. Run `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`, and `node scripts/check-payments.mjs`.
7. Exercise successful, failed, cancelled, delayed, repeated, wrong-amount, high-risk, and refund scenarios in the actual sandbox. Automated tests simulate external providers; they do not prove merchant activation.
8. Switch to a separate production database and live merchant credentials with `SSLCOMMERZ_MODE=live` only after sandbox checks. Do not change merchant credentials or mode while that database contains unresolved attempts. Perform a controlled live purchase and merchant-portal refund before opening wider sales.

## Behavior

- Prices come from the saved order, created using database package prices. The browser cannot choose the gateway charge amount.
- Checkout retries reuse the pending attempt and URL. A failed/cancelled provider-verified attempt allows a new attempt. Ambiguous timeouts or no-record provider responses stay pending; contact merchant support before retrying or changing records. Never clear pending records simply because time elapsed.
- IPN messages and return-page fields are untrusted. Only merchant-authenticated validation with matching transaction, BDT amount/currency, and bank reference can confirm payment. High or missing risk flags require review.
- Receipt return pages require the original private order receipt. The return redirect never marks payment successful. Customers can explicitly check status; background jobs recover confirmations even if the browser closes.
- Late payments after cancellation, manual submission, another active attempt, or an existing payment are recorded for review. Replayed confirmations do not duplicate order fulfillment or receipt queue entries.
- Staff find transactions in **Orders → Find a gateway transaction** using the full QuickSub payment ID or bank reference. Open an order to see all attempts and recheck unresolved payments. Pending or reviewed online payments block manual verification.
- Owners can approve a reviewed transaction after resolving conflicting attempts and documenting why it is safe. A cancelled or already-paid order cannot be reopened by this action. Refund duplicates through the merchant portal instead.
- Refund controls record a **full refund** performed through the merchant portal; they do not call a money-moving refund API. Record requested/pending/failed progress, and enter the provider reference only after confirming completion. A completed refund of the order's verified payment cancels that order. Partial refunds are not supported.
- After refund or review actions, refresh the admin order list before changing fulfillment status. Payment and refund changes have audit records; gateway records retain amount, transaction reference, and verification time. No card details are stored.
- Receipt email delivery retries using a stable Resend idempotency key. Provider acceptance is recorded; this is not proof of delivery to an inbox. Email providers can still reject/bounce messages. Monitor the queue and your provider dashboard; the provider's deduplication window is finite.
- Delivery remains manual. Payment confirmation does not activate third-party services automatically.

## References

- https://developer.sslcommerz.com/doc/v4/
- https://resend.com/docs/api-reference/emails/send-email
- https://resend.com/docs/dashboard/emails/idempotency-keys

## In-site checkout and demo packages

Product detail buttons, deals, and saved products now open `/checkout?product=PRODUCT_ID` inside QuickSub. Browser back/forward navigation works without a full page reload. Old `/buy?text=...` links also open checkout; WhatsApp is reserved for explicit support actions.

For local previews, set `QUICKSUB_DEMO_CHECKOUT=true` in `server/.env`. This has been enabled in the local workspace. The API offers demo packages only when the product has no real active packages; hidden/out-of-stock products remain unavailable. Example quantities and BDT prices are in `server/demo-packages.json` and are clearly labeled in the checkout.

Demo payment runs only in the browser. It never creates a database order, contacts the payment gateway, sends a receipt email, or moves money. Demo package IDs are rejected by the real order API. You can try successful and failed payment states without gateway credentials. Refreshing the page clears a demo payment.

To replace examples, sign in at `/admin`, open **Packages**, and add active packages with actual names, quantities/durations, and exact BDT prices. Real packages take precedence over demos for that product. Set `QUICKSUB_DEMO_CHECKOUT=false` before accepting real customers, configure the gateway as described above, and restart the API.

Run `npm run dev` to start the API and frontend together; `npm run dev:client` starts only Vite. Visit `http://localhost:5173/checkout?product=3` to preview PUBG UC checkout. Run `npm run check:checkout` for navigation, outage-retry, demo and real-order browser regressions.

### Demo payment options

Every demo package offers bKash, Nagad, Rocket, Visa, Mastercard, and Bank Transfer. Select a method, simulate success or failure, retry, or choose another package. These previews collect no payment details, move no money, and create no real orders.

Real packages use hosted checkout, which displays the payment methods enabled for your merchant account. The demo method list does not activate those methods for real payments.
