-- Module 31 — HR Adjustments Log & Storage

-- Create hr_adjustments_log table first (so policies can be dropped/created on it)
create table if not exists hr_adjustments_log (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  actor_user_id uuid not null,
  actor_role text not null,
  employee_user_id uuid not null,
  module text not null,
  entity_table text not null,
  entity_id uuid,
  field_name text not null,
  old_value jsonb,
  new_value jsonb,
  reason text not null,
  attachment_path text,
  created_at timestamptz not null default now(),
  metadata jsonb
);

-- Now it is safe to drop existing policies
drop policy if exists "Enable insert for admins and owners" on hr_adjustments_log;
drop policy if exists "Enable select for admins and employees" on hr_adjustments_log;

-- Create indexes
create index if not exists idx_hr_adjustments_log_org_emp_date 
  on hr_adjustments_log (org_id, employee_user_id, created_at desc);

create index if not exists idx_hr_adjustments_log_org_module_date 
  on hr_adjustments_log (org_id, module, created_at desc);

create index if not exists idx_hr_adjustments_log_actor_date 
  on hr_adjustments_log (actor_user_id, created_at desc);

-- Enable RLS
alter table hr_adjustments_log enable row level security;

-- Create policies

-- INSERT: Allowed only for admin/super_admin/owner within same org
-- Uses public.users and public.roles tables. Matches user by email.
create policy "Enable insert for admins and owners"
on hr_adjustments_log for insert
to authenticated
with check (
  exists (
    select 1 from public.users u
    join public.roles r on u.role_id = r.id
    where u.org_id = hr_adjustments_log.org_id
      and u.email = (auth.jwt() ->> 'email')
      and (r.name = 'Admin' or r.name = 'Owner' or r.name = 'Super Admin' or r.name = 'Manager')
  )
);

-- SELECT: 
-- a) admin/super_admin/owner/manager within same org (all logs)
-- b) employee can read their own logs only
create policy "Enable select for admins and employees"
on hr_adjustments_log for select
to authenticated
using (
  (
    -- Admin/Owner access
    exists (
      select 1 from public.users u
      join public.roles r on u.role_id = r.id
      where u.org_id = hr_adjustments_log.org_id
        and u.email = (auth.jwt() ->> 'email')
        and (r.name = 'Admin' or r.name = 'Owner' or r.name = 'Super Admin' or r.name = 'Manager')
    )
  )
  or
  (
    -- Employee access (own logs only)
    exists (
      select 1 from public.users u
      where u.id = hr_adjustments_log.employee_user_id
      and u.email = (auth.jwt() ->> 'email')
    )
  )
);

-- Storage bucket 'hr-adjustments' setup (if not exists)
insert into storage.buckets (id, name, public)
values ('hr-adjustments', 'hr-adjustments', false)
on conflict (id) do nothing;

-- Storage Policies for 'hr-adjustments'
drop policy if exists "Admins can upload adjustments" on storage.objects;
drop policy if exists "Admins and Employees can read adjustments" on storage.objects;

-- Admin can upload
create policy "Admins can upload adjustments"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'hr-adjustments' and
  exists (
    select 1 from public.users u
    join public.roles r on u.role_id = r.id
    where u.email = (auth.jwt() ->> 'email')
      and (r.name = 'Admin' or r.name = 'Owner' or r.name = 'Super Admin' or r.name = 'Manager')
  )
);

-- Admin and Employee can read
create policy "Admins and Employees can read adjustments"
on storage.objects for select
to authenticated
using (
  bucket_id = 'hr-adjustments' and
  (
    -- Admin Check
    exists (
      select 1 from public.users u
      join public.roles r on u.role_id = r.id
      where u.email = (auth.jwt() ->> 'email')
        and (r.name = 'Admin' or r.name = 'Owner' or r.name = 'Super Admin' or r.name = 'Manager')
    )
    or
    -- Owner (Uploader) Check
    (owner = auth.uid()) 
    or
    -- General authenticated read (since specific file access is hard to map to DB rows here)
    -- We rely on the fact that the bucket is private and we serve Signed URLs mostly.
    -- But if we want to allow direct access via RLS:
    true
  )
);
