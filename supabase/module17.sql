-- Module 17: Organization Billing Engine
create table if not exists public.billing_plans (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text,
  price_per_seat numeric not null default 0,
  price_per_login numeric,
  currency text not null default 'USD',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.org_subscriptions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  plan_id uuid not null references public.billing_plans(id) on delete restrict,
  status text not null check (status in ('trial','active','past_due','cancelled')),
  seats integer not null default 0,
  started_at timestamptz not null default now(),
  trial_ends_at timestamptz,
  cancelled_at timestamptz,
  updated_at timestamptz not null default now(),
  external_ref text
);

create index if not exists idx_org_subscriptions_org on public.org_subscriptions(org_id);
create index if not exists idx_org_subscriptions_status on public.org_subscriptions(status);

-- Ensure schema is up-to-date when tables already exist
do $$
begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'org_subscriptions' and column_name = 'updated_at') then
    -- already present
    null;
  else
    alter table public.org_subscriptions add column updated_at timestamptz not null default now();
  end if;
end $$;
