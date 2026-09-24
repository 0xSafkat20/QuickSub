begin;
create table if not exists public.quicksub_cart_items (
 user_id uuid not null references auth.users(id) on delete cascade,
 package_id uuid not null references public.quicksub_packages(id) on delete cascade,
 customer_name text not null default '' check(length(customer_name)<=120),
 contact text not null default '' check(length(contact)<=160),
 note text not null default '' check(length(note)<=1000),
 updated_at timestamptz not null default now(),
 primary key(user_id,package_id)
);
alter table public.quicksub_cart_items enable row level security;
revoke all on public.quicksub_cart_items from public,anon,authenticated;
grant select,insert,update,delete on public.quicksub_cart_items to service_role;

create or replace function public.quicksub_cart(p_user uuid) returns jsonb
language sql stable set search_path=public as $$
 select coalesce(jsonb_agg(jsonb_build_object(
  'package_id',c.package_id,'product_id',p.product_id,
  'product_name',coalesce(pr.data->>'name','Product'),'package_name',p.name,
  'price_bdt',p.price_bdt,'available',p.active and pr.active and pr.in_stock,
  'name',c.customer_name,'contact',c.contact,'note',c.note,'updated_at',c.updated_at
 ) order by c.updated_at desc,c.package_id),'[]'::jsonb)
 from quicksub_cart_items c join quicksub_packages p on p.id=c.package_id
 join quicksub_products pr on pr.id=p.product_id where c.user_id=p_user;
$$;

create or replace function public.quicksub_save_cart_item(p_user uuid,p_package uuid,p_name text,p_contact text,p_note text)
returns void language plpgsql set search_path=public as $$
begin
 perform pg_advisory_xact_lock(hashtextextended('cart:'||p_user::text,0));
 if not exists(select 1 from quicksub_packages p join quicksub_products pr on pr.id=p.product_id where p.id=p_package and p.active and pr.active and pr.in_stock) then
  raise exception 'Package unavailable';
 end if;
 if not exists(select 1 from quicksub_cart_items where user_id=p_user and package_id=p_package)
 and (select count(*) from quicksub_cart_items where user_id=p_user)>=20 then raise exception 'Cart limit reached'; end if;
 insert into quicksub_cart_items(user_id,package_id,customer_name,contact,note)
 values(p_user,p_package,p_name,p_contact,p_note)
 on conflict(user_id,package_id) do update set customer_name=excluded.customer_name,contact=excluded.contact,note=excluded.note,updated_at=now();
end $$;

create or replace function public.quicksub_checkout_cart(p_user uuid,p_id uuid,p_hash text,p_package uuid,p_name text,p_contact text,p_note text,p_expected numeric)
returns jsonb language plpgsql set search_path=public as $$
declare result jsonb;
begin
 perform pg_advisory_xact_lock(hashtextextended('cart:'||p_user::text,0));
 perform pg_advisory_xact_lock(hashtextextended(p_id::text,0));
 -- An order retry must not remove a package added again after that order.
 if exists(select 1 from quicksub_orders where id=p_id) then
  return quicksub_customer_order(p_user,p_id,p_hash,p_package,p_name,p_contact,p_note,p_expected);
 end if;
 if not exists(select 1 from quicksub_cart_items where user_id=p_user and package_id=p_package) then raise exception 'Cart item unavailable'; end if;
 result := quicksub_customer_order(p_user,p_id,p_hash,p_package,p_name,p_contact,p_note,p_expected);
 delete from quicksub_cart_items where user_id=p_user and package_id=p_package;
 return result;
end $$;
revoke all on function public.quicksub_cart(uuid),public.quicksub_save_cart_item(uuid,uuid,text,text,text),public.quicksub_checkout_cart(uuid,uuid,text,uuid,text,text,text,numeric) from public,anon,authenticated;
grant execute on function public.quicksub_cart(uuid),public.quicksub_save_cart_item(uuid,uuid,text,text,text),public.quicksub_checkout_cart(uuid,uuid,text,uuid,text,text,text,numeric) to service_role;
notify pgrst,'reload schema';
commit;
