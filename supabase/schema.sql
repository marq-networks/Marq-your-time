-- Organizations
create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  org_name text not null,
  org_logo text,
  owner_name text not null,
  owner_email text not null,
  billing_email text not null,
  subscription_type text not null check (subscription_type in ('monthly','yearly')),
  price_per_login numeric not null,
  total_licensed_seats integer not null,
  used_seats integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Invites
create table if not exists public.organization_invites (
  id uuid primary key default gen_random_uuid(),
  invited_email text not null,
  org_id uuid not null references public.organizations(id) on delete cascade,
  invited_by text not null,
  role text not null,
  invite_status text not null check (invite_status in ('pending','accepted','expired','revoked')) default 'pending',
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  token text not null unique,
  assign_seat boolean not null default false
);

-- SaaS Settings (singleton)
create table if not exists public.saas_settings (
  id text primary key,
  default_seat_price numeric not null,
  default_seat_limit integer not null,
  landing_page_invite_enabled boolean not null
);

-- simple function to increment seats atomically
create or replace function public.increment_used_seats(org uuid)
returns void language plpgsql as $$
begin
  update public.organizations set used_seats = used_seats + 1, updated_at = now() where id = org;
end;$$;
create extension if not exists "pgcrypto";
