-- Apply after the catalog migration. All access goes through the Node API.
create table public.quicksub_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('owner','staff')),
  created_at timestamptz not null default now()
);
create table public.quicksub_packages (
  id uuid primary key default gen_random_uuid(),
  product_id text not null references public.quicksub_products(id),
  name text not null check (length(name) between 1 and 160),
  details text not null default '',
  price_bdt numeric(12,2) not null check (price_bdt > 0),
  active boolean not null default true,
  updated_at timestamptz not null default now()
);
create table public.quicksub_orders (
  id uuid primary key,
  tracking_hash text not null,
  package_id uuid not null references public.quicksub_packages(id),
  product_name text not null,
  package_name text not null,
  amount_bdt numeric(12,2) not null,
  customer_name text not null,
  contact text not null,
  customer_note text not null default '',
  status text not null default 'pending' check (status in ('pending','processing','delivered','cancelled')),
  payment_status text not null default 'unpaid' check (payment_status in ('unpaid','submitted','verified','rejected','refunded')),
  payment_reference text not null default '',
  delivery_note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.quicksub_orders (created_at desc);
create index on public.quicksub_packages(product_id);
create table public.quicksub_audit (
  id bigint generated always as identity primary key,
  actor uuid not null,
  action text not null,
  record_id text not null,
  created_at timestamptz not null default now()
);
create table public.quicksub_requests (
  id uuid primary key default gen_random_uuid(),
  kind text not null check(kind in ('support','restock','newsletter')),
  contact text not null,
  message text not null default '',
  status text not null default 'open' check(status in ('open','resolved')),
  created_at timestamptz not null default now()
);
do $$ declare t text; begin
  foreach t in array array['quicksub_admins','quicksub_packages','quicksub_orders','quicksub_audit','quicksub_requests'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on public.%I from anon, authenticated',t);
    execute format('grant all on public.%I to service_role',t);
  end loop;
end $$;
grant usage, select on sequence public.quicksub_audit_id_seq to service_role;

-- Locks the package and product. Price is always taken from the database.
create function public.quicksub_create_order(p_id uuid,p_hash text,p_package uuid,p_name text,p_contact text,p_note text,p_expected numeric)
returns jsonb language plpgsql set search_path = public as $$
declare pkg quicksub_packages; prod quicksub_products; existing quicksub_orders; result quicksub_orders;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_id::text,0));
  select * into existing from quicksub_orders where id=p_id;
  if found then
    if existing.tracking_hash <> p_hash then raise exception 'Order unavailable'; end if;
    return to_jsonb(existing)-'tracking_hash';
  end if;
  select * into pkg from quicksub_packages where id=p_package and active for share;
  if not found then raise exception 'Package unavailable'; end if;
  if pkg.price_bdt <> p_expected then raise exception 'Price changed. Refresh packages before ordering'; end if;
  select * into prod from quicksub_products where id=pkg.product_id and active and in_stock for share;
  if not found then raise exception 'Product unavailable'; end if;
  insert into quicksub_orders(id,tracking_hash,package_id,product_name,package_name,amount_bdt,customer_name,contact,customer_note)
  values(p_id,p_hash,pkg.id,prod.data->>'name',pkg.name,pkg.price_bdt,p_name,p_contact,p_note) returning * into result;
  return to_jsonb(result)-'tracking_hash';
end $$;

-- A write and its audit record either both commit or both roll back.
create function public.quicksub_admin_write(p_actor uuid,p_kind text,p_id text,p_data jsonb)
returns void language plpgsql set search_path = public as $$
declare admin_role text; current_order quicksub_orders;
begin
  select role into admin_role from quicksub_admins where user_id=p_actor;
  if admin_role is null then raise exception 'Forbidden'; end if;
  if p_kind not in ('order','request') and admin_role <> 'owner' then raise exception 'Owner access required'; end if;
  if p_kind='product' then
    insert into quicksub_products(id,price_bdt,image_url,in_stock,active,sort_order,data)
    values(p_id,(p_data->>'price_bdt')::numeric,p_data->>'image_url',(p_data->>'in_stock')::boolean,(p_data->>'active')::boolean,(p_data->>'sort_order')::integer,p_data->'data')
    on conflict(id) do update set price_bdt=excluded.price_bdt,image_url=excluded.image_url,in_stock=excluded.in_stock,active=excluded.active,sort_order=excluded.sort_order,data=excluded.data,updated_at=now();
  elsif p_kind='package' then
    insert into quicksub_packages(id,product_id,name,details,price_bdt,active)
    values(p_id::uuid,p_data->>'product_id',p_data->>'name',p_data->>'details',(p_data->>'price_bdt')::numeric,(p_data->>'active')::boolean)
    on conflict(id) do update set product_id=excluded.product_id,name=excluded.name,details=excluded.details,price_bdt=excluded.price_bdt,active=excluded.active,updated_at=now();
  elsif p_kind='content' then
    insert into quicksub_content(id,data) values(p_id,p_data)
    on conflict(id) do update set data=excluded.data,updated_at=now();
  elsif p_kind='order' then
    select * into current_order from quicksub_orders where id=p_id::uuid for update;
    if not found then raise exception 'Order not found'; end if;
    if p_data->>'status' in ('processing','delivered') and p_data->>'payment_status' <> 'verified' then raise exception 'Verify payment before fulfillment'; end if;
    if current_order.status='cancelled' and p_data->>'status' <> 'cancelled' then raise exception 'Cancelled orders cannot reopen'; end if;
    if current_order.status='delivered' and p_data->>'status' not in ('delivered','cancelled') then raise exception 'Delivered orders cannot move backwards'; end if;
    if current_order.payment_status in ('verified','refunded') and p_data->>'payment_status' not in ('verified','refunded') then raise exception 'Verified payments cannot be reset'; end if;
    if current_order.payment_status='refunded' and p_data->>'payment_status' <> 'refunded' then raise exception 'Refunded payments cannot be reset'; end if;
    if p_data->>'payment_status' in ('submitted','verified') and current_order.payment_reference='' then raise exception 'Payment reference required'; end if;
    if p_data->>'payment_status'='refunded' and current_order.payment_status not in ('verified','refunded') then raise exception 'Only verified payments can be refunded'; end if;
    update quicksub_orders set status=p_data->>'status',payment_status=p_data->>'payment_status',delivery_note=p_data->>'delivery_note',updated_at=now() where id=p_id::uuid;
  elsif p_kind='request' then
    update quicksub_requests set status=p_data->>'status' where id=p_id::uuid;
    if not found then raise exception 'Request not found'; end if;
  else raise exception 'Unknown action'; end if;
  insert into quicksub_audit(actor,action,record_id) values(p_actor,p_kind,p_id);
