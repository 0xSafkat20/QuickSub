# Customer account setup

Apply `supabase/migrations/20260920000000_customers.sql` in the Supabase SQL Editor after the existing catalog, admin/orders, and payment migrations. This adds customer profiles, server sessions, order ownership, and subscription expiry. It preserves existing orders; they remain guest orders until the receipt owner claims them.

The backend uses the existing `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. No secrets or Auth tokens are exposed to the frontend or stored in localStorage. Restart the Node API after updating the code.

Enable email/password signup in Supabase Authentication. Keep email confirmation enabled, configure your email sender, and set the Auth Site URL to your public website `/account`. Confirmation links return there; customers then sign in with their password. Local testing can use `http://localhost:5173/account`. Production uses HTTPS. Supabase email limits and delivery depend on your Auth SMTP configuration.

Visit `/account` to create an account, sign in, edit saved details, view paginated order history, or link a guest order using its ID and private receipt code. Real purchases made while signed in are linked atomically to the authenticated user. Checkout offers a button to reuse saved contact details. Demo purchases still do not create real orders or save checkout details.

Sessions last at most one hour. Logout invalidates the database session immediately. Expired sessions require another password sign-in. Customer login does not grant admin access. Tables and RPCs deny direct public/anonymous/authenticated access; only the backend service role can use them, with ownership verified in the API. Contact details are not used to infer order ownership.

In Admin > Orders, save the payment as verified and the order as delivered, then reopen the order and save its confirmed subscription expiry date. One-time products should have no expiry. This action is audited. Account order cards show expiry and opt-in dashboard reminders seven days before expiry and after expiration. Renew opens a fresh checkout with current packages and prices; there are no automatic charges or email reminders.

Verification: `node --test scripts/customers.integration.test.mjs`, `npm run typecheck`, `npm run lint`, `npm run build`, and `node scripts/check-accounts.mjs`. Automated Auth responses are simulated; the schema and ownership operations run in real PostgreSQL via PGlite. Verify confirmation email delivery separately with your configured Supabase project.
