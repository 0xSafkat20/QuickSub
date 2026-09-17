-- Run once in your Supabase SQL editor. Existing newsletter data is untouched.
create table public.quicksub_products (
  id text primary key,
  price_bdt numeric(12,2) not null check (price_bdt >= 0),
  image_url text not null,
  in_stock boolean not null default true,
  active boolean not null default true,
  sort_order integer not null default 0,
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  updated_at timestamptz not null default now()
);
create table public.quicksub_content (
  id text primary key,
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  updated_at timestamptz not null default now()
);
alter table public.quicksub_products enable row level security;
alter table public.quicksub_content enable row level security;
revoke all on public.quicksub_products, public.quicksub_content from anon, authenticated;
grant all on public.quicksub_products, public.quicksub_content to service_role;

-- Public images, but only privileged server-side credentials can upload.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('quicksub-products', 'quicksub-products', true, 6291456, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;
