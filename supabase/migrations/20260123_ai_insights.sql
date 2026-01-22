-- AI Insights Table
create table if not exists public.ai_insights (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid references public.users(id) on delete cascade,
  insight_type text not null,
  period_start date not null,
  period_end date not null,
  severity text not null check (severity in ('info','warning','critical')),
  title text not null,
  summary text not null,
  details jsonb not null,
  confidence numeric not null default 0.5,
  recommended_actions jsonb,
  status text not null default 'active' check (status in ('active','dismissed','snoozed','resolved')),
  created_at timestamptz default now()
);

create index if not exists idx_ai_insights_org_user_created on public.ai_insights(org_id, user_id, created_at desc);
create index if not exists idx_ai_insights_org_type_created on public.ai_insights(org_id, insight_type, created_at desc);

-- AI Alert Rules Table
create table if not exists public.ai_alert_rules (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  rule_key text not null,
  enabled boolean default true,
  thresholds jsonb not null,
  notify_roles jsonb not null,
  notify_employee boolean default false,
  created_at timestamptz default now(),
  unique (org_id, rule_key)
);

create index if not exists idx_ai_alert_rules_org on public.ai_alert_rules(org_id);

-- AI Timesheet Candidates Table
create table if not exists public.ai_timesheet_candidates (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  timesheet_id uuid not null references public.time_sessions(id) on delete cascade,
  candidate_type text not null,
  proposed_changes jsonb not null,
  reason text not null,
  confidence numeric not null,
  status text not null default 'pending' check (status in ('pending','approved','rejected','applied')),
  reviewed_by uuid references public.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz default now()
);

create index if not exists idx_ai_timesheet_candidates_org_status on public.ai_timesheet_candidates(org_id, status);
create index if not exists idx_ai_timesheet_candidates_user on public.ai_timesheet_candidates(user_id);

-- AI Task Tags Table
create table if not exists public.ai_task_tags (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  source_type text not null,
  source_value text not null,
  tag text not null,
  confidence numeric not null,
  created_at timestamptz default now()
);

create index if not exists idx_ai_task_tags_org_user on public.ai_task_tags(org_id, user_id);

-- RLS Policies

-- ai_insights
alter table public.ai_insights enable row level security;

create policy "Users can view their own insights"
  on public.ai_insights for select
  using (auth.uid() = user_id);

create policy "Admins can view all insights in their org"
  on public.ai_insights for select
  using (
    exists (
      select 1 from public.users
      where users.id = auth.uid()
      and users.org_id = ai_insights.org_id
      and users.role in ('admin', 'super_admin') -- Assuming 'role' column exists on users or resolved via joining member_roles
    )
  );

-- ai_alert_rules
alter table public.ai_alert_rules enable row level security;

create policy "Admins can view and manage alert rules"
  on public.ai_alert_rules for all
  using (
    exists (
      select 1 from public.users
      where users.id = auth.uid()
      and users.org_id = ai_alert_rules.org_id
      and users.role in ('admin', 'super_admin')
    )
  );

-- ai_timesheet_candidates
alter table public.ai_timesheet_candidates enable row level security;

create policy "Users can view their own candidates"
  on public.ai_timesheet_candidates for select
  using (auth.uid() = user_id);

create policy "Admins can view and manage candidates"
  on public.ai_timesheet_candidates for all
  using (
    exists (
      select 1 from public.users
      where users.id = auth.uid()
      and users.org_id = ai_timesheet_candidates.org_id
      and users.role in ('admin', 'super_admin')
    )
  );

-- ai_task_tags
alter table public.ai_task_tags enable row level security;

create policy "Users can view their own task tags"
  on public.ai_task_tags for select
  using (auth.uid() = user_id);

create policy "Admins can view task tags"
  on public.ai_task_tags for select
  using (
    exists (
      select 1 from public.users
      where users.id = auth.uid()
      and users.org_id = ai_task_tags.org_id
      and users.role in ('admin', 'super_admin')
    )
  );
