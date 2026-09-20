begin;
-- Customer data is accessible only through the authenticated Node API.
create table if not exists public.quicksub_customers (
 user_id uuid primary key references auth.users(id) on delete cascade,
 name text not null default '' check(length(name)<=120),
 contact text not null default '' check(length(contact)<=160),
 renewal_reminders boolean not null default true,
 updated_at timestamptz not null default now()
);
create table if not exists public.quicksub_customer_sessions (
 id text primary key,
 user_id uuid not null references auth.users(id) on delete cascade,
 token text not null,
 expires_at timestamptz not null
);
alter table public.quicksub_orders add column if not exists customer_id uuid references auth.users(id) on delete set null;
alter table public.quicksub_orders add column if not exists expires_at timestamptz;
create index if not exists quicksub_orders_customer_created_idx on public.quicksub_orders(customer_id,created_at desc);
create index if not exists quicksub_customer_sessions_expiry_idx on public.quicksub_customer_sessions(expires_at);
do $$ declare t text; begin
 foreach t in array array['quicksub_customers','quicksub_customer_sessions'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from public,anon,authenticated',t);
  execute format('grant all on public.%I to service_role',t);
 end loop;
end $$;

create or replace function public.quicksub_save_customer(p_user uuid,p_name text,p_contact text,p_reminders boolean)
returns jsonb language plpgsql set search_path=public as $$
declare result quicksub_customers;
begin
 insert into quicksub_customers(user_id,name,contact,renewal_reminders) values(p_user,p_name,p_contact,p_reminders)
 on conflict(user_id) do update set name=excluded.name,contact=excluded.contact,renewal_reminders=excluded.renewal_reminders,updated_at=now()
 returning * into result;
 return to_jsonb(result);
end $$;

-- Creation and ownership assignment are atomic; retries cannot transfer ownership.
create or replace function public.quicksub_customer_order(p_user uuid,p_id uuid,p_hash text,p_package uuid,p_name text,p_contact text,p_note text,p_expected numeric)
returns jsonb language plpgsql set search_path=public as $$
declare result jsonb; existing quicksub_orders;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_id::text,0));
 select * into existing from quicksub_orders where id=p_id;
 if found and existing.customer_id is distinct from p_user then raise exception 'Order unavailable'; end if;
 result := quicksub_create_order(p_id,p_hash,p_package,p_name,p_contact,p_note,p_expected);
 update quicksub_orders set customer_id=p_user where id=p_id;
 return result || jsonb_build_object('customer_id',p_user);
end $$;

create or replace function public.quicksub_claim_order(p_user uuid,p_id uuid,p_hash text)
returns void language plpgsql set search_path=public as $$
begin
 perform 1 from quicksub_orders where id=p_id and tracking_hash=p_hash and (customer_id is null or customer_id=p_user) for update;
 if not found then raise exception 'Order unavailable'; end if;
 update quicksub_orders set customer_id=p_user where id=p_id and (customer_id is null or customer_id=p_user);
 if not found then raise exception 'Order unavailable'; end if;
end $$;

create or replace function public.quicksub_set_expiry(p_actor uuid,p_id uuid,p_expires timestamptz)
returns void language plpgsql set search_path=public as $$
begin
 if not exists(select 1 from quicksub_admins where user_id=p_actor and role in ('owner','staff')) then raise exception 'Forbidden'; end if;
 perform 1 from quicksub_orders where id=p_id and status='delivered' and payment_status='verified' for update;
 if not found then raise exception 'Save paid and delivered status first'; end if;
 update quicksub_orders set expires_at=p_expires,updated_at=now() where id=p_id;
 insert into quicksub_audit(actor,action,record_id) values(p_actor,'subscription-expiry',p_id::text);
end $$;
revoke all on function public.quicksub_save_customer(uuid,text,text,boolean),public.quicksub_customer_order(uuid,uuid,text,uuid,text,text,text,numeric),public.quicksub_claim_order(uuid,uuid,text),public.quicksub_set_expiry(uuid,uuid,timestamptz) from public,anon,authenticated;
grant execute on function public.quicksub_save_customer(uuid,text,text,boolean),public.quicksub_customer_order(uuid,uuid,text,uuid,text,text,text,numeric),public.quicksub_claim_order(uuid,uuid,text),public.quicksub_set_expiry(uuid,uuid,timestamptz) to service_role;

notify pgrst, 'reload schema';
commit;
