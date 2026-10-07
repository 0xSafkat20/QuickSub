begin;

alter table public.quicksub_customers
  add column if not exists preferred_locale text not null default 'en-BD'
    check (preferred_locale in ('en-BD','bn-BD')),
  add column if not exists referral_code text,
  add column if not exists referred_by uuid references auth.users(id) on delete set null;

update public.quicksub_customers
set referral_code=upper(substr(replace(user_id::text,'-',''),1,8))
where referral_code is null;

alter table public.quicksub_customers alter column referral_code set not null;
create unique index if not exists quicksub_customers_referral_code_idx
  on public.quicksub_customers(upper(referral_code));

alter table public.quicksub_orders
  add column if not exists is_demo boolean not null default false,
  add column if not exists subtotal_bdt numeric(12,2),
  add column if not exists loyalty_discount_bdt numeric(12,2) not null default 0,
  add column if not exists loyalty_points_redeemed integer not null default 0,
  add column if not exists referral_code text;

update public.quicksub_orders set subtotal_bdt=amount_bdt where subtotal_bdt is null;
alter table public.quicksub_orders alter column subtotal_bdt set not null;
alter table public.quicksub_orders
  drop constraint if exists quicksub_orders_loyalty_discount_check,
  add constraint quicksub_orders_loyalty_discount_check check(loyalty_discount_bdt>=0 and loyalty_discount_bdt<=subtotal_bdt),
  drop constraint if exists quicksub_orders_loyalty_points_check,
  add constraint quicksub_orders_loyalty_points_check check(loyalty_points_redeemed>=0);

create or replace function public.quicksub_order_loyalty_defaults()
returns trigger language plpgsql set search_path=public as $$
begin
 new.subtotal_bdt:=coalesce(new.subtotal_bdt,new.amount_bdt);
 return new;
end $$;
drop trigger if exists quicksub_order_loyalty_defaults on public.quicksub_orders;
create trigger quicksub_order_loyalty_defaults before insert on public.quicksub_orders
for each row execute function public.quicksub_order_loyalty_defaults();

create table if not exists public.quicksub_loyalty_settings (
  id boolean primary key default true check(id),
  enabled boolean not null default true,
  points_per_10_bdt integer not null default 1 check(points_per_10_bdt between 0 and 100),
  bdt_per_point numeric(8,4) not null default 0.25 check(bdt_per_point>0 and bdt_per_point<=100),
  minimum_redemption integer not null default 100 check(minimum_redemption between 1 and 1000000),
  maximum_discount_percent integer not null default 20 check(maximum_discount_percent between 1 and 100),
  referral_reward integer not null default 100 check(referral_reward between 0 and 1000000),
  referred_reward integer not null default 50 check(referred_reward between 0 and 1000000),
  referral_wait_days integer not null default 7 check(referral_wait_days between 0 and 90),
  monthly_referral_limit integer not null default 10 check(monthly_referral_limit between 1 and 10000),
  updated_at timestamptz not null default now()
);
insert into public.quicksub_loyalty_settings(id) values(true) on conflict(id) do nothing;

create table if not exists public.quicksub_loyalty_transactions (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references auth.users(id) on delete cascade,
  order_id uuid references public.quicksub_orders(id) on delete restrict,
  kind text not null check(kind in ('purchase','redemption','redemption-return','refund-reversal','referral','welcome-referral','admin-adjustment')),
  points integer not null check(points<>0),
  description text not null default '' check(length(description)<=240),
  event_key text not null unique check(length(event_key) between 3 and 200),
  created_at timestamptz not null default now()
);
create index if not exists quicksub_loyalty_customer_created_idx on public.quicksub_loyalty_transactions(customer_id,created_at desc);

-- Preserve points already earned by customers whose verified purchases were
-- completed before this migration was installed.
insert into public.quicksub_loyalty_transactions(customer_id,order_id,kind,points,description,event_key,created_at)
select o.customer_id,o.id,'purchase',floor(o.amount_bdt/10)::integer*s.points_per_10_bdt,
  'Points earned from delivered order','purchase:'||o.id,o.updated_at
from public.quicksub_orders o cross join public.quicksub_loyalty_settings s
where s.id and s.enabled and o.customer_id is not null and not o.is_demo
  and o.status='delivered' and o.payment_status='verified'
  and floor(o.amount_bdt/10)::integer*s.points_per_10_bdt>0
on conflict(event_key) do nothing;

