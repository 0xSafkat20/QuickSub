begin;

alter table public.quicksub_orders
  add column if not exists is_demo boolean not null default false;

update public.quicksub_orders
set is_demo=true
where customer_name ~* '^\[DEMO\]'
   or id::text like 'd0000000-%';

create index if not exists quicksub_orders_real_created_idx
  on public.quicksub_orders(created_at desc) where is_demo=false;

create table if not exists public.quicksub_admin_notification_reads (
  user_id uuid not null references auth.users(id) on delete cascade,
  section text not null check(section in (
    'Products','Packages','Orders','Customers','Subscriptions','Reports','Inbox'
  )),
  read_at timestamptz not null,
  primary key(user_id,section)
);

alter table public.quicksub_admin_notification_reads enable row level security;
revoke all on public.quicksub_admin_notification_reads from public,anon,authenticated;
grant select,insert,update,delete on public.quicksub_admin_notification_reads to service_role;

create or replace function public.quicksub_mark_admin_notifications_read(
  p_user uuid,
  p_sections text[],
  p_read_at timestamptz
) returns void language plpgsql set search_path=public as $$
begin
  if not exists(
    select 1 from quicksub_admins
    where user_id=p_user and role in ('owner','staff')
  ) then raise exception 'Forbidden'; end if;
  if p_sections is null or cardinality(p_sections)=0 or exists(
    select 1 from unnest(p_sections) section
    where section not in (
      'Products','Packages','Orders','Customers','Subscriptions','Reports','Inbox'
    )
  ) then raise exception 'Invalid notification section'; end if;

  insert into quicksub_admin_notification_reads(user_id,section,read_at)
  select p_user,section,p_read_at from unnest(p_sections) section
  on conflict(user_id,section) do update
    set read_at=greatest(
      quicksub_admin_notification_reads.read_at,
      excluded.read_at
    );
end $$;

create or replace function public.quicksub_overview() returns jsonb
language sql stable set search_path=public as $$
  select jsonb_build_object(
    'orders',(select count(*) from quicksub_orders where not is_demo),
    'pending',(select count(*) from quicksub_orders where not is_demo and status='pending'),
    'revenue',(select coalesce(sum(amount_bdt),0) from quicksub_orders where not is_demo and payment_status='verified'),
    'customers',(select count(distinct contact) from quicksub_orders where not is_demo)
  );
$$;

create or replace function public.quicksub_customers(p_offset integer default 0)
returns jsonb language sql stable set search_path=public as $$
  select coalesce(jsonb_agg(x),'[]'::jsonb) from (
    select contact,
      (array_agg(customer_name order by created_at desc))[1] as name,
      count(*) as orders,
      coalesce(sum(amount_bdt) filter(where payment_status='verified'),0) as revenue,
      max(created_at) as last_order
    from quicksub_orders
    where not is_demo
    group by contact
    order by max(created_at) desc,contact
    limit 50 offset greatest(p_offset,0)
  ) x;
$$;

create or replace function public.quicksub_admin_notifications(p_user uuid)
returns jsonb language plpgsql stable set search_path=public as $$
declare
  product_count integer;
  package_count integer;
  order_count integer;
  customer_count integer;
  subscription_count integer;
  report_count integer;
  inbox_count integer;
begin
  if not exists(
    select 1 from quicksub_admins
    where user_id=p_user and role in ('owner','staff')
  ) then raise exception 'Forbidden'; end if;

  with reads as (
    select
      coalesce(max(read_at) filter(where section='Products'),'epoch'::timestamptz) products,
      coalesce(max(read_at) filter(where section='Packages'),'epoch'::timestamptz) packages,
      coalesce(max(read_at) filter(where section='Orders'),'epoch'::timestamptz) orders,
      coalesce(max(read_at) filter(where section='Customers'),'epoch'::timestamptz) customers,
      coalesce(max(read_at) filter(where section='Subscriptions'),'epoch'::timestamptz) subscriptions,
      coalesce(max(read_at) filter(where section='Reports'),'epoch'::timestamptz) reports,
      coalesce(max(read_at) filter(where section='Inbox'),'epoch'::timestamptz) inbox
    from quicksub_admin_notification_reads where user_id=p_user
  )
  select
    (select count(*) from quicksub_products p,reads r
      where p.active and not p.in_stock and p.updated_at>r.products)::integer,
    (select count(*) from quicksub_products p,reads r
      where p.active and p.in_stock
        and not exists(select 1 from quicksub_packages k where k.product_id=p.id and k.active)
        and greatest(p.updated_at,coalesce((select max(k.updated_at) from quicksub_packages k where k.product_id=p.id),'epoch'::timestamptz))>r.packages)::integer,
    (select count(*) from quicksub_orders o,reads r
      where not o.is_demo and o.status='pending' and o.updated_at>r.orders)::integer,
    (select count(*) from (
      select o.contact,max(o.updated_at) changed_at
      from quicksub_orders o where not o.is_demo group by o.contact
    ) c,reads r where c.changed_at>r.customers)::integer,
    (select count(*) from quicksub_subscriptions s
      join quicksub_orders o on o.id=s.order_id cross join reads r
      where not o.is_demo and s.status in ('active','upcoming')
        and s.ends_at>=now() and s.ends_at<=now()+interval '7 days'
        and s.updated_at>r.subscriptions)::integer,
    (select count(*) from quicksub_payments p
      join quicksub_orders o on o.id=p.order_id cross join reads r
      where not o.is_demo
        and (p.status in ('pending','failed','cancelled','review')
          or p.refund_status in ('requested','pending','failed'))
        and coalesce(p.refund_updated_at,p.checked_at,p.created_at)>r.reports)::integer,
    (select count(*) from quicksub_requests q,reads r
      where q.status='open' and q.created_at>r.inbox)::integer
  into product_count,package_count,order_count,customer_count,
       subscription_count,report_count,inbox_count
  from reads;

  return jsonb_build_object(
    'Products',product_count,
    'Packages',package_count,
    'Orders',order_count,
    'Customers',customer_count,
    'Subscriptions',subscription_count,
    'Reports',report_count,
    'Inbox',inbox_count,
    'Overview',product_count+package_count+order_count+customer_count+
      subscription_count+report_count+inbox_count
  );
end $$;

revoke all on function public.quicksub_admin_notifications(uuid)
  from public,anon,authenticated;
grant execute on function public.quicksub_admin_notifications(uuid)
  to service_role;
revoke all on function public.quicksub_mark_admin_notifications_read(uuid,text[],timestamptz)
  from public,anon,authenticated;
grant execute on function public.quicksub_mark_admin_notifications_read(uuid,text[],timestamptz)
  to service_role;

notify pgrst, 'reload schema';
commit;
