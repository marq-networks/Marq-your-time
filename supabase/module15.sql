create table if not exists public.devices (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  member_id uuid references public.users(id) on delete set null,
  device_id uuid not null,
  device_name text,
  device_os text,
  last_seen timestamptz,
  agent_version text,
  last_version_check_at timestamptz,
  update_status text check (update_status in ('ok','outdated','blocked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, device_id)
);

create index if not exists idx_devices_org on public.devices(org_id);
create index if not exists idx_devices_member on public.devices(member_id);

create table if not exists public.platform_settings (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  value_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
insert into public.platform_settings(key, value_json)
  values ('agent_minimum_version', '{"minimum_version":"1.0.0","download_url":""}'::jsonb)
on conflict (key) do nothing;
