begin;

alter table public.quicksub_orders add column if not exists paid_at timestamptz;
alter table public.quicksub_orders add column if not exists refunded_at timestamptz;
update public.quicksub_orders set paid_at=updated_at where paid_at is null and payment_status in ('verified','refunded');
update public.quicksub_orders set refunded_at=updated_at where refunded_at is null and payment_status='refunded';
create or replace function public.quicksub_order_reporting_timestamps() returns trigger language plpgsql set search_path=public as $$
begin
 if new.payment_status in ('verified','refunded') and (tg_op='INSERT' or old.payment_status not in ('verified','refunded')) then new.paid_at=coalesce(new.paid_at,now()); end if;
 if new.payment_status='refunded' and (tg_op='INSERT' or old.payment_status<>'refunded') then new.refunded_at=coalesce(new.refunded_at,now()); end if;
 return new;
end $$;
drop trigger if exists quicksub_order_reporting_timestamps on public.quicksub_orders;
create trigger quicksub_order_reporting_timestamps before insert or update of payment_status on public.quicksub_orders for each row execute function public.quicksub_order_reporting_timestamps();
create index if not exists quicksub_orders_reporting_created_idx on public.quicksub_orders(created_at, payment_status);
create index if not exists quicksub_orders_reporting_paid_idx on public.quicksub_orders(paid_at) where paid_at is not null;
create index if not exists quicksub_orders_reporting_refunded_idx on public.quicksub_orders(refunded_at) where refunded_at is not null;
create index if not exists quicksub_orders_reporting_expiry_idx on public.quicksub_orders(expires_at) where expires_at is not null;
create index if not exists quicksub_payments_reporting_verified_idx on public.quicksub_payments(verified_at, status);
create index if not exists quicksub_payments_reporting_refund_idx on public.quicksub_payments(refund_updated_at, refund_status);

