-- Module 18: Leave Management System
create table if not exists public.leave_types (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  code text not null,
  name text not null,
  description text,
  paid boolean not null default false,
  default_days_per_year integer not null default 0,
  is_active boolean not null default true
);

create unique index if not exists idx_leave_types_org_code on public.leave_types(org_id, code);

create table if not exists public.leave_requests (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  member_id uuid not null references public.users(id) on delete cascade,
  leave_type_id uuid not null references public.leave_types(id) on delete restrict,
  start_date date not null,
  end_date date not null,
  days_count integer not null,
  status text not null check (status in ('pending','approved','rejected','cancelled')),
  reason text,
  created_at timestamptz not null default now(),
  created_by uuid references public.users(id) on delete set null,
  reviewed_at timestamptz,
  reviewed_by uuid references public.users(id) on delete set null,
  review_note text
);

create index if not exists idx_leave_requests_org on public.leave_requests(org_id);
create index if not exists idx_leave_requests_member on public.leave_requests(member_id);
create index if not exists idx_leave_requests_status on public.leave_requests(status);
create index if not exists idx_leave_requests_dates on public.leave_requests(start_date, end_date);