end $$;
revoke all on function public.quicksub_create_order(uuid,text,uuid,text,text,text,numeric) from public,anon,authenticated;
revoke all on function public.quicksub_admin_write(uuid,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.quicksub_create_order(uuid,text,uuid,text,text,text,numeric) to service_role;
grant execute on function public.quicksub_admin_write(uuid,text,text,jsonb) to service_role;

create function public.quicksub_overview() returns jsonb language sql stable set search_path=public as $$
 select jsonb_build_object(
 'orders',(select count(*) from quicksub_orders),
 'pending',(select count(*) from quicksub_orders where status='pending'),
 'revenue',(select coalesce(sum(amount_bdt),0) from quicksub_orders where payment_status='verified'),
 'customers',(select count(distinct contact) from quicksub_orders));
$$;
create function public.quicksub_customers(p_offset integer default 0) returns jsonb language sql stable set search_path=public as $$
 select coalesce(jsonb_agg(x),'[]'::jsonb) from (
 select contact, (array_agg(customer_name order by created_at desc))[1] as name,
 count(*) as orders, coalesce(sum(amount_bdt) filter(where payment_status='verified'),0) as revenue,
 max(created_at) as last_order from quicksub_orders group by contact order by max(created_at) desc,contact limit 50 offset greatest(p_offset,0)
 ) x;
$$;
revoke all on function public.quicksub_overview() from public,anon,authenticated;
revoke all on function public.quicksub_customers(integer) from public,anon,authenticated;
grant execute on function public.quicksub_overview() to service_role;
grant execute on function public.quicksub_customers(integer) to service_role;

-- Keep advertised starting prices synchronized when exact-price packages change.
create function public.quicksub_package_starting_price() returns trigger language plpgsql set search_path=public as $$
declare lowest numeric; product text;
begin
  for product in select distinct x from unnest(array[new.product_id,case when tg_op='UPDATE' then old.product_id else new.product_id end]) as t(x) loop
    select min(price_bdt) into lowest from quicksub_packages where product_id=product and active;
    if lowest is not null then update quicksub_products set price_bdt=lowest,updated_at=now() where id=product; end if;
  end loop;
  return new;
end $$;
create trigger quicksub_package_price after insert or update on public.quicksub_packages for each row execute function public.quicksub_package_starting_price();
revoke all on function public.quicksub_package_starting_price() from public,anon,authenticated;

insert into public.quicksub_content(id,data) values('settings',jsonb_build_object('paymentInstructions','','supportHours','10 AM–11 PM Bangladesh time','dealEndsAt',now()+interval '1 month')) on conflict(id) do nothing;

-- Upgrade only the legacy demonstration wording, preserving custom store content.
update public.quicksub_content
set data=jsonb_set(data,'{operations,limitations}',to_jsonb('The assistant cannot access private orders or confirm payment. Customers can use Track Order with their receipt ID and private access code. Never ask for access codes in AI chat. Fulfillment and refunds are handled manually by staff.'::text)),updated_at=now()
where id='store' and data#>>'{operations,limitations}' like '%Order tracking on the website is demonstration data only%';
update public.quicksub_content
set data=jsonb_set(data,'{operations,ordering}',to_jsonb('Open product details to select an available exact-price package and place an order. Save the order receipt. If packages are unavailable, contact WhatsApp support. Payments are reviewed manually.'::text)),updated_at=now()
where id='store' and data#>>'{operations,ordering}'='Orders, exact package pricing, payment instructions and activation help are handled by human support on WhatsApp.';
