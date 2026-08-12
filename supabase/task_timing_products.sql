-- 產品鏡像表：同一個品番在不同工序（類別）各保留一筆，
-- 所以主鍵是 (part_number, category) 而不是單一 part_number。
create table if not exists public.task_timing_products (
  part_number text not null,
  product_name text not null default '',
  car_model text not null default '',
  category text not null default '',
  ct_time_seconds numeric,
  product_image text,
  source_updated_at timestamptz,
  synced_at timestamptz not null default now()
);

-- 既有專案從單欄主鍵升級為複合主鍵；重複執行不會出錯。
alter table public.task_timing_products
drop constraint if exists task_timing_products_pkey;

alter table public.task_timing_products
add primary key (part_number, category);

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
