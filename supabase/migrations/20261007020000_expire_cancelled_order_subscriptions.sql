begin;

-- A cancelled or refunded purchase no longer grants subscription access. Keep
-- the subscription record for customer/admin history, but classify it as
-- expired so it appears in the customer's Expired section.
create or replace function public.quicksub_sync_cancelled_order_subscription()
returns trigger language plpgsql set search_path=public as $$
declare v_subscription_id uuid;
begin
  if new.status='cancelled' or new.payment_status='refunded' then
    update quicksub_subscriptions
    set status='expired',updated_at=now()
    where order_id=new.id and status<>'expired'
    returning id into v_subscription_id;
    if v_subscription_id is not null then
      delete from quicksub_subscription_reminders where subscription_id=v_subscription_id;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists quicksub_zz_sync_cancelled_order_subscription on public.quicksub_orders;
create trigger quicksub_zz_sync_cancelled_order_subscription
after update of status,payment_status on public.quicksub_orders
for each row execute function public.quicksub_sync_cancelled_order_subscription();

-- Repair subscriptions belonging to orders that were cancelled/refunded
-- before this correction was installed.
with corrected as (
  update quicksub_subscriptions s
  set status='expired',updated_at=now()
  from quicksub_orders o
  where o.id=s.order_id
    and (o.status='cancelled' or o.payment_status='refunded')
    and s.status<>'expired'
  returning s.id
)
delete from quicksub_subscription_reminders r
using corrected c
where r.subscription_id=c.id;

revoke all on function public.quicksub_sync_cancelled_order_subscription() from public,anon,authenticated;

notify pgrst,'reload schema';
commit;
