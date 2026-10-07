begin;

-- Four reward points equal BDT 1, so the displayed value is points / 4.
update public.quicksub_loyalty_settings
set bdt_per_point=0.25,updated_at=now()
where id;

-- Remove legacy purchase earnings for orders that are no longer completed.
-- The old refund-reversal rows are also removed so customers see one clean,
-- current list of valid earnings instead of a positive and negative pair.
delete from public.quicksub_loyalty_transactions t
using public.quicksub_orders o
where t.order_id=o.id and t.kind='purchase'
  and (o.status<>'delivered' or o.payment_status<>'verified');

delete from public.quicksub_loyalty_transactions t
using public.quicksub_orders o
where t.order_id=o.id
  and t.kind in ('referral','welcome-referral','refund-reversal')
  and (o.status<>'delivered' or o.payment_status<>'verified');

create or replace function public.quicksub_loyalty_summary(p_user uuid)
returns jsonb language sql stable set search_path=public as $$
 with profile as (
   select referral_code,preferred_locale from quicksub_customers where user_id=p_user
 ), settings as (select * from quicksub_loyalty_settings where id), refs as (
   select count(*) total,count(*) filter(where status='pending') pending,count(*) filter(where status='rewarded') rewarded
   from quicksub_referrals where referrer_id=p_user
 ) select jsonb_build_object(
   'balance',quicksub_loyalty_balance(p_user),
   'lifetimeEarned',greatest(0,coalesce((select sum(points) from quicksub_loyalty_transactions
     where customer_id=p_user and kind in ('purchase','referral','welcome-referral','refund-reversal')),0)),
   'lifetimeRedeemed',coalesce((select -sum(least(points,0)) from quicksub_loyalty_transactions where customer_id=p_user and kind='redemption'),0),
   'referralCode',(select referral_code from profile),
   'locale',(select preferred_locale from profile),
   'referrals',jsonb_build_object('total',refs.total,'pending',refs.pending,'rewarded',refs.rewarded),
   'settings',to_jsonb(settings)-'id'-'updated_at',
   'transactions',coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at desc) from
     (select t.id,t.order_id,t.kind,t.points,t.description,t.created_at
      from quicksub_loyalty_transactions t
      where t.customer_id=p_user and t.kind<>'refund-reversal'
        and (t.kind<>'purchase' or exists(
          select 1 from quicksub_orders o where o.id=t.order_id
            and o.status='delivered' and o.payment_status='verified'
        ))
      order by t.created_at desc limit 50)x),'[]'::jsonb)
 ) from refs,settings;
$$;

create or replace function public.quicksub_remove_invalid_purchase_rewards()
returns trigger language plpgsql set search_path=public as $$
begin
  if new.status='cancelled' or new.payment_status='refunded' then
    delete from quicksub_loyalty_transactions
    where order_id=new.id
      and kind in ('purchase','referral','welcome-referral','refund-reversal');
  end if;
  return new;
end $$;

drop trigger if exists quicksub_zz_remove_invalid_purchase_rewards on public.quicksub_orders;
create trigger quicksub_zz_remove_invalid_purchase_rewards
after update of status,payment_status on public.quicksub_orders
for each row execute function public.quicksub_remove_invalid_purchase_rewards();

create or replace function public.quicksub_sync_cancelled_order_subscription()
returns trigger language plpgsql set search_path=public as $$
declare subscription_id uuid;
begin
  if new.status='cancelled' or new.payment_status='refunded' then
    update quicksub_subscriptions
    set status=case when ends_at<=now() then 'expired' else 'cancelled' end,
        updated_at=now()
    where order_id=new.id and status not in ('cancelled','expired')
    returning id into subscription_id;
    if subscription_id is not null then
      perform quicksub_sync_subscription_reminders(subscription_id);
    end if;
  end if;
  return new;
end $$;

drop trigger if exists quicksub_zz_sync_cancelled_order_subscription on public.quicksub_orders;
create trigger quicksub_zz_sync_cancelled_order_subscription
after update of status,payment_status on public.quicksub_orders
for each row execute function public.quicksub_sync_cancelled_order_subscription();

do $$ declare item record; begin
  for item in
    update quicksub_subscriptions s
    set status=case when s.ends_at<=now() then 'expired' else 'cancelled' end,
        updated_at=now()
    from quicksub_orders o
    where o.id=s.order_id and (o.status='cancelled' or o.payment_status='refunded')
      and s.status not in ('cancelled','expired')
    returning s.id
  loop
    perform quicksub_sync_subscription_reminders(item.id);
  end loop;
end $$;

revoke all on function public.quicksub_remove_invalid_purchase_rewards(),public.quicksub_sync_cancelled_order_subscription() from public,anon,authenticated;

notify pgrst,'reload schema';
commit;
