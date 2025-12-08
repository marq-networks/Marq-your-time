-- Module 23: Performance & OKR Engine (add-only)
create table if not exists public.okr_sets (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  level text not null check (level in ('company','department','member')),
  department_id uuid references public.departments(id) on delete set null,
  member_id uuid references public.users(id) on delete set null,
  title text not null,
  period_start date not null,
  period_end date not null,
  created_by uuid not null references public.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create index if not exists idx_okr_sets_org on public.okr_sets(org_id);
create index if not exists idx_okr_sets_level on public.okr_sets(level);
create index if not exists idx_okr_sets_department on public.okr_sets(department_id);
create index if not exists idx_okr_sets_member on public.okr_sets(member_id);
create index if not exists idx_okr_sets_period on public.okr_sets(period_start, period_end);

create table if not exists public.okr_objectives (
  id uuid primary key default gen_random_uuid(),
  okr_set_id uuid not null references public.okr_sets(id) on delete cascade,
  title text not null,
  description text,
  weight numeric default 1.0,
  created_at timestamptz not null default now()
);

create index if not exists idx_okrs_objectives_set on public.okr_objectives(okr_set_id);

create table if not exists public.okr_key_results (
  id uuid primary key default gen_random_uuid(),
  objective_id uuid not null references public.okr_objectives(id) on delete cascade,
  label text not null,
  target_value numeric,
  current_value numeric default 0,
  unit text,
  direction text check (direction in ('up','down')),
  created_at timestamptz not null default now()
);

create index if not exists idx_okrs_krs_objective on public.okr_key_results(objective_id);

create table if not exists public.performance_checkins (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  member_id uuid not null references public.users(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  summary text,
  self_score numeric,
  manager_score numeric,
  created_at timestamptz not null default now(),
  created_by uuid not null references public.users(id) on delete restrict
);

create index if not exists idx_performance_checkins_org on public.performance_checkins(org_id);
create index if not exists idx_performance_checkins_member on public.performance_checkins(member_id);
create index if not exists idx_performance_checkins_period on public.performance_checkins(period_start, period_end);

