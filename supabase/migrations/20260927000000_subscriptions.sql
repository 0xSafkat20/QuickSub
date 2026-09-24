begin;

alter table public.quicksub_orders
  add column if not exists renewal_of uuid,
  add column if not exists payment_confirmed_at timestamptz;

create table if not exists public.quicksub_subscriptions (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.quicksub_orders(id) on delete restrict,
  customer_id uuid not null references auth.users(id) on delete cascade,
  package_id uuid not null references public.quicksub_packages(id) on delete restrict,
  product_id text not null references public.quicksub_products(id) on delete restrict,
  renewed_from uuid references public.quicksub_subscriptions(id) on delete set null,
  product_name text not null,
  package_name text not null,
  amount_bdt numeric(12,2) not null check(amount_bdt > 0),
  status text not null check(status in ('upcoming','active','expired','suspended','cancelled')),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  payment_confirmed_at timestamptz not null,
  device_limit integer not null default 1 check(device_limit between 1 and 100),
  account_reference text not null default '' check(length(account_reference) <= 160),
  delivery_instructions text not null default '' check(length(delivery_instructions) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check(ends_at > starts_at)
);

alter table public.quicksub_orders
  drop constraint if exists quicksub_orders_renewal_of_fkey;
alter table public.quicksub_orders
  add constraint quicksub_orders_renewal_of_fkey foreign key(renewal_of)
  references public.quicksub_subscriptions(id) on delete set null;

create table if not exists public.quicksub_subscription_reminders (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.quicksub_subscriptions(id) on delete cascade,
  customer_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check(kind in ('7_days','3_days','1_day','expired')),
  due_at timestamptz not null,
  message text not null check(length(message) between 1 and 500),
  read_at timestamptz,
  created_at timestamptz not null default now(),
  unique(subscription_id,kind)
);

create index if not exists quicksub_subscriptions_customer_end_idx on public.quicksub_subscriptions(customer_id,ends_at desc);
create index if not exists quicksub_subscriptions_status_end_idx on public.quicksub_subscriptions(status,ends_at);
create index if not exists quicksub_subscription_reminders_customer_due_idx on public.quicksub_subscription_reminders(customer_id,due_at desc);

do $$ declare t text; begin
  foreach t in array array['quicksub_subscriptions','quicksub_subscription_reminders'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on public.%I from public,anon,authenticated',t);
    execute format('grant select,insert,update,delete on public.%I to service_role',t);
  end loop;
end $$;

create or replace function public.quicksub_sync_subscription_reminders(p_id uuid)
returns void language plpgsql set search_path=public as $$
declare s quicksub_subscriptions;
begin
  select * into s from quicksub_subscriptions where id=p_id;
  if not found then return; end if;
  if s.status='cancelled' then delete from quicksub_subscription_reminders where subscription_id=s.id; return; end if;
  insert into quicksub_subscription_reminders(subscription_id,customer_id,kind,due_at,message) values
    (s.id,s.customer_id,'7_days',s.ends_at-interval '7 days',s.product_name||' expires in 7 days.'),
    (s.id,s.customer_id,'3_days',s.ends_at-interval '3 days',s.product_name||' expires in 3 days.'),
    (s.id,s.customer_id,'1_day',s.ends_at-interval '1 day',s.product_name||' expires tomorrow.'),
    (s.id,s.customer_id,'expired',s.ends_at,s.product_name||' has expired. Renew to restore access.')
  on conflict(subscription_id,kind) do update set customer_id=excluded.customer_id,due_at=excluded.due_at,message=excluded.message,
    read_at=case when quicksub_subscription_reminders.due_at is distinct from excluded.due_at then null else quicksub_subscription_reminders.read_at end;
end $$;

create or replace function public.quicksub_activate_subscription(p_order uuid)
returns jsonb language plpgsql set search_path=public as $$
declare o quicksub_orders; pkg quicksub_packages; previous quicksub_subscriptions; result quicksub_subscriptions;
declare confirmed timestamptz; begins timestamptz; finishes timestamptz; devices integer;
begin
  select * into o from quicksub_orders where id=p_order for update;
  if not found or o.customer_id is null or o.payment_status<>'verified' or o.subscription_period='' or o.product_category='gaming' then return null; end if;
  select * into result from quicksub_subscriptions where order_id=o.id;
  if found then return to_jsonb(result); end if;
  confirmed:=coalesce(o.payment_confirmed_at,o.subscription_started_at,o.updated_at,now());
  if o.renewal_of is not null then
    select * into previous from quicksub_subscriptions where id=o.renewal_of and customer_id=o.customer_id and package_id=o.package_id for update;
    if not found then raise exception 'Renewal subscription unavailable'; end if;
  end if;
  begins:=case when previous.id is not null and previous.ends_at>confirmed then previous.ends_at else confirmed end;
  finishes:=(begins at time zone 'Asia/Dhaka' + o.subscription_period::interval) at time zone 'Asia/Dhaka';
  select * into pkg from quicksub_packages where id=o.package_id;
  devices:=coalesce(nullif((regexp_match(lower(coalesce(o.package_details,'')),'([0-9]+)\s*devices?'))[1], '')::integer,1);
  devices:=greatest(1,least(devices,100));
  insert into quicksub_subscriptions(order_id,customer_id,package_id,product_id,renewed_from,product_name,package_name,amount_bdt,status,starts_at,ends_at,payment_confirmed_at,device_limit)
  values(o.id,o.customer_id,o.package_id,pkg.product_id,previous.id,o.product_name,o.package_name,o.amount_bdt,case when begins>now() then 'upcoming' else 'active' end,begins,finishes,confirmed,devices)
  returning * into result;
  update quicksub_orders set subscription_started_at=begins,expires_at=finishes,payment_confirmed_at=confirmed where id=o.id;
  perform quicksub_sync_subscription_reminders(result.id);
  return to_jsonb(result);
end $$;

create or replace function public.quicksub_order_subscription_trigger()
returns trigger language plpgsql set search_path=public as $$
begin
  if new.payment_status='verified' and (old.payment_status is distinct from 'verified' or old.customer_id is distinct from new.customer_id) then
    perform quicksub_activate_subscription(new.id);
  end if;
  return new;
end $$;
drop trigger if exists quicksub_order_subscription on public.quicksub_orders;
create trigger quicksub_order_subscription after update of payment_status,customer_id on public.quicksub_orders
for each row execute function public.quicksub_order_subscription_trigger();

create or replace function public.quicksub_payment_confirmed_timestamp()
returns trigger language plpgsql set search_path=public as $$
begin
  if new.payment_status='verified' and old.payment_status is distinct from 'verified' and new.payment_confirmed_at is null then new.payment_confirmed_at:=now(); end if;
  return new;
end $$;
drop trigger if exists quicksub_payment_confirmed_timestamp on public.quicksub_orders;
create trigger quicksub_payment_confirmed_timestamp before update of payment_status on public.quicksub_orders
for each row execute function public.quicksub_payment_confirmed_timestamp();

create or replace function public.quicksub_process_subscriptions(p_now timestamptz default now())
returns jsonb language plpgsql set search_path=public as $$
declare activated integer; expired_count integer;
begin
  update quicksub_subscriptions set status='active',updated_at=p_now where status='upcoming' and starts_at<=p_now and ends_at>p_now;
  get diagnostics activated=row_count;
  update quicksub_subscriptions set status='expired',updated_at=p_now where status in ('upcoming','active') and ends_at<=p_now;
  get diagnostics expired_count=row_count;
  return jsonb_build_object('activated',activated,'expired',expired_count,'processedAt',p_now);
end $$;

create or replace function public.quicksub_admin_subscription(p_actor uuid,p_id uuid,p_status text,p_ends timestamptz,p_device integer,p_account text,p_instructions text)
returns jsonb language plpgsql set search_path=public as $$
declare role_name text; current_row quicksub_subscriptions; result quicksub_subscriptions;
begin
  select role into role_name from quicksub_admins where user_id=p_actor;
  if role_name not in ('owner','staff') then raise exception 'Forbidden'; end if;
  select * into current_row from quicksub_subscriptions where id=p_id for update;
  if not found then raise exception 'Subscription not found'; end if;
  if p_status not in ('upcoming','active','expired','suspended','cancelled') then raise exception 'Invalid subscription status'; end if;
  if current_row.status='cancelled' and p_status<>'cancelled' then raise exception 'Cancelled subscriptions cannot be reopened'; end if;
  if p_status='cancelled' and role_name<>'owner' then raise exception 'Owner access required'; end if;
  if p_ends<=current_row.starts_at then raise exception 'Expiry must be after the start date'; end if;
  if p_device not between 1 and 100 then raise exception 'Invalid device limit'; end if;
  update quicksub_subscriptions set status=p_status,ends_at=p_ends,device_limit=p_device,account_reference=p_account,delivery_instructions=p_instructions,updated_at=now() where id=p_id returning * into result;
  update quicksub_orders set expires_at=p_ends,updated_at=now() where id=result.order_id;
  perform quicksub_sync_subscription_reminders(result.id);
  insert into quicksub_audit(actor,action,record_id) values(p_actor,'subscription-update',p_id::text);
  return to_jsonb(result);
end $$;

create or replace function public.quicksub_set_expiry(p_actor uuid,p_id uuid,p_expires timestamptz)
returns void language plpgsql set search_path=public as $$
declare sub_id uuid;
begin
  if not exists(select 1 from quicksub_admins where user_id=p_actor and role in ('owner','staff')) then raise exception 'Forbidden'; end if;
  perform 1 from quicksub_orders where id=p_id and status='delivered' and payment_status='verified' for update;
  if not found then raise exception 'Save paid and delivered status first'; end if;
  update quicksub_orders set expires_at=p_expires,updated_at=now() where id=p_id;
  select id into sub_id from quicksub_subscriptions where order_id=p_id;
  if sub_id is null then select (quicksub_activate_subscription(p_id)->>'id')::uuid into sub_id; end if;
  if sub_id is not null and p_expires is not null then
    update quicksub_subscriptions set ends_at=p_expires,status=case when p_expires<=now() then 'expired' when starts_at>now() then 'upcoming' else 'active' end,updated_at=now() where id=sub_id;
    perform quicksub_sync_subscription_reminders(sub_id);
  end if;
  insert into quicksub_audit(actor,action,record_id) values(p_actor,'subscription-expiry',p_id::text);
end $$;

create or replace function public.quicksub_place_order(p_user uuid,p_cart boolean,p_id uuid,p_hash text,p_package uuid,p_name text,p_contact text,p_note text,p_expected numeric,p_email text,p_game text,p_renewal uuid)
returns jsonb language plpgsql set search_path=public as $$
declare result jsonb; existing quicksub_orders; source quicksub_subscriptions;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_id::text,0));
  select * into existing from quicksub_orders where id=p_id;
  if existing.id is not null then
    if existing.tracking_hash<>p_hash or existing.customer_id is distinct from p_user or existing.renewal_of is distinct from p_renewal then raise exception 'Order unavailable'; end if;
    return to_jsonb(existing)-'tracking_hash';
  end if;
  if p_renewal is not null then
    if p_user is null then raise exception 'Sign in to renew a subscription'; end if;
    select * into source from quicksub_subscriptions where id=p_renewal and customer_id=p_user and package_id=p_package and status in ('active','expired') for share;
    if not found then raise exception 'Subscription cannot be renewed'; end if;
  end if;
  if p_cart then result:=quicksub_checkout_cart(p_user,p_id,p_hash,p_package,p_name,p_contact,p_note,p_expected);
  elsif p_user is not null then result:=quicksub_customer_order(p_user,p_id,p_hash,p_package,p_name,p_contact,p_note,p_expected);
  else result:=quicksub_create_order(p_id,p_hash,p_package,p_name,p_contact,p_note,p_expected); end if;
  update quicksub_orders set receipt_email=p_email,game_account=p_game,renewal_of=p_renewal where id=p_id;
  select to_jsonb(o)-'tracking_hash' into result from quicksub_orders o where id=p_id;
  return result;
