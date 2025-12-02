-- Organizations
create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  org_name text not null,
  org_logo text,
  owner_name text not null,
  owner_email text not null,
  billing_email text not null,
  subscription_type text not null check (subscription_type in ('monthly','yearly')),
  price_per_login numeric not null,
  total_licensed_seats integer not null,
  used_seats integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Invites
create table if not exists public.organization_invites (
  id uuid primary key default gen_random_uuid(),
  invited_email text not null,
  org_id uuid not null references public.organizations(id) on delete cascade,
  invited_by text not null,
  role text not null,
  invite_status text not null check (invite_status in ('pending','accepted','expired','revoked')) default 'pending',
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  token text not null unique,
  assign_seat boolean not null default false
);

-- SaaS Settings (singleton)
create table if not exists public.saas_settings (
  id text primary key,
  default_seat_price numeric not null,
  default_seat_limit integer not null,
  landing_page_invite_enabled boolean not null
);

-- simple function to increment seats atomically
create or replace function public.increment_used_seats(org uuid)
returns void language plpgsql as $$
begin
  update public.organizations set used_seats = used_seats + 1, updated_at = now() where id = org;
end;$$;
create extension if not exists "pgcrypto";

-- Departments
create table if not exists public.departments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);
alter table if not exists public.departments
  add constraint departments_org_name_unique unique (org_id, name);

-- Roles
create table if not exists public.roles (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  permissions jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

-- Users
create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  first_name text not null,
  last_name text not null,
  email text not null,
  password_hash text not null,
  role_id uuid references public.roles(id) on delete set null,
  department_id uuid references public.departments(id) on delete set null,
  position_title text,
  profile_image text,
  salary numeric,
  working_days text[] not null default '{}',
  working_hours_per_day numeric,
  status text not null check (status in ('active','inactive','suspended')) default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, email)
);