create table if not exists public.quicksub_referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references auth.users(id) on delete cascade,
  referred_id uuid not null unique references auth.users(id) on delete cascade,
  referral_code text not null,
  qualifying_order_id uuid unique references public.quicksub_orders(id) on delete restrict,
  status text not null default 'registered' check(status in ('registered','pending','rewarded','rejected')),
  eligible_at timestamptz,
  rewarded_at timestamptz,
  rejection_reason text not null default '',
  created_at timestamptz not null default now(),
  check(referrer_id<>referred_id)
);
create index if not exists quicksub_referrals_referrer_created_idx on public.quicksub_referrals(referrer_id,created_at desc);

do $$ declare t text; begin
  foreach t in array array['quicksub_loyalty_settings','quicksub_loyalty_transactions','quicksub_referrals'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on public.%I from public,anon,authenticated',t);
    execute format('grant all on public.%I to service_role',t);
  end loop;
end $$;

drop function if exists public.quicksub_save_customer(uuid,text,text,boolean);
create or replace function public.quicksub_save_customer(p_user uuid,p_name text,p_contact text,p_reminders boolean,p_locale text default null)
returns jsonb language plpgsql set search_path=public as $$
declare result quicksub_customers; locale text;
begin
 locale:=case when p_locale in ('en-BD','bn-BD') then p_locale else null end;
 insert into quicksub_customers(user_id,name,contact,renewal_reminders,preferred_locale,referral_code)
 values(p_user,p_name,p_contact,p_reminders,coalesce(locale,'en-BD'),upper(substr(replace(p_user::text,'-',''),1,8)))
 on conflict(user_id) do update set name=excluded.name,contact=excluded.contact,
   renewal_reminders=excluded.renewal_reminders,preferred_locale=coalesce(locale,quicksub_customers.preferred_locale),updated_at=now()
 returning * into result;
 return to_jsonb(result);
end $$;

create or replace function public.quicksub_attach_referral(p_user uuid,p_code text)
returns jsonb language plpgsql set search_path=public as $$
declare owner_id uuid; result quicksub_referrals;
begin
 if p_code is null or btrim(p_code)='' then return null; end if;
 select user_id into owner_id from quicksub_customers where upper(referral_code)=upper(btrim(p_code));
 if owner_id is null then raise exception 'Referral code not found'; end if;
 if owner_id=p_user then raise exception 'You cannot use your own referral code'; end if;
 if exists(select 1 from quicksub_orders where customer_id=p_user and not is_demo) then raise exception 'Referral codes are only for new customers'; end if;
 insert into quicksub_referrals(referrer_id,referred_id,referral_code)
 values(owner_id,p_user,upper(btrim(p_code)))
 on conflict(referred_id) do update set referral_code=quicksub_referrals.referral_code
 returning * into result;
 update quicksub_customers set referred_by=owner_id where user_id=p_user and referred_by is null;
 return to_jsonb(result);
end $$;

create or replace function public.quicksub_loyalty_balance(p_user uuid)
returns integer language sql stable set search_path=public as $$
 select coalesce(sum(points),0)::integer from quicksub_loyalty_transactions where customer_id=p_user;
$$;

create or replace function public.quicksub_loyalty_summary(p_user uuid)
returns jsonb language sql stable set search_path=public as $$
 with profile as (
   select referral_code,preferred_locale from quicksub_customers where user_id=p_user
 ), settings as (select * from quicksub_loyalty_settings where id), refs as (
   select count(*) total,count(*) filter(where status='pending') pending,count(*) filter(where status='rewarded') rewarded
   from quicksub_referrals where referrer_id=p_user
 ) select jsonb_build_object(
   'balance',quicksub_loyalty_balance(p_user),
   'lifetimeEarned',coalesce((select sum(greatest(points,0)) from quicksub_loyalty_transactions where customer_id=p_user),0),
   'lifetimeRedeemed',coalesce((select -sum(least(points,0)) from quicksub_loyalty_transactions where customer_id=p_user and kind='redemption'),0),
   'referralCode',(select referral_code from profile),
   'locale',(select preferred_locale from profile),
   'referrals',jsonb_build_object('total',refs.total,'pending',refs.pending,'rewarded',refs.rewarded),
   'settings',to_jsonb(settings)-'id'-'updated_at',
   'transactions',coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at desc) from
     (select id,order_id,kind,points,description,created_at from quicksub_loyalty_transactions where customer_id=p_user order by created_at desc limit 50)x),'[]'::jsonb)
 ) from refs,settings;
