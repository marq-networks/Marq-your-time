-- Module URL Categorization
-- Configurable productivity rules for categories
create table if not exists public.org_category_rules (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  category_key text not null, -- e.g. 'Social Media'
  display_name text, -- e.g. 'Social Media' (can be used for custom categories)
  productivity_status text not null check (productivity_status in ('productive','neutral','unproductive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, category_key)
);

-- URL overrides to force specific URLs to specific categories
create table if not exists public.org_url_overrides (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  url_pattern text not null, -- e.g. 'linkedin.com' or 'github.com/my-repo'
  category_key text not null, -- e.g. 'Work-related'
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, url_pattern)
);

-- Index for faster lookups
create index if not exists idx_org_category_rules_org on public.org_category_rules(org_id);
create index if not exists idx_org_url_overrides_org on public.org_url_overrides(org_id);
