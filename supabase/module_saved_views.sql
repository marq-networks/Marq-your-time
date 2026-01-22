-- Saved Views for Filtering System

create table if not exists public.saved_views (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  page_key text not null,
  name text not null,
  query_params jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Index for faster lookups
create index if not exists idx_saved_views_lookup 
  on public.saved_views(org_id, user_id, page_key);

-- RLS
alter table public.saved_views enable row level security;

-- Policy: Users can only see/manage their own saved views
create policy "Users can manage their own saved views"
  on public.saved_views
  for all
  using (
    auth.uid() = user_id
  );
