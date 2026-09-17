# QuickSub test report

## Result

**The final automated verification run passed.** There are **62 passing Node test results** (including two parent scenario groups), four passing browser suites, a successful production build, and no TypeScript or ESLint errors. ESLint still reports three existing Fast Refresh warnings.

This is a bounded code and regression test report, **not a claim that every possible input, function or browser has been tested**. Coverage is measured only for the backend modules and test transport loaded by the Node suites. Frontend coverage percentages, the production entry point's coverage, and live cloud behavior are not included in those percentages.

The machine-readable run time, per-step exit codes and durations are in [results.json](deliverables/test-report/results.json).

## What was fixed

1. **Passwords containing leading/trailing spaces could not authenticate correctly.** The backend trimmed passwords before submitting them to Supabase. Passwords are now passed exactly as entered; ordinary text fields still trim whitespace. A regression verifies that the exact password succeeds and its trimmed form fails.
2. **Malformed nested content could return server errors.** Null FAQ entries, null policy objects and null policy sections now return validation errors rather than unexpected exceptions. Each has an explicit negative test.
3. **Fractional pagination could produce invalid database requests.** Offsets are now normalized to nonnegative bounded integers, with a regression for `offset=0.5`.
4. **Punctuation-only phone contacts were accepted.** Phone input now requires at least eight digits in addition to the existing permitted-character and length checks. A regression rejects `--------`.

Changes are in `server/admin.js`. The production build has been regenerated. Previously delivered ZIPs predate these fixes.

## Weak tests strengthened

- Expanded the test suite from **32 to 62 passing results**.
- Matched the SQL test server's JSON limit to production: **16 KB**, replacing its previous 64 KB allowance.
- Added an injectable clock to test expiry and rate-limit resets without waiting in real time.
- Replaced the product-name input interaction with a reliable form fill and an exact-value assertion before saving. Customer-page loading still verifies that the saved change reaches the storefront.
- Changed the chat and privacy browser tests to use dynamically allocated ports. They can run while the user's site is already running on port 4000.
- Made privacy tests explicitly simulate unavailable API responses and blocked external requests. They no longer depend on whichever backend happens to be running locally.
- Added credential-free tests for missing configuration, provider authentication failure, network failure, error sanitization and invalid login fields.
- Added SQL-backed tests for concurrent duplicate order submissions, failed-write/audit rollback, refunds and irreversible refund states, protected-table/RPC privileges, session expiry, rate-limit recovery and malformed admin payloads.
- Added a storefront browser suite for search recovery, numeric price sorting, saved-product persistence, comparison selection and policy dialogs.
- Added a fail-fast verification runner. It saves each command's output and stops immediately if a step fails, preventing a later successful command from hiding an earlier failure.
- Added coverage gates: **95% lines, 80% branches, 90% functions** across the instrumented test run. The current run passes these gates.

## Coverage

Baseline figures are in [backend.txt](deliverables/test-report/backend.txt); final figures are in [coverage-gates.txt](deliverables/test-report/coverage-gates.txt).

- **Admin API:** 98.34% lines, 83.43% branches, 95.35% functions. Branch coverage improved from 62.84%.
- **Catalog:** 100% lines, 85.45% branches, 100% functions.
- **Gemini chat:** 98.39% lines, 89.74% branches, 100% functions.
- **Aggregate, including the simulated Supabase transport:** 98.25% lines, 85.01% branches, 96.55% functions.

High coverage does not establish exhaustive correctness. Some error paths, capacity limits and upload failures remain unexercised. The SQL tests use a real local PostgreSQL engine through PGlite, with simulated Supabase Auth and HTTP/Storage responses. A concurrent-request test proves duplicate suppression through that local setup; it is not a production multi-instance load test.

## Tested behavior

### Admin, checkout and database

- Authorized login, failed login, private cookie attributes, exact password handling, logout, session expiry and revoked roles.
- Missing/cross-origin requests and missing custom request headers are rejected for mutations.
- Staff cannot edit owner-only catalog data or upload images.
- Product/package edits reach public catalog responses; package price edits reach Gemini knowledge and advertised starting prices.
- Hidden products have no purchasable packages and reject new orders.
- Customer-supplied totals do not override database prices; stale quoted prices reject checkout.
- Sequential retries and concurrent duplicate submissions create one order.
- Invalid tracking codes cannot read orders; public tracking responses exclude customer contact and tracking hashes.
- Payment references require manual verification; repeat submissions cannot overwrite a submitted reference.
- Unpaid orders cannot be delivered. Failed fulfillment does not create an audit entry or partially update the order.
- Verified fulfillment reaches customer tracking. Refunds remove revenue and cannot be reverted to verified state.
- FAQs, empty published lists, offer deadlines, inbox requests and customer totals.
- Owner image-upload path and rejection of staff/SVG requests. Storage upload itself is simulated.
- Anonymous/authenticated table and RPC permissions.

