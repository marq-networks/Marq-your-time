import { supabaseServer } from '@lib/supabase'
import { createHRLog } from '@lib/hr-log'
import { publishNotification } from './db'

export type TimesheetPeriod = 'day' | 'week' | 'pay_period'
export type TimesheetStatus = 'draft' | 'submitted' | 'changes_required' | 'approved' | 'rejected'

export interface TimesheetTotals {
  worked_minutes: number
  break_minutes: number
  idle_minutes: number
  overtime_minutes: number
  screenshots_count: number
  activity_percent: number
}

export async function refreshTimesheet(timesheetId: string) {
  const sb = supabaseServer()

  // 1. Get existing timesheet
  const { data: ts } = await sb
    .from('timesheets')
    .select('*')
    .eq('id', timesheetId)
    .single()

  if (!ts) throw new Error('Timesheet not found')
  if (ts.status !== 'draft' && ts.status !== 'changes_required') throw new Error('Only draft timesheets can be refreshed')

  const orgId = ts.org_id
  const employeeUserId = ts.employee_user_id
  const periodStart = ts.period_start
  const periodEnd = ts.period_end

  // 2. Re-aggregate data (Copy-paste logic from createOrGet, ideally refactor into shared function)
  // Get daily summaries
  const { data: dailySummaries } = await sb
    .from('daily_time_summaries')
    .select('*')
    .eq('org_id', orgId)
    .eq('member_id', employeeUserId)
    .gte('date', periodStart)
    .lte('date', periodEnd)

  let worked = 0
  let breaks = 0
  let overtime = 0
  
  if (dailySummaries) {
    worked = dailySummaries.reduce((acc, curr) => acc + (curr.worked_minutes || 0), 0)
    breaks = dailySummaries.reduce((acc, curr) => acc + (curr.paid_break_minutes || 0) + (curr.unpaid_break_minutes || 0), 0)
    overtime = dailySummaries.reduce((acc, curr) => acc + (curr.extra_minutes || 0), 0)
  }

  // Get activity stats
  const { data: timeSessions } = await sb
    .from('time_sessions')
    .select('id')
    .eq('org_id', orgId)
    .eq('member_id', employeeUserId)
    .gte('date', periodStart)
    .lte('date', periodEnd)

  let screenshots = 0
  let idle = 0 // Pending better idle calc
  let activityPercent = 0

  if (timeSessions && timeSessions.length > 0) {
    const tsIds = timeSessions.map(ts => ts.id)
    const { data: trackingSessions } = await sb
      .from('tracking_sessions')
      .select('id')
      .in('time_session_id', tsIds)

    if (trackingSessions && trackingSessions.length > 0) {
      const trIds = trackingSessions.map(tr => tr.id)
      
      const { count: scCount } = await sb.from('screenshots').select('*', { count: 'exact', head: true }).in('tracking_session_id', trIds)
      screenshots = scCount || 0
    }
  }

  const totals = {
    worked_minutes: worked,
    break_minutes: breaks,
    idle_minutes: idle,
    overtime_minutes: overtime,
    screenshots_count: screenshots,
    activity_percent: activityPercent
  }

  // 3. Update Timesheet
  await sb.from('timesheets').update({ totals, updated_at: new Date().toISOString() }).eq('id', timesheetId)

  // 4. Update Items
  // Delete old items
  await sb.from('timesheet_items').delete().eq('timesheet_id', timesheetId)

  // Insert new items
  const items = (dailySummaries || []).map(ds => ({
    timesheet_id: timesheetId,
    date: ds.date,
    work_sessions: [],
    breaks: [],
    totals: {
      worked_minutes: ds.worked_minutes,
      break_minutes: (ds.paid_break_minutes || 0) + (ds.unpaid_break_minutes || 0),
      overtime_minutes: ds.extra_minutes
    }
  }))

  if (items.length > 0) {
    await sb.from('timesheet_items').insert(items)
  }

  return { id: timesheetId, totals, items }
}

