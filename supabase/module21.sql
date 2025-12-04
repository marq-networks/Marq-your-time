-- Module 21 — HR & Org Structure Engine
-- Add-only migration: departments hierarchy, member_roles, manager relationship

create table if not exists public.member_roles (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  level int not null,
  created_at timestamptz not null default now()
);

alter table if exists public.departments
  add column if not exists description text,
  add column if not exists parent_id uuid references public.departments(id) on delete set null,
  add column if not exists updated_at timestamptz not null default now();

create index if not exists departments_parent_idx on public.departments(parent_id);

alter table if exists public.users
  add column if not exists manager_id uuid references public.users(id) on delete set null;

alter table if exists public.users
  add column if not exists member_role_id uuid references public.member_roles(id) on delete set null;