$$;

create or replace function public.quicksub_redeem_order_points(p_user uuid,p_order uuid,p_points integer)
returns jsonb language plpgsql set search_path=public as $$
declare o quicksub_orders; s quicksub_loyalty_settings; available integer; max_points integer; discount numeric;
begin
 if p_points is null or p_points=0 then return null; end if;
 if p_points<0 then raise exception 'Invalid reward points'; end if;
 select * into s from quicksub_loyalty_settings where id for share;
 if not s.enabled then raise exception 'Rewards are currently unavailable'; end if;
 select * into o from quicksub_orders where id=p_order and customer_id=p_user and status='pending' and payment_status='unpaid' for update;
 if not found then raise exception 'Order is not eligible for rewards'; end if;
 if o.loyalty_points_redeemed>0 then return to_jsonb(o)-'tracking_hash'; end if;
 select quicksub_loyalty_balance(p_user) into available;
 max_points:=floor((o.subtotal_bdt*s.maximum_discount_percent/100)/s.bdt_per_point);
 if p_points<s.minimum_redemption or p_points>available or p_points>max_points then raise exception 'Reward points exceed the eligible balance or order limit'; end if;
 discount:=least(o.subtotal_bdt-1,round(p_points*s.bdt_per_point,2));
 update quicksub_orders set loyalty_points_redeemed=p_points,loyalty_discount_bdt=discount,amount_bdt=subtotal_bdt-discount,updated_at=now() where id=p_order returning * into o;
 insert into quicksub_loyalty_transactions(customer_id,order_id,kind,points,description,event_key)
 values(p_user,p_order,'redemption',-p_points,'Points applied to order','redeem:'||p_order)
 on conflict(event_key) do nothing;
 return to_jsonb(o)-'tracking_hash';
end $$;

create or replace function public.quicksub_loyalty_order_event()
returns trigger language plpgsql set search_path=public as $$
declare s quicksub_loyalty_settings; earned integer; ref quicksub_referrals;
begin
 select * into s from quicksub_loyalty_settings where id;
 if new.customer_id is not null and not new.is_demo and s.enabled then
   if new.status='delivered' and new.payment_status='verified' and
      (old.status is distinct from 'delivered' or old.payment_status is distinct from 'verified') then
     earned:=floor(new.amount_bdt/10)*s.points_per_10_bdt;
     if earned>0 then insert into quicksub_loyalty_transactions(customer_id,order_id,kind,points,description,event_key)
       values(new.customer_id,new.id,'purchase',earned,'Points earned from delivered order','purchase:'||new.id)
       on conflict(event_key) do nothing; end if;
     select * into ref from quicksub_referrals where referred_id=new.customer_id and status='registered' for update;
     if ref.id is not null then update quicksub_referrals set status='pending',qualifying_order_id=new.id,
       eligible_at=now()+make_interval(days=>s.referral_wait_days) where id=ref.id; end if;
   end if;
   if new.payment_status='refunded' and old.payment_status is distinct from 'refunded' then
     select points into earned from quicksub_loyalty_transactions where event_key='purchase:'||new.id;
     if earned is not null then insert into quicksub_loyalty_transactions(customer_id,order_id,kind,points,description,event_key)
       values(new.customer_id,new.id,'refund-reversal',-earned,'Purchase points reversed after refund','refund:'||new.id)
       on conflict(event_key) do nothing; end if;
     update quicksub_referrals set status='rejected',rejection_reason='Qualifying order was refunded'
       where qualifying_order_id=new.id and status='pending';
     select * into ref from quicksub_referrals where qualifying_order_id=new.id and status='rewarded' for update;
     if ref.id is not null then
       select points into earned from quicksub_loyalty_transactions where event_key='referrer:'||ref.id;
       if earned is not null then insert into quicksub_loyalty_transactions(customer_id,order_id,kind,points,description,event_key)
         values(ref.referrer_id,new.id,'refund-reversal',-earned,'Referral reward reversed after refund','referrer-refund:'||ref.id)
         on conflict(event_key) do nothing; end if;
       select points into earned from quicksub_loyalty_transactions where event_key='referred:'||ref.id;
       if earned is not null then insert into quicksub_loyalty_transactions(customer_id,order_id,kind,points,description,event_key)
         values(ref.referred_id,new.id,'refund-reversal',-earned,'Welcome reward reversed after refund','referred-refund:'||ref.id)
         on conflict(event_key) do nothing; end if;
       update quicksub_referrals set status='rejected',rejection_reason='Reward reversed because the qualifying order was refunded' where id=ref.id;
     end if;
   end if;
   if new.status='cancelled' and old.status is distinct from 'cancelled' and new.loyalty_points_redeemed>0 then
     insert into quicksub_loyalty_transactions(customer_id,order_id,kind,points,description,event_key)
     values(new.customer_id,new.id,'redemption-return',new.loyalty_points_redeemed,'Points returned from cancelled order','return:'||new.id)
     on conflict(event_key) do nothing;
   end if;
 end if;
 return new;
