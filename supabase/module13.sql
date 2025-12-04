create table if not exists public.agent_sync_queues (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null,
  member_id uuid not null references public.users(id) on delete cascade,
  org_id uuid not null references public.organizations(id) on delete cascade,
  local_batch_id text not null,
  batch_type text not null check (batch_type in ('time','activity','screenshot')),
  item_count integer not null default 0,
  status text not null check (status in ('pending','processing','applied','error')) default 'pending',
  error_message text,
  received_at timestamptz not null default now(),
  processed_at timestamptz
);

create unique index if not exists uniq_agent_sync_batch on public.agent_sync_queues(device_id, member_id, local_batch_id);
create index if not exists idx_agent_sync_queues_status on public.agent_sync_queues(status);

create table if not exists public.agent_sync_items (
  id uuid primary key default gen_random_uuid(),
  sync_queue_id uuid not null references public.agent_sync_queues(id) on delete cascade,
  item_index integer not null,
  payload_type text not null check (payload_type in ('time_session','activity_event','screenshot')),
  payload_json jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_agent_sync_items_queue on public.agent_sync_items(sync_queue_id);
create unique index if not exists uniq_agent_sync_items_order on public.agent_sync_items(sync_queue_id, item_index);

create table if not exists public.agent_sync_conflicts (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null,
  member_id uuid not null references public.users(id) on delete cascade,
  org_id uuid not null references public.organizations(id) on delete cascade,
  conflict_type text not null check (conflict_type in ('overlapping_time_session','duplicate_event','privacy_blocked','missing_image','no_time_session')),
  details jsonb not null,
  created_at timestamptz not null default now(),
  resolved boolean not null default false,
  resolved_at timestamptz,
  resolved_by uuid references public.users(id) on delete set null
);

create index if not exists idx_agent_sync_conflicts_member on public.agent_sync_conflicts(member_id);
create index if not exists idx_agent_sync_conflicts_org on public.agent_sync_conflicts(org_id);
create index if not exists idx_agent_sync_conflicts_type on public.agent_sync_conflicts(conflict_type);

-- Enable RLS to restrict direct client access; server uses service role
alter table if exists public.agent_sync_queues enable row level security;
alter table if exists public.agent_sync_items enable row level security;
alter table if exists public.agent_sync_conflicts enable row level security;

-- Optional: explicit deny-all (no policies) keeps tables locked to service role access only
-- Uncomment if you want explicit policies (leave commented if not needed)
-- create policy "deny select" on public.agent_sync_queues for select using (false);
-- create policy "deny insert" on public.agent_sync_queues for insert with check (false);
-- create policy "deny update" on public.agent_sync_queues for update using (false);
-- create policy "deny delete" on public.agent_sync_queues for delete using (false);
-- create policy "deny select" on public.agent_sync_items for select using (false);
-- create policy "deny insert" on public.agent_sync_items for insert with check (false);
-- create policy "deny update" on public.agent_sync_items for update using (false);
-- create policy "deny delete" on public.agent_sync_items for delete using (false);
-- create policy "deny select" on public.agent_sync_conflicts for select using (false);
-- create policy "deny insert" on public.agent_sync_conflicts for insert with check (false);
-- create policy "deny update" on public.agent_sync_conflicts for update using (false);
-- create policy "deny delete" on public.agent_sync_conflicts for delete using (false);