export async function createOrGetTimesheet(
  orgId: string,
  employeeUserId: string,
  periodType: TimesheetPeriod,
  periodStart: string,
  periodEnd: string
) {
  const sb = supabaseServer()

  // 1. Check if exists
  const { data: existing } = await sb
    .from('timesheets')
    .select('*')
    .eq('org_id', orgId)
    .eq('employee_user_id', employeeUserId)
    .eq('period_start', periodStart)
    .single()

  if (existing) return existing

  // 2. Aggregate data
  // Get daily summaries for basic time stats
  const { data: dailySummaries } = await sb
    .from('daily_time_summaries')
    .select('*')
    .eq('org_id', orgId)
    .eq('member_id', employeeUserId)
    .gte('date', periodStart)
    .lte('date', periodEnd)

  let worked = 0
  let breaks = 0
  let overtime = 0
  
  if (dailySummaries) {
    worked = dailySummaries.reduce((acc, curr) => acc + (curr.worked_minutes || 0), 0)
    breaks = dailySummaries.reduce((acc, curr) => acc + (curr.paid_break_minutes || 0) + (curr.unpaid_break_minutes || 0), 0)
    overtime = dailySummaries.reduce((acc, curr) => acc + (curr.extra_minutes || 0), 0)
  }

  // Get activity stats (simplified aggregation)
  // We need to link time_sessions -> tracking_sessions -> activity_events/screenshots
  const { data: timeSessions } = await sb
    .from('time_sessions')
    .select('id')
    .eq('org_id', orgId)
    .eq('member_id', employeeUserId)
    .gte('date', periodStart)
    .lte('date', periodEnd)

  let idle = 0
  let screenshots = 0
  let activityPercent = 0

  if (timeSessions && timeSessions.length > 0) {
    const tsIds = timeSessions.map(ts => ts.id)
    const { data: trackingSessions } = await sb
      .from('tracking_sessions')
      .select('id')
      .in('time_session_id', tsIds)

    if (trackingSessions && trackingSessions.length > 0) {
      const trIds = trackingSessions.map(tr => tr.id)
      
      // Screenshots count
      const { count: scCount } = await sb
        .from('screenshots')
        .select('*', { count: 'exact', head: true })
        .in('tracking_session_id', trIds)
      screenshots = scCount || 0

      // Activity stats - this is heavy to aggregate on the fly, might need optimization
      // For now, let's approximate or just fetch if not too heavy. 
      // Fetching all events might be too much.
      // Alternative: Use daily_time_summaries if we add activity stats there in future.
      // For now, we will skip heavy event aggregation to avoid timeout and set 0 or simple query.
      // Let's try to get simple count of active vs total events if possible, or skip activity_percent for initial creation.
      // Actually, let's try to get a count of active events.
      
      // We can use a simplified approach: count rows where is_active=true vs total
      const { count: activeCount } = await sb
        .from('activity_events')
        .select('*', { count: 'exact', head: true })
        .in('tracking_session_id', trIds)
        .eq('is_active', true)
        
       const { count: totalEvents } = await sb
        .from('activity_events')
        .select('*', { count: 'exact', head: true })
        .in('tracking_session_id', trIds)

       if (totalEvents && totalEvents > 0) {
         activityPercent = Math.round((activeCount || 0) / totalEvents * 100)
         // Estimate idle minutes from non-active events (assuming 1 event per minute roughly)
         idle = (totalEvents - (activeCount || 0)) 
       }
    }
  }

  const totals: TimesheetTotals = {
    worked_minutes: worked,
    break_minutes: breaks,
    idle_minutes: idle,
    overtime_minutes: overtime,
    screenshots_count: screenshots,
    activity_percent: activityPercent
  }

  // 3. Create Draft
  const { data: newTimesheet, error } = await sb
    .from('timesheets')
    .insert({
      org_id: orgId,
      employee_user_id: employeeUserId,
      period_type: periodType,
      period_start: periodStart,
      period_end: periodEnd,
      status: 'draft',
      totals
    })
    .select()
    .single()

  if (error) throw error

  // 4. Create Items (Async or here)
  // We should create items for each day in the period
  // This helps with the detail view.
  if (dailySummaries) {
    const items = dailySummaries.map(ds => ({
      timesheet_id: newTimesheet.id,
      date: ds.date,
      totals: {
        worked_minutes: ds.worked_minutes || 0,
        break_minutes: (ds.paid_break_minutes || 0) + (ds.unpaid_break_minutes || 0),
        overtime_minutes: ds.extra_minutes || 0,
        // We'd need daily granularity for idle/screenshots if we want it in items
      }
    }))
    
    if (items.length > 0) {
      await sb.from('timesheet_items').insert(items)
    }
  }

  return newTimesheet
}