-- Permission Audit Log
create table if not exists public.permission_audit_logs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  actor_user_id uuid references public.users(id) on delete cascade,
  target_user_id uuid references public.users(id) on delete set null,
  action_type text not null check (action_type in ('role_changed','permissions_updated','role_deleted')),
  previous_role jsonb,
  previous_permissions jsonb,
  new_role jsonb,
  new_permissions jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.time_sessions (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.users(id) on delete cascade,
  org_id uuid not null references public.organizations(id) on delete cascade,
  date date not null,
  start_time timestamptz not null,
  end_time timestamptz,
  source text not null,
  status text not null check (status in ('open','closed','cancelled')),
  total_minutes integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_time_sessions_member_org_date on public.time_sessions(member_id, org_id, date);
create index if not exists idx_time_sessions_status on public.time_sessions(status);

alter table public.time_sessions add column if not exists cancel_reason text;

create table if not exists public.break_sessions (
  id uuid primary key default gen_random_uuid(),
  time_session_id uuid not null references public.time_sessions(id) on delete cascade,
  break_rule_id uuid,
  label text not null,
  start_time timestamptz not null,
  end_time timestamptz,
  total_minutes integer,
  is_paid boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_break_sessions_session on public.break_sessions(time_session_id);
create index if not exists idx_break_sessions_open on public.break_sessions(time_session_id) where end_time is null;

create table if not exists public.daily_time_summaries (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.users(id) on delete cascade,
  org_id uuid not null references public.organizations(id) on delete cascade,
  date date not null,
  work_pattern_id uuid,
  scheduled_minutes integer not null default 0,
  worked_minutes integer not null default 0,
  paid_break_minutes integer not null default 0,
  unpaid_break_minutes integer not null default 0,
  extra_minutes integer not null default 0,
  short_minutes integer not null default 0,
  status text not null check (status in ('normal','extra','short','absent','unconfigured')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_daily_summaries_member_org_date on public.daily_time_summaries(member_id, org_id, date);

create table if not exists public.time_anomalies (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.users(id) on delete cascade,
  org_id uuid not null references public.organizations(id) on delete cascade,
  date date not null,
  type text not null,
  details text,
  resolved boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_time_anomalies_member_org_date on public.time_anomalies(member_id, org_id, date);

create table if not exists public.payroll_periods (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  start_date date not null,
  end_date date not null,
  status text not null check (status in ('open','locked','exported')) default 'open',
  created_by uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  locked_at timestamptz,
  exported_at timestamptz
);

create table if not exists public.member_payroll_lines (
  id uuid primary key default gen_random_uuid(),
  payroll_period_id uuid not null references public.payroll_periods(id) on delete cascade,
  member_id uuid not null references public.users(id) on delete cascade,
  org_id uuid not null references public.organizations(id) on delete cascade,
  total_scheduled_minutes integer not null default 0,
  total_worked_minutes integer not null default 0,
  total_extra_minutes integer not null default 0,
  total_short_minutes integer not null default 0,
  days_present integer not null default 0,
  days_absent integer not null default 0,
  salary_type text not null check (salary_type in ('monthly','hourly','daily')),
  base_rate numeric not null default 0,
  currency text not null default 'USD',
  base_earnings numeric not null default 0,
  extra_earnings numeric not null default 0,
  deduction_for_short numeric not null default 0,
  fines_total numeric not null default 0,
  adjustments_total numeric not null default 0,
  net_payable numeric not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (payroll_period_id, member_id)
);

create table if not exists public.member_fines (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.users(id) on delete cascade,
  org_id uuid not null references public.organizations(id) on delete cascade,
  date date not null,
  reason text not null,
  amount numeric not null,
  currency text not null default 'USD',
  created_by uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.member_adjustments (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.users(id) on delete cascade,
  org_id uuid not null references public.organizations(id) on delete cascade,
  date date not null,
  reason text not null,
  amount numeric not null,
  currency text not null default 'USD',
  created_by uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.billing_invoices (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  invoice_number text not null,
  invoice_date date not null,
  billing_period_start date not null,
  billing_period_end date not null,
  subtotal numeric not null default 0,
  tax numeric not null default 0,
  total numeric not null default 0,
  status text not null check (status in ('paid','unpaid','overdue')) default 'unpaid',
  pdf_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, invoice_number)
);

create table if not exists public.billing_line_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.billing_invoices(id) on delete cascade,
  title text not null,
  description text,
  quantity numeric not null default 1,
  unit_price numeric not null default 0,
  total numeric not null default 0
);

create index if not exists idx_billing_line_items_invoice on public.billing_line_items(invoice_id);

-- Notifications (Module 11)
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  member_id uuid references public.users(id) on delete set null,
  type text not null check (type in ('system','attendance','payroll','device','agent','billing')),
  title text not null,
  message text not null,
  meta jsonb,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists idx_notifications_org on public.notifications(org_id);
create index if not exists idx_notifications_member on public.notifications(member_id);
create index if not exists idx_notifications_created on public.notifications(created_at);

create table if not exists public.notification_preferences (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.users(id) on delete cascade,
  email_enabled boolean not null default true,
  inapp_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (member_id)
);

create table if not exists public.billing_settings (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  billing_email text not null,
  payment_method_type text,
  payment_method_token text,
  created_at timestamptz not null default now()
);

create table if not exists public.member_privacy_settings (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.users(id) on delete cascade unique,
  org_id uuid not null references public.organizations(id) on delete cascade,
  allow_activity_tracking boolean not null default false,
  allow_screenshots boolean not null default false,
  mask_personal_windows boolean not null default true,
  last_updated_by uuid references public.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table if not exists public.tracking_sessions (
  id uuid primary key default gen_random_uuid(),
  time_session_id uuid not null references public.time_sessions(id) on delete cascade,
  member_id uuid not null references public.users(id) on delete cascade,
  org_id uuid not null references public.organizations(id) on delete cascade,
  started_at timestamptz not null,
  ended_at timestamptz,
  consent_given boolean not null default false,
  consent_text text,
  created_at timestamptz not null default now()
);

create table if not exists public.activity_events (
  id uuid primary key default gen_random_uuid(),
  tracking_session_id uuid not null references public.tracking_sessions(id) on delete cascade,
  timestamp timestamptz not null,
  app_name text not null,
  window_title text not null,
  url text,
  category text,
  is_active boolean not null,
  keyboard_activity_score smallint,
  mouse_activity_score smallint,
  created_at timestamptz not null default now()
);

create table if not exists public.activity_app_aliases (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.organizations(id) on delete cascade,
  match_type text not null check (match_type in ('contains','equals','regex')),
  pattern text not null,
  category text not null check (category in ('productive','neutral','unproductive')),
  label text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.screenshots (
  id uuid primary key default gen_random_uuid(),
  tracking_session_id uuid not null references public.tracking_sessions(id) on delete cascade,
  timestamp timestamptz not null,
  storage_path text not null,
  thumbnail_path text not null,
  blur_level smallint not null,
  was_masked boolean not null,
  created_at timestamptz not null default now()
);

create table if not exists public.employees (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  full_name text,
  department text,
  role_title text,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_employees_user on public.employees(user_id);
