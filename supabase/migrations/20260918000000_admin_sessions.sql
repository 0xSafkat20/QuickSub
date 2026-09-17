-- Private shared sessions for serverless deployments.
create table if not exists public.quicksub_admin_sessions (
  id text primary key check (id ~ '^[a-f0-9]{64}$'),
  user_id uuid not null references auth.users(id) on delete cascade,
  token text not null,
  expires_at timestamptz not null
);
alter table public.quicksub_admin_sessions enable row level security;
revoke all on public.quicksub_admin_sessions from public, anon, authenticated;
grant select, insert, delete on public.quicksub_admin_sessions to service_role;
create index if not exists quicksub_admin_sessions_expiry on public.quicksub_admin_sessions(expires_at);
