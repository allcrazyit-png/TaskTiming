create table if not exists public.task_timing_employees (
  employee_id text primary key,
  employee_name text not null default '',
  auth_user_id uuid unique not null,
  source_updated_at timestamptz,
  synced_at timestamptz not null default now()
);

-- Migration for the pre-existing unsafe table. It was verified empty before
-- applying the NOT NULL requirement below, so no employee data is discarded.
alter table public.task_timing_employees
  drop column if exists password,
  drop column if exists employee_password,
  add column if not exists auth_user_id uuid;

alter table public.task_timing_employees
  alter column auth_user_id set not null;

create unique index if not exists task_timing_employees_auth_user_id_idx
on public.task_timing_employees (auth_user_id);

alter table public.task_timing_employees enable row level security;
revoke all on table public.task_timing_employees from anon, authenticated;
grant select on public.task_timing_employees to anon;

drop policy if exists "Anonymous users can insert task timing employees"
on public.task_timing_employees;

drop policy if exists "Anonymous users can update task timing employees"
on public.task_timing_employees;

drop policy if exists "Anonymous users can delete task timing employees"
on public.task_timing_employees;

drop policy if exists "Anonymous users can write task timing employees"
on public.task_timing_employees;

drop policy if exists "Anonymous users can manage task timing employees"
on public.task_timing_employees;

drop policy if exists "Anonymous users can read task timing employees"
on public.task_timing_employees;

create policy "Anonymous users can read task timing employees"
on public.task_timing_employees
for select to anon
using (true);

create index if not exists task_timing_employees_name_idx
on public.task_timing_employees (employee_name, employee_id);
