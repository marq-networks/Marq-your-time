-- Module 35 — Support Tickets & Comments (ADD-ONLY)

create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  created_by_user_id uuid not null references public.users(id) on delete cascade,
  category text not null,
  title text not null,
  description text,
  status text not null check (status in ('open','in_progress','resolved','closed')) default 'open',
  priority text not null check (priority in ('low','normal','high')) default 'normal',
  assigned_to_user_id uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_support_tickets_org on public.support_tickets(org_id);
create index if not exists idx_support_tickets_creator on public.support_tickets(created_by_user_id);
create index if not exists idx_support_tickets_status on public.support_tickets(status);

create table if not exists public.support_comments (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_support_comments_ticket on public.support_comments(ticket_id);
create index if not exists idx_support_comments_user on public.support_comments(user_id);

