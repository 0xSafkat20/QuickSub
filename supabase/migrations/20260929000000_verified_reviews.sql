begin;

create table if not exists public.quicksub_reviews (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.quicksub_orders(id) on delete cascade,
  customer_id uuid not null references auth.users(id) on delete cascade,
  product_id text not null references public.quicksub_products(id),
  product_name text not null check (length(product_name) between 1 and 160),
  display_name text not null check (length(display_name) between 1 and 80),
  rating smallint not null check (rating between 1 and 5),
  comment text not null check (length(comment) between 10 and 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists quicksub_reviews_product_created_idx
  on public.quicksub_reviews(product_id, created_at desc);

alter table public.quicksub_reviews enable row level security;
revoke all on public.quicksub_reviews from public, anon, authenticated;
grant all on public.quicksub_reviews to service_role;

create or replace function public.quicksub_save_review(
  p_user uuid,
  p_order uuid,
  p_rating smallint,
  p_comment text
) returns jsonb language plpgsql set search_path=public as $$
declare
  purchased quicksub_orders;
  product text;
  customer_name text;
  result quicksub_reviews;
begin
  select * into purchased from quicksub_orders
    where id=p_order and customer_id=p_user for update;
  if not found then raise exception 'Order unavailable'; end if;
  if purchased.status <> 'delivered' or purchased.payment_status <> 'verified' then
    raise exception 'Only completed purchases can be reviewed';
  end if;
  select product_id into product from quicksub_packages where id=purchased.package_id;
  if product is null then raise exception 'Product unavailable'; end if;
  select nullif(trim(name),'') into customer_name from quicksub_customers where user_id=p_user;
  customer_name := coalesce(customer_name, 'Verified customer');

  insert into quicksub_reviews(order_id,customer_id,product_id,product_name,display_name,rating,comment)
  values(p_order,p_user,product,purchased.product_name,left(customer_name,80),p_rating,trim(p_comment))
  on conflict(order_id) do update set
    rating=excluded.rating,
    comment=excluded.comment,
    display_name=excluded.display_name,
    updated_at=now()
  where quicksub_reviews.customer_id=p_user
  returning * into result;
  if result.id is null then raise exception 'Review unavailable'; end if;
  return to_jsonb(result)-'customer_id';
end $$;

revoke all on function public.quicksub_save_review(uuid,uuid,smallint,text) from public,anon,authenticated;
grant execute on function public.quicksub_save_review(uuid,uuid,smallint,text) to service_role;

notify pgrst, 'reload schema';
commit;