-- One canonical report keeps dashboard totals and exports consistent. Product
-- names and prices are the historical snapshots stored on each order.
create or replace function public.quicksub_admin_report(p_from timestamptz,p_to timestamptz,p_bucket text default 'day')
returns jsonb language plpgsql stable set search_path=public as $$
declare result jsonb;
begin
 if p_from is null or p_to is null or p_from>=p_to or p_to-p_from>interval '732 days' or p_bucket not in ('day','week','month') then raise exception 'Invalid reporting period'; end if;
 with
 period_orders as (select * from quicksub_orders where created_at>=p_from and created_at<p_to),
 financial_orders as (select * from quicksub_orders where paid_at>=p_from and paid_at<p_to and payment_status in ('verified','refunded')),
 refund_events as (
  select id::text event_id,id order_id,amount_bdt,product_name,package_name,refunded_at event_at from quicksub_orders
  where payment_status='refunded' and refunded_at>=p_from and refunded_at<p_to
  union all
  select p.id,p.order_id,p.amount_bdt,o.product_name,o.package_name,p.refund_updated_at from quicksub_payments p join quicksub_orders o on o.id=p.order_id
  where p.refund_status='completed' and p.refund_updated_at>=p_from and p.refund_updated_at<p_to and o.payment_status<>'refunded'
 ),
 summary as (
  select (select count(*) from period_orders)::int orders,(select count(*) from financial_orders)::int paid_orders,
   coalesce((select sum(amount_bdt) from financial_orders),0) gross_revenue,
   coalesce((select sum(amount_bdt) from refund_events),0) refunds,
   coalesce((select sum(amount_bdt) from financial_orders),0)-coalesce((select sum(amount_bdt) from refund_events),0) net_revenue,
   coalesce((select avg(amount_bdt) from financial_orders),0) average_order,
   coalesce((select round(100.0*count(*) filter(where status='verified')/nullif(count(*),0),2) from quicksub_payments where created_at>=p_from and created_at<p_to),0) payment_success_rate
 ),
 buckets as (
  select generate_series(date_trunc(p_bucket,p_from at time zone 'Asia/Dhaka'),date_trunc(p_bucket,(p_to-interval '1 millisecond') at time zone 'Asia/Dhaka'),case p_bucket when 'day' then interval '1 day' when 'week' then interval '1 week' else interval '1 month' end) bucket
 ),
 trends as (
  select b.bucket,
   (select count(*) from period_orders o where date_trunc(p_bucket,o.created_at at time zone 'Asia/Dhaka')=b.bucket)::int orders,
   (select count(*) from financial_orders o where date_trunc(p_bucket,o.paid_at at time zone 'Asia/Dhaka')=b.bucket)::int paid_orders,
   coalesce((select sum(amount_bdt) from financial_orders o where date_trunc(p_bucket,o.paid_at at time zone 'Asia/Dhaka')=b.bucket),0) gross_revenue,
   coalesce((select sum(amount_bdt) from refund_events r where date_trunc(p_bucket,r.event_at at time zone 'Asia/Dhaka')=b.bucket),0) refunds
  from buckets b order by b.bucket
 ),
 products as (
  select keys.product_name,keys.package_name,
   (select count(*) from financial_orders o where o.product_name=keys.product_name and o.package_name=keys.package_name)::int paid_orders,
   coalesce((select sum(amount_bdt) from financial_orders o where o.product_name=keys.product_name and o.package_name=keys.package_name),0) gross_revenue,
   (select count(*) from refund_events r where r.product_name=keys.product_name and r.package_name=keys.package_name)::int refunded_orders,
   coalesce((select sum(amount_bdt) from refund_events r where r.product_name=keys.product_name and r.package_name=keys.package_name),0) refunds,
   coalesce((select sum(amount_bdt) from financial_orders o where o.product_name=keys.product_name and o.package_name=keys.package_name),0)-coalesce((select sum(amount_bdt) from refund_events r where r.product_name=keys.product_name and r.package_name=keys.package_name),0) net_revenue
  from (select product_name,package_name from financial_orders union select product_name,package_name from refund_events) keys
  order by net_revenue desc,paid_orders desc,product_name,package_name limit 100
 ),
 payment_stats as (
  select count(*)::int total,count(*) filter(where status='verified')::int verified,count(*) filter(where status='pending')::int pending,
   count(*) filter(where status='failed')::int failed,count(*) filter(where status='cancelled')::int cancelled,
   count(*) filter(where status='review')::int review,count(*) filter(where refund_status='completed')::int completed_refunds
  from quicksub_payments where created_at>=p_from and created_at<p_to
 ),
 payment_issues as (
  select p.id,p.order_id,p.amount_bdt,p.status,p.refund_status,p.bank_reference,p.created_at,p.checked_at,p.refund_updated_at,o.product_name,o.package_name
  from quicksub_payments p join quicksub_orders o on o.id=p.order_id
  where (p.created_at>=p_from and p.created_at<p_to and p.status in ('failed','cancelled','review')) or (p.refund_updated_at>=p_from and p.refund_updated_at<p_to and p.refund_status<>'none')
  order by coalesce(p.refund_updated_at,p.checked_at,p.created_at) desc limit 100
 ),
 expiring as (
  select id,product_name,package_name,customer_name,contact,amount_bdt,expires_at,floor(extract(epoch from (expires_at-now()))/86400)::int days_remaining
  from quicksub_orders where expires_at is not null and expires_at>=p_from and expires_at<p_to and status='delivered' and payment_status='verified'
  order by expires_at,id limit 500
 )
 select jsonb_build_object(
  'summary',(select to_jsonb(s) from summary s),
  'trends',(select coalesce(jsonb_agg(jsonb_build_object('bucket',bucket,'orders',orders,'paid_orders',paid_orders,'gross_revenue',gross_revenue,'refunds',refunds,'net_revenue',gross_revenue-refunds) order by bucket),'[]'::jsonb) from trends),
  'products',(select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) from products x),
  'payments',(select to_jsonb(x) from payment_stats x),
  'payment_issues',(select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) from payment_issues x),
  'expiring',(select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) from expiring x)
 ) into result;
 return result;
end $$;

revoke all on function public.quicksub_admin_report(timestamptz,timestamptz,text) from public,anon,authenticated;
grant execute on function public.quicksub_admin_report(timestamptz,timestamptz,text) to service_role;
notify pgrst, 'reload schema';
commit;
