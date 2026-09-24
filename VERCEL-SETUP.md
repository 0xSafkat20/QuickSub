# Vercel deployment

The root vercel.json deploys the Vite frontend and api/index.js Express function together. Use the repository root as the Vercel root directory and Node 22.18+.

1. Apply every unapplied migration in `supabase/migrations` in filename order. Reporting requires `20260922000000_admin_reporting.sql` after the customer and payment migrations.
2. In Vercel project Settings > Environment Variables, configure SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, GEMINI_API_KEY, GEMINI_MODEL and PUBLIC_ORIGIN=https://quick-sub.vercel.app (no trailing slash). Never use VITE_ prefixes for secrets. Set NODE_ENV=production. Vercel supplies VERCEL=1 automatically, which enables shared database sessions.
3. Redeploy the latest GitHub commit. Both frontend and server dependencies must be installed; vercel.json supplies the install command.
4. Open /api/admin/session without signing in: JSON with HTTP 401 is expected, not a Vercel 404 page.
5. Open /admin and use your real Supabase Auth account, assigned owner or staff in quicksub_admins. owner@example.test and test-password work only in the local test server.

New sessions expire two hours after login, without sliding renewal, are revalidated against Supabase on every request, and are removed on logout. The session table is inaccessible to anon/authenticated roles. Schedule deletion of expired rows periodically with: delete from public.quicksub_admin_sessions where expires_at < now();

Rate limits and Gemini conversation history remain per-instance; use shared rate limiting or platform firewall controls before increasing traffic. Vercel request-size limits can also constrain image uploads below the app's 6 MB limit. Live platform verification requires deployment and configured credentials.

The account-cart migration `20260925000000_account_cart.sql` adds private saved carts. `/cart` has an explicit frontend rewrite. Deploy the matching frontend and API code together after applying the migration.
