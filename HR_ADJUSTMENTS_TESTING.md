# HR Adjustments Log (Audit Trail) - Testing Checklist

## 1. Access Control (RLS & API)
- [ ] **Admin Access**: Log in as Admin/Owner. Navigate to `/hr-adjustments-log`. Verify page loads.
- [ ] **Employee Access Restriction**: Log in as Employee. Navigate to `/hr-adjustments-log`. Verify 403 Forbidden or Redirect.
- [ ] **Employee View**: Log in as Employee. Navigate to `/my-adjustments`. Verify page loads.
- [ ] **Data Visibility (Admin)**: Verify Admin sees logs for multiple employees.
- [ ] **Data Visibility (Employee)**: Verify Employee sees ONLY their own logs.

## 2. Manual Log Creation (Admin UI)
- [ ] **Create Log**: On `/hr-adjustments-log`, click "Add Manual Log".
- [ ] **Validation**: Try submitting with reason < 8 chars. Verify error.
- [ ] **Success**: Submit valid log. Verify it appears in the list immediately.
- [ ] **Attachment**: Upload a file (if configured). Verify it is linked.

## 3. Integration Hooks (Automatic Logging)
Trigger the following admin actions and verify a new entry appears in `hr_adjustments_log`:

### Time Module
- [ ] **Timesheet Correction**: Approve a Timesheet Change Request.
    - Verify log created with `module: 'time'`, `entity_table: 'timesheet_change_requests'`.
    - Verify `old_value` (pending) and `new_value` (approved).
    - Verify second log for actual time session change (`module: 'time'`, `entity_table: 'time_sessions'`).
- [ ] **Manual Session Stop**: As Admin, find an open session for another user and click "Stop" (or use API `POST /api/time/stop`).
    - Verify log created with `reason: 'Manual stop by admin/manager'`.

### Break Module
- [ ] **Break Approval**: Approve/Reject a break request.
    - Verify log created with `module: 'time'`, `entity_table: 'break_approvals'`.

### Payroll Module
- [ ] **Add Fine**: Add a payroll fine to a user.
    - Verify log created with `module: 'payroll'`, `entity_table: 'member_fines'`, `field_name: 'amount'`.
- [ ] **Add Adjustment**: Add a payroll adjustment (bonus/deduction).
    - Verify log created with `module: 'payroll'`, `entity_table: 'payroll_adjustments'`.

## 4. Features & UI
- [ ] **Filtering**: Filter by "Module: Payroll" or specific Employee. Verify list updates.
- [ ] **Details Modal**: Click a log entry. Verify full details (Old/New values) are shown.
- [ ] **CSV Export**: Click "Export CSV". Verify file downloads and contains filtered data.

## 5. Immutability
- [ ] **Database**: Verify `hr_adjustments_log` table has RLS policies enabling `INSERT` and `SELECT` but **NO** `UPDATE` or `DELETE` policies.
- [ ] **API**: Verify no public API endpoint exists to update/delete logs.
