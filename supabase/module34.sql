-- Module 34 — AI Insights & Coaching (add-only)
create table if not exists public.ai_insight_snapshots (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  target_type text not null check (target_type in ('org','department','member')),
  target_id uuid,
  snapshot_date date not null,
  summary text,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_ai_insights_org on public.ai_insight_snapshots(org_id);
create index if not exists idx_ai_insights_target on public.ai_insight_snapshots(target_type, target_id);
create index if not exists idx_ai_insights_date on public.ai_insight_snapshots(snapshot_date);
