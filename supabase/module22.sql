create table if not exists public.shifts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  start_time time not null,
  end_time time not null,
  is_overnight boolean not null default false,
  grace_minutes integer not null default 0,
  break_minutes integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_shifts_org on public.shifts(org_id);
create unique index if not exists uniq_shift_name_per_org on public.shifts(org_id, name);

create table if not exists public.shift_assignments (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.users(id) on delete cascade,
  shift_id uuid not null references public.shifts(id) on delete cascade,
  effective_from date not null,
  effective_to date,
  created_at timestamptz not null default now()
);

create index if not exists idx_shift_assignments_member on public.shift_assignments(member_id);
create index if not exists idx_shift_assignments_shift on public.shift_assignments(shift_id);
create index if not exists idx_shift_assignments_effective on public.shift_assignments(effective_from, effective_to);
