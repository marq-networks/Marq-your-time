
-- Add sent_at and paid_at to payslips
alter table public.payslips add column if not exists sent_at timestamptz;
alter table public.payslips add column if not exists paid_at timestamptz;

create index if not exists idx_payslips_sent_at on public.payslips(sent_at);
create index if not exists idx_payslips_paid_at on public.payslips(paid_at);

-- Saved Views
create table if not exists public.saved_views (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  page_key text not null,
  name text not null,
  query_params jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_saved_views_org_user_page on public.saved_views(org_id, user_id, page_key);

alter table public.saved_views enable row level security;

create policy "Users can manage their own saved views"
  on public.saved_views for all
  using (auth.uid() = user_id);

-- Add missing indexes for performance
create index if not exists idx_time_sessions_project_id on public.time_sessions(project_id);
-- activity_events app_name/url for search
create index if not exists idx_activity_events_app_name_trgm on public.activity_events using gin (app_name gin_trgm_ops);
create index if not exists idx_activity_events_url_trgm on public.activity_events using gin (url gin_trgm_ops);
