
alter table if not exists public.organizations
add column if not exists org_password_hash text;
