begin;

create table if not exists public.quicksub_admin_challenges (
  id text primary key check (id ~ '^[a-f0-9]{64}$'),
  user_id uuid not null references auth.users(id) on delete cascade,
  email text not null check (length(email) between 3 and 254),
  role text not null check (role in ('owner','staff')),
  token text not null,
  refresh_token text,
  token_expires_at timestamptz not null,
  code_hash text not null check (code_hash ~ '^[a-f0-9]{64}$'),
  attempts integer not null default 0 check (attempts between 0 and 5),
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

alter table public.quicksub_admin_challenges enable row level security;
revoke all on public.quicksub_admin_challenges from public, anon, authenticated;
grant select, insert, update, delete on public.quicksub_admin_challenges to service_role;
create index if not exists quicksub_admin_challenges_expiry
  on public.quicksub_admin_challenges(expires_at);

create or replace function public.quicksub_create_admin_challenge(
  p_id text,
  p_user uuid,
  p_email text,
  p_role text,
  p_token text,
  p_refresh text,
  p_token_expires timestamptz,
  p_code_hash text,
  p_expires timestamptz
) returns void language plpgsql set search_path=public as $$
begin
  delete from quicksub_admin_challenges where expires_at <= now();
  insert into quicksub_admin_challenges(
    id,user_id,email,role,token,refresh_token,token_expires_at,code_hash,expires_at
  ) values(
    p_id,p_user,p_email,p_role,p_token,p_refresh,p_token_expires,p_code_hash,p_expires
  );
end $$;

create or replace function public.quicksub_consume_admin_challenge(
  p_id text,
  p_code_hash text,
  p_now timestamptz
) returns jsonb language plpgsql set search_path=public as $$
declare challenge quicksub_admin_challenges;
begin
  select * into challenge from quicksub_admin_challenges where id=p_id for update;
  if not found then return null; end if;
  if challenge.expires_at <= p_now or challenge.attempts >= 5 then
    delete from quicksub_admin_challenges where id=p_id;
    return null;
  end if;
  if challenge.code_hash <> p_code_hash then
    update quicksub_admin_challenges set attempts=attempts+1 where id=p_id;
    return jsonb_build_object('ok',false);
  end if;
  delete from quicksub_admin_challenges where id=p_id;
  return jsonb_build_object(
    'ok',true,
    'user_id',challenge.user_id,
    'email',challenge.email,
    'role',challenge.role,
    'token',challenge.token,
    'refresh_token',challenge.refresh_token,
    'token_expires_at',challenge.token_expires_at
  );
end $$;

revoke all on function public.quicksub_create_admin_challenge(text,uuid,text,text,text,text,timestamptz,text,timestamptz) from public,anon,authenticated;
revoke all on function public.quicksub_consume_admin_challenge(text,text,timestamptz) from public,anon,authenticated;
grant execute on function public.quicksub_create_admin_challenge(text,uuid,text,text,text,text,timestamptz,text,timestamptz) to service_role;
grant execute on function public.quicksub_consume_admin_challenge(text,text,timestamptz) to service_role;

notify pgrst, 'reload schema';
commit;
