-- Timesheets
create table if not exists public.timesheets (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  employee_user_id uuid not null references public.users(id) on delete cascade,
  period_type text not null check (period_type in ('day','week','pay_period')),
  period_start date not null,
  period_end date not null,
  status text not null check (status in ('draft','submitted','changes_required','approved','rejected')),
  submitted_at timestamptz,
  approved_at timestamptz,
  approved_by uuid references public.users(id) on delete set null,
  reviewed_at timestamptz,
  reviewed_by uuid references public.users(id) on delete set null,
  rejection_reason text,
  totals jsonb not null default '{}'::jsonb, -- worked_minutes, break_minutes, etc.
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, employee_user_id, period_start)
);

create index if not exists idx_timesheets_org_emp_period on public.timesheets(org_id, employee_user_id, period_start);
create index if not exists idx_timesheets_org_status on public.timesheets(org_id, status);

-- Timesheet Items
create table if not exists public.timesheet_items (
  id uuid primary key default gen_random_uuid(),
  timesheet_id uuid not null references public.timesheets(id) on delete cascade,
  date date not null,
  work_sessions jsonb not null default '[]'::jsonb,
  breaks jsonb not null default '[]'::jsonb,
  totals jsonb not null default '{}'::jsonb,
  notes text,
  created_at timestamptz not null default now(),
  unique (timesheet_id, date)
);

create index if not exists idx_timesheet_items_ts_date on public.timesheet_items(timesheet_id, date);

-- RLS Policies for Timesheets
alter table public.timesheets enable row level security;

-- Employee: SELECT own timesheets
create policy "Employees can view own timesheets"
  on public.timesheets for select
  using (
    auth.uid() = employee_user_id
    or exists (
      select 1 from public.member_roles mr
      join public.users u on u.member_role_id = mr.id
      where u.id = auth.uid() and u.org_id = timesheets.org_id and mr.level >= 50 -- Admin/Super
    )
    or exists (
        select 1 from public.roles r
        join public.users u on u.role_id = r.id
        where u.id = auth.uid() and u.org_id = timesheets.org_id and (r.permissions->>'manage_timesheets')::boolean = true
    )
  );

-- Employee: INSERT draft (usually via API, but allowing draft creation)
create policy "Employees can insert draft timesheets"
  on public.timesheets for insert
  with check (
    auth.uid() = employee_user_id
    and status = 'draft'
  );

-- Employee: UPDATE only when status in ('draft','changes_required')
create policy "Employees can update own draft timesheets"
  on public.timesheets for update
  using (
    auth.uid() = employee_user_id
  )
  with check (
    status in ('draft', 'changes_required', 'submitted') -- Allow transition to submitted
  );

-- Admin/Super: Full access within org
create policy "Admins can manage all timesheets in org"
  on public.timesheets for all
  using (
    exists (
      select 1 from public.users u
      join public.member_roles mr on u.member_role_id = mr.id
      where u.id = auth.uid() and u.org_id = timesheets.org_id and mr.level >= 50
    )
    or exists (
        select 1 from public.users u
        join public.roles r on u.role_id = r.id
        where u.id = auth.uid() and u.org_id = timesheets.org_id and (r.permissions->>'manage_timesheets')::boolean = true
    )
  );

-- RLS Policies for Timesheet Items
alter table public.timesheet_items enable row level security;

create policy "Users can view items of visible timesheets"
  on public.timesheet_items for select
  using (
    exists (
      select 1 from public.timesheets t
      where t.id = timesheet_items.timesheet_id
      and (
        t.employee_user_id = auth.uid()
        or exists (
          select 1 from public.users u
          join public.member_roles mr on u.member_role_id = mr.id
          where u.id = auth.uid() and u.org_id = t.org_id and mr.level >= 50
        )
      )
    )
  );

create policy "Employees can insert/update items for draft timesheets"
  on public.timesheet_items for all
  using (
    exists (
      select 1 from public.timesheets t
      where t.id = timesheet_items.timesheet_id
      and t.employee_user_id = auth.uid()
      and t.status in ('draft', 'changes_required')
    )
  );