end $$;
drop trigger if exists quicksub_loyalty_order_event on public.quicksub_orders;
create trigger quicksub_loyalty_order_event after update of status,payment_status on public.quicksub_orders
for each row execute function public.quicksub_loyalty_order_event();

create or replace function public.quicksub_process_referrals(p_now timestamptz default now())
returns jsonb language plpgsql set search_path=public as $$
declare item quicksub_referrals; s quicksub_loyalty_settings; processed integer:=0; monthly integer;
begin
 perform pg_advisory_xact_lock(hashtext('quicksub_process_referrals'));
 select * into s from quicksub_loyalty_settings where id;
 for item in select * from quicksub_referrals where status='pending' and eligible_at<=p_now loop
   if exists(select 1 from quicksub_orders where id=item.qualifying_order_id and status='delivered' and payment_status='verified') then
     select count(*) into monthly from quicksub_referrals where referrer_id=item.referrer_id and status='rewarded'
       and rewarded_at>=date_trunc('month',p_now);
     if monthly>=s.monthly_referral_limit then
       update quicksub_referrals set status='rejected',rejection_reason='Monthly referral reward limit reached' where id=item.id;
     else
       if s.referral_reward>0 then insert into quicksub_loyalty_transactions(customer_id,order_id,kind,points,description,event_key)
         values(item.referrer_id,item.qualifying_order_id,'referral',s.referral_reward,'Reward for a successful referral','referrer:'||item.id)
         on conflict(event_key) do nothing; end if;
       if s.referred_reward>0 then insert into quicksub_loyalty_transactions(customer_id,order_id,kind,points,description,event_key)
         values(item.referred_id,item.qualifying_order_id,'welcome-referral',s.referred_reward,'Welcome reward from a referral','referred:'||item.id)
         on conflict(event_key) do nothing; end if;
       update quicksub_referrals set status='rewarded',rewarded_at=p_now where id=item.id;
       processed:=processed+1;
     end if;
   else update quicksub_referrals set status='rejected',rejection_reason='Qualifying order is no longer eligible' where id=item.id;
   end if;
 end loop;
 return jsonb_build_object('processed',processed);
end $$;

create or replace function public.quicksub_admin_loyalty(p_actor uuid)
returns jsonb language plpgsql stable set search_path=public as $$
begin
 if not exists(select 1 from quicksub_admins where user_id=p_actor and role='owner') then raise exception 'Forbidden'; end if;
 return jsonb_build_object(
   'settings',(select to_jsonb(s)-'id' from quicksub_loyalty_settings s where id),
   'summary',jsonb_build_object(
     'outstanding',coalesce((select sum(points) from quicksub_loyalty_transactions),0),
     'issued',coalesce((select sum(greatest(points,0)) from quicksub_loyalty_transactions),0),
     'redeemed',coalesce((select -sum(least(points,0)) from quicksub_loyalty_transactions where kind='redemption'),0),
     'referrals',coalesce((select count(*) from quicksub_referrals),0),
     'pendingReferrals',coalesce((select count(*) from quicksub_referrals where status='pending'),0)
   ),
   'recent',coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at desc) from
     (select t.id,t.customer_id,t.order_id,t.kind,t.points,t.description,t.created_at,c.name,c.contact
      from quicksub_loyalty_transactions t left join quicksub_customers c on c.user_id=t.customer_id
      order by t.created_at desc limit 100)x),'[]'::jsonb),
   'referralRows',coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at desc) from
     (select r.*,a.name referrer_name,b.name referred_name from quicksub_referrals r
      left join quicksub_customers a on a.user_id=r.referrer_id left join quicksub_customers b on b.user_id=r.referred_id
      order by r.created_at desc limit 100)x),'[]'::jsonb)
 );
end $$;

