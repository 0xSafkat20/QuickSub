begin;

alter table public.quicksub_orders
  add column if not exists customer_deleted_at timestamptz;

create index if not exists quicksub_orders_customer_visible_idx
  on public.quicksub_orders(customer_id, created_at desc)
  where customer_deleted_at is null;

create or replace function public.quicksub_delete_pending_order(p_user uuid, p_id uuid)
returns void
language plpgsql
set search_path = public
as $$
declare
  target public.quicksub_orders%rowtype;
begin
  select * into target
  from public.quicksub_orders
  where id = p_id and customer_id = p_user
  for update;

  if not found or target.customer_deleted_at is not null then
    raise exception 'Order not found in your account.';
  end if;
  if target.status <> 'pending' or target.payment_status <> 'unpaid' then
    raise exception 'Only pending, unpaid orders can be removed from your history.';
  end if;
  if to_regclass('public.quicksub_payments') is not null then
    if exists (select 1 from public.quicksub_payments where order_id = p_id) then
      raise exception 'This order has payment activity and cannot be removed.';
    end if;
  end if;
  if to_regclass('public.quicksub_subscriptions') is not null then
    if exists (select 1 from public.quicksub_subscriptions where order_id = p_id) then
      raise exception 'This order has subscription activity and cannot be removed.';
    end if;
  end if;

  update public.quicksub_orders
  set customer_deleted_at = now(), updated_at = now()
  where id = p_id and customer_id = p_user
    and status = 'pending' and payment_status = 'unpaid'
    and customer_deleted_at is null;
  if not found then
    raise exception 'Order changed. Refresh and try again.';
  end if;
end;
$$;

revoke all on function public.quicksub_delete_pending_order(uuid, uuid) from public, anon, authenticated;
grant execute on function public.quicksub_delete_pending_order(uuid, uuid) to service_role;
notify pgrst, 'reload schema';

commit;