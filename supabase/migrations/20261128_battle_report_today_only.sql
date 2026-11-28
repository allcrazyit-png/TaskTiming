-- Battle report reads only today's rows plus the latest 15; the all-time sum is gone.
create or replace function public.task_timing_battle_report(
  p_today date default ((now() at time zone 'Asia/Taipei')::date)
)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  with today_records as (
    select *
    from public.task_timing_records
    where work_date = p_today
  ),
  today_summary as (
    select
      coalesce(sum(good_count), 0)::bigint as today_good_count,
      count(*)::bigint as today_record_count,
      coalesce(sum(defect_missing), 0)::bigint as today_defect_missing,
      coalesce(sum(defect_deform), 0)::bigint as today_defect_deform,
      coalesce(sum(defect_appearance), 0)::bigint as today_defect_appearance,
      coalesce(sum(defect_other), 0)::bigint as today_defect_other,
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
    'today_good_count', today_summary.today_good_count,
    'today_record_count', today_summary.today_record_count,
    'today_operator_count', today_summary.today_operator_count,
    'avg_efficiency', today_summary.avg_efficiency,
    'today_defect_missing', today_summary.today_defect_missing,
    'today_defect_deform', today_summary.today_defect_deform,
    'today_defect_appearance', today_summary.today_defect_appearance,
    'today_defect_other', today_summary.today_defect_other,
    'live_feed', live_feed.records
  )
  from today_summary, live_feed;
$$;

revoke all on function public.task_timing_battle_report(date) from public, anon;
grant execute on function public.task_timing_battle_report(date) to authenticated;