### Customer browser behavior

- Admin edit → customer catalog → checkout → payment reference → admin fulfillment → private tracking.
- Desktop and narrow mobile layouts in headless Chrome.
- Search selection clears a conflicting product text filter.
- Prices sort numerically; saved products survive reload; comparison selection updates; policy dialog opens.
- Multi-turn chat, Bangla responses, safe WhatsApp handoff, rate-limit messages and outage recovery.
- Real HTTP handling for malformed/oversized chat requests and WhatsApp redirect encoding.
- Seven privacy cases: normal storage, denied reads, denied writes, invalid favorite structure, null favorites, malformed JSON and mixed invalid favorite IDs. External resources are blocked and APIs are simulated unavailable.
- No uncaught browser runtime errors in the completed suites.

### Build and dependencies

- TypeScript check: passed.
- ESLint: no errors; three existing mixed-export/Fast Refresh warnings in CompareDrawer, LegalModal and WishlistContext.
- Production build and generated knowledge files: passed.
- `npm audit --omit=dev` for root and server production dependencies: **zero reported advisories at the time of the scan**. Development dependencies were not included in this advisory check. Dependency audits do not replace application security testing.

## Remaining findings and limits

1. **Live integrations remain unverified.** Supabase/Gemini credentials are not configured. Actual cloud authentication, RLS deployment, Storage permissions, image uploads, Gemini responses and production proxy/HTTPS cookie behavior still need a live smoke test after setup.
2. **Some existing storefront controls are placeholders.** PromoBanner bundle buttons and footer social buttons have no action handlers/links. The footer's Order Status link points to the contact section rather than opening tracking. These are functional gaps found during inspection, not passing tested purchase flows. Social destinations require the owner's real profile URLs; no URLs were invented.
3. **The tests do not exhaust every component interaction.** Review carousel timing, every animation/responsive breakpoint, every keyboard/focus interaction, all accessibility requirements and all legal-content combinations have not been exhaustively checked. Search is checked against a conflicting text filter; all possible category/stock/filter combinations are not covered.
4. **Browser coverage is Chrome only.** Ad-blocker behavior is simulated through blocked requests/storage; actual extension-specific filter lists, Safari and Firefox were not run.
5. **No production load or payment-provider test was performed.** Multi-instance sessions/rate limits, large catalogs, all pagination boundaries, sustained load, merchant reconciliation and automatic payment/refund integrations remain outside this run.
6. **Import and legacy service limitations.** The build-time knowledge generator runs during the build. The live Supabase seed/image import and the legacy newsletter Edge Function were not executed. New storefront newsletter submissions use the Node inbox API instead of that legacy function.
7. **Some existing limitations are intentional product scope.** Payments and fulfillment are manual; accounts, recurring billing, automated notifications and review moderation are not implemented by these tests.

## Reproduce

Use Node.js 22.18+ and install root/server dependencies as described in ADMIN-SETUP.md. Browser scripts require Chrome; set `CHROME_PATH` if it is not at the default Windows location.

```text
npm test
npm run test:coverage
npm run verify
npm run verify:full
```

`verify` runs type checking, lint, coverage-gated tests and the build. `verify:full` adds all four browser suites. Each run replaces its files under `deliverables/test-report/` and writes `results.json`.

## Evidence

- [Final coverage and test results](deliverables/test-report/coverage-gates.txt)
- [Run manifest](deliverables/test-report/results.json)
- [Admin browser results](deliverables/test-report/browser-admin.txt)
- [Chat browser results](deliverables/test-report/browser-chat.txt)
- [Privacy browser results](deliverables/test-report/browser-privacy.txt)
- [Storefront browser results](deliverables/test-report/browser-storefront.txt)
- [TypeScript](deliverables/test-report/typecheck.txt), [lint](deliverables/test-report/lint.txt), [build](deliverables/test-report/build.txt)
- [Root production dependency scan](deliverables/test-report/dependencies-root.json), [server scan](deliverables/test-report/dependencies-server.json)
