create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.organizations(id) on delete cascade,
  actor_user_id uuid references public.users(id) on delete set null,
  actor_ip text,
  actor_user_agent text,
  event_type text not null,
  entity_type text,
  entity_id uuid,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_audit_logs_org on public.audit_logs(org_id);
create index if not exists idx_audit_logs_actor on public.audit_logs(actor_user_id);
create index if not exists idx_audit_logs_event on public.audit_logs(event_type);
create index if not exists idx_audit_logs_created on public.audit_logs(created_at);
