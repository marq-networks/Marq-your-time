-- Indexes for consistent filtering system performance
-- Users filtering
create index if not exists idx_users_status on public.users(status);
create index if not exists idx_users_department on public.users(department_id);
create index if not exists idx_users_role on public.users(role_id);

-- Activity Overview filtering
create index if not exists idx_tracking_sessions_filter on public.tracking_sessions(org_id, member_id, started_at);
create index if not exists idx_activity_events_session on public.activity_events(tracking_session_id);
create index if not exists idx_activity_events_category on public.activity_events(category);
create index if not exists idx_activity_events_timestamp on public.activity_events(timestamp);

-- Time Logs / Timesheets filtering (if not already covered by composite indexes)
-- existing: idx_time_sessions_member_org_date covers (member_id, org_id, date)
-- If filtering by status alone:
create index if not exists idx_time_sessions_status_only on public.time_sessions(status);

-- Payroll filtering
create index if not exists idx_payroll_periods_org_status on public.payroll_periods(org_id, status);
