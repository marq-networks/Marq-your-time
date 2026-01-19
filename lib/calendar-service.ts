import { TimeSession, BreakSession, Holiday, DailyTimeSummary, Shift, ShiftAssignment } from './types'
import { isSupabaseConfigured, supabaseServer } from './supabase'
// We might need to import memory accessors if we add them to lib/db.ts
// For now, we will assume Supabase is the primary source.

export type CalendarEventType = 'attendance' | 'break' | 'leave' | 'shift' | 'overtime' | 'holiday'

export interface CalendarEvent {
  id: string
  memberId?: string // Optional for backward compatibility, but recommended
  date: string // YYYY-MM-DD
  type: CalendarEventType
  status: string // e.g. 'approved', 'pending', 'late', 'present'
  startTime?: number // minutes from midnight
  endTime?: number // minutes from midnight
  title: string
  metadata?: any
}

export async function getCalendarEventsForUsers(
  userIds: string[],
  orgId: string,
  from: string,
  to: string
): Promise<CalendarEvent[]> {
  const events: CalendarEvent[] = []
  const sb = isSupabaseConfigured() ? supabaseServer() : null

  if (!sb) {
    return []
  }
  
  // 1. Fetch Work Sessions (Attendance)
  const { data: sessions } = await sb
    .from('time_sessions')
    .select('*')
    .in('member_id', userIds)
    .eq('org_id', orgId)
    .gte('date', from)
    .lte('date', to)

  if (sessions) {
    sessions.forEach((s: any) => {
      events.push({
        id: s.id,
        memberId: s.member_id,
        date: s.date,
        type: 'attendance',
        status: s.status,
        startTime: s.start_time,
        endTime: s.end_time,
        title: s.project_name ? `Work: ${s.project_name}` : 'Work Session',
        metadata: {
            projectId: s.project_id,
            taskId: s.task_id,
            totalMinutes: s.total_minutes
        }
      })
    })
  }

  // 2. Fetch Breaks
  const sessionIds = sessions?.map((s: any) => s.id) || []
  if (sessionIds.length > 0) {
    const { data: breaks } = await sb
        .from('break_sessions')
        .select('*')
        .in('time_session_id', sessionIds)
    
    if (breaks) {
        const sessionMap = new Map(sessions?.map((s: any) => [s.id, s]))
        breaks.forEach((b: any) => {
            const session = sessionMap.get(b.time_session_id)
            if (session) {
                events.push({
                    id: b.id,
                    memberId: session.member_id,
                    date: session.date,
                    type: 'break',
                    status: 'completed',
                    startTime: b.start_time,
                    endTime: b.end_time,
                    title: b.label || 'Break',
                    metadata: {
                        isPaid: b.is_paid
                    }
                })
            }
        })
    }
  }

  // 3. Fetch Leave Requests
  const { data: leaves } = await sb
    .from('leave_requests')
    .select('*, leave_types(name, code)')
    .in('member_id', userIds)
    .eq('org_id', orgId)
    .eq('status', 'approved')
    .or(`start_date.lte.${to},end_date.gte.${from}`) 

  if (leaves) {
    leaves.forEach((l: any) => {
        let current = new Date(l.start_date)
        const end = new Date(l.end_date)
        
        while (current <= end) {
            const dateStr = current.toISOString().slice(0, 10)
            if (dateStr >= from && dateStr <= to) {
                events.push({
                    id: `${l.id}-${dateStr}`,
                    memberId: l.member_id,
                    date: dateStr,
                    type: 'leave',
                    status: 'approved',
                    title: l.leave_types?.name || 'Leave',
                    metadata: {
                        code: l.leave_types?.code,
                        reason: l.reason
                    }
                })
            }
            current.setDate(current.getDate() + 1)
        }
    })
  }

  // 4. Fetch Holidays (Org wide, not user specific, but we return for context)
  // Holidays apply to everyone usually.
  const { data: holidays } = await sb
    .from('holidays')
    .select('*, holiday_calendars!inner(org_id)')
    .eq('holiday_calendars.org_id', orgId)
    .gte('date', from)
    .lte('date', to)

  if (holidays) {
      holidays.forEach((h: any) => {
          // Holidays don't have a memberId, they are global.
          // But if we are returning a list of events for users, we might want to duplicate them for each user OR just treat them as global events.
          // For simplicity, we add them without memberId, or with a special 'GLOBAL' memberId.
          events.push({
              id: h.id,
              date: h.date,
              type: 'holiday',
              status: 'official',
              title: h.name,
              metadata: {
                  isFullDay: h.is_full_day
              }
          })
      })
  }

  // 5. Daily Summaries
  const { data: summaries } = await sb
      .from('daily_time_summaries')
      .select('*')
      .in('member_id', userIds)
      .eq('org_id', orgId)
      .gte('date', from)
      .lte('date', to)
    
  if (summaries) {
      summaries.forEach((s: any) => {
          if (s.status === 'extra') {
              events.push({
                  id: `ot-${s.id}`,
                  memberId: s.member_id,
                  date: s.date,
                  type: 'overtime',
                  status: 'approved',
                  title: `Overtime: ${Math.round(s.extra_minutes)}m`,
                  metadata: {
                      minutes: s.extra_minutes
                  }
              })
          }
      })
  }

  return events
}

export async function getCalendarEvents(
  userId: string,
  orgId: string,
  from: string,
  to: string
): Promise<CalendarEvent[]> {
    return getCalendarEventsForUsers([userId], orgId, from, to)
}

