-- Apply before deploying the two-hour session implementation.
-- Refresh credentials remain in private server-only tables, never browser storage.
begin;
alter table public.quicksub_admin_sessions add column if not exists refresh_token text;
alter table public.quicksub_admin_sessions add column if not exists token_expires_at timestamptz;
alter table public.quicksub_customer_sessions add column if not exists refresh_token text;
alter table public.quicksub_customer_sessions add column if not exists token_expires_at timestamptz;
grant update on public.quicksub_admin_sessions to service_role;
commit;
