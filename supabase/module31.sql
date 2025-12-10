-- Module 31 — Notification Rules & Digests (ADD-ONLY)
create table if not exists public.notification_event_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  event_type text not null,
  channel text not null check (channel in ('in_app','email')),
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index if not exists idx_notification_event_prefs_unique on public.notification_event_preferences(user_id, event_type, channel);

create table if not exists public.notification_digests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  frequency text not null check (frequency in ('daily','weekly')),
  created_at timestamptz not null default now()
);
create index if not exists idx_notification_digests_user on public.notification_digests(user_id);
