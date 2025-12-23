import { NextRequest, NextResponse } from 'next/server'
import { isSupabaseConfigured, supabaseServer } from '@lib/supabase'
import { listUsers, listDepartments, getOrganization, listTeamMemberIds } from '@lib/db'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const orgId = searchParams.get('org_id') || searchParams.get('orgId') || ''
  const start = searchParams.get('start') || ''
  const end = searchParams.get('end') || ''
  const departmentId = searchParams.get('department') || searchParams.get('department_id') || ''
  if (!orgId || !start || !end) return NextResponse.json({ error: 'MISSING_FIELDS' }, { status: 400 })

  const sb = isSupabaseConfigured() ? supabaseServer() : null
  const users = await listUsers(orgId)
  const departments = await listDepartments(orgId)
  const org = await getOrganization(orgId)
  let allowedMemberIds = departmentId ? users.filter(u => u.departmentId === departmentId).map(u => u.id) : users.map(u => u.id)
  const role = (req.headers.get('x-role') || '').toLowerCase()
  const actor = req.headers.get('x-user-id') || ''
  if (role === 'manager' && actor) {
    const team = await listTeamMemberIds(orgId, actor)
    allowedMemberIds = allowedMemberIds.filter(id => team.includes(id))
  }

  let totalScheduledMinutes = 0
  let totalWorkedMinutes = 0
  let totalExtraMinutes = 0
  let totalShortMinutes = 0
  let presentDays = 0
  let scheduledDays = 0

  if (sb) {
    const { data: dailyRows } = await sb.from('daily_time_summaries').select('*').eq('org_id', orgId).gte('date', start).lte('date', end)
    const daily = (dailyRows || []).filter((r: any) => allowedMemberIds.includes(r.member_id))
    
    // Add real-time open session data
    const { data: openSessions } = await sb.from('time_sessions').select('id, member_id, start_time').eq('org_id', orgId).gte('date', start).lte('date', end).is('end_time', null)
    let openMinutes = 0
    if (openSessions && openSessions.length > 0) {
      const relevantOpen = openSessions.filter((s: any) => allowedMemberIds.includes(s.member_id))
      if (relevantOpen.length > 0) {
        const ids = relevantOpen.map((s: any) => s.id)
        const { data: breaks } = await sb.from('break_sessions').select('time_session_id, start_time, end_time, total_minutes, is_paid').in('time_session_id', ids)
        const now = Date.now()
        for (const s of relevantOpen) {
          const sBreaks = (breaks || []).filter((b: any) => b.time_session_id === s.id)
          const startMs = new Date(s.start_time).getTime()
          const totalMs = Math.max(0, now - startMs)
          let unpaidBreakMs = 0
          for (const b of sBreaks) {
            if (!b.is_paid) {
               if (b.end_time) {
                 unpaidBreakMs += (Number(b.total_minutes || 0) * 60000)
               } else {
                 unpaidBreakMs += Math.max(0, now - new Date(b.start_time).getTime())
               }
            }
          }
          openMinutes += Math.max(0, totalMs - unpaidBreakMs) / 60000
        }
      }
    }

    totalScheduledMinutes = daily.reduce((s: number, r: any) => s + Number(r.scheduled_minutes || 0), 0)
    totalWorkedMinutes = daily.reduce((s: number, r: any) => s + Number(r.worked_minutes || 0), 0) + openMinutes
    totalExtraMinutes = daily.reduce((s: number, r: any) => s + Number(r.extra_minutes || 0), 0)
    totalShortMinutes = daily.reduce((s: number, r: any) => s + Number(r.short_minutes || 0), 0)
    presentDays = daily.filter((r: any) => Number(r.worked_minutes || 0) > 0).length + (openMinutes > 0 && daily.every((r:any)=>Number(r.worked_minutes||0)===0) ? 1 : 0) // Approximation for present days
    scheduledDays = daily.filter((r: any) => Number(r.scheduled_minutes || 0) > 0).length
  }

  let activeMinutes = 0
  let idleMinutes = 0
  let productiveMinutes = 0
  let unproductiveMinutes = 0
  let topApps: { app: string, count: number }[] = []

  if (sb) {
    const { data: sessRows } = await sb.from('time_sessions').select('id, member_id').eq('org_id', orgId).gte('date', start).lte('date', end)
    const sessionIds = (sessRows || []).filter((r: any) => allowedMemberIds.includes(r.member_id)).map((r: any) => r.id)
    const { data: tsRows } = sessionIds.length ? await sb.from('tracking_sessions').select('id, member_id').in('time_session_id', sessionIds) : { data: [] }
    const tsIds = (tsRows || []).map((r: any) => r.id)
    const { data: evRows } = tsIds.length ? await sb.from('activity_events').select('app_name, category, is_active, timestamp, tracking_session_id').in('tracking_session_id', tsIds) : { data: [] }
    const rawEvents = (evRows || []) as any[]

    // Deduplicate events by minute per session to prevent overcounting (e.g. multiple tabs)
    const uniqueEventsMap = new Map<string, any>()
    for (const e of rawEvents) {
        const d = new Date(e.timestamp)
        // Key includes tracking_session_id so we don't merge events from different users/sessions
        const key = `${e.tracking_session_id}-${d.toISOString().slice(0, 16)}`
        
        if (!uniqueEventsMap.has(key)) {
            uniqueEventsMap.set(key, e)
        } else {
             const existing = uniqueEventsMap.get(key)
             if (!existing.is_active && e.is_active) {
                 uniqueEventsMap.set(key, e)
             } else if (existing.is_active && e.is_active) {
                 if (existing.category !== 'productive' && e.category === 'productive') {
                     uniqueEventsMap.set(key, e)
                 }
             }
        }
    }
    const events = Array.from(uniqueEventsMap.values())

    activeMinutes = events.filter(e => !!e.is_active).length
    idleMinutes = events.filter(e => !e.is_active).length
    productiveMinutes = events.filter(e => e.category === 'productive').length
    unproductiveMinutes = events.filter(e => e.category === 'unproductive').length
    const appCounts = new Map<string, number>()
    for (const e of events) {
      const k = e.app_name || ''
      if (!k) continue
      appCounts.set(k, (appCounts.get(k) || 0) + 1)
    }
    topApps = Array.from(appCounts.entries()).sort((a,b)=>b[1]-a[1]).slice(0, 10).map(([app, count]) => ({ app, count }))
  }

  let totalPayrollNet = 0
  let totalBase = 0
  let totalOvertime = 0
  let totalDeductions = 0
  let totalFines = 0

  if (sb) {
    const { data: periods } = await sb.from('payroll_periods').select('*').eq('org_id', orgId).lte('start_date', end).gte('end_date', start)
    const periodIds = (periods || []).map((p: any) => p.id)
    const { data: lines } = periodIds.length ? await sb.from('member_payroll_lines').select('*').in('payroll_period_id', periodIds) : { data: [] }
    const filtered = (lines || []).filter((r: any) => allowedMemberIds.includes(r.member_id))
    totalPayrollNet = filtered.reduce((s: number, r: any) => s + Number(r.net_payable || 0), 0)
    totalBase = filtered.reduce((s: number, r: any) => s + Number(r.base_earnings || 0), 0)
    totalOvertime = filtered.reduce((s: number, r: any) => s + Number(r.extra_earnings || 0), 0)
    totalDeductions = filtered.reduce((s: number, r: any) => s + Number(r.deduction_for_short || 0), 0)
    totalFines = filtered.reduce((s: number, r: any) => s + Number(r.fines_total || 0), 0)
  }

  let totalLogins = 0
  let totalActiveSeats = 0
  let totalUsageHours = 0
  let billedAmount = 0

  if (sb) {
    totalActiveSeats = users.filter(u => u.status === 'active').length
    totalUsageHours = Math.round(totalWorkedMinutes / 60)
    const { data: invoices } = await sb.from('billing_invoices').select('*').eq('org_id', orgId).gte('billing_period_start', start).lte('billing_period_end', end)
    billedAmount = (invoices || []).reduce((s: number, r: any) => s + Number(r.total || 0), 0)
  }

  const daysInRange = Math.max(1, Math.round((new Date(end).getTime() - new Date(start).getTime()) / (24*60*60*1000)) + 1)
  const memberCount = allowedMemberIds.length || 1
  const avgWorkedPerMemberPerDayMinutes = Math.round(totalWorkedMinutes / (memberCount * daysInRange))
  const attendanceRatePercent = scheduledDays > 0 ? Math.round((presentDays / scheduledDays) * 100) : 0

  return NextResponse.json({
    period: { start, end },
    time: {
      totalScheduledMinutes,
      totalWorkedMinutes,
      totalExtraMinutes,
      totalShortMinutes,
      avgWorkedPerMemberPerDayMinutes,
      attendanceRatePercent
    },
    productivity: {
      activeMinutes,
      idleMinutes,
      productiveMinutes,
      unproductiveMinutes,
      topApps
    },
    cost: {
      totalPayrollNet,
      totalBase,
      totalOvertime,
      totalDeductions,
      totalFines
    },
    billing: {
      totalLogins,
      totalActiveSeats,
      totalUsageHours,
      billedAmount
    }
  })
}