end $$;

create or replace function public.quicksub_claim_order(p_user uuid,p_id uuid,p_hash text)
returns void language plpgsql set search_path=public as $$
begin
  perform 1 from quicksub_orders where id=p_id and tracking_hash=p_hash and (customer_id is null or customer_id=p_user) for update;
  if not found then raise exception 'Order unavailable'; end if;
  update quicksub_orders set customer_id=p_user where id=p_id and (customer_id is null or customer_id=p_user);
  if not found then raise exception 'Order unavailable'; end if;
  perform quicksub_activate_subscription(p_id);
end $$;

revoke all on function public.quicksub_sync_subscription_reminders(uuid),public.quicksub_activate_subscription(uuid),public.quicksub_order_subscription_trigger(),public.quicksub_payment_confirmed_timestamp(),public.quicksub_process_subscriptions(timestamptz),public.quicksub_admin_subscription(uuid,uuid,text,timestamptz,integer,text,text),public.quicksub_place_order(uuid,boolean,uuid,text,uuid,text,text,text,numeric,text,text,uuid) from public,anon,authenticated;
grant execute on function public.quicksub_sync_subscription_reminders(uuid),public.quicksub_activate_subscription(uuid),public.quicksub_process_subscriptions(timestamptz),public.quicksub_admin_subscription(uuid,uuid,text,timestamptz,integer,text,text),public.quicksub_place_order(uuid,boolean,uuid,text,uuid,text,text,text,numeric,text,text,uuid) to service_role;

-- Preserve paid subscription history created before this migration.
update quicksub_orders set payment_confirmed_at=coalesce(payment_confirmed_at,subscription_started_at,updated_at)
where payment_status='verified' and payment_confirmed_at is null;
do $$ declare item record; begin
  for item in select id from quicksub_orders where customer_id is not null and payment_status='verified' and subscription_period<>'' and product_category<>'gaming' loop
    perform quicksub_activate_subscription(item.id);
  end loop;
end $$;

notify pgrst,'reload schema';
commit;
