-- Sheet remains the master. A complete validated snapshot is replaced atomically.
create table if not exists public.task_timing_notice_snapshot (
  source_sheet_id text primary key,
  notices jsonb not null default '[]'::jsonb check (jsonb_typeof(notices) = 'array'),
  synced_at timestamptz not null default now()
);
alter table public.task_timing_notice_snapshot enable row level security;
revoke all on public.task_timing_notice_snapshot from anon, authenticated;
grant select on public.task_timing_notice_snapshot to authenticated;
drop policy if exists "Employees read notices" on public.task_timing_notice_snapshot;
create policy "Employees read notices" on public.task_timing_notice_snapshot
for select to authenticated using (auth.uid() is not null);
