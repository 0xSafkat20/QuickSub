-- Gateway records are private; all operations pass through the backend.
create table public.quicksub_payments (
 id text primary key, order_id uuid not null references quicksub_orders(id),
 amount_bdt numeric(12,2) not null check(amount_bdt>0), currency text not null default 'BDT' check(currency='BDT'),
 status text not null default 'pending' check(status in ('pending','failed','cancelled','verified','review')),
 checkout_url text, bank_reference text unique, email text not null, review_note text not null default '',
 verified_at timestamptz, checked_at timestamptz, created_at timestamptz not null default now(),
 refund_status text not null default 'none' check(refund_status in ('none','requested','pending','completed','failed')),
 refund_reference text not null default '', refund_note text not null default '',
 refund_updated_at timestamptz
);
create index on quicksub_payments(order_id,created_at desc);
create unique index quicksub_one_pending_payment on quicksub_payments(order_id) where status='pending';
create table public.quicksub_payment_mail (
 id bigint generated always as identity primary key, payment_id text not null references quicksub_payments(id),
 email text not null, subject text not null, message text not null, sent_at timestamptz, attempted_at timestamptz,
 unique(payment_id,subject)
);
alter table quicksub_payments enable row level security;
alter table quicksub_payment_mail enable row level security;
revoke all on quicksub_payments,quicksub_payment_mail from anon,authenticated;
grant all on quicksub_payments,quicksub_payment_mail to service_role;
grant usage,select on sequence quicksub_payment_mail_id_seq to service_role;

create function quicksub_start_payment(p_order uuid,p_id text,p_email text) returns jsonb language plpgsql set search_path=public as $$
declare o quicksub_orders; p quicksub_payments;
begin
 select * into o from quicksub_orders where id=p_order for update;
 if not found or o.status<>'pending' or o.payment_status not in ('unpaid','rejected') then raise exception 'Order is not payable'; end if;
 if exists(select 1 from quicksub_payments where order_id=p_order and status='review' and refund_status<>'completed') then raise exception 'Payment requires staff review'; end if;
 select * into p from quicksub_payments where order_id=p_order and status='pending';
 if found then return to_jsonb(p); end if;
 insert into quicksub_payments(id,order_id,amount_bdt,email) values(p_id,p_order,o.amount_bdt,p_email) returning * into p;
 return to_jsonb(p);
end $$;

create function quicksub_settle_payment(p_id text,p_status text,p_reference text default null) returns void language plpgsql set search_path=public as $$
declare p quicksub_payments; o quicksub_orders; final_status text;
begin
 -- Lock order first everywhere, including concurrent admin/manual updates.
 select * into p from quicksub_payments where id=p_id;
 if not found then raise exception 'Payment missing'; end if;
 select * into o from quicksub_orders where id=p.order_id for update;
 select * into p from quicksub_payments where id=p_id for update;
 if p.status in ('verified','review') then return; end if;
 if p_status not in ('verified','review','failed','cancelled') then raise exception 'Invalid settlement'; end if;
 final_status:=p_status;
 if p_status='verified' and (o.payment_status in ('submitted','verified','refunded') or o.status<>'pending' or exists(select 1 from quicksub_payments where order_id=o.id and id<>p_id and (status='pending' or (status='review' and refund_status<>'completed')))) then final_status:='review'; end if;
 if p_status in ('verified','review') and coalesce(p_reference,'')='' then raise exception 'Bank reference required'; end if;
 update quicksub_payments set status=final_status, bank_reference=p_reference,
 verified_at=case when p_status in ('verified','review') then now() else null end,checked_at=now() where id=p_id;
 if final_status='verified' then
   update quicksub_orders set payment_status='verified',payment_reference='SSLCOMMERZ:'||p_id,updated_at=now() where id=o.id;
 end if;
 if p_status in ('verified','review') then
   insert into quicksub_payment_mail(payment_id,email,subject,message) values(p_id,p.email,
    'QuickSub payment update', 'Order '||o.id||E'\nAmount: BDT '||p.amount_bdt||E'\nPayment: '||final_status||E'\nTransaction: '||p_id||E'\nKeep your downloaded order receipt to track delivery. Contact support if review is required.') on conflict do nothing;
 end if;
end $$;

