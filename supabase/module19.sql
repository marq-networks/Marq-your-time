create table if not exists public.report_jobs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.organizations(id) on delete cascade,
  created_by uuid references public.users(id) on delete set null,
  report_type text not null check (report_type in ('attendance','timesheet','activity','payroll','billing','leave')),
  params jsonb not null,
  status text not null check (status in ('pending','running','completed','error')),
  file_url text,
  error_message text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists idx_report_jobs_org on public.report_jobs(org_id);
create index if not exists idx_report_jobs_status on public.report_jobs(status);
create index if not exists idx_report_jobs_type on public.report_jobs(report_type);

