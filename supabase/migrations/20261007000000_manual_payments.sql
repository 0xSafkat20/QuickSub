begin;

create table if not exists public.quicksub_manual_payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.quicksub_orders(id) on delete restrict,
  method text not null check (method in ('bkash','nagad','rocket','bank_transfer')),
  amount_bdt numeric(12,2) not null check (amount_bdt > 0),
  transaction_reference text not null,
  payer_phone text,
  payer_name text not null default '',
  sender_bank text not null default '',
  account_last_four text not null default '',
  status text not null default 'submitted' check (status in ('submitted','verified','rejected','refunded')),
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  constraint quicksub_manual_payment_reference_unique unique (method, transaction_reference),
  constraint quicksub_manual_payment_phone_check check (
    payer_phone is null or payer_phone ~ '^\+8801[3-9][0-9]{8}$'
  ),
  constraint quicksub_manual_payment_last4_check check (
    account_last_four = '' or account_last_four ~ '^[0-9]{4}$'
  )
);

create index if not exists quicksub_manual_payments_order_idx
  on public.quicksub_manual_payments(order_id, submitted_at desc);
create unique index if not exists quicksub_one_submitted_manual_payment
  on public.quicksub_manual_payments(order_id) where status='submitted';

alter table public.quicksub_manual_payments enable row level security;
revoke all on public.quicksub_manual_payments from public, anon, authenticated;
grant all on public.quicksub_manual_payments to service_role;

create or replace function public.quicksub_submit_manual_payment(
  p_order uuid,
  p_hash text,
  p_method text,
  p_reference text,
  p_phone text default null,
  p_name text default '',
  p_bank text default '',
  p_last_four text default ''
) returns jsonb language plpgsql set search_path=public as $$
declare
  o quicksub_orders;
  result quicksub_manual_payments;
  display_method text;
begin
  select * into o from quicksub_orders
  where id=p_order and tracking_hash=p_hash for update;
  if not found or o.status<>'pending' or o.payment_status not in ('unpaid','rejected') then
    raise exception 'Order is not payable';
  end if;
  if p_method not in ('bkash','nagad','rocket','bank_transfer') then
    raise exception 'Unsupported manual payment method';
  end if;
  if p_reference is null or p_reference !~ '^[A-Z0-9][A-Z0-9._/-]{3,79}$' then
    raise exception 'Invalid transaction reference';
  end if;
  if p_method in ('bkash','nagad','rocket') and
     (p_phone is null or p_phone !~ '^\+8801[3-9][0-9]{8}$') then
    raise exception 'Valid Bangladesh mobile number required';
  end if;
  if p_method='bank_transfer' and
     (length(btrim(p_name))<2 or length(btrim(p_bank))<2) then
    raise exception 'Sender name and bank are required';
  end if;
  if coalesce(p_last_four,'')<>'' and p_last_four !~ '^[0-9]{4}$' then
    raise exception 'Only the last four account digits may be stored';
  end if;

  insert into quicksub_manual_payments(
    order_id,method,amount_bdt,transaction_reference,payer_phone,
    payer_name,sender_bank,account_last_four
  ) values (
    o.id,p_method,o.amount_bdt,upper(p_reference),p_phone,
    left(btrim(coalesce(p_name,'')),120),left(btrim(coalesce(p_bank,'')),120),coalesce(p_last_four,'')
  ) returning * into result;

  display_method:=case p_method
    when 'bkash' then 'bKash'
    when 'nagad' then 'Nagad'
    when 'rocket' then 'Rocket'
    else 'Bank transfer'
  end;
  update quicksub_orders set
    payment_reference=result.transaction_reference,
    payment_method=display_method,
    payment_status='submitted',
    updated_at=now()
  where id=o.id;
  return to_jsonb(result);
end $$;

create or replace function public.quicksub_sync_manual_payment_status()
returns trigger language plpgsql set search_path=public as $$
begin
  if new.payment_status is distinct from old.payment_status and
     new.payment_status in ('verified','rejected','refunded') then
    update quicksub_manual_payments set
      status=new.payment_status,
      reviewed_at=now()
    where id=(
      select id from quicksub_manual_payments
      where order_id=new.id and status='submitted'
      order by submitted_at desc limit 1
    );
  end if;
  return new;
end $$;

drop trigger if exists quicksub_sync_manual_payment_status on public.quicksub_orders;
create trigger quicksub_sync_manual_payment_status
after update of payment_status on public.quicksub_orders
for each row execute function public.quicksub_sync_manual_payment_status();

revoke all on function public.quicksub_submit_manual_payment(uuid,text,text,text,text,text,text,text),
  public.quicksub_sync_manual_payment_status() from public,anon,authenticated;
grant execute on function public.quicksub_submit_manual_payment(uuid,text,text,text,text,text,text,text)
  to service_role;

notify pgrst,'reload schema';
commit;
