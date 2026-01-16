create table if not exists public.payslips (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  payroll_run_id uuid not null references public.payroll_periods_v12(id) on delete cascade,
  slip_number text not null,
  pdf_path text,
  created_at timestamptz not null default now(),
  unique (org_id, slip_number)
);

create index if not exists idx_payslips_org_run_user on public.payslips(org_id, payroll_run_id, user_id);
create index if not exists idx_payslips_user on public.payslips(user_id);

create table if not exists public.payslip_line_items (
  id uuid primary key default gen_random_uuid(),
  payslip_id uuid not null references public.payslips(id) on delete cascade,
  type text not null check (type in ('earning','deduction')),
  label text not null,
  amount numeric not null
);

create index if not exists idx_payslip_line_items_payslip on public.payslip_line_items(payslip_id);

