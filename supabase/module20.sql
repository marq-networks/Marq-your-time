create table if not exists public.api_clients (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  api_key_hash text not null,
  scopes text[] not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid not null references public.users(id) on delete cascade,
  last_used_at timestamptz
);

create index if not exists idx_api_clients_org on public.api_clients(org_id);
create index if not exists idx_api_clients_active on public.api_clients(is_active);

create table if not exists public.webhooks (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  target_url text not null,
  secret text not null,
  events text[] not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid not null references public.users(id) on delete cascade,
  last_triggered_at timestamptz
);

create index if not exists idx_webhooks_org on public.webhooks(org_id);
create index if not exists idx_webhooks_active on public.webhooks(is_active);

create table if not exists public.webhook_events (
  id uuid primary key default gen_random_uuid(),
  webhook_id uuid not null references public.webhooks(id) on delete cascade,
  event_type text not null,
  payload jsonb not null,
  status text not null check (status in ('pending','delivered','failed')) default 'pending',
  attempt_count integer not null default 0,
  last_attempt_at timestamptz,
  error_message text,
  created_at timestamptz not null default now()
);

create index if not exists idx_webhook_events_webhook on public.webhook_events(webhook_id);
create index if not exists idx_webhook_events_status on public.webhook_events(status);
