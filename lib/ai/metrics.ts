import { supabaseServer } from '@/lib/supabase'

export async function getDailySummaries(orgId: string, userId: string, startDate: string, endDate: string) {
  const sb = supabaseServer()
  const { data } = await sb
    .from('daily_time_summaries')
    .select('*')
    .eq('org_id', orgId)
    .eq('member_id', userId)
    .gte('date', startDate)
    .lte('date', endDate)
    .order('date', { ascending: true })
  return data || []
}

export async function getActivityStats(orgId: string, userId: string, startDate: string, endDate: string) {
  const sb = supabaseServer()
  
  // Get tracking sessions for the period
  const { data: sessions } = await sb
    .from('tracking_sessions')
    .select('id, started_at, time_sessions!inner(date)')
    .eq('org_id', orgId)
    .eq('member_id', userId)
    .gte('time_sessions.date', startDate)
    .lte('time_sessions.date', endDate)
    
  if (!sessions || sessions.length === 0) return { idleMinutes: 0, screenshotsCount: 0, topApps: [], activityPercent: 0 }

  const sessionIds = sessions.map(s => s.id)
  
  // Get activity events
  const { data: events } = await sb
    .from('activity_events')
    .select('is_active, app_name, url, category')
    .in('tracking_session_id', sessionIds)

  // Get screenshots count
  const { count } = await sb
    .from('screenshots')
    .select('*', { count: 'exact', head: true })
    .in('tracking_session_id', sessionIds)

  // Calculate metrics
  let idleMinutes = 0
  let activeEvents = 0
  const appUsage = new Map<string, number>()
  
  if (events) {
      idleMinutes = events.filter(e => e.is_active === false).length
      activeEvents = events.filter(e => e.is_active === true).length
      
      events.forEach(e => {
          if (e.app_name && e.is_active) {
              const key = e.app_name
              appUsage.set(key, (appUsage.get(key) || 0) + 1)
          }
      })
  }
  
  const totalEvents = (events?.length || 0)
  const activityPercent = totalEvents > 0 ? Math.round((activeEvents / totalEvents) * 100) : 0
  
  return {
      idleMinutes,
      screenshotsCount: count || 0,
      topApps: Array.from(appUsage.entries()).map(([name, count]) => ({ name, count })).sort((a,b) => b.count - a.count).slice(0, 5),
      activityPercent
  }
}

export async function getBreaks(orgId: string, userId: string, startDate: string, endDate: string) {
    const sb = supabaseServer()
    const { data } = await sb
        .from('break_sessions')
        .select('*, time_sessions!inner(date)')
        .eq('time_sessions.org_id', orgId)
        .eq('time_sessions.member_id', userId)
        .gte('time_sessions.date', startDate)
        .lte('time_sessions.date', endDate)
    return data || []
}

export async function getTimeSessions(orgId: string, userId: string, startDate: string, endDate: string) {
    const sb = supabaseServer()
    const { data } = await sb
        .from('time_sessions')
        .select('*')
        .eq('org_id', orgId)
        .eq('member_id', userId)
        .gte('date', startDate)
        .lte('date', endDate)
    return data || []
}

export async function getPayrollInfo(orgId: string, userId: string) {
    const sb = supabaseServer()
    // Assuming we can get current payroll info or user rate
    // We'll check member_payroll_lines for the latest one
    const { data } = await sb
        .from('member_payroll_lines')
        .select('*')
        .eq('org_id', orgId)
        .eq('member_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
    return data
}

export async function getRoleAverageStats(orgId: string, role: string, startDate: string, endDate: string) {
    const sb = supabaseServer()
    
    // Get all users with this role
    const { data: users } = await sb
        .from('users')
        .select('id')
        .eq('org_id', orgId)
        .eq('role', role)

    if (!users || users.length === 0) return null

    // Get summaries for all these users
    const { data: summaries } = await sb
        .from('daily_time_summaries')
        .select('worked_minutes')
        .eq('org_id', orgId)
        .in('member_id', users.map(u => u.id))
        .gte('date', startDate)
        .lte('date', endDate)

    if (!summaries || summaries.length === 0) return null

    const totalWorked = summaries.reduce((acc, s) => acc + (s.worked_minutes || 0), 0)
    const avgWorked = totalWorked / users.length // Average total worked minutes per user in this period

    return {
        avgWorkedMinutes: avgWorked
    }
}
