-- Module 16: AI Productivity & Anomaly Coaching System
create table if not exists public.productivity_insights (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  member_id uuid references public.users(id) on delete set null,
  date_range daterange not null,
  insight_type text not null check (insight_type in ('late_starts','idle_spike','overwork','burnout_risk','performance_drop')),
  severity text not null check (severity in ('low','medium','high')),
  summary text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  acknowledged boolean not null default false,
  acknowledged_at timestamptz,
  acknowledged_by uuid references public.users(id) on delete set null
);

create index if not exists idx_productivity_insights_org on public.productivity_insights(org_id);
create index if not exists idx_productivity_insights_member on public.productivity_insights(member_id);
create index if not exists idx_productivity_insights_type on public.productivity_insights(insight_type);
create index if not exists idx_productivity_insights_severity on public.productivity_insights(severity);
create index if not exists idx_productivity_insights_created on public.productivity_insights(created_at);

