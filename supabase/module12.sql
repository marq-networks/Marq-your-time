create table if not exists public.payroll_periods_v12 (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  status text not null check (status in ('pending','processing','approved','completed')) default 'pending',
  generated_at timestamptz,
  approved_at timestamptz,
  approved_by uuid references public.users(id) on delete set null,
  created_by uuid not null references public.users(id) on delete cascade,
  notes text
);

create index if not exists idx_payroll_periods_v12_org on public.payroll_periods_v12(org_id, period_start);

create table if not exists public.member_payroll (
  id uuid primary key default gen_random_uuid(),
  payroll_period_id uuid not null references public.payroll_periods_v12(id) on delete cascade,
  member_id uuid not null references public.users(id) on delete cascade,
  base_salary numeric not null default 0,
  worked_minutes integer not null default 0,
  extra_minutes integer not null default 0,
  short_minutes integer not null default 0,
  overtime_amount numeric not null default 0,
  short_deduction numeric not null default 0,
  fines_total numeric not null default 0,
  adjustments_total numeric not null default 0,
  net_salary numeric not null default 0,
  generated_at timestamptz not null default now(),
  approved boolean not null default false,
  approved_at timestamptz
);

create unique index if not exists uniq_member_payroll_period on public.member_payroll(payroll_period_id, member_id);

create table if not exists public.payroll_adjustments (
  id uuid primary key default gen_random_uuid(),
  member_payroll_id uuid not null references public.member_payroll(id) on delete cascade,
  type text not null check (type in ('bonus','deduction','fine')),
  amount numeric not null,
  reason text not null,
  created_at timestamptz not null default now(),
  created_by uuid not null references public.users(id) on delete cascade
);