create function quicksub_guard_gateway_order() returns trigger language plpgsql set search_path=public as $$
begin
 if new.status is distinct from old.status and new.status in ('processing','delivered') and exists(select 1 from quicksub_payments where order_id=new.id and refund_status in ('requested','pending')) then raise exception 'Resolve refund before fulfillment'; end if;
 if new.payment_status is distinct from old.payment_status then
   if new.payment_status in ('submitted','verified') and exists(select 1 from quicksub_payments where order_id=new.id and (status='pending' or (status='review' and refund_status<>'completed'))) then raise exception 'Resolve gateway payment first'; end if;
   if new.payment_status='refunded' and exists(select 1 from quicksub_payments where order_id=new.id and status='verified' and refund_status<>'completed') then raise exception 'Record completed gateway refund first'; end if;
 end if;
 return new;
end $$;
create trigger quicksub_gateway_order_guard before update on quicksub_orders for each row execute function quicksub_guard_gateway_order();

create function quicksub_record_refund(p_actor uuid,p_id text,p_status text,p_reference text,p_note text) returns void language plpgsql set search_path=public as $$
declare p quicksub_payments;
begin
 if not exists(select 1 from quicksub_admins where user_id=p_actor and role in ('owner','staff')) then raise exception 'Forbidden'; end if;
 select * into p from quicksub_payments where id=p_id;
 perform 1 from quicksub_orders where id=p.order_id for update;
 select * into p from quicksub_payments where id=p_id for update;
 if not found or p.status not in ('verified','review') or p_status not in ('requested','pending','completed','failed') then raise exception 'Invalid refund'; end if;
 if p.refund_status='completed' then raise exception 'Refund already completed'; end if;
 if p_status='completed' and length(trim(p_reference))<4 then raise exception 'Provider refund reference required'; end if;
 update quicksub_payments set refund_status=p_status,refund_reference=p_reference,refund_note=p_note,refund_updated_at=now() where id=p_id;
 if p_status='completed' and p.status='verified' then
   update quicksub_orders set payment_status='refunded',status='cancelled',updated_at=now() where id=p.order_id;
 end if;
 insert into quicksub_audit(actor,action,record_id) values(p_actor,'refund:'||p_status,p_id);
end $$;
revoke all on function quicksub_start_payment(uuid,text,text),quicksub_settle_payment(text,text,text),quicksub_record_refund(uuid,text,text,text,text),quicksub_guard_gateway_order() from public,anon,authenticated;
grant execute on function quicksub_start_payment(uuid,text,text),quicksub_settle_payment(text,text,text),quicksub_record_refund(uuid,text,text,text,text) to service_role;


-- An owner may release a reviewed payment only after checking the provider's risk warning.
create function quicksub_review_payment(p_actor uuid,p_id text,p_note text) returns void language plpgsql set search_path=public as $$
declare p quicksub_payments; o quicksub_orders;
begin
 if not exists(select 1 from quicksub_admins where user_id=p_actor and role='owner') or length(trim(p_note))<10 then raise exception 'Owner and review explanation required'; end if;
 select * into p from quicksub_payments where id=p_id;
 select * into o from quicksub_orders where id=p.order_id for update;
 select * into p from quicksub_payments where id=p_id for update;
 if not found or p.status<>'review' or p.refund_status<>'none' or o.status<>'pending' or o.payment_status not in ('unpaid','rejected') then raise exception 'Payment cannot be released'; end if;
 if exists(select 1 from quicksub_payments where order_id=o.id and id<>p.id and (status='pending' or (status in ('review','verified') and refund_status<>'completed'))) then raise exception 'Resolve other payments first'; end if;
 update quicksub_payments set status='verified',review_note=p_note where id=p_id;
 update quicksub_orders set payment_status='verified',payment_reference='SSLCOMMERZ:'||p_id,updated_at=now() where id=o.id;
 insert into quicksub_audit(actor,action,record_id) values(p_actor,'payment-review-approved',p_id);
 insert into quicksub_payment_mail(payment_id,email,subject,message) values(p_id,p.email,'QuickSub payment confirmed','Order '||o.id||E'\nPayment confirmed after review. Amount: BDT '||p.amount_bdt);
end $$;
revoke all on function quicksub_review_payment(uuid,text,text) from public,anon,authenticated;
grant execute on function quicksub_review_payment(uuid,text,text) to service_role;
