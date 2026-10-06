-- Existing projects: allow Sheet positions to change without blocking new IDs.
-- This does not delete or overwrite production records, or change Auth/RLS.
begin;
set local lock_timeout = '5s';
alter table public.task_timing_records
drop constraint if exists task_timing_records_source_sheet_id_source_sheet_name_sourc_key;
commit;

-- Verify: record_id must remain the primary key; the source-row unique
-- constraint must no longer appear.
select conname, pg_get_constraintdef(oid)
from pg_constraint
where conrelid = 'public.task_timing_records'::regclass
order by conname;