export async function submitTimesheet(timesheetId: string, userId: string) {
  const sb = supabaseServer()
  
  const { data: ts } = await sb.from('timesheets').select('*').eq('id', timesheetId).single()
  if (!ts) throw new Error('Timesheet not found')
  if (ts.employee_user_id !== userId) throw new Error('Unauthorized')
  if (!['draft', 'changes_required'].includes(ts.status)) throw new Error('Invalid status for submit')

  const { data: updated, error } = await sb
    .from('timesheets')
    .update({
      status: 'submitted',
      submitted_at: new Date().toISOString()
    })
    .eq('id', timesheetId)
    .select()
    .single()

  if (error) throw error

  // Notify Admins
  try {
    const { data: roles } = await sb.from('roles').select('id, permissions').eq('org_id', ts.org_id)
    if (roles) {
      const adminRoleIds = roles.filter((r: any) => 
        Array.isArray(r.permissions) && (r.permissions.includes('manage_org') || r.permissions.includes('manage_users'))
      ).map((r: any) => r.id)

      if (adminRoleIds.length > 0) {
        const { data: admins } = await sb.from('users').select('id').eq('org_id', ts.org_id).in('role_id', adminRoleIds)
        if (admins) {
          for (const admin of admins) {
            await publishNotification({
              orgId: ts.org_id,
              memberId: admin.id,
              type: 'system',
              title: 'Timesheet Submitted',
              message: `A timesheet has been submitted by user ${userId}.`,
              meta: { timesheetId: ts.id, url: `/timesheets/approvals/${ts.id}` }
            })
          }
        }
      }
    }
  } catch (e) {
    console.error('Failed to notify admins', e)
  }

  return updated
}

export async function reviewTimesheet(
  timesheetId: string,
  action: 'approve' | 'reject' | 'changes_required',
  reviewerId: string,
  reviewerRole: string,
  reason?: string
) {
  const sb = supabaseServer()
  
  const { data: ts } = await sb.from('timesheets').select('*').eq('id', timesheetId).single()
  if (!ts) throw new Error('Timesheet not found')

  const updates: any = {
    status: action === 'approve' ? 'approved' : (action === 'reject' ? 'rejected' : 'changes_required'),
    rejection_reason: reason || null,
    reviewed_by: reviewerId,
    reviewed_at: new Date().toISOString()
  }

  if (action === 'approve') {
    updates.approved_at = new Date().toISOString()
    updates.approved_by = reviewerId
  }

  const { data: updated, error } = await sb
    .from('timesheets')
    .update(updates)
    .eq('id', timesheetId)
    .select()
    .single()

  if (error) throw error

  // Notify Employee
  try {
    const title = action === 'approve' ? 'Timesheet Approved' : (action === 'reject' ? 'Timesheet Rejected' : 'Timesheet Changes Required')
    const message = action === 'approve' 
      ? `Your timesheet for ${ts.period_start} has been approved.` 
      : `Your timesheet for ${ts.period_start} was ${action === 'reject' ? 'rejected' : 'returned for changes'}. Reason: ${reason || 'None'}`
    
    await publishNotification({
      orgId: ts.org_id,
      memberId: ts.employee_user_id,
      type: 'system',
      title,
      message,
      meta: { timesheetId: ts.id, url: `/my-timesheets/${ts.id}` }
    })
  } catch (e) {
    console.error('Failed to notify employee', e)
  }

  return updated
}

export async function updateTimesheetTotals(
  timesheetId: string, 
  newTotals: TimesheetTotals, 
  actorId: string, 
  actorRole: string,
  reason: string
) {
  const sb = supabaseServer()
  const { data: ts } = await sb.from('timesheets').select('*').eq('id', timesheetId).single()
  if (!ts) throw new Error('Timesheet not found')

  const { error } = await sb
    .from('timesheets')
    .update({ totals: newTotals })
    .eq('id', timesheetId)

  if (error) throw error

  // Log HR Adjustment
  await createHRLog({
    org_id: ts.org_id,
    actor_user_id: actorId,
    actor_role: actorRole,
    employee_user_id: ts.employee_user_id,
    module: 'Timesheets',
    entity_table: 'timesheets',
    entity_id: timesheetId,
    field_name: 'totals',
    old_value: ts.totals,
    new_value: newTotals,
    reason: reason
  })
}

export async function getApprovedDailySummaries(orgId: string, userId: string, startDate: string, endDate: string) {
  const sb = supabaseServer()
  
  // Find approved timesheet items in range
  const { data: items } = await sb
    .from('timesheet_items')
    .select(`
      date,
      totals,
      timesheets!inner(status, org_id, employee_user_id)
    `)
    .eq('timesheets.org_id', orgId)
    .eq('timesheets.employee_user_id', userId)
    .eq('timesheets.status', 'approved')
    .gte('date', startDate)
    .lte('date', endDate)

  if (!items || items.length === 0) return null

  // Map to format compatible with payroll aggregation
  return items.map((it: any) => ({
    date: it.date,
    workedMinutes: it.totals.worked_minutes || 0,
    paidBreakMinutes: it.totals.break_minutes || 0, // Assuming paid for simplicity or need split
    unpaidBreakMinutes: 0,
    extraMinutes: it.totals.overtime_minutes || 0,
    shortMinutes: 0 // We might need to calculate this if not in totals
  }))
}