create or replace function public.quicksub_admin_loyalty_settings(p_actor uuid,p_data jsonb)
returns jsonb language plpgsql set search_path=public as $$
declare result quicksub_loyalty_settings;
begin
 if not exists(select 1 from quicksub_admins where user_id=p_actor and role='owner') then raise exception 'Forbidden'; end if;
 update quicksub_loyalty_settings set
   enabled=(p_data->>'enabled')::boolean,
   points_per_10_bdt=(p_data->>'points_per_10_bdt')::integer,
   bdt_per_point=0.25,
   minimum_redemption=(p_data->>'minimum_redemption')::integer,
   maximum_discount_percent=(p_data->>'maximum_discount_percent')::integer,
   referral_reward=(p_data->>'referral_reward')::integer,
   referred_reward=(p_data->>'referred_reward')::integer,
   referral_wait_days=(p_data->>'referral_wait_days')::integer,
   monthly_referral_limit=(p_data->>'monthly_referral_limit')::integer,
   updated_at=now() where id returning * into result;
 insert into quicksub_audit(actor,action,record_id) values(p_actor,'loyalty-settings','loyalty');
 return to_jsonb(result)-'id';
end $$;

create or replace function public.quicksub_admin_loyalty_adjust(p_actor uuid,p_customer uuid,p_points integer,p_reason text)
returns jsonb language plpgsql set search_path=public as $$
declare result quicksub_loyalty_transactions;
begin
 if not exists(select 1 from quicksub_admins where user_id=p_actor and role='owner') then raise exception 'Forbidden'; end if;
 if p_points=0 or abs(p_points)>100000 or length(btrim(p_reason))<5 then raise exception 'Invalid loyalty adjustment'; end if;
 if p_points<0 and quicksub_loyalty_balance(p_customer)+p_points<0 then raise exception 'Adjustment would create a negative balance'; end if;
 insert into quicksub_loyalty_transactions(customer_id,kind,points,description,event_key)
 values(p_customer,'admin-adjustment',p_points,btrim(p_reason),'adjust:'||gen_random_uuid()) returning * into result;
 insert into quicksub_audit(actor,action,record_id) values(p_actor,'loyalty-adjustment',result.id::text);
 return to_jsonb(result);
end $$;

-- The new overload preserves every existing validation in the established order
-- function, then applies points in the same database transaction.
create or replace function public.quicksub_place_order(p_user uuid,p_cart boolean,p_id uuid,p_hash text,p_package uuid,p_name text,p_contact text,p_note text,p_expected numeric,p_email text,p_game text,p_renewal uuid,p_points integer)
returns jsonb language plpgsql set search_path=public as $$
declare result jsonb;
begin
 result:=quicksub_place_order(p_user,p_cart,p_id,p_hash,p_package,p_name,p_contact,p_note,p_expected,p_email,p_game,p_renewal);
 if coalesce(p_points,0)>0 then
   if p_user is null then raise exception 'Sign in to redeem reward points'; end if;
   result:=quicksub_redeem_order_points(p_user,p_id,p_points);
 end if;
 return result;
end $$;

revoke all on function public.quicksub_order_loyalty_defaults(),public.quicksub_save_customer(uuid,text,text,boolean,text),public.quicksub_attach_referral(uuid,text),
 public.quicksub_loyalty_balance(uuid),public.quicksub_loyalty_summary(uuid),public.quicksub_redeem_order_points(uuid,uuid,integer),
 public.quicksub_loyalty_order_event(),public.quicksub_process_referrals(timestamptz),public.quicksub_admin_loyalty(uuid),
 public.quicksub_admin_loyalty_settings(uuid,jsonb),public.quicksub_admin_loyalty_adjust(uuid,uuid,integer,text),
 public.quicksub_place_order(uuid,boolean,uuid,text,uuid,text,text,text,numeric,text,text,uuid,integer)
 from public,anon,authenticated;
grant execute on function public.quicksub_save_customer(uuid,text,text,boolean,text),public.quicksub_attach_referral(uuid,text),
 public.quicksub_loyalty_balance(uuid),public.quicksub_loyalty_summary(uuid),public.quicksub_redeem_order_points(uuid,uuid,integer),
 public.quicksub_process_referrals(timestamptz),public.quicksub_admin_loyalty(uuid),public.quicksub_admin_loyalty_settings(uuid,jsonb),
 public.quicksub_admin_loyalty_adjust(uuid,uuid,integer,text),public.quicksub_place_order(uuid,boolean,uuid,text,uuid,text,text,text,numeric,text,text,uuid,integer)
 to service_role;

notify pgrst,'reload schema';
commit;
