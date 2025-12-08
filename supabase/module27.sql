-- Module 27 — Asset Management (Add-only)

create table if not exists public.assets (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  asset_tag text not null,
  category text not null check (category in ('laptop','monitor','phone','license','other')),
  model text,
  serial_number text,
  purchase_date date,
  warranty_end date,
  status text not null check (status in ('in_use','in_stock','retired','lost')),
  created_at timestamptz not null default now(),
  unique (org_id, asset_tag)
);

create index if not exists assets_org_idx on public.assets(org_id);
create index if not exists assets_status_idx on public.assets(status);
create index if not exists assets_category_idx on public.assets(category);

create table if not exists public.asset_assignments (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.assets(id) on delete cascade,
  member_id uuid references public.users(id) on delete set null,
  assigned_at timestamptz not null default now(),
  returned_at timestamptz
);

create index if not exists asset_assignments_asset_idx on public.asset_assignments(asset_id);
create index if not exists asset_assignments_member_idx on public.asset_assignments(member_id);

