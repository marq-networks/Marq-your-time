-- Clients Tracking Module

-- Clients
create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  email text,
  address text,
  currency text default 'USD',
  status text check (status in ('active','archived')) default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_clients_org on public.clients(org_id);

-- Projects
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  name text not null,
  code text,
  description text,
  status text check (status in ('active','completed','on_hold','archived')) default 'active',
  budget_type text check (budget_type in ('hours','money','none')) default 'none',
  budget_value numeric default 0,
  start_date date,
  end_date date,
  manager_id uuid references public.users(id) on delete set null,
  is_billable boolean default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_projects_org on public.projects(org_id);
create index if not exists idx_projects_client on public.projects(client_id);

-- Project Members
create table if not exists public.project_members (
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  role text default 'member',
  rate numeric,
  created_at timestamptz not null default now(),
  primary key (project_id, user_id)
);

-- Tasks
create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null,
  description text,
  status text check (status in ('todo','in_progress','review','done')) default 'todo',
  priority text check (priority in ('low','medium','high','urgent')) default 'medium',
  assignee_id uuid references public.users(id) on delete set null,
  reporter_id uuid references public.users(id) on delete set null,
  due_date timestamptz,
  estimated_hours numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_tasks_project on public.tasks(project_id);
create index if not exists idx_tasks_assignee on public.tasks(assignee_id);
create index if not exists idx_tasks_org on public.tasks(org_id);

-- Update Time Sessions
alter table public.time_sessions add column if not exists project_id uuid references public.projects(id) on delete set null;
alter table public.time_sessions add column if not exists task_id uuid references public.tasks(id) on delete set null;
create index if not exists idx_time_sessions_project on public.time_sessions(project_id);
create index if not exists idx_time_sessions_task on public.time_sessions(task_id);
