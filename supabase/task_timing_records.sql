create table if not exists public.task_timing_records (
  record_id text primary key,
  source_sheet_id text not null,
  source_sheet_name text not null,
  source_row bigint not null,
  operator_label text not null default '',
  operator_id text not null default '',
  operator_name text not null default '',
  car_model text not null default '',
  category text not null default '',
  part_number text not null default '',
  product_name text not null default '',
  work_date date,
  start_time text not null default '',
  end_time text not null default '',
  total_time text not null default '',
  total_seconds numeric not null default 0,
  avg_time_seconds numeric not null default 0,
  standard_time_seconds numeric not null default 0,
  good_count integer not null default 0,
  defect_missing integer not null default 0,
  defect_deform integer not null default 0,
  defect_appearance integer not null default 0,
  defect_other integer not null default 0,
  total_scrap integer not null default 0,
  remarks text not null default '',
  scrap_rate numeric not null default 0,
  yield_rate numeric not null default 0,
  efficiency_ratio numeric not null default 0,
  satisfaction numeric not null default 0,
  source_updated_at timestamptz,
  synced_at timestamptz not null default now(),
  unique (source_sheet_id, source_sheet_name, source_row)
);

alter table public.task_timing_records enable row level security;
revoke all on table public.task_timing_records from anon, authenticated;
grant select on public.task_timing_records to authenticated;

drop policy if exists "Authenticated employees can read task timing records"
on public.task_timing_records;

create policy "Authenticated employees can read task timing records"
on public.task_timing_records
for select to authenticated
using (auth.uid() is not null);

create index if not exists task_timing_records_work_date_idx
on public.task_timing_records (work_date desc);

create index if not exists task_timing_records_latest_idx
on public.task_timing_records (source_row desc);

create or replace function public.task_timing_battle_report(
  p_today date default ((now() at time zone 'Asia/Taipei')::date)
)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  with totals as (
    select coalesce(sum(good_count), 0)::bigint as cumulative_total
    from public.task_timing_records
  ),
  today_records as (
    select *
    from public.task_timing_records
    where work_date = p_today
  ),
  today_summary as (
    select
      coalesce(sum(good_count), 0)::bigint as today_good_count,
      count(*)::bigint as today_record_count,
      count(distinct operator_id)::bigint as today_operator_count,
      case
        when coalesce(sum(
          case
            when good_count > 0 and standard_time_seconds > 0 and efficiency_ratio > 0
            then (good_count * standard_time_seconds) / efficiency_ratio
            else 0
          end
        ), 0) > 0
        then round((
          sum(
            case
              when good_count > 0 and standard_time_seconds > 0 and efficiency_ratio > 0
              then good_count * standard_time_seconds
              else 0
            end
          ) /
          sum(
            case
              when good_count > 0 and standard_time_seconds > 0 and efficiency_ratio > 0
              then (good_count * standard_time_seconds) / efficiency_ratio
              else 0
            end
          )
        ) * 100, 1)
        else 0
      end as avg_efficiency
    from today_records
  ),
  live_feed as (
    select coalesce(jsonb_agg(jsonb_build_object(
      'operator_label', latest.operator_label,
      'part_number', latest.part_number,
      'product_name', latest.product_name,
      'good_count', latest.good_count
    ) order by latest.source_row desc), '[]'::jsonb) as records
    from (
      select operator_label, part_number, product_name, good_count, source_row
      from public.task_timing_records
      where operator_label <> ''
      order by source_row desc
      limit 15
    ) latest
  )
  select jsonb_build_object(
    'cumulative_total', totals.cumulative_total,
    'today_good_count', today_summary.today_good_count,
    'today_record_count', today_summary.today_record_count,
    'today_operator_count', today_summary.today_operator_count,
    'avg_efficiency', today_summary.avg_efficiency,
    'live_feed', live_feed.records
  )
  from totals, today_summary, live_feed;
$$;

revoke all on function public.task_timing_battle_report(date) from public, anon;
grant execute on function public.task_timing_battle_report(date) to authenticated;
