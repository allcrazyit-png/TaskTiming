create table if not exists public.task_timing_products (
  part_number text primary key,
  product_name text not null default '',
  car_model text not null default '',
  category text not null default '',
  ct_time_seconds numeric,
  product_image text,
  source_updated_at timestamptz,
  synced_at timestamptz not null default now()
);

alter table public.task_timing_products enable row level security;
grant select on public.task_timing_products to anon;

drop policy if exists "Anonymous users can read task timing products"
on public.task_timing_products;

create policy "Anonymous users can read task timing products"
on public.task_timing_products
for select to anon
using (true);

create index if not exists task_timing_products_category_idx
on public.task_timing_products (category);
