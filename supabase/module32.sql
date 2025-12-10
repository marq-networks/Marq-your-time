-- Module 32: Multi-Org / Partner Admin Console
-- Org memberships join table for multi-org users
create table if not exists public.org_memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  org_id uuid not null references public.organizations(id) on delete cascade,
  role text not null check (role in ('owner','admin','manager','member')),
  created_at timestamptz not null default now()
);
create index if not exists idx_org_memberships_user on public.org_memberships(user_id);
create index if not exists idx_org_memberships_org on public.org_memberships(org_id);
alter table public.org_memberships add constraint unique_user_org unique (user_id, org_id);

-- Super admin flag on users (add-only)
alter table if not exists public.users add column if not exists is_super_admin boolean default false;

