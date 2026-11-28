-- TV board: stop returning the all-time production total.
-- Summing every record each minute was the board's heaviest work; only today's rows are read now.

create or replace function public.task_timing_public_board(p_key text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_today date := (now() at time zone 'Asia/Taipei')::date;
  v_today_text text := ((now() at time zone 'Asia/Taipei')::date)::text;
  v_summary jsonb;
  v_notices jsonb;
begin
  if not exists (
    select 1 from public.task_timing_board_keys
    where key_hash = encode(sha256(convert_to(p_key, 'UTF8')), 'hex')
  ) then
    raise exception 'invalid board key' using errcode = '28000';
  end if;

  with today_records as (
    select good_count, standard_time_seconds, efficiency_ratio, operator_id,
           defect_missing, defect_deform, defect_appearance, defect_other
    from public.task_timing_records
    where work_date = v_today
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
  )
  select jsonb_build_object(
    'today', v_today_text,
    'today_good_count', s.today_good_count,
    'today_record_count', s.today_record_count,
    'today_operator_count', s.today_operator_count,
    'avg_efficiency', s.avg_efficiency,
    'today_defect_missing', s.today_defect_missing,
    'today_defect_deform', s.today_defect_deform,
    'today_defect_appearance', s.today_defect_appearance,
    'today_defect_other', s.today_defect_other
  )
  into v_summary
  from today_summary s;

  -- Same rules as getActiveTaskTimingNotices in src/services/taskTimingRecords.js.
  select coalesce(jsonb_agg(jsonb_build_object(
    'content', n.item->>'content',
    'content_vi', coalesce(n.item->>'content_vi', ''),
    'content_id', coalesce(n.item->>'content_id', '')
  ) order by n.ord), '[]'::jsonb)
  into v_notices
  from public.task_timing_notice_snapshot snap
  cross join lateral jsonb_array_elements(
    case when jsonb_typeof(snap.notices) = 'array' then snap.notices else '[]'::jsonb end
  ) with ordinality as n(item, ord)
  where snap.source_sheet_id = '1xo4YhDuxh-wpstg7tmAqW4orB9aBheF1CUFzM1TDWKw'
    and jsonb_typeof(n.item->'content') = 'string'
    and btrim(n.item->>'content') <> ''
    and coalesce(n.item->>'start_date', '') ~ '^\d{4}-\d{2}-\d{2}$'
    and n.item->>'start_date' <= v_today_text
    and (
      n.item->>'end_date' is null
      or n.item->>'end_date' = ''
      or (n.item->>'end_date' ~ '^\d{4}-\d{2}-\d{2}$' and v_today_text <= n.item->>'end_date')
    );

  return v_summary || jsonb_build_object('notices', v_notices);
end;
$$;

comment on function public.task_timing_public_board(text) is
  'TV board data. Rotate keys with: delete from public.task_timing_board_keys; insert a new sha256 hex of the key.';

revoke all on function public.task_timing_public_board(text) from public;
grant execute on function public.task_timing_public_board(text) to anon, authenticated;
