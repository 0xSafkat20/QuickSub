begin;
alter table public.quicksub_orders
 add column receipt_email text not null default '',
 add column game_account text not null default '',
 add column package_details text not null default '',
 add column product_category text not null default '',
 add column subscription_period text not null default '',
 add column subscription_started_at timestamptz,
 add column payment_method text not null default '';

-- Snapshot the purchased terms. Existing orders are deliberately not backfilled
-- from today's catalog, which may no longer describe their original purchase.
create function public.quicksub_receipt_snapshot() returns trigger language plpgsql set search_path=public as $$
declare pkg quicksub_packages; prod quicksub_products; duration text[];
begin
 if TG_OP='INSERT' then
  select * into pkg from quicksub_packages where id=new.package_id;
  select * into prod from quicksub_products where id=pkg.product_id;
  new.package_details:=pkg.details;
  new.product_category:=coalesce(prod.data->>'category','');
  if new.product_category<>'gaming' then
   duration:=regexp_match(lower(new.package_name), '([0-9]+)\s*(month|year|day)s?');
   if duration is not null and duration[1]::int between 1 and 120 then
    new.subscription_period:=duration[1]||' '||duration[2];
   elsif lower(new.package_name) like '%monthly%' then new.subscription_period:='1 month';
   elsif lower(new.package_name) like '%annual%' then new.subscription_period:='1 year';
   end if;
  end if;
 end if;
 if TG_OP='UPDATE' and new.payment_status='verified' and old.payment_status<>'verified' then
  if new.subscription_started_at is null and new.subscription_period<>'' then
   new.subscription_started_at:=now();
   new.expires_at:=(new.subscription_started_at at time zone 'Asia/Dhaka' + new.subscription_period::interval) at time zone 'Asia/Dhaka';
  end if;
 end if;
 if new.payment_reference like 'SSLCOMMERZ:%' and new.payment_method not like 'Online%' then new.payment_method:='Online payment (SSLCommerz)'; end if;
 return new;
end $$;
create trigger quicksub_receipt_snapshot before insert or update on public.quicksub_orders for each row execute function public.quicksub_receipt_snapshot();
revoke all on function public.quicksub_receipt_snapshot() from public,anon,authenticated;

create function public.quicksub_place_order(p_user uuid,p_cart boolean,p_id uuid,p_hash text,p_package uuid,p_name text,p_contact text,p_note text,p_expected numeric,p_email text,p_game text)
returns jsonb language plpgsql set search_path=public as $$
declare result jsonb; existing boolean;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_id::text,0));
 select exists(select 1 from quicksub_orders where id=p_id) into existing;
 if p_cart then result:=quicksub_checkout_cart(p_user,p_id,p_hash,p_package,p_name,p_contact,p_note,p_expected);
 elsif p_user is not null then result:=quicksub_customer_order(p_user,p_id,p_hash,p_package,p_name,p_contact,p_note,p_expected);
 else result:=quicksub_create_order(p_id,p_hash,p_package,p_name,p_contact,p_note,p_expected); end if;
 if not existing then
  update quicksub_orders set receipt_email=p_email,game_account=p_game where id=p_id;
 end if;
 select to_jsonb(o)-'tracking_hash' into result from quicksub_orders o where id=p_id;
 return result;
end $$;
revoke all on function public.quicksub_place_order(uuid,boolean,uuid,text,uuid,text,text,text,numeric,text,text) from public,anon,authenticated;
grant execute on function public.quicksub_place_order(uuid,boolean,uuid,text,uuid,text,text,text,numeric,text,text) to service_role;
notify pgrst,'reload schema';
commit;
