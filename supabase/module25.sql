-- Module 25: Holiday Calendars & Holidays
create table if not exists public.holiday_calendars (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  country_code text,
  created_at timestamptz not null default now()
);

create index if not exists idx_holiday_calendars_org on public.holiday_calendars(org_id);
alter table public.holiday_calendars add constraint uniq_holiday_calendar_name unique (org_id, name);

create table if not exists public.holidays (
  id uuid primary key default gen_random_uuid(),
  calendar_id uuid not null references public.holiday_calendars(id) on delete cascade,
  date date not null,
  name text not null,
  is_full_day boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_holidays_calendar on public.holidays(calendar_id);
create index if not exists idx_holidays_date on public.holidays(date);
alter table public.holidays add constraint uniq_holiday_calendar_date unique (calendar_id, date);

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'daily_time_summaries' and column_name = 'is_holiday'
  ) then
    alter table public.daily_time_summaries add column is_holiday boolean not null default false;
    create index if not exists idx_daily_summaries_is_holiday on public.daily_time_summaries(is_holiday);
  end if;
end$$;

