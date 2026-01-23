
-- Slack Integration Tables

create table if not exists public.integrations_slack (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null unique references public.organizations(id) on delete cascade,
  slack_team_id text not null,
  slack_team_name text,
  slack_bot_user_id text,
  access_token_encrypted text not null,
  connected_by uuid not null references public.users(id),
  connected_at timestamptz default now(),
  is_enabled boolean default true,
  created_at timestamptz default now()
);

create index if not exists idx_integrations_slack_org_id on public.integrations_slack(org_id);

create table if not exists public.integrations_slack_settings (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null unique references public.organizations(id) on delete cascade,
  default_channel_id text not null,
  default_channel_name text,
  notify_events jsonb not null default '{
    "timesheet_submitted": true,
    "timesheet_approved": true,
    "timesheet_rejected": true,
    "timesheet_changes_required": true,
    "smart_alerts": true,
    "missing_screenshots": true,
    "break_abuse": true,
    "absent_login": true,
    "payroll_generated": false
  }'::jsonb,
  mention_user_ids jsonb default '[]'::jsonb,
  quiet_hours jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_integrations_slack_settings_org_id on public.integrations_slack_settings(org_id);

-- RLS Policies

alter table public.integrations_slack enable row level security;
alter table public.integrations_slack_settings enable row level security;

-- Admin/Owner/SuperAdmin can view integration status (but NOT the token)
create policy "Admins can view slack integration status"
  on public.integrations_slack for select
  using (
    exists (
      select 1 from public.users u
      join public.roles r on u.role_id = r.id
      where u.id = auth.uid() 
      and u.org_id = integrations_slack.org_id
      and (r.name in ('Admin', 'Owner', 'Super Admin') or r.permissions->>'manage_org' = 'true')
    )
  );

-- Only service role can insert/update/delete sensitive token data
-- (We'll assume the API uses service role for writing tokens)
-- Or we can allow admins to delete/disconnect.

create policy "Admins can delete slack integration"
  on public.integrations_slack for delete
  using (
    exists (
      select 1 from public.users u
      join public.roles r on u.role_id = r.id
      where u.id = auth.uid() 
      and u.org_id = integrations_slack.org_id
      and (r.name in ('Admin', 'Owner', 'Super Admin') or r.permissions->>'manage_org' = 'true')
    )
  );

-- Settings: Admins can view and update
create policy "Admins can view slack settings"
  on public.integrations_slack_settings for select
  using (
    exists (
      select 1 from public.users u
      join public.roles r on u.role_id = r.id
      where u.id = auth.uid() 
      and u.org_id = integrations_slack_settings.org_id
      and (r.name in ('Admin', 'Owner', 'Super Admin') or r.permissions->>'manage_org' = 'true')
    )
  );

create policy "Admins can update slack settings"
  on public.integrations_slack_settings for update
  using (
    exists (
      select 1 from public.users u
      join public.roles r on u.role_id = r.id
      where u.id = auth.uid() 
      and u.org_id = integrations_slack_settings.org_id
      and (r.name in ('Admin', 'Owner', 'Super Admin') or r.permissions->>'manage_org' = 'true')
    )
  );

create policy "Admins can insert slack settings"
  on public.integrations_slack_settings for insert
  with check (
    exists (
      select 1 from public.users u
      join public.roles r on u.role_id = r.id
      where u.id = auth.uid() 
      and u.org_id = integrations_slack_settings.org_id
      and (r.name in ('Admin', 'Owner', 'Super Admin') or r.permissions->>'manage_org' = 'true')
    )
  );
