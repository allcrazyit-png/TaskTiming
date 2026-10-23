-- Optional HR fields belong to a private mirror, not the anonymous login list.
create table if not exists public.task_timing_employee_profiles (
  employee_id text primary key references public.task_timing_employees(employee_id) on delete cascade,
  auth_user_id uuid unique not null,
  gender text check (gender is null or gender in ('男', '女', '未填')),
  nationality text,
  hire_date date,
  source_updated_at timestamptz,
  synced_at timestamptz not null default now()
);

alter table public.task_timing_employee_profiles enable row level security;
revoke all on table public.task_timing_employee_profiles from anon, authenticated;
grant select (employee_id, gender, nationality, hire_date, source_updated_at)
  on public.task_timing_employee_profiles to authenticated;
grant all on table public.task_timing_employee_profiles to service_role;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public'
      and tablename = 'task_timing_employee_profiles'
      and policyname = 'Employees can read their own profile') then
    create policy "Employees can read their own profile"
      on public.task_timing_employee_profiles for select to authenticated
      using ((select auth.uid()) = auth_user_id);
  end if;
end $$;

notify pgrst, 'reload schema';
