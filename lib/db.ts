import { Organization, OrganizationInvite, OrgCreationInvite, SaaSSettings, User, Department, Role, Permission, TimeSession, BreakSession, DailyTimeSummary, TimeAnomaly, MemberPrivacySettings, TrackingSession, ActivityEvent, ActivityAppAlias, ScreenshotMeta, PayrollPeriod, MemberPayrollLine, SalaryType, MemberFine, MemberAdjustment, NotificationItem, NotificationPreferences, MemberRole, Survey, SurveyQuestion, SurveyResponse, HolidayCalendar, Holiday, DataRetentionPolicy, PrivacyRequest, PrivacyRequestStatus, OrgMembership, SupportTicket, SupportComment } from './types'
import { isSupabaseConfigured, supabaseServer } from './supabase'
import { newId, newToken } from './token'
import { canConsumeSeat, canReduceSeats, isInviteExpired, inviteWindowHours } from './rules'

const organizations: Organization[] = []
const invites: OrganizationInvite[] = []
const orgCreationInvitesMem: OrgCreationInvite[] = []
const roles: Role[] = []
const departments: Department[] = []
const users: User[] = []
const memberRoles: MemberRole[] = []
const permAudit: any[] = []
let settings: SaaSSettings = { id: 'saas', defaultSeatPrice: 5, defaultSeatLimit: 50, landingPageInviteEnabled: true }

// Module 4 in-memory stores (fallback when Supabase is not configured)
const timeSessions: TimeSession[] = []
const breakSessions: BreakSession[] = []
const dailySummaries: DailyTimeSummary[] = []
const anomalies: TimeAnomaly[] = []
const privacySettings: MemberPrivacySettings[] = []
const trackingSessions: TrackingSession[] = []
const activityEvents: ActivityEvent[] = []
const activityAliases: ActivityAppAlias[] = []
const screenshots: ScreenshotMeta[] = []
const payrollPeriods: PayrollPeriod[] = []
const payrollLines: MemberPayrollLine[] = []
const fines: MemberFine[] = []
const adjustments: MemberAdjustment[] = []
const notifications: NotificationItem[] = []
const notificationPrefs: NotificationPreferences[] = []
const eventPrefsV2: import('./types').EventNotificationPreference[] = []
const digestRowsMem: { id: string, userId: string, frequency: 'daily'|'weekly', createdAt: number }[] = []
const shiftsMem: import('./types').Shift[] = []
const shiftAssignmentsMem: import('./types').ShiftAssignment[] = []
const surveysMem: Survey[] = []
const surveyQuestionsMem: SurveyQuestion[] = []
const surveyResponsesMem: SurveyResponse[] = []
const holidayCalendarsMem: HolidayCalendar[] = []
const holidaysMem: Holiday[] = []
const assetsMem: import('./types').Asset[] = []
const assetAssignmentsMem: import('./types').AssetAssignment[] = []
const retentionPoliciesMem: DataRetentionPolicy[] = []
const privacyRequestsMem: PrivacyRequest[] = []
const auditLogsMem: import('./types').AuditLog[] = []
const orgMembershipsMem: OrgMembership[] = []
const superAdminsMem = new Set<string>()
const supportTicketsMem: SupportTicket[] = []
const supportCommentsMem: SupportComment[] = []
const aiInsightSnapshotsMem: import('./types').AIInsightSnapshot[] = []

function dateISO(d: Date) {
  return d.toISOString().slice(0,10)
}

function minutesBetween(a: number, b: number) {
  return Math.max(0, Math.round((b - a) / 60000))
}

function weekdayFromISO(date: string) {
  const dt = new Date(date + 'T00:00:00')
  return ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][dt.getDay()]
}

async function computeScheduledMinutes(memberId: string, orgId: string, date: string) {
  const u = await getUser(memberId)
  if (!u || u.orgId !== orgId) return 0
  const assigned = await getAssignedShiftFor(memberId, orgId, date)
  if (assigned) {
    const m = minutesBetweenShift(assigned.startTime, assigned.endTime, assigned.isOvernight) - (assigned.breakMinutes || 0)
    return Math.max(0, m)
  }
  const wd = weekdayFromISO(date)
  const days = Array.isArray(u.workingDays) ? u.workingDays : []
  if (!days.includes(wd)) return 0
  return (u.workingHoursPerDay ?? 0) * 60
}

async function recomputeDaily(memberId: string, orgId: string, date: string) {
  if (isSupabaseConfigured()) {
    const sb = supabaseServer()
    const { data: sessRows } = await sb.from('time_sessions').select('*').eq('member_id', memberId).eq('org_id', orgId).eq('date', date)
    const sessions = (sessRows || []).filter((r: any) => r.status === 'closed')
    const sorted = [...sessions].sort((a: any, b: any) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
    for (let i = 1; i < sorted.length; i++) {
      const prevEnd = new Date(sorted[i-1].end_time || sorted[i-1].start_time).getTime()
      const curStart = new Date(sorted[i].start_time).getTime()
      if (prevEnd && curStart < prevEnd) {
        const { count } = await sb.from('time_anomalies').select('*', { count: 'exact', head: true }).eq('member_id', memberId).eq('org_id', orgId).eq('date', date).eq('type', 'overlap')
        if ((count || 0) === 0) {
          const now = new Date()
          await sb.from('time_anomalies').insert({ member_id: memberId, org_id: orgId, date, type: 'overlap', details: `Sessions ${sorted[i-1].id} and ${sorted[i].id} overlap`, resolved: false, created_at: now, updated_at: now })
        }
        break
      }
    }
    const worked = sessions.reduce((sum: number, r: any) => sum + Number(r.total_minutes || 0), 0)
    const { data: brRows } = await sb.from('break_sessions').select('*').in('time_session_id', sessions.map((r: any) => r.id))
    const paidBreak = (brRows || []).filter((r: any) => !!r.is_paid).reduce((s: number, r: any) => s + Number(r.total_minutes || 0), 0)
    const unpaidBreak = (brRows || []).filter((r: any) => !r.is_paid).reduce((s: number, r: any) => s + Number(r.total_minutes || 0), 0)
    const scheduled = await computeScheduledMinutes(memberId, orgId, date)
    const workedMinusUnpaid = Math.max(0, worked - unpaidBreak)
    const shiftForDay = await getAssignedShiftFor(memberId, orgId, date)
    const workedAfterFixedBreak = Math.max(0, workedMinusUnpaid - (shiftForDay?.breakMinutes || 0))
    let status: 'normal'|'extra'|'short'|'absent'|'unconfigured' = 'normal'
    let extra = 0
    let short = 0
    if (scheduled === 0) status = workedAfterFixedBreak > 0 ? 'normal' : 'unconfigured'
    else if (workedAfterFixedBreak === 0) status = 'absent'
    else if (workedAfterFixedBreak > scheduled) { status = 'extra'; extra = workedAfterFixedBreak - scheduled }
    else if (workedAfterFixedBreak < scheduled) { status = 'short'; short = scheduled - workedAfterFixedBreak }
    const holiday = await isOrgHoliday(orgId, new Date(date + 'T00:00:00'))
    if (holiday && status === 'absent') status = 'unconfigured'
    const now = new Date()
    const payload = {
      member_id: memberId,
      org_id: orgId,
      date,
      work_pattern_id: null,
      scheduled_minutes: scheduled,
      worked_minutes: workedAfterFixedBreak,
      paid_break_minutes: paidBreak,
      unpaid_break_minutes: unpaidBreak,
      extra_minutes: extra,
      short_minutes: short,
      status,
      is_holiday: holiday,
      updated_at: now,
      created_at: now
    }
    const { data: existing } = await sb.from('daily_time_summaries').select('id').eq('member_id', memberId).eq('org_id', orgId).eq('date', date).limit(1).maybeSingle()
    if (existing?.id) await sb.from('daily_time_summaries').update(payload).eq('id', existing.id)
    else await sb.from('daily_time_summaries').insert(payload)
    return { scheduled, worked: workedAfterFixedBreak, paidBreak, unpaidBreak, extra, short, status }
  }
  const sessions = timeSessions.filter(s => s.memberId === memberId && s.orgId === orgId && s.date === date && s.status === 'closed')
  const sorted = [...sessions].sort((a, b) => a.startTime - b.startTime)
  for (let i = 1; i < sorted.length; i++) {
    const prevEnd = sorted[i-1].endTime || sorted[i-1].startTime
    const curStart = sorted[i].startTime
    if (prevEnd && curStart < prevEnd) {
      anomalies.push({ id: newId(), memberId, orgId, date, type: 'overlap', details: `Sessions ${sorted[i-1].id} and ${sorted[i].id} overlap`, resolved: false, createdAt: Date.now(), updatedAt: Date.now() })
      break
    }
  }
  const worked = sessions.reduce((sum, s) => sum + (s.totalMinutes || 0), 0)
  const breaks = breakSessions.filter(b => sessions.some(s => s.id === b.timeSessionId))
  const paidBreak = breaks.filter(b => b.isPaid).reduce((sum, b) => sum + (b.totalMinutes || 0), 0)
  const unpaidBreak = breaks.filter(b => !b.isPaid).reduce((sum, b) => sum + (b.totalMinutes || 0), 0)
  const scheduled = await computeScheduledMinutes(memberId, orgId, date)
  const workedMinusUnpaid = Math.max(0, worked - unpaidBreak)
  const shiftForDayMem = await getAssignedShiftFor(memberId, orgId, date)
  const workedAfterFixedBreak = Math.max(0, workedMinusUnpaid - (shiftForDayMem?.breakMinutes || 0))
  let status: 'normal'|'extra'|'short'|'absent'|'unconfigured' = 'normal'
  let extra = 0
  let short = 0
  if (scheduled === 0) status = workedAfterFixedBreak > 0 ? 'normal' : 'unconfigured'
  else if (workedAfterFixedBreak === 0) status = 'absent'
  else if (workedAfterFixedBreak > scheduled) { status = 'extra'; extra = workedAfterFixedBreak - scheduled }
  else if (workedAfterFixedBreak < scheduled) { status = 'short'; short = scheduled - workedAfterFixedBreak }
  const holidayMem = await isOrgHoliday(orgId, new Date(date + 'T00:00:00'))
  if (holidayMem && status === 'absent') status = 'unconfigured'
  const existing = dailySummaries.find(d => d.memberId === memberId && d.orgId === orgId && d.date === date)
  const nowMs = Date.now()
  const base: DailyTimeSummary = {
    id: existing?.id || newId(),
    memberId,
    orgId,
    date,
    workPatternId: undefined,
    scheduledMinutes: scheduled,
    workedMinutes: workedAfterFixedBreak,
    paidBreakMinutes: paidBreak,
    unpaidBreakMinutes: unpaidBreak,
    extraMinutes: extra,
    shortMinutes: short,
    status,
    isHoliday: holidayMem,
    createdAt: existing?.createdAt || nowMs,
    updatedAt: nowMs
  }
  if (existing) Object.assign(existing, base)
  else dailySummaries.push(base)
  return { scheduled, worked: workedAfterFixedBreak, paidBreak, unpaidBreak, extra, short, status }
}

export async function recalculateDailySummary(memberId: string, orgId: string, date: string) {
  const res = await recomputeDaily(memberId, orgId, date)
  await applyShiftRulesToDay(memberId, date)
  return res
}

function mapAuditLogRow(row: any): import('./types').AuditLog {
  return {
    id: String(row.id),
    orgId: String(row.org_id),
    actorUserId: row.actor_user_id ? String(row.actor_user_id) : undefined,
    actorIp: row.actor_ip ?? undefined,
    actorUserAgent: row.actor_user_agent ?? undefined,
    eventType: String(row.event_type),
    entityType: row.entity_type ?? undefined,
    entityId: row.entity_id ? String(row.entity_id) : undefined,
    metadata: row.metadata ?? undefined,
    createdAt: new Date(row.created_at).getTime()
  }
}

export async function logAuditEvent(input: { orgId: string, actorUserId?: string, actorIp?: string, actorUserAgent?: string, eventType: string, entityType?: string, entityId?: string, metadata?: any }): Promise<'OK'|'DB_ERROR'> {
  const now = new Date()
  if (isSupabaseConfigured()) {
    const sb = supabaseServer()
    const payload = {
      org_id: input.orgId,
      actor_user_id: input.actorUserId ?? null,
      actor_ip: input.actorIp ?? null,
      actor_user_agent: input.actorUserAgent ?? null,
      event_type: input.eventType,
      entity_type: input.entityType ?? null,
      entity_id: input.entityId ?? null,
      metadata: input.metadata ?? null,
      created_at: now
    }
    const { error } = await sb.from('audit_logs').insert(payload)
    if (error) return 'DB_ERROR'
    return 'OK'
  }
  const base: import('./types').AuditLog = {
    id: newId(),
    orgId: input.orgId,
    actorUserId: input.actorUserId,
    actorIp: input.actorIp,
    actorUserAgent: input.actorUserAgent,
    eventType: input.eventType,
    entityType: input.entityType,
    entityId: input.entityId,
    metadata: input.metadata,
    createdAt: now.getTime()
  }
  auditLogsMem.push(base)
  return 'OK'
}

export async function listAuditLogs(params: { orgId: string, eventType?: string, actorUserId?: string, dateStart?: string, dateEnd?: string, limit?: number, cursor?: string }): Promise<{ items: import('./types').AuditLog[], nextCursor: string | null }> {
  const limit = Math.max(1, Math.min(200, params.limit || 50))
  if (isSupabaseConfigured()) {
    const sb = supabaseServer()
    let q = sb.from('audit_logs').select('*').eq('org_id', params.orgId).order('created_at', { ascending: false }).limit(limit)
    if (params.eventType) q = q.eq('event_type', params.eventType)
    if (params.actorUserId) q = q.eq('actor_user_id', params.actorUserId)
    if (params.dateStart) q = q.gte('created_at', new Date(params.dateStart))
    if (params.dateEnd) q = q.lte('created_at', new Date(params.dateEnd))
    if (params.cursor) q = q.lt('created_at', new Date(params.cursor))
    const { data } = await q
    const items = (data || []).map(mapAuditLogRow)
    const nextCursor = items.length ? new Date(items[items.length-1].createdAt).toISOString() : null
    return { items, nextCursor }
  }
  let arr = auditLogsMem.filter(l => l.orgId === params.orgId).slice().sort((a,b)=> b.createdAt - a.createdAt)
  if (params.eventType) arr = arr.filter(l => l.eventType === params.eventType)
  if (params.actorUserId) arr = arr.filter(l => l.actorUserId === params.actorUserId)
  if (params.dateStart) arr = arr.filter(l => l.createdAt >= new Date(params.dateStart as string).getTime())
  if (params.dateEnd) arr = arr.filter(l => l.createdAt <= new Date(params.dateEnd as string).getTime())
  if (params.cursor) arr = arr.filter(l => l.createdAt < new Date(params.cursor as string).getTime())
  const items = arr.slice(0, limit)
  const nextCursor = items.length ? new Date(items[items.length-1].createdAt).toISOString() : null
  return { items, nextCursor }
}

export async function createHolidayCalendar(input: { orgId: string, name: string, countryCode?: string }): Promise<HolidayCalendar | 'DB_ERROR'> {
  const now = new Date()
  if (isSupabaseConfigured()) {
    const sb = supabaseServer()
    const { data, error } = await sb.from('holiday_calendars').insert({ org_id: input.orgId, name: input.name, country_code: input.countryCode ?? null, created_at: now }).select('*').single()
    if (error) return 'DB_ERROR'
    return { id: data.id, orgId: data.org_id, name: data.name, countryCode: data.country_code ?? undefined, createdAt: new Date(data.created_at).getTime() }
  }
  const cal: HolidayCalendar = { id: newId(), orgId: input.orgId, name: input.name, countryCode: input.countryCode, createdAt: now.getTime() }
  holidayCalendarsMem.push(cal)
  return cal
}

export async function listHolidayCalendars(orgId: string): Promise<HolidayCalendar[]> {
  if (isSupabaseConfigured()) {
    const sb = supabaseServer()
    const { data } = await sb.from('holiday_calendars').select('*').eq('org_id', orgId).order('created_at', { ascending: false })
    return (data || []).map((r: any) => ({ id: r.id, orgId: r.org_id, name: r.name, countryCode: r.country_code ?? undefined, createdAt: new Date(r.created_at).getTime() }))
  }
  return holidayCalendarsMem.filter(c => c.orgId === orgId)
}

export async function addHoliday(input: { calendarId: string, date: string, name: string, isFullDay?: boolean }): Promise<Holiday | 'DB_ERROR'> {
  const now = new Date()
  if (isSupabaseConfigured()) {
    const sb = supabaseServer()
    const { data, error } = await sb.from('holidays').insert({ calendar_id: input.calendarId, date: input.date, name: input.name, is_full_day: !!input.isFullDay, created_at: now }).select('*').single()
    if (error) return 'DB_ERROR'
    return { id: data.id, calendarId: data.calendar_id, date: data.date, name: data.name, isFullDay: !!data.is_full_day, createdAt: new Date(data.created_at).getTime() }
  }
  const h: Holiday = { id: newId(), calendarId: input.calendarId, date: input.date, name: input.name, isFullDay: !!input.isFullDay, createdAt: now.getTime() }
  holidaysMem.push(h)
  return h
}

export async function listHolidays(calendarId: string): Promise<Holiday[]> {
  if (isSupabaseConfigured()) {
    const sb = supabaseServer()
    const { data } = await sb.from('holidays').select('*').eq('calendar_id', calendarId).order('date', { ascending: true })
    return (data || []).map((r: any) => ({ id: r.id, calendarId: r.calendar_id, date: r.date, name: r.name, isFullDay: !!r.is_full_day, createdAt: new Date(r.created_at).getTime() }))
  }
  return holidaysMem.filter(h => h.calendarId === calendarId).sort((a,b)=> a.date.localeCompare(b.date))
}

const activeHolidayByOrgMem = new Map<string, string>()

export async function setActiveHolidayCalendar(orgId: string, calendarId: string): Promise<'OK'|'DB_ERROR'> {
  if (isSupabaseConfigured()) {
    const sb = supabaseServer()
    const key = `org_active_holiday_calendar:${orgId}`
    const now = new Date()
    const { data: existing } = await sb.from('platform_settings').select('*').eq('key', key).limit(1).maybeSingle()
    if (existing?.id) {
      const { error } = await sb.from('platform_settings').update({ value_json: { calendar_id: calendarId }, updated_at: now }).eq('id', existing.id)
      if (error) return 'DB_ERROR'
    } else {
      const { error } = await sb.from('platform_settings').insert({ key, value_json: { calendar_id: calendarId }, created_at: now, updated_at: now })
      if (error) return 'DB_ERROR'
    }
    return 'OK'
  }
  activeHolidayByOrgMem.set(orgId, calendarId)
  return 'OK'
}

export async function getActiveHolidayCalendar(orgId: string): Promise<string | undefined> {
  if (isSupabaseConfigured()) {
    const sb = supabaseServer()
    const key = `org_active_holiday_calendar:${orgId}`
    const { data } = await sb.from('platform_settings').select('*').eq('key', key).limit(1).maybeSingle()
    const calId = data?.value_json?.calendar_id || undefined
    return calId || undefined
  }
  return activeHolidayByOrgMem.get(orgId)
}

export async function isOrgHoliday(orgId: string, date: Date): Promise<boolean> {
  const iso = date.toISOString().slice(0,10)
  const active = await getActiveHolidayCalendar(orgId)
  if (!active) return false
  if (isSupabaseConfigured()) {
    const sb = supabaseServer()
    const { count } = await sb.from('holidays').select('*', { count: 'exact', head: true }).eq('calendar_id', active).eq('date', iso)
    return (count || 0) > 0
  }
  return holidaysMem.some(h => h.calendarId === active && h.date === iso)
}

function minutesBetweenShift(start: string, end: string, isOvernight: boolean) {
  const base = new Date('1970-01-01T00:00:00Z')
  const sParts = start.split(':').map(Number)
  const eParts = end.split(':').map(Number)
  const s = new Date(base)
  s.setUTCHours(sParts[0] || 0, sParts[1] || 0, 0, 0)
  const e = new Date(base)
  e.setUTCHours(eParts[0] || 0, eParts[1] || 0, 0, 0)
  let diff = (e.getTime() - s.getTime()) / 60000
  if (isOvernight && diff <= 0) diff = ((24*60) - ((sParts[0]||0)*60 + (sParts[1]||0))) + ((eParts[0]||0)*60 + (eParts[1]||0))
  return Math.max(0, Math.round(diff))
}

async function getAssignedShiftFor(memberId: string, orgId: string, date: string) {
  const u = await getUser(memberId)
  if (!u || u.orgId !== orgId) return undefined
  if (isSupabaseConfigured()) {
    const sb = supabaseServer()
    const { data: asg } = await sb.from('shift_assignments').select('*, shifts(*)').eq('member_id', memberId).lte('effective_from', date).or(`effective_to.is.null,effective_to.gte.${date}`)
    const row = (asg || []).find((r:any)=> r.shifts && r.shifts.org_id === orgId)
    if (!row || !row.shifts) return undefined
    const s = row.shifts
    return { id: s.id, orgId: s.org_id, name: s.name, startTime: s.start_time, endTime: s.end_time, isOvernight: !!s.is_overnight, graceMinutes: Number(s.grace_minutes||0), breakMinutes: Number(s.break_minutes||0), createdAt: new Date(s.created_at).getTime() } as import('./types').Shift
  }
  const found = shiftAssignmentsMem.find(a => a.memberId === memberId && a.effectiveFrom <= date && (!a.effectiveTo || a.effectiveTo >= date))
  if (!found) return undefined
  const s = shiftsMem.find(ss => ss.id === found.shiftId)
  return s
}

export async function createShift(input: { orgId: string, name: string, startTime: string, endTime: string, isOvernight?: boolean, graceMinutes?: number, breakMinutes?: number }) {
  const now = new Date()
  if (isSupabaseConfigured()) {
    const sb = supabaseServer()
    const payload = { org_id: input.orgId, name: input.name, start_time: input.startTime, end_time: input.endTime, is_overnight: !!input.isOvernight, grace_minutes: input.graceMinutes ?? 0, break_minutes: input.breakMinutes ?? 0, created_at: now }
    const { data, error } = await sb.from('shifts').insert(payload).select('*').single()
    if (error) return 'DB_ERROR'
    return { id: data.id, orgId: data.org_id, name: data.name, startTime: data.start_time, endTime: data.end_time, isOvernight: !!data.is_overnight, graceMinutes: Number(data.grace_minutes||0), breakMinutes: Number(data.break_minutes||0), createdAt: new Date(data.created_at).getTime() } as import('./types').Shift
  }
  const id = newId()
  const s: import('./types').Shift = { id, orgId: input.orgId, name: input.name, startTime: input.startTime, endTime: input.endTime, isOvernight: !!input.isOvernight, graceMinutes: input.graceMinutes ?? 0, breakMinutes: input.breakMinutes ?? 0, createdAt: now.getTime() }
  shiftsMem.push(s)
  return s
}

export async function listShifts(orgId: string) {
  if (isSupabaseConfigured()) {
    const sb = supabaseServer()
    const { data } = await sb.from('shifts').select('*').eq('org_id', orgId).order('created_at', { ascending: false })
    return (data || []).map((r:any)=> ({ id: r.id, orgId: r.org_id, name: r.name, startTime: r.start_time, endTime: r.end_time, isOvernight: !!r.is_overnight, graceMinutes: Number(r.grace_minutes||0), breakMinutes: Number(r.break_minutes||0), createdAt: new Date(r.created_at).getTime() })) as import('./types').Shift[]
  }
  return shiftsMem.filter(s => s.orgId === orgId)
}

export async function assignShift(input: { memberId: string, shiftId: string, effectiveFrom: string, effectiveTo?: string }) {
  const now = new Date()
  if (isSupabaseConfigured()) {
    const sb = supabaseServer()
    const payload = { member_id: input.memberId, shift_id: input.shiftId, effective_from: input.effectiveFrom, effective_to: input.effectiveTo ?? null, created_at: now }
    const { data, error } = await sb.from('shift_assignments').insert(payload).select('*').single()
    if (error) return 'DB_ERROR'
    return { id: data.id, memberId: data.member_id, shiftId: data.shift_id, effectiveFrom: data.effective_from, effectiveTo: data.effective_to ?? undefined, createdAt: new Date(data.created_at).getTime() } as import('./types').ShiftAssignment
  }
  const a: import('./types').ShiftAssignment = { id: newId(), memberId: input.memberId, shiftId: input.shiftId, effectiveFrom: input.effectiveFrom, effectiveTo: input.effectiveTo, createdAt: now.getTime() }
  shiftAssignmentsMem.push(a)
  return a
}

export async function unassignShift(id: string) {
  if (isSupabaseConfigured()) {
    const sb = supabaseServer()
    const { error } = await sb.from('shift_assignments').delete().eq('id', id)
    if (error) return 'DB_ERROR'
    return 'OK'
  }
  const idx = shiftAssignmentsMem.findIndex(a => a.id === id)
  if (idx < 0) return 'NOT_FOUND'
  shiftAssignmentsMem.splice(idx, 1)
  return 'OK'
}

export async function listShiftAssignments(params: { orgId?: string, memberId?: string }) {
  if (isSupabaseConfigured()) {
    const sb = supabaseServer()
    let q = sb.from('shift_assignments').select('*, shifts(*)')
    if (params.memberId) q = q.eq('member_id', params.memberId)
    const { data } = await q
    const rows = (data || []).filter((r:any)=> !params.orgId || (r.shifts && r.shifts.org_id === params.orgId))
    return rows.map((r:any)=> ({ id: r.id, memberId: r.member_id, shiftId: r.shift_id, effectiveFrom: r.effective_from, effectiveTo: r.effective_to ?? undefined, createdAt: new Date(r.created_at).getTime() })) as import('./types').ShiftAssignment[]
  }
  let arr = shiftAssignmentsMem.slice()
  if (params.memberId) arr = arr.filter(a => a.memberId === params.memberId)
  if (params.orgId) {
    const members = await listUsers(params.orgId)
    const set = new Set(members.map(m => m.id))
    arr = arr.filter(a => set.has(a.memberId))
  }
  return arr
}

export async function applyShiftRulesToDay(memberId: string, date: string) {
  const u = await getUser(memberId)
  if (!u) return
  const orgId = u.orgId
  if (isSupabaseConfigured()) {
    const sb = supabaseServer()
    const { data: leaves } = await sb.from('leave_requests').select('id').eq('org_id', orgId).eq('member_id', memberId).eq('status','approved').lte('start_date', date).gte('end_date', date)
    if ((leaves||[]).length) return
  } else {
    try {
      const { listRequests: memList } = await import('./memory/leave')
      const approved = memList({ org_id: orgId, status: 'approved', member_id: memberId, start_date: date, end_date: date })
      if ((approved||[]).length) return
    } catch {}
  }
  const shift = await getAssignedShiftFor(memberId, orgId, date)
  if (!shift) return
  if (isSupabaseConfigured()) {
    const sb = supabaseServer()
    const { data: sessRows } = await sb.from('time_sessions').select('*').eq('member_id', memberId).eq('org_id', orgId).eq('date', date)
    const sessions = (sessRows || []).filter((r:any)=> r.status === 'closed')
    const firstStart = sessions.length ? new Date(sessions.map((r:any)=> r.start_time).sort()[0]).getTime() : 0
    const lastEnd = sessions.length ? new Date((sessions.map((r:any)=> r.end_time || r.start_time).filter(Boolean).sort().slice(-1)[0]) as any).getTime() : 0
    const dayStart = new Date(date + 'T00:00:00Z')
    const sStart = new Date(dayStart)
    const sEnd = new Date(dayStart)
    const [sh, sm] = shift.startTime.split(':').map(Number)
    const [eh, em] = shift.endTime.split(':').map(Number)
    sStart.setUTCHours(sh||0, sm||0, 0, 0)
    sEnd.setUTCHours(eh||0, em||0, 0, 0)
    if (shift.isOvernight && sEnd <= sStart) sEnd.setUTCDate(sEnd.getUTCDate()+1)
    const graceMs = (shift.graceMinutes||0) * 60000
    if (!firstStart) {
      const { count } = await sb.from('time_anomalies').select('*', { count:'exact', head:true }).eq('member_id', memberId).eq('org_id', orgId).eq('date', date).eq('type','absent')
      if ((count||0)===0) await sb.from('time_anomalies').insert({ member_id: memberId, org_id: orgId, date, type:'absent', details:'No check-in for scheduled shift', resolved:false, created_at:new Date(), updated_at:new Date() })
      return
    }
    if (firstStart > sStart.getTime() + graceMs) await sb.from('time_anomalies').insert({ member_id: memberId, org_id: orgId, date, type:'late', details:`Check-in at ${new Date(firstStart).toISOString()} after shift start`, resolved:false, created_at:new Date(), updated_at:new Date() })
    if (lastEnd && lastEnd < sEnd.getTime()) await sb.from('time_anomalies').insert({ member_id: memberId, org_id: orgId, date, type:'early_leave', details:`Check-out before shift end`, resolved:false, created_at:new Date(), updated_at:new Date() })
    if (lastEnd && lastEnd > sEnd.getTime()) await sb.from('time_anomalies').insert({ member_id: memberId, org_id: orgId, date, type:'overtime', details:`Worked beyond shift end`, resolved:false, created_at:new Date(), updated_at:new Date() })
    return
  }
  const sessions = timeSessions.filter(s => s.memberId === memberId && s.orgId === orgId && s.date === date && s.status === 'closed')
  const firstStart = sessions.length ? Math.min(...sessions.map(s=> s.startTime)) : 0
  const lastEnd = sessions.length ? Math.max(...sessions.map(s=> s.endTime || s.startTime)) : 0
  const dayStart = new Date(date + 'T00:00:00Z').getTime()
  const sStart = dayStart + ((Number(shift.startTime.split(':')[0])||0)*3600000) + ((Number(shift.startTime.split(':')[1])||0)*60000)
  let sEnd = dayStart + ((Number(shift.endTime.split(':')[0])||0)*3600000) + ((Number(shift.endTime.split(':')[1])||0)*60000)
  if (shift.isOvernight && sEnd <= sStart) sEnd += 24*3600000
  const graceMs = (shift.graceMinutes||0) * 60000
  if (!firstStart) { anomalies.push({ id: newId(), memberId, orgId, date, type:'absent', details:'No check-in for scheduled shift', resolved:false, createdAt: Date.now(), updatedAt: Date.now() }); return }
  if (firstStart > sStart + graceMs) anomalies.push({ id: newId(), memberId, orgId, date, type:'late', details:'Check-in after shift start', resolved:false, createdAt: Date.now(), updatedAt: Date.now() })
  if (lastEnd && lastEnd < sEnd) anomalies.push({ id: newId(), memberId, orgId, date, type:'early_leave', details:'Check-out before shift end', resolved:false, createdAt: Date.now(), updatedAt: Date.now() })
  if (lastEnd && lastEnd > sEnd) anomalies.push({ id: newId(), memberId, orgId, date, type:'overtime', details:'Worked beyond shift end', resolved:false, createdAt: Date.now(), updatedAt: Date.now() })
}

export async function calculateComplianceScore(memberId: string, date: string) {
  const u = await getUser(memberId)
  if (!u) return 0
  const orgId = u.orgId
  const shift = await getAssignedShiftFor(memberId, orgId, date)
  if (!shift) return 100
  if (isSupabaseConfigured()) {
    const sb = supabaseServer()
    const { data: sessRows } = await sb.from('time_sessions').select('*').eq('member_id', memberId).eq('org_id', orgId).eq('date', date)
    const sessions = (sessRows || []).filter((r:any)=> r.status === 'closed')
    if (!sessions.length) return 0
    const firstStart = new Date(sessions.map((r:any)=> r.start_time).sort()[0]).getTime()
    const lastEnd = new Date((sessions.map((r:any)=> r.end_time || r.start_time).filter(Boolean).sort().slice(-1)[0]) as any).getTime()
    const dayStart = new Date(date + 'T00:00:00Z')
    const sStart = new Date(dayStart)
    const sEnd = new Date(dayStart)
    const [sh, sm] = shift.startTime.split(':').map(Number)
    const [eh, em] = shift.endTime.split(':').map(Number)
    sStart.setUTCHours(sh||0, sm||0, 0, 0)
    sEnd.setUTCHours(eh||0, em||0, 0, 0)
    if (shift.isOvernight && sEnd <= sStart) sEnd.setUTCDate(sEnd.getUTCDate()+1)
    let score = 100
    if (firstStart > sStart.getTime() + (shift.graceMinutes||0)*60000) score -= 20
    if (lastEnd < sEnd.getTime()) score -= 20
    return Math.max(0, score)
  }
  const sessions = timeSessions.filter(s => s.memberId === memberId && s.orgId === orgId && s.date === date && s.status === 'closed')
  if (!sessions.length) return 0
  const firstStart = Math.min(...sessions.map(s=> s.startTime))
  const lastEnd = Math.max(...sessions.map(s=> s.endTime || s.startTime))
  const dayStart = new Date(date + 'T00:00:00Z').getTime()
  const sStart = dayStart + ((Number(shift.startTime.split(':')[0])||0)*3600000) + ((Number(shift.startTime.split(':')[1])||0)*60000)
  let sEnd = dayStart + ((Number(shift.endTime.split(':')[0])||0)*3600000) + ((Number(shift.endTime.split(':')[1])||0)*60000)
  if (shift.isOvernight && sEnd <= sStart) sEnd += 24*3600000
  let score = 100
  if (firstStart > sStart + (shift.graceMinutes||0)*60000) score -= 20
  if (lastEnd < sEnd) score -= 20
  return Math.max(0, score)
}

export async function publishNotification(input: { orgId: string, memberId?: string | null, type: NotificationItem['type'], title: string, message: string, meta?: any }) {
  const now = new Date()
  if (isSupabaseConfigured()) {
    const sb = supabaseServer()
    const payload: any = { org_id: input.orgId, member_id: input.memberId ?? null, type: input.type, title: input.title, message: input.message, meta: input.meta ?? null, is_read: false, created_at: now }
    const { data, error } = await sb.from('notifications').insert(payload).select('*').single()
    if (error) return 'DB_ERROR'
    return mapNotificationFromRow(data)
  }
  const base: NotificationItem = { id: newId(), orgId: input.orgId, memberId: input.memberId || undefined, type: input.type, title: input.title, message: input.message, meta: input.meta, isRead: false, createdAt: now.getTime() }
  notifications.push(base)
  return base
}

function mapNotificationFromRow(row: any): NotificationItem {
  return { id: row.id, orgId: row.org_id, memberId: row.member_id ?? undefined, type: row.type, title: row.title, message: row.message, meta: row.meta ?? undefined, isRead: !!row.is_read, createdAt: new Date(row.created_at).getTime() }
}

export async function listNotifications(params: { orgId?: string, memberId?: string, limit?: number, cursor?: string }) {
  const limit = Math.max(1, Math.min(200, params.limit || 50))
  if (isSupabaseConfigured()) {
    const sb = supabaseServer()
    let q = sb.from('notifications').select('*').order('created_at', { ascending: false }).limit(limit)
    if (params.orgId) q = q.eq('org_id', params.orgId)
    if (params.memberId) q = q.eq('member_id', params.memberId)
    if (params.cursor) q = q.lt('created_at', new Date(params.cursor))
    const { data } = await q
    const items = (data || []).map(mapNotificationFromRow)
    const nextCursor = items.length ? new Date(items[items.length-1].createdAt).toISOString() : null
    return { items, nextCursor }
  }
  let arr = notifications.slice().sort((a,b)=>b.createdAt - a.createdAt)
  if (params.orgId) arr = arr.filter(n => n.orgId === params.orgId)
  if (params.memberId) arr = arr.filter(n => n.memberId === params.memberId)
  if (params.cursor) arr = arr.filter(n => n.createdAt < new Date(params.cursor as string).getTime())
  const items = arr.slice(0, limit)
  const nextCursor = items.length ? new Date(items[items.length-1].createdAt).toISOString() : null
  return { items, nextCursor }
}

export async function markNotificationRead(notificationId: string) {
  if (isSupabaseConfigured()) {
    const sb = supabaseServer()
    const { data, error } = await sb.from('notifications').update({ is_read: true }).eq('id', notificationId).select('*').single()
    if (error) return 'DB_ERROR'
    return mapNotificationFromRow(data)
  }
  const n = notifications.find(nn => nn.id === notificationId)
  if (!n) return 'NOT_FOUND'
  n.isRead = true
  return n
}

export async function markAllNotificationsRead(memberId: string) {
  if (isSupabaseConfigured()) {
    const sb = supabaseServer()
    await sb.from('notifications').update({ is_read: true }).eq('member_id', memberId)
    return 'OK'
  }
  notifications.forEach(n => { if (n.memberId === memberId) n.isRead = true })
  return 'OK'
}

export async function getNotificationPreferences(memberId: string) {
  if (isSupabaseConfigured()) {
    const sb = supabaseServer()
    const { data } = await sb.from('notification_preferences').select('*').eq('member_id', memberId).limit(1).maybeSingle()
    if (data) return mapPrefFromRow(data)
    const now = new Date()
    const { data: created } = await sb.from('notification_preferences').insert({ member_id: memberId, email_enabled: true, inapp_enabled: true, created_at: now, updated_at: now }).select('*').single()
    return mapPrefFromRow(created)
  }
  const existing = notificationPrefs.find(p => p.memberId === memberId)
  if (existing) return existing
  const nowMs = Date.now()
  const base: NotificationPreferences = { id: newId(), memberId, emailEnabled: true, inappEnabled: true, createdAt: nowMs, updatedAt: nowMs }
  notificationPrefs.push(base)
  return base
}

export async function updateNotificationPreferences(memberId: string, patch: { emailEnabled?: boolean, inappEnabled?: boolean }) {
  if (isSupabaseConfigured()) {
    const sb = supabaseServer()
    const { data: before } = await sb.from('notification_preferences').select('*').eq('member_id', memberId).limit(1).maybeSingle()
    const now = new Date()
    if (before) {
      const { data } = await sb.from('notification_preferences').update({ email_enabled: patch.emailEnabled ?? before.email_enabled, inapp_enabled: patch.inappEnabled ?? before.inapp_enabled, updated_at: now }).eq('id', before.id).select('*').single()
      return mapPrefFromRow(data)
    } else {
      const { data } = await sb.from('notification_preferences').insert({ member_id: memberId, email_enabled: patch.emailEnabled ?? true, inapp_enabled: patch.inappEnabled ?? true, created_at: now, updated_at: now }).select('*').single()
      return mapPrefFromRow(data)
    }
  }
  const existing = notificationPrefs.find(p => p.memberId === memberId)
  const nowMs = Date.now()
  if (existing) {
    if (patch.emailEnabled !== undefined) existing.emailEnabled = patch.emailEnabled
    if (patch.inappEnabled !== undefined) existing.inappEnabled = patch.inappEnabled
    existing.updatedAt = nowMs
    return existing
  }
  const base: NotificationPreferences = { id: newId(), memberId, emailEnabled: patch.emailEnabled ?? true, inappEnabled: patch.inappEnabled ?? true, createdAt: nowMs, updatedAt: nowMs }
  notificationPrefs.push(base)
  return base
}

function mapPrefFromRow(row: any): NotificationPreferences {
  return { id: row.id, memberId: row.member_id, emailEnabled: !!row.email_enabled, inappEnabled: !!row.inapp_enabled, createdAt: new Date(row.created_at).getTime(), updatedAt: new Date(row.updated_at).getTime() }
}

function mapEventPrefRow(row: any): import('./types').EventNotificationPreference {
  return { id: String(row.id), userId: String(row.user_id), eventType: String(row.event_type), channel: String(row.channel) as any, enabled: !!row.enabled, createdAt: new Date(row.created_at).getTime() }
}

export async function listEventNotificationPreferences(userId: string): Promise<import('./types').EventNotificationPreference[]> {
  if (isSupabaseConfigured()) {
    const sb = supabaseServer()
    const { data } = await sb.from('notification_event_preferences').select('*').eq('user_id', userId).order('created_at', { ascending: false })
    return (data || []).map(mapEventPrefRow)
  }
  return eventPrefsV2.filter(p => p.userId === userId).slice().sort((a,b)=>b.createdAt - a.createdAt)
}

export async function upsertEventNotificationPreferences(userId: string, items: { eventType: string, channel: 'in_app'|'email', enabled: boolean }[]): Promise<import('./types').EventNotificationPreference[]> {
  const now = new Date()
  if (isSupabaseConfigured()) {
    const sb = supabaseServer()
    const payload = items.map(i => ({ user_id: userId, event_type: i.eventType, channel: i.channel, enabled: !!i.enabled, created_at: now }))
    const { data } = await sb.from('notification_event_preferences').upsert(payload, { onConflict: 'user_id,event_type,channel' }).select('*')
    return (data || []).map(mapEventPrefRow)
  }
  for (const i of items) {
    const existingIdx = eventPrefsV2.findIndex(p => p.userId === userId && p.eventType === i.eventType && p.channel === i.channel)
    if (existingIdx >= 0) eventPrefsV2.splice(existingIdx, 1)
    eventPrefsV2.push({ id: newId(), userId, eventType: i.eventType, channel: i.channel, enabled: !!i.enabled, createdAt: now.getTime() })
  }
  return eventPrefsV2.filter(p => p.userId === userId)
}

export async function shouldSendForEvent(userId: string, eventType: string, channel: 'in_app'|'email'): Promise<boolean> {
  const prefs = await listEventNotificationPreferences(userId)
  const row = prefs.find(p => p.eventType === eventType && p.channel === channel)
  if (row) return !!row.enabled
  if (channel === 'email') {
    const base = await getNotificationPreferences(userId)
    return !!base.emailEnabled
  }
  if (channel === 'in_app') {
    const base = await getNotificationPreferences(userId)
    return !!base.inappEnabled
  }
  return true
}

export async function getDigestFrequency(userId: string): Promise<import('./types').DigestFrequency> {
  if (isSupabaseConfigured()) {
    const sb = supabaseServer()
    const { data } = await sb.from('notification_digests').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(1)
    const row = (data || [])[0]
    if (!row) return 'none'
    return String(row.frequency) as any
  }
  const rows = digestRowsMem.filter(r => r.userId === userId).sort((a,b)=>b.createdAt - a.createdAt)
  return rows[0]?.frequency ? (rows[0].frequency as any) : 'none'
}

export async function updateDigestFrequency(userId: string, frequency: import('./types').DigestFrequency): Promise<import('./types').DigestFrequency> {
  if (isSupabaseConfigured()) {
    const sb = supabaseServer()
    if (frequency === 'none') {
      await sb.from('notification_digests').delete().eq('user_id', userId)
      return 'none'
    }
    const now = new Date()
    const { data } = await sb.from('notification_digests').insert({ user_id: userId, frequency, created_at: now }).select('*').single()
    return String(data.frequency) as any
  }
  if (frequency === 'none') {
    for (let i = digestRowsMem.length - 1; i >= 0; i--) { if (digestRowsMem[i].userId === userId) digestRowsMem.splice(i, 1) }
    return 'none'
  }
  digestRowsMem.push({ id: newId(), userId, frequency: frequency === 'daily' ? 'daily' : 'weekly', createdAt: Date.now() })
  return frequency
}

export async function listDigestUsers(frequency: 'daily'|'weekly'): Promise<string[]> {
  if (isSupabaseConfigured()) {
    const sb = supabaseServer()
    const { data } = await sb.from('notification_digests').select('user_id').eq('frequency', frequency)
    return (data || []).map((r:any)=> String(r.user_id))
  }
  return digestRowsMem.filter(r => r.frequency === frequency).map(r => r.userId)
}

export async function listNotificationsForUserBetween(userId: string, startISO: string, endISO: string): Promise<NotificationItem[]> {
  if (isSupabaseConfigured()) {
    const sb = supabaseServer()
    const { data } = await sb.from('notifications').select('*').eq('member_id', userId).gte('created_at', new Date(startISO)).lte('created_at', new Date(endISO)).order('created_at', { ascending: false })
    return (data || []).map(mapNotificationFromRow)
  }
  const startMs = new Date(startISO).getTime()
  const endMs = new Date(endISO).getTime()
  return notifications.filter(n => n.memberId === userId && n.createdAt >= startMs && n.createdAt <= endMs).slice().sort((a,b)=>b.createdAt - a.createdAt)
}

function mapSupportTicketFromRow(row: any): SupportTicket {
  return {
    id: String(row.id),
    orgId: String(row.org_id),
    createdByUserId: String(row.created_by_user_id),
    category: String(row.category),
    title: String(row.title),
    description: row.description ?? undefined,
    status: String(row.status),
    priority: String(row.priority),
    assignedToUserId: row.assigned_to_user_id ? String(row.assigned_to_user_id) : undefined,
    createdAt: new Date(row.created_at).getTime(),
    updatedAt: new Date(row.updated_at).getTime()
  }
}

function mapSupportCommentFromRow(row: any): SupportComment {
  return {
    id: String(row.id),
    ticketId: String(row.ticket_id),
    userId: String(row.user_id),
    body: String(row.body),
    createdAt: new Date(row.created_at).getTime()
  }
}

function mapAIInsightSnapshotFromRow(row: any): import('./types').AIInsightSnapshot {
  return {
    id: String(row.id),
    orgId: String(row.org_id),
    targetType: String(row.target_type) as any,
    targetId: row.target_id ? String(row.target_id) : undefined,
    snapshotDate: String(row.snapshot_date),
    summary: row.summary ?? undefined,
    metadata: row.metadata ?? undefined,
    createdAt: new Date(row.created_at).getTime()
  }
}

export async function createAIInsightSnapshot(input: { orgId: string, targetType: 'org'|'department'|'member', targetId?: string, snapshotDate: string, summary?: string, metadata?: any }): Promise<import('./types').AIInsightSnapshot | 'DB_ERROR'> {
  const now = new Date()
  if (isSupabaseConfigured()) {
    const sb = supabaseServer()
    const payload = {
      org_id: input.orgId,
      target_type: input.targetType,
      target_id: input.targetId ?? null,
      snapshot_date: input.snapshotDate,
      summary: input.summary ?? null,
      metadata: input.metadata ?? null,
      created_at: now
    }
    const { data, error } = await sb.from('ai_insight_snapshots').insert(payload).select('*').single()
    if (error) return 'DB_ERROR'
    return mapAIInsightSnapshotFromRow(data)
  }
  const base: import('./types').AIInsightSnapshot = {
    id: newId(),
    orgId: input.orgId,
    targetType: input.targetType,
    targetId: input.targetId,
    snapshotDate: input.snapshotDate,
    summary: input.summary,
    metadata: input.metadata,
    createdAt: now.getTime()
  }
  aiInsightSnapshotsMem.push(base)
  return base
}

export async function listAIInsightSnapshots(params: { orgId: string, targetType?: 'org'|'department'|'member', targetId?: string, periodStart?: string, periodEnd?: string, limit?: number }): Promise<import('./types').AIInsightSnapshot[]> {
  const limit = Math.max(1, Math.min(500, params.limit || 200))
  if (isSupabaseConfigured()) {
    const sb = supabaseServer()
    let q = sb.from('ai_insight_snapshots').select('*').eq('org_id', params.orgId).order('snapshot_date', { ascending: false }).limit(limit)
    if (params.targetType) q = q.eq('target_type', params.targetType)
    if (params.targetId) q = q.eq('target_id', params.targetId)
    if (params.periodStart) q = q.gte('snapshot_date', params.periodStart)
    if (params.periodEnd) q = q.lte('snapshot_date', params.periodEnd)
    const { data } = await q
    return (data || []).map(mapAIInsightSnapshotFromRow)
  }
  let arr = aiInsightSnapshotsMem.filter(s => s.orgId === params.orgId)
  if (params.targetType) arr = arr.filter(s => s.targetType === params.targetType)
  if (params.targetId) arr = arr.filter(s => s.targetId === params.targetId)
  if (params.periodStart) arr = arr.filter(s => s.snapshotDate >= params.periodStart!)
  if (params.periodEnd) arr = arr.filter(s => s.snapshotDate <= params.periodEnd!)
  return arr.slice().sort((a,b)=> b.snapshotDate.localeCompare(a.snapshotDate)).slice(0, limit)
}

export async function createSupportTicket(input: { orgId: string, createdByUserId: string, category: string, title: string, description?: string, priority?: string }): Promise<SupportTicket | 'DB_ERROR'> {
  const now = new Date()
  const priority = (input.priority || 'normal')
  if (isSupabaseConfigured()) {
    const sb = supabaseServer()
    const { data, error } = await sb.from('support_tickets').insert({ org_id: input.orgId, created_by_user_id: input.createdByUserId, category: input.category, title: input.title, description: input.description ?? null, status: 'open', priority, created_at: now, updated_at: now, assigned_to_user_id: null }).select('*').single()
    if (error) return 'DB_ERROR'
    return mapSupportTicketFromRow(data)
  }
  const base: SupportTicket = { id: newId(), orgId: input.orgId, createdByUserId: input.createdByUserId, category: input.category, title: input.title, description: input.description, status: 'open', priority, assignedToUserId: undefined, createdAt: now.getTime(), updatedAt: now.getTime() }
  supportTicketsMem.push(base)
  return base
}

export async function listMySupportTickets(userId: string): Promise<SupportTicket[]> {
  if (isSupabaseConfigured()) {
    const sb = supabaseServer()
    const { data } = await sb.from('support_tickets').select('*').eq('created_by_user_id', userId).order('created_at', { ascending: false })
    return (data || []).map(mapSupportTicketFromRow)
  }
  return supportTicketsMem.filter(t => t.createdByUserId === userId).slice().sort((a,b)=> b.createdAt - a.createdAt)
}

export async function listSupportTickets(params: { orgId: string, status?: string, category?: string }): Promise<SupportTicket[]> {
  if (isSupabaseConfigured()) {
    const sb = supabaseServer()
    let q = sb.from('support_tickets').select('*').eq('org_id', params.orgId).order('created_at', { ascending: false })
    if (params.status) q = q.eq('status', params.status)
    if (params.category) q = q.eq('category', params.category)
    const { data } = await q
    return (data || []).map(mapSupportTicketFromRow)
  }
  let arr = supportTicketsMem.filter(t => t.orgId === params.orgId)
  if (params.status) arr = arr.filter(t => String(t.status) === params.status)
  if (params.category) arr = arr.filter(t => String(t.category) === params.category)
  return arr.slice().sort((a,b)=> b.createdAt - a.createdAt)
}

export async function updateSupportTicket(id: string, patch: { status?: string, priority?: string, assignedToUserId?: string }): Promise<SupportTicket | 'DB_ERROR' | 'NOT_FOUND'> {
  const now = new Date()
  if (isSupabaseConfigured()) {
    const sb = supabaseServer()
    const { data: before } = await sb.from('support_tickets').select('*').eq('id', id).limit(1).maybeSingle()
    if (!before) return 'NOT_FOUND'
    const payload = {
      status: patch.status ?? before.status,
      priority: patch.priority ?? before.priority,
      assigned_to_user_id: patch.assignedToUserId ?? before.assigned_to_user_id,
      updated_at: now
    }
    const { data, error } = await sb.from('support_tickets').update(payload).eq('id', id).select('*').single()
    if (error) return 'DB_ERROR'
    return mapSupportTicketFromRow(data)
  }
  const t = supportTicketsMem.find(x => x.id === id)
  if (!t) return 'NOT_FOUND'
  if (patch.status !== undefined) t.status = patch.status as any
  if (patch.priority !== undefined) t.priority = patch.priority as any
  if (patch.assignedToUserId !== undefined) t.assignedToUserId = patch.assignedToUserId
  t.updatedAt = now.getTime()
  return t
}

export async function addSupportComment(input: { ticketId: string, userId: string, body: string }): Promise<SupportComment | 'DB_ERROR'> {
  const now = new Date()
  if (isSupabaseConfigured()) {
    const sb = supabaseServer()
    const { data, error } = await sb.from('support_comments').insert({ ticket_id: input.ticketId, user_id: input.userId, body: input.body, created_at: now }).select('*').single()
    if (error) return 'DB_ERROR'
    return mapSupportCommentFromRow(data)
  }
  const c: SupportComment = { id: newId(), ticketId: input.ticketId, userId: input.userId, body: input.body, createdAt: now.getTime() }
  supportCommentsMem.push(c)
  return c
}

export async function getSupportTicketDetail(id: string): Promise<{ ticket: SupportTicket, comments: SupportComment[] } | 'NOT_FOUND'> {
  if (isSupabaseConfigured()) {
    const sb = supabaseServer()
    const { data: t } = await sb.from('support_tickets').select('*').eq('id', id).limit(1).maybeSingle()
    if (!t) return 'NOT_FOUND'
    const ticket = mapSupportTicketFromRow(t)
    const { data: rows } = await sb.from('support_comments').select('*').eq('ticket_id', id).order('created_at', { ascending: true })
    const comments = (rows || []).map(mapSupportCommentFromRow)
    return { ticket, comments }
  }
  const ticket = supportTicketsMem.find(t => t.id === id)
  if (!ticket) return 'NOT_FOUND'
  const comments = supportCommentsMem.filter(c => c.ticketId === id).slice().sort((a,b)=> a.createdAt - b.createdAt)
  return { ticket, comments }
}

async function ensureDemoSeed() {
  if (isSupabaseConfigured()) return
  if (organizations.length > 0) return
  const org = await createOrganization({
    orgName: 'Demo Org',
    orgLogo: undefined,
    ownerName: 'Demo Owner',
    ownerEmail: 'owner@demo.local',
    billingEmail: 'billing@demo.local',
    subscriptionType: 'monthly',
    pricePerLogin: 5,
    totalLicensedSeats: 50
  }) as Organization
  const eng = await createDepartment({ orgId: org.id, name: 'Engineering' })
  const hr = await createDepartment({ orgId: org.id, name: 'HR' })
  const rOwner = await createRole({ orgId: org.id, name: 'Owner', permissions: ['manage_org','manage_users','manage_reports','manage_settings'] as any })
  const rAdmin = await createRole({ orgId: org.id, name: 'Admin', permissions: ['manage_org','manage_users','manage_reports','manage_settings'] as any })
  const rEmployee = await createRole({ orgId: org.id, name: 'Employee', permissions: [] })
  await createUser({ firstName:'Olivia', lastName:'Owner', email:'olivia.owner@example.com', passwordHash:'demo', roleId:(rOwner as Role).id, orgId: org.id, departmentId:(eng as any).id, positionTitle:'Owner', profileImage: undefined, salary: 9000, workingDays:['Mon','Tue','Wed','Thu','Fri'], workingHoursPerDay: 8, status:'active' })
  await createUser({ firstName:'Alan', lastName:'Admin', email:'alan.admin@example.com', passwordHash:'demo', roleId:(rAdmin as Role).id, orgId: org.id, departmentId:(hr as any).id, positionTitle:'Admin', profileImage: undefined, salary: 7000, workingDays:['Mon','Tue','Wed','Thu','Fri'], workingHoursPerDay: 8, status:'active' })
  await createUser({ firstName:'Eve', lastName:'Employee', email:'eve.employee@example.com', passwordHash:'demo', roleId:(rEmployee as Role).id, orgId: org.id, departmentId:(eng as any).id, positionTitle:'Engineer', profileImage: undefined, salary: 5000, workingDays:['Mon','Tue','Wed','Thu','Fri'], workingHoursPerDay: 8, status:'active' })
}

async function ensureDemoForOrg(orgId: string) {
  if (isSupabaseConfigured()) return
  const existingUsers = users.filter(u => u.orgId === orgId)
  if (existingUsers.length > 0) return
  const org = await getOrganization(orgId)
  if (!org) return
  const depEng = (await listDepartments(orgId)).find(d => d.name === 'Engineering') || await createDepartment({ orgId, name: 'Engineering' }) as any
  const depHR = (await listDepartments(orgId)).find(d => d.name === 'HR') || await createDepartment({ orgId, name: 'HR' }) as any
  const roleOwner = (await listRoles(orgId)).find(r => r.name === 'Owner') || await createRole({ orgId, name: 'Owner', permissions: ['manage_org','manage_users','manage_reports','manage_settings'] as any }) as Role
  const roleAdmin = (await listRoles(orgId)).find(r => r.name === 'Admin') || await createRole({ orgId, name: 'Admin', permissions: ['manage_org','manage_users','manage_reports','manage_settings'] as any }) as Role
  const roleEmployee = (await listRoles(orgId)).find(r => r.name === 'Employee') || await createRole({ orgId, name: 'Employee', permissions: [] }) as Role
  await createUser({ firstName:'Olivia', lastName:'Owner', email:`olivia.owner+${orgId}@example.com`, passwordHash:'demo', roleId:roleOwner.id, orgId: orgId, departmentId:depEng.id, positionTitle:'Owner', profileImage: undefined, salary: 9000, workingDays:['Mon','Tue','Wed','Thu','Fri'], workingHoursPerDay: 8, status:'active' })
  await createUser({ firstName:'Alan', lastName:'Admin', email:`alan.admin+${orgId}@example.com`, passwordHash:'demo', roleId:roleAdmin.id, orgId: orgId, departmentId:depHR.id, positionTitle:'Admin', profileImage: undefined, salary: 7000, workingDays:['Mon','Tue','Wed','Thu','Fri'], workingHoursPerDay: 8, status:'active' })
  await createUser({ firstName:'Eve', lastName:'Employee', email:`eve.employee+${orgId}@example.com`, passwordHash:'demo', roleId:roleEmployee.id, orgId: orgId, departmentId:depEng.id, positionTitle:'Engineer', profileImage: undefined, salary: 5000, workingDays:['Mon','Tue','Wed','Thu','Fri'], workingHoursPerDay: 8, status:'active' })
}

export async function getOpenSession(memberId: string, orgId: string) {
  if (isSupabaseConfigured()) {
    const sb = supabaseServer()
    const { data: sess } = await sb.from('time_sessions').select('*').eq('member_id', memberId).eq('org_id', orgId).eq('status', 'open').order('start_time', { ascending: false }).limit(1).maybeSingle()
    if (!sess) return null
    const { data: br } = await sb.from('break_sessions').select('*').eq('time_session_id', sess.id).is('end_time', null).maybeSingle()
    return { ...mapTimeSessionFromRow(sess), currentBreak: br ? mapBreakSessionFromRow(br) : null }
  }
  const sess = timeSessions.filter(s => s.memberId === memberId && s.orgId === orgId && s.status === 'open').sort((a,b)=>b.startTime-a.startTime)[0]
  if (!sess) return null
  const br = breakSessions.find(b => b.timeSessionId === sess.id && !b.endTime)
  return { ...sess, currentBreak: br }
}

export async function startWorkSession(params: { memberId: string, orgId: string, source: string }) {
  const user = await getUser(params.memberId)
  if (!user || user.orgId !== params.orgId) return 'USER_NOT_IN_ORG'
  if (user.status !== 'active') return 'USER_INACTIVE'
  const now = new Date()
  const today = dateISO(now)
  
  // 12-hour cooldown check
  if (isSupabaseConfigured()) {
    const sb = supabaseServer()
    // Check if there is ANY session started within the last 12 hours
    const { data: last } = await sb.from('time_sessions').select('start_time').eq('member_id', params.memberId).eq('org_id', params.orgId).order('start_time', { ascending: false }).limit(1).maybeSingle()
    if (last) {
      const diff = now.getTime() - new Date(last.start_time).getTime()
      // If last session started less than 12 hours ago, prevent new check-in
      // NOTE: If the last session is still OPEN, this logic would also block it, but we handle "openExisting" below.
      // However, if we want to allow re-returning the EXISTING open session, we should check that first.
    }
  }

  if (isSupabaseConfigured()) {
    const sb = supabaseServer()
    const { data: openRow } = await sb.from('time_sessions').select('*').eq('member_id', params.memberId).eq('org_id', params.orgId).eq('status', 'open').order('start_time', { ascending: false }).limit(1).maybeSingle()
    if (openRow) return mapTimeSessionFromRow(openRow)

    // Check cooldown only if no open session exists
    const { data: last } = await sb.from('time_sessions').select('start_time').eq('member_id', params.memberId).eq('org_id', params.orgId).order('start_time', { ascending: false }).limit(1).maybeSingle()
    if (last) {
      const diff = now.getTime() - new Date(last.start_time).getTime()
      if (diff < 12 * 60 * 60 * 1000) return 'CHECKIN_COOLDOWN'
    }

    const payload = { member_id: params.memberId, org_id: params.orgId, date: today, start_time: now, end_time: null, source: params.source, status: 'open', total_minutes: null, created_at: now, updated_at: now }
    const { data, error } = await sb.from('time_sessions').insert(payload).select('*').single()
    if (error) return 'DB_ERROR'
    const out = mapTimeSessionFromRow(data)
    try { const { queueWebhookEvent } = await import('@lib/webhooks/queue'); await queueWebhookEvent(params.orgId, 'member.check_in', { member_id: params.memberId, org_id: params.orgId, session_id: out.id, started_at: new Date(out.startTime).toISOString() }) } catch {}
    return out
  }
  const openExisting = timeSessions.filter(s => s.memberId === params.memberId && s.orgId === params.orgId && s.status === 'open').sort((a,b)=>b.startTime-a.startTime)[0]
  if (openExisting) return openExisting

  // Check cooldown
  const last = timeSessions.filter(s => s.memberId === params.memberId && s.orgId === params.orgId).sort((a,b)=>b.startTime-a.startTime)[0]
  if (last && (now.getTime() - last.startTime < 12 * 60 * 60 * 1000)) return 'CHECKIN_COOLDOWN'

  const sess: TimeSession = { id: newId(), memberId: params.memberId, orgId: params.orgId, date: today, startTime: now.getTime(), source: params.source, status: 'open', createdAt: now.getTime(), updatedAt: now.getTime() }
  timeSessions.push(sess)
  try { const { queueWebhookEvent } = await import('@lib/webhooks/queue'); await queueWebhookEvent(params.orgId, 'member.check_in', { member_id: params.memberId, org_id: params.orgId, session_id: sess.id, started_at: new Date(sess.startTime).toISOString() }) } catch {}
  return sess
}

export async function stopWorkSession(params: { memberId: string, orgId: string }) {
  const now = new Date()
  const today = dateISO(now)
  if (isSupabaseConfigured()) {
    const sb = supabaseServer()
    const { data: openRow } = await sb.from('time_sessions').select('*').eq('member_id', params.memberId).eq('org_id', params.orgId).eq('status', 'open').order('start_time', { ascending: false }).limit(1).maybeSingle()
    if (!openRow) return 'NO_OPEN_SESSION'
    const start = new Date(openRow.start_time).getTime()
    const total = minutesBetween(start, now.getTime())
    const { data } = await sb.from('time_sessions').update({ end_time: now, status: 'closed', total_minutes: total, updated_at: now }).eq('id', openRow.id).select('*').single()
    const { data: brOpen } = await sb.from('break_sessions').select('*').eq('time_session_id', openRow.id).is('end_time', null)
    for (const b of (brOpen || []) as any[]) {
      const bTotal = minutesBetween(new Date(b.start_time).getTime(), now.getTime())
      await sb.from('break_sessions').update({ end_time: now, total_minutes: bTotal, updated_at: now }).eq('id', b.id)
    }
    if (total > 16 * 60) await sb.from('time_anomalies').insert({ member_id: params.memberId, org_id: params.orgId, date: today, type: 'too_long', details: `Session ${openRow.id} lasted ${total} minutes`, resolved: false, created_at: now, updated_at: now })
    await recomputeDaily(params.memberId, params.orgId, today)
    const out = mapTimeSessionFromRow(data)
    try { const { queueWebhookEvent } = await import('@lib/webhooks/queue'); await queueWebhookEvent(params.orgId, 'member.check_out', { member_id: params.memberId, org_id: params.orgId, session_id: out.id, ended_at: new Date(out.endTime || Date.now()).toISOString(), duration_minutes: out.totalMinutes || total }) } catch {}
    const { count: openCount } = await sb.from('time_sessions').select('*', { count: 'exact', head: true }).eq('member_id', params.memberId).eq('org_id', params.orgId).eq('date', today).eq('status','open')
    if ((openCount || 0) === 0) { try { const { queueWebhookEvent } = await import('@lib/webhooks/queue'); await queueWebhookEvent(params.orgId, 'time.daily_closed', { member_id: params.memberId, org_id: params.orgId, date: today }) } catch {} }
    return out
  }
  const open = timeSessions.filter(s => s.memberId === params.memberId && s.orgId === params.orgId && s.status === 'open').sort((a,b)=>b.startTime-a.startTime)[0]
  if (!open) return 'NO_OPEN_SESSION'
  open.endTime = now.getTime()
  open.totalMinutes = minutesBetween(open.startTime, open.endTime)
  open.status = 'closed'
  open.updatedAt = now.getTime()
  const brs = breakSessions.filter(b => b.timeSessionId === open.id && !b.endTime)
  for (const b of brs) { b.endTime = now.getTime(); b.totalMinutes = minutesBetween(b.startTime, b.endTime); b.updatedAt = now.getTime() }
  if ((open.totalMinutes || 0) > 16 * 60) anomalies.push({ id: newId(), memberId: params.memberId, orgId: params.orgId, date: today, type: 'too_long', details: `Session ${open.id} lasted ${open.totalMinutes} minutes`, resolved: false, createdAt: now.getTime(), updatedAt: now.getTime() })
  await recomputeDaily(params.memberId, params.orgId, today)
  try { const { queueWebhookEvent } = await import('@lib/webhooks/queue'); await queueWebhookEvent(params.orgId, 'member.check_out', { member_id: params.memberId, org_id: params.orgId, session_id: open.id, ended_at: new Date(open.endTime!).toISOString(), duration_minutes: open.totalMinutes }) } catch {}
  const hasOpen = timeSessions.some(s => s.memberId === params.memberId && s.orgId === params.orgId && s.date === today && s.status === 'open')
  if (!hasOpen) { try { const { queueWebhookEvent } = await import('@lib/webhooks/queue'); await queueWebhookEvent(params.orgId, 'time.daily_closed', { member_id: params.memberId, org_id: params.orgId, date: today }) } catch {} }
  return open
}

export async function startBreak(params: { timeSessionId?: string, memberId: string, orgId: string, breakRuleId?: string, label?: string }) {
  const now = new Date()
  const sb = isSupabaseConfigured() ? supabaseServer() : null
  if (params.timeSessionId) {
    // ensure session open
    if (sb) {
      const { data: sess } = await sb!.from('time_sessions').select('*').eq('id', params.timeSessionId).single()
      if (!sess || sess.status !== 'open') return 'SESSION_NOT_OPEN'
      const { data: openBreaks } = await sb!.from('break_sessions').select('id').eq('time_session_id', params.timeSessionId).is('end_time', null)
      if ((openBreaks || []).length > 0) return 'BREAK_ALREADY_OPEN'
      const payload = { time_session_id: params.timeSessionId, break_rule_id: params.breakRuleId ?? null, label: params.label ?? 'Break', start_time: now, end_time: null, total_minutes: null, is_paid: false, created_at: now, updated_at: now }
      const { data, error } = await sb!.from('break_sessions').insert(payload).select('*').single()
      if (error) return 'DB_ERROR'
      return mapBreakSessionFromRow(data)
    }
    const sess = timeSessions.find(s => s.id === params.timeSessionId)
    if (!sess || sess.status !== 'open') return 'SESSION_NOT_OPEN'
    const hasOpen = breakSessions.some(b => b.timeSessionId === params.timeSessionId && !b.endTime)
    if (hasOpen) return 'BREAK_ALREADY_OPEN'
    const b: BreakSession = { id: newId(), timeSessionId: params.timeSessionId, breakRuleId: params.breakRuleId, label: params.label ?? 'Break', startTime: now.getTime(), isPaid: false, createdAt: now.getTime(), updatedAt: now.getTime() }
    breakSessions.push(b)
    return b
  }
  // infer session by member/org
  if (sb) {
    const { data: openSess } = await sb!.from('time_sessions').select('*').eq('member_id', params.memberId).eq('org_id', params.orgId).eq('status', 'open').order('start_time', { ascending: false }).limit(1).maybeSingle()
    if (!openSess) return 'NO_OPEN_SESSION'
    const { data: openBreaks } = await sb!.from('break_sessions').select('id').eq('time_session_id', openSess.id).is('end_time', null)
    if ((openBreaks || []).length > 0) return 'BREAK_ALREADY_OPEN'
    const payload = { time_session_id: openSess.id, break_rule_id: params.breakRuleId ?? null, label: params.label ?? 'Break', start_time: now, end_time: null, total_minutes: null, is_paid: false, created_at: now, updated_at: now }
    const { data, error } = await sb!.from('break_sessions').insert(payload).select('*').single()
    if (error) return 'DB_ERROR'
    return mapBreakSessionFromRow(data)
  }
  const openSess = timeSessions.filter(s => s.memberId === params.memberId && s.orgId === params.orgId && s.status === 'open').sort((a,b)=>b.startTime-a.startTime)[0]
  if (!openSess) return 'NO_OPEN_SESSION'
  const hasOpen = breakSessions.some(b => b.timeSessionId === openSess.id && !b.endTime)
  if (hasOpen) return 'BREAK_ALREADY_OPEN'
  const b: BreakSession = { id: newId(), timeSessionId: openSess.id, breakRuleId: params.breakRuleId, label: params.label ?? 'Break', startTime: now.getTime(), isPaid: false, createdAt: now.getTime(), updatedAt: now.getTime() }
  breakSessions.push(b)
  return b
}

export async function stopBreak(params: { timeSessionId?: string, memberId?: string, orgId?: string }) {
  const now = new Date()
  const sb = isSupabaseConfigured() ? supabaseServer() : null
  if (sb) {
    let sessionId = params.timeSessionId
    if (!sessionId) {
      const { data: sess } = await sb!.from('time_sessions').select('*').eq('member_id', params.memberId!).eq('org_id', params.orgId!).eq('status', 'open').order('start_time', { ascending: false }).limit(1).maybeSingle()
      if (!sess) return 'NO_OPEN_SESSION'
      sessionId = sess.id
    }
    const { data: br } = await sb!.from('break_sessions').select('*').eq('time_session_id', sessionId!).is('end_time', null).order('start_time', { ascending: false }).limit(1).maybeSingle()
    if (!br) return 'NO_OPEN_BREAK'
    const total = minutesBetween(new Date(br.start_time).getTime(), now.getTime())
    const { data } = await sb!.from('break_sessions').update({ end_time: now, total_minutes: total, updated_at: now }).eq('id', br.id).select('*').single()
    const day = dateISO(now)
    const { data: sessRow } = await sb!.from('time_sessions').select('*').eq('id', sessionId!).single()
    await recomputeDaily(sessRow.member_id, sessRow.org_id, day)
    return mapBreakSessionFromRow(data)
  }
  let sessionId = params.timeSessionId
  if (!sessionId) {
    const openSess = timeSessions.filter(s => s.memberId === params.memberId && s.orgId === params.orgId && s.status === 'open').sort((a,b)=>b.startTime-a.startTime)[0]
    if (!openSess) return 'NO_OPEN_SESSION'
    sessionId = openSess.id
  }
  const br = breakSessions.filter(b => b.timeSessionId === sessionId && !b.endTime).sort((a,b)=>b.startTime-a.startTime)[0]
  if (!br) return 'NO_OPEN_BREAK'
  br.endTime = now.getTime()
  br.totalMinutes = minutesBetween(br.startTime, br.endTime)
  br.updatedAt = now.getTime()
  const sess = timeSessions.find(s => s.id === sessionId)!
  await recomputeDaily(sess.memberId, sess.orgId, dateISO(now))
  return br
}

export async function getTodaySummary(input: { memberId: string, orgId: string }) {
  const now = new Date()
  const today = dateISO(now)
  const daily = await recomputeDaily(input.memberId, input.orgId, today)
  if (isSupabaseConfigured()) {
    const sb = supabaseServer()
    const { data: sessRows } = await sb.from('time_sessions').select('*').eq('member_id', input.memberId).eq('org_id', input.orgId).eq('date', today).order('start_time', { ascending: true })
    const { data: brRows } = await sb.from('break_sessions').select('*').in('time_session_id', (sessRows || []).map((r: any) => r.id)).order('start_time', { ascending: true })
    const openSession = (sessRows || []).find((r: any) => r.status === 'open')
    const openBreak = (brRows || []).find((r: any) => r.end_time === null)
    return {
      today_hours: formatHM(daily.worked),
      extra_time: daily.extra ? `+${formatHM(daily.extra)}` : '+00:00',
      short_time: daily.short ? `-${formatHM(daily.short)}` : '-00:00',
      session: openSession ? mapTimeSessionFromRow(openSession) : null,
      break: openBreak ? mapBreakSessionFromRow(openBreak) : null,
      sessions: (sessRows || []).map(mapTimeSessionFromRow),
      breaks: (brRows || []).map(mapBreakSessionFromRow)
    }
  }
  const sessions = timeSessions.filter(s => s.memberId === input.memberId && s.orgId === input.orgId && s.date === today).sort((a,b)=>a.startTime-b.startTime)
  const breaks = breakSessions.filter(b => sessions.some(s => s.id === b.timeSessionId)).sort((a,b)=>a.startTime-b.startTime)
  const openSession = sessions.find(s => s.status === 'open') || null
  const openBreak = breaks.find(b => !b.endTime) || null
  return {
    today_hours: formatHM(daily.worked),
    extra_time: daily.extra ? `+${formatHM(daily.extra)}` : '+00:00',
    short_time: daily.short ? `-${formatHM(daily.short)}` : '-00:00',
    session: openSession,
    break: openBreak,
    sessions,
    breaks
  }
}

export async function listDailyLogs(input: { orgId: string, date: string, memberId?: string }) {
  if (isSupabaseConfigured()) {
    const sb = supabaseServer()
    const q = sb.from('daily_time_summaries').select('*').eq('org_id', input.orgId).eq('date', input.date)
    const { data: summaries } = input.memberId ? await q.eq('member_id', input.memberId) : await q
    const { data: sessions } = await sb.from('time_sessions').select('*').eq('org_id', input.orgId).eq('date', input.date)
    const sessIds = (sessions || []).map((r: any) => r.id)
    const { data: breaks } = await sb.from('break_sessions').select('*').in('time_session_id', sessIds)
    return {
      summaries: (summaries || []).map(mapDailySummaryFromRow),
      sessions: (sessions || []).map(mapTimeSessionFromRow),
      breaks: (breaks || []).map(mapBreakSessionFromRow)
    }
  }
  const summaries = dailySummaries.filter(d => d.orgId === input.orgId && d.date === input.date && (!input.memberId || d.memberId === input.memberId))
  const sessions = timeSessions.filter(s => s.orgId === input.orgId && s.date === input.date && (!input.memberId || s.memberId === input.memberId))
  const breaks = breakSessions.filter(b => sessions.some(s => s.id === b.timeSessionId))
  return { summaries, sessions, breaks }
}

export async function createTimesheetChangeRequest(input: { orgId: string, memberId: string, requestedBy: string, reason: string, items: Array<{ targetDate: string, originalStart?: number, originalEnd?: number, originalMinutes?: number, newStart?: number, newEnd?: number, newMinutes?: number, note?: string }> }) {
  const now = new Date()
  if (isSupabaseConfigured()) {
    const sb = supabaseServer()
    const { data: req, error: reqErr } = await sb.from('timesheet_change_requests').insert({ org_id: input.orgId, member_id: input.memberId, requested_by: input.requestedBy, status: 'pending', reason: input.reason, created_at: now, reviewed_at: null, reviewed_by: null }).select('*').single()
    if (reqErr) return 'DB_ERROR'
    const rows = (input.items || []).map(i => ({ change_request_id: req.id, target_date: i.targetDate, original_start: i.originalStart ? new Date(i.originalStart) : null, original_end: i.originalEnd ? new Date(i.originalEnd) : null, original_minutes: i.originalMinutes ?? null, new_start: i.newStart ? new Date(i.newStart) : null, new_end: i.newEnd ? new Date(i.newEnd) : null, new_minutes: i.newMinutes ?? null, note: i.note ?? null }))
    const { error: itemErr } = await sb.from('timesheet_change_items').insert(rows)
    if (itemErr) return 'DB_ERROR'
    await sb.from('timesheet_audit_log').insert({ org_id: input.orgId, member_id: input.memberId, actor_id: input.requestedBy, action_type: 'request', details: { request_id: req.id, reason: input.reason, items: input.items }, created_at: now })
    return { id: req.id }
  }
  return 'SUPABASE_REQUIRED'
}

export async function listTimesheetChangeRequests(params: { orgId: string, status?: 'pending'|'approved'|'rejected', memberId?: string }) {
  if (isSupabaseConfigured()) {
    const sb = supabaseServer()
    let q = sb.from('timesheet_change_requests').select('*').eq('org_id', params.orgId).order('created_at', { ascending: false })
    if (params.status) q = q.eq('status', params.status)
    if (params.memberId) q = q.eq('member_id', params.memberId)
    const { data } = await q
    return (data || []).map((r: any) => ({ id: r.id, orgId: r.org_id, memberId: r.member_id, requestedBy: r.requested_by, status: r.status, reason: r.reason, createdAt: new Date(r.created_at).getTime(), reviewedAt: r.reviewed_at ? new Date(r.reviewed_at).getTime() : undefined, reviewedBy: r.reviewed_by ?? undefined }))
  }
  return 'SUPABASE_REQUIRED'
}

export async function listMyTimesheetChangeRequests(memberId: string) {
  if (isSupabaseConfigured()) {
    const sb = supabaseServer()
    const { data } = await sb.from('timesheet_change_requests').select('*').eq('requested_by', memberId).order('created_at', { ascending: false })
    return (data || []).map((r: any) => ({ id: r.id, orgId: r.org_id, memberId: r.member_id, requestedBy: r.requested_by, status: r.status, reason: r.reason, createdAt: new Date(r.created_at).getTime(), reviewedAt: r.reviewed_at ? new Date(r.reviewed_at).getTime() : undefined, reviewedBy: r.reviewed_by ?? undefined }))
  }
  return 'SUPABASE_REQUIRED'
}

export async function reviewTimesheetChangeRequest(input: { changeRequestId: string, decision: 'approve'|'reject', reviewNote?: string, actorUserId: string }) {
  const now = new Date()
  if (isSupabaseConfigured()) {
    const sb = supabaseServer()
    const { data: row } = await sb.from('timesheet_change_requests').select('*').eq('id', input.changeRequestId).single()
    if (!row) return 'NOT_FOUND'
    const status = input.decision === 'approve' ? 'approved' : 'rejected'
    const { data: updated, error } = await sb.from('timesheet_change_requests').update({ status, reviewed_at: now, reviewed_by: input.actorUserId }).eq('id', input.changeRequestId).select('*').single()
    if (error) return 'DB_ERROR'
    await sb.from('timesheet_audit_log').insert({ org_id: updated.org_id, member_id: updated.member_id, actor_id: input.actorUserId, action_type: input.decision === 'approve' ? 'approve' : 'reject', details: { request_id: input.changeRequestId, note: input.reviewNote || '' }, created_at: now })
    if (input.decision === 'approve') {
      const applyRes = await applyTimesheetCorrections(input.changeRequestId, input.actorUserId)
      if (applyRes !== 'OK') return applyRes
    }
    return 'OK'
  }
  return 'SUPABASE_REQUIRED'
}

export async function applyTimesheetCorrections(changeRequestId: string, actorUserId: string) {
  if (isSupabaseConfigured()) {
    const sb = supabaseServer()
    const { data: req } = await sb.from('timesheet_change_requests').select('*').eq('id', changeRequestId).single()
    if (!req) return 'NOT_FOUND'
    const { data: items } = await sb.from('timesheet_change_items').select('*').eq('change_request_id', changeRequestId)
    for (const it of (items || []) as any[]) {
      const day = it.target_date
      const { data: closed } = await sb.from('time_sessions').select('*').eq('member_id', req.member_id).eq('org_id', req.org_id).eq('date', day).eq('status', 'closed')
      for (const s of (closed || []) as any[]) {
        await sb.from('time_sessions').update({ status: 'cancelled', total_minutes: 0, cancel_reason: 'correction_applied', updated_at: new Date() }).eq('id', s.id)
      }
      const start = it.new_start ? new Date(it.new_start) : (it.original_start ? new Date(it.original_start) : new Date(day + 'T09:00:00'))
      const end = it.new_end ? new Date(it.new_end) : (it.original_end ? new Date(it.original_end) : new Date(start.getTime() + ((it.new_minutes ?? it.original_minutes ?? 0) * 60000)))
      const total = it.new_minutes ?? (end.getTime() - start.getTime()) / 60000
      const now = new Date()
      const payload = { member_id: req.member_id, org_id: req.org_id, date: day, start_time: start, end_time: end, source: 'correction', status: 'closed', total_minutes: Math.round(total), created_at: now, updated_at: now }
      await sb.from('time_sessions').insert(payload)
      await recomputeDaily(req.member_id, req.org_id, day)
      await sb.from('timesheet_audit_log').insert({ org_id: req.org_id, member_id: req.member_id, actor_id: actorUserId, action_type: 'apply', details: { request_id: changeRequestId, date: day, applied_minutes: Math.round(total) }, created_at: new Date() })
    }
    return 'OK'
  }
  return 'SUPABASE_REQUIRED'
}

export async function listTimesheetAudit(memberId: string, date?: string) {
  if (isSupabaseConfigured()) {
    const sb = supabaseServer()
    let q = sb.from('timesheet_audit_log').select('*').eq('member_id', memberId)
    const { data } = await q
    const arr = (data || []).map((r: any) => ({ id: r.id, orgId: r.org_id, memberId: r.member_id, actorId: r.actor_id, actionType: r.action_type, details: r.details, createdAt: new Date(r.created_at).getTime() }))
    return date ? arr.filter(a => String(a.details?.date || a.details?.items?.[0]?.targetDate || '') === date) : arr
  }
  return 'SUPABASE_REQUIRED'
}

function formatHM(mins: number) {
  const m = Math.max(0, Math.round(mins))
  const h = Math.floor(m / 60)
  const mm = String(m % 60).padStart(2, '0')
  return `${h}:${mm}`
}

function mapTimeSessionFromRow(row: any): TimeSession {
  return {
    id: row.id,
    memberId: row.member_id,
    orgId: row.org_id,
    date: row.date,
    startTime: new Date(row.start_time).getTime(),
    endTime: row.end_time ? new Date(row.end_time).getTime() : undefined,
    source: row.source,
    status: row.status,
    totalMinutes: row.total_minutes === null ? undefined : Number(row.total_minutes),
    cancelReason: row.cancel_reason ?? undefined,
    createdAt: new Date(row.created_at).getTime(),
    updatedAt: new Date(row.updated_at).getTime()
  }
}

function mapBreakSessionFromRow(row: any): BreakSession {
  return {
    id: row.id,
    timeSessionId: row.time_session_id,
    breakRuleId: row.break_rule_id ?? undefined,
    label: row.label,
    startTime: new Date(row.start_time).getTime(),
    endTime: row.end_time ? new Date(row.end_time).getTime() : undefined,
    totalMinutes: row.total_minutes === null ? undefined : Number(row.total_minutes),
    isPaid: !!row.is_paid,
    createdAt: new Date(row.created_at).getTime(),
    updatedAt: new Date(row.updated_at).getTime()
  }
}

function mapDailySummaryFromRow(row: any): DailyTimeSummary {
  return {
    id: row.id,
    memberId: row.member_id,
    orgId: row.org_id,
    date: row.date,
    workPatternId: row.work_pattern_id ?? undefined,
    scheduledMinutes: Number(row.scheduled_minutes || 0),
    workedMinutes: Number(row.worked_minutes || 0),
    paidBreakMinutes: Number(row.paid_break_minutes || 0),
    unpaidBreakMinutes: Number(row.unpaid_break_minutes || 0),
    extraMinutes: Number(row.extra_minutes || 0),
    shortMinutes: Number(row.short_minutes || 0),
    status: row.status,
    isHoliday: !!row.is_holiday,
    createdAt: new Date(row.created_at).getTime(),
    updatedAt: new Date(row.updated_at).getTime()
  }
}

export async function createOrganization(input: Omit<Organization, 'id'|'createdAt'|'updatedAt'|'usedSeats'>) {
  if (isSupabaseConfigured()) {
    const sb = supabaseServer()
    const now = new Date()
    const payload = {
      org_name: input.orgName,
      org_logo: input.orgLogo ?? null,
      theme_bg_main: input.themeBgMain ?? null,
      theme_accent: input.themeAccent ?? null,
      layout_type: input.layoutType ?? null,
      owner_name: input.ownerName,
      owner_email: input.ownerEmail,
      billing_email: input.billingEmail,
      subscription_type: input.subscriptionType,
      price_per_login: input.pricePerLogin,
      total_licensed_seats: input.totalLicensedSeats,
      used_seats: 0,
      created_at: now,
      updated_at: now
    }
    const { data, error } = await sb.from('organizations').insert(payload).select('*').single()
    if (error) return 'DB_ERROR'
    return mapOrgFromRow(data)
  }
  const id = newId()
  const now = Date.now()
  const org: Organization = { ...input, id, createdAt: now, updatedAt: now, usedSeats: 0 }
  organizations.push(org)
  return org
}

export async function listOrganizations() {
  if (isSupabaseConfigured()) {
    const sb = supabaseServer()
    const { data, error } = await sb.from('organizations').select('*').order('created_at', { ascending: false })
    if (error) return []
    return data.map(mapOrgFromRow)
  }
  await ensureDemoSeed()
  return organizations
}

export async function listUserOrganizations(userId: string): Promise<Organization[]> {
  if (isSupabaseConfigured()) {
    const sb = supabaseServer()
    const { data } = await sb.from('org_memberships').select('org_id').eq('user_id', userId)
    const orgIds = (data || []).map((r: any) => String(r.org_id))
    if (!orgIds.length) {
      const { data: u } = await sb.from('users').select('org_id').eq('id', userId).limit(1).maybeSingle()
      if (u?.org_id) orgIds.push(String(u.org_id))
    }
    const out: Organization[] = []
    for (const id of orgIds) {
      const o = await getOrganization(id)
      if (o) out.push(o)
    }
    return out
  }
  const direct = users.find(u => u.id === userId)?.orgId
  const ids = new Set<string>(orgMembershipsMem.filter(m => m.userId === userId).map(m => m.orgId))
  if (direct) ids.add(direct)
  return Array.from(ids.values()).map(id => organizations.find(o => o.id === id)).filter((o): o is Organization => !!o)
}

export async function addOrgMembership(userId: string, orgId: string, role: OrgMembership['role']): Promise<'OK'|'DB_ERROR'|'ORG_NOT_FOUND'|'USER_NOT_FOUND'|'DUPLICATE'> {
  const org = await getOrganization(orgId)
  if (!org) return 'ORG_NOT_FOUND'
  const user = await getUser(userId)
  if (!user) return 'USER_NOT_FOUND'
  if (isSupabaseConfigured()) {
    const sb = supabaseServer()
    const { count } = await sb.from('org_memberships').select('*', { count: 'exact', head: true }).eq('user_id', userId).eq('org_id', orgId)
    if ((count || 0) > 0) return 'DUPLICATE'
    const now = new Date()
    const { error } = await sb.from('org_memberships').insert({ user_id: userId, org_id: orgId, role, created_at: now })
    if (error) return 'DB_ERROR'
    return 'OK'
  }
  if (orgMembershipsMem.some(m => m.userId === userId && m.orgId === orgId)) return 'DUPLICATE'
  orgMembershipsMem.push({ id: newId(), userId, orgId, role, createdAt: Date.now() })
  return 'OK'
}

export async function isSuperAdmin(userId: string): Promise<boolean> {
  if (isSupabaseConfigured()) {
    const sb = supabaseServer()
    const { data } = await sb.from('users').select('is_super_admin').eq('id', userId).limit(1).maybeSingle()
    return !!(data && data.is_super_admin)
  }
  return superAdminsMem.has(userId)
}

export async function getOrganization(id: string) {
  if (isSupabaseConfigured()) {
    const sb = supabaseServer()
    const { data, error } = await sb.from('organizations').select('*').eq('id', id).single()
    if (error || !data) return undefined
    return mapOrgFromRow(data)
  }
  return organizations.find(o => o.id === id)
}

export async function updateOrganization(id: string, patch: Partial<Organization>) {
  if (isSupabaseConfigured()) {
    const org = await getOrganization(id)
    if (!org) return undefined
    if (patch.totalLicensedSeats !== undefined && !canReduceSeats(org, patch.totalLicensedSeats)) return 'SEAT_LIMIT_BELOW_USED'
    const sb = supabaseServer()
    const { data, error } = await sb.from('organizations').update({
      org_name: patch.orgName ?? org.orgName,
      org_logo: patch.orgLogo ?? org.orgLogo ?? null,
      theme_bg_main: patch.themeBgMain ?? org.themeBgMain ?? null,
      theme_accent: patch.themeAccent ?? org.themeAccent ?? null,
      layout_type: patch.layoutType ?? org.layoutType ?? null,
      owner_name: patch.ownerName ?? org.ownerName,
      owner_email: patch.ownerEmail ?? org.ownerEmail,
      billing_email: patch.billingEmail ?? org.billingEmail,
      subscription_type: patch.subscriptionType ?? org.subscriptionType,
      price_per_login: patch.pricePerLogin ?? org.pricePerLogin,
      total_licensed_seats: patch.totalLicensedSeats ?? org.totalLicensedSeats,
      used_seats: org.usedSeats,
      updated_at: new Date()
    }).eq('id', id).select('*').single()
    if (error) return 'DB_ERROR'
    return mapOrgFromRow(data)
  }
  const org = organizations.find(o => o.id === id)
  if (!org) return undefined
  if (patch.totalLicensedSeats !== undefined && !canReduceSeats(org, patch.totalLicensedSeats)) return 'SEAT_LIMIT_BELOW_USED'
  Object.assign(org, patch)
  org.updatedAt = Date.now()
  return org
}

export async function createInvite(params: { invitedEmail: string, orgId: string, invitedBy: string, role: string, assignSeat: boolean }) {
  if (isSupabaseConfigured()) {
    const org = await getOrganization(params.orgId)
    if (!org) return 'ORG_NOT_FOUND'
    if (params.assignSeat && !canConsumeSeat(org)) return 'SEATS_EXHAUSTED'
    const sb = supabaseServer()
    const now = new Date()
    const expires = new Date(now.getTime() + inviteWindowHours() * 60 * 60 * 1000)
    const token = newToken()
    const { data, error } = await sb.from('organization_invites').insert({
      invited_email: params.invitedEmail,
      org_id: params.orgId,
      invited_by: params.invitedBy,
      role: params.role,
      invite_status: 'pending',
      created_at: now,
      expires_at: expires,
      token,
      assign_seat: params.assignSeat
    }).select('*').single()
    if (error) return 'DB_ERROR'
    return mapInviteFromRow(data)
  }
  const org = organizations.find(o => o.id === params.orgId)
  if (!org) return 'ORG_NOT_FOUND'
  if (params.assignSeat && !canConsumeSeat(org)) return 'SEATS_EXHAUSTED'
  const id = newId()
  const token = newToken()
  const now = Date.now()
  const expiresAt = now + inviteWindowHours() * 60 * 60 * 1000
  const invite: OrganizationInvite = { id, token, createdAt: now, expiresAt, inviteStatus: 'pending', orgId: params.orgId, invitedEmail: params.invitedEmail, invitedBy: params.invitedBy, role: params.role, assignSeat: params.assignSeat }
  invites.push(invite)
  return invite
}

export async function listInvites(orgId: string) {
  if (isSupabaseConfigured()) {
    const sb = supabaseServer()
    const { data, error } = await sb.from('organization_invites').select('*').eq('org_id', orgId).order('created_at', { ascending: false })
    if (error) return []
    return data.map(mapInviteFromRow)
  }
  return invites.filter(i => i.orgId === orgId)
}

export async function acceptInvite(token: string, grantPermissions: boolean) {
  if (isSupabaseConfigured()) {
    const sb = supabaseServer()
    const { data: invRow, error } = await sb.from('organization_invites').select('*').eq('token', token).single()
    if (error || !invRow) return 'INVITE_NOT_FOUND'
    const inv = mapInviteFromRow(invRow)
    if (isInviteExpired(inv) || inv.inviteStatus !== 'pending') return 'INVITE_INVALID'
    if (!grantPermissions) {
      const { data } = await sb.from('organization_invites').update({ invite_status: 'revoked' }).eq('id', inv.id).select('*').single()
      return mapInviteFromRow(data)
    }
    const org = await getOrganization(inv.orgId)
    if (!org) return 'ORG_NOT_FOUND'
    if (inv.assignSeat) {
      if (!canConsumeSeat(org)) return 'SEATS_EXHAUSTED'
      await sb.rpc('increment_used_seats', { org: org.id })
    }
    const { data: updated } = await sb.from('organization_invites').update({ invite_status: 'accepted' }).eq('id', inv.id).select('*').single()
    return mapInviteFromRow(updated)
  }
  const inv = invites.find(i => i.token === token)
  if (!inv) return 'INVITE_NOT_FOUND'
  if (isInviteExpired(inv) || inv.inviteStatus !== 'pending') return 'INVITE_INVALID'
  if (!grantPermissions) {
    inv.inviteStatus = 'revoked'
    return inv
  }
  const org = organizations.find(o => o.id === inv.orgId)
  if (!org) return 'ORG_NOT_FOUND'
  if (inv.assignSeat) {
    if (!canConsumeSeat(org)) return 'SEATS_EXHAUSTED'
    org.usedSeats += 1
    org.updatedAt = Date.now()
  }
  inv.inviteStatus = 'accepted'
  return inv
}

export async function rejectInvite(token: string) {
  if (isSupabaseConfigured()) {
    const sb = supabaseServer()
    const { data: invRow, error } = await sb.from('organization_invites').select('*').eq('token', token).single()
    if (error || !invRow) return 'INVITE_NOT_FOUND'
    const inv = mapInviteFromRow(invRow)
    if (isInviteExpired(inv) || inv.inviteStatus !== 'pending') return 'INVITE_INVALID'
    const { data } = await sb.from('organization_invites').update({ invite_status: 'revoked' }).eq('id', inv.id).select('*').single()
    return mapInviteFromRow(data)
  }
  const inv = invites.find(i => i.token === token)
  if (!inv) return 'INVITE_NOT_FOUND'
  if (isInviteExpired(inv) || inv.inviteStatus !== 'pending') return 'INVITE_INVALID'
  inv.inviteStatus = 'revoked'
  return inv
}

export async function createOrgCreationInvite(params: { invitedEmail?: string, createdBy?: string }): Promise<{ token: string } | 'DB_ERROR'> {
  const now = new Date()
  const expires = new Date(now.getTime() + inviteWindowHours() * 60 * 60 * 1000)
  const token = newToken()
  if (isSupabaseConfigured()) {
    const sb = supabaseServer()
    const { error } = await sb.from('org_creation_invites').insert({ token, invited_email: params.invitedEmail ?? null, created_by: params.createdBy ?? null, status: 'pending', expires_at: expires, created_at: now })
    if (!error) return { token }
    // Fallback to memory if table not present or insert fails
  }
  const base: OrgCreationInvite = { id: newId(), token, invitedEmail: params.invitedEmail, createdBy: params.createdBy, status: 'pending', expiresAt: expires.getTime(), createdAt: now.getTime() }
  orgCreationInvitesMem.push(base)
  return { token }
}

export async function getOrgCreationInvite(token: string): Promise<OrgCreationInvite | 'INVITE_NOT_FOUND' | 'INVITE_INVALID'> {
  if (isSupabaseConfigured()) {
    const sb = supabaseServer()
    const { data, error } = await sb.from('org_creation_invites').select('*').eq('token', token).maybeSingle()
    if (data && !error) {
      const row = data
      const inv: OrgCreationInvite = { id: String(row.id), token: String(row.token), invitedEmail: row.invited_email || undefined, createdBy: row.created_by || undefined, status: String(row.status) as any, expiresAt: new Date(row.expires_at).getTime(), createdAt: new Date(row.created_at).getTime() }
      if (Date.now() > inv.expiresAt || inv.status !== 'pending') return 'INVITE_INVALID'
      return inv
    }
    // Fallback to memory if table not present or query fails
  }
  const inv = orgCreationInvitesMem.find(i => i.token === token)
  if (!inv) return 'INVITE_NOT_FOUND'
  if (Date.now() > inv.expiresAt || inv.status !== 'pending') return 'INVITE_INVALID'
  return inv
}

export async function consumeOrgCreationInvite(token: string): Promise<'OK' | 'INVITE_NOT_FOUND' | 'INVITE_INVALID' | 'DB_ERROR'> {
  if (isSupabaseConfigured()) {
    const sb = supabaseServer()
    const { data, error } = await sb.from('org_creation_invites').select('*').eq('token', token).maybeSingle()
    if (data && !error) {
      const status = String(data.status || '')
      const expiresAt = new Date(data.expires_at).getTime()
      if (Date.now() > expiresAt || status !== 'pending') return 'INVITE_INVALID'
      const { error: upErr } = await sb.from('org_creation_invites').update({ status: 'used' }).eq('id', data.id)
      if (upErr) return 'DB_ERROR'
      return 'OK'
    }
    // Fallback to memory if table not present or query fails
  }
  const inv = orgCreationInvitesMem.find(i => i.token === token)
  if (!inv) return 'INVITE_NOT_FOUND'
  if (Date.now() > inv.expiresAt || inv.status !== 'pending') return 'INVITE_INVALID'
  inv.status = 'used'
  return 'OK'
}

export async function getSettings() {
  if (isSupabaseConfigured()) {
    const sb = supabaseServer()
    const { data } = await sb.from('saas_settings').select('*').eq('id', 'saas').single()
    if (!data) return settings
    return { id: data.id, defaultSeatPrice: Number(data.default_seat_price), defaultSeatLimit: Number(data.default_seat_limit), landingPageInviteEnabled: !!data.landing_page_invite_enabled }
  }
  return settings
}

function mapPrivacyFromRow(row: any): MemberPrivacySettings {
  return {
    id: row.id,
    memberId: row.member_id,
    orgId: row.org_id,
    allowActivityTracking: !!row.allow_activity_tracking,
    allowScreenshots: !!row.allow_screenshots,
    maskPersonalWindows: !!row.mask_personal_windows,
    lastUpdatedBy: row.last_updated_by ?? undefined,
    updatedAt: new Date(row.updated_at).getTime()
  }
}

function mapTrackingFromRow(row: any): TrackingSession {
  return {
    id: row.id,
    timeSessionId: row.time_session_id,
    memberId: row.member_id,
    orgId: row.org_id,
    startedAt: new Date(row.started_at).getTime(),
    endedAt: row.ended_at ? new Date(row.ended_at).getTime() : undefined,
    consentGiven: !!row.consent_given,
    consentText: row.consent_text ?? undefined,
    createdAt: new Date(row.created_at).getTime()
  }
}

function normalizeUrl(u?: string) {
  if (!u) return undefined
  try {
    const url = new URL(u)
    return `${url.protocol}//${url.host}${url.pathname}`
  } catch {
    return u.split('?')[0].split('#')[0]
  }
}

function aliasMatches(ev: { appName: string, windowTitle?: string, url?: string }, a: ActivityAppAlias) {
  const target = `${ev.appName} ${ev.windowTitle || ''} ${ev.url || ''}`.toLowerCase()
  const patt = a.pattern.toLowerCase()
  if (a.matchType === 'contains') return target.includes(patt)
  if (a.matchType === 'equals') return target === patt
  try { if (a.matchType === 'regex') return new RegExp(a.pattern, 'i').test(target) } catch {}
  return false
}

async function listAliases(orgId: string): Promise<ActivityAppAlias[]> {
  if (isSupabaseConfigured()) {
    const sb = supabaseServer()
    const { data: rows } = await sb.from('activity_app_aliases').select('*').or(`org_id.is.null,org_id.eq.${orgId}`)
    return (rows || []).map(r => ({ id: r.id, orgId: r.org_id ?? undefined, matchType: r.match_type, pattern: r.pattern, category: r.category, label: r.label, createdAt: new Date(r.created_at).getTime(), updatedAt: new Date(r.updated_at).getTime() }))
  }
  return activityAliases.filter(a => !a.orgId || a.orgId === orgId)
}

export async function ingestActivityBatch(input: { trackingSessionId: string, events: { timestamp: number, app_name: string, window_title: string, url?: string, is_active: boolean, keyboard_activity_score?: number, mouse_activity_score?: number }[] }) {
  const sb = isSupabaseConfigured() ? supabaseServer() : null
  if (sb) {
    const { data: ts } = await sb!.from('tracking_sessions').select('*').eq('id', input.trackingSessionId).single()
    if (!ts || ts.consent_given !== true || ts.ended_at) return 'TRACKING_NOT_ALLOWED'
    const priv = await getPrivacySettings(ts.member_id, ts.org_id)
    if (!priv.allowActivityTracking) return 'TRACKING_DISABLED'
    const aliases = await listAliases(ts.org_id)
    const rows = input.events.map(e => {
      const appName = (e.app_name || '').trim()
      const windowTitle = (e.window_title || '').trim()
      const url = normalizeUrl(e.url)
      const match = aliases.find(a => aliasMatches({ appName, windowTitle, url }, a))
      return {
        tracking_session_id: ts.id,
        timestamp: new Date(e.timestamp),
        app_name: appName,
        window_title: windowTitle,
        url: url ?? null,
        category: match ? match.category : null,
        is_active: !!e.is_active,
        keyboard_activity_score: e.keyboard_activity_score ?? null,
        mouse_activity_score: e.mouse_activity_score ?? null,
        created_at: new Date()
      }
    })
    const { error } = await sb!.from('activity_events').insert(rows)
    if (error) return 'DB_ERROR'
    return { inserted: rows.length }
  }
  const ts = trackingSessions.find(t => t.id === input.trackingSessionId)
  if (!ts || ts.consentGiven !== true || ts.endedAt) return 'TRACKING_NOT_ALLOWED'
  const priv = await getPrivacySettings(ts.memberId, ts.orgId)
  if (!priv.allowActivityTracking) return 'TRACKING_DISABLED'
  const aliases = await listAliases(ts.orgId)
  for (const e of input.events) {
    const appName = (e.app_name || '').trim()
    const windowTitle = (e.window_title || '').trim()
    const url = normalizeUrl(e.url)
    const match = aliases.find(a => aliasMatches({ appName, windowTitle, url }, a))
    const ev: ActivityEvent = {
      id: newId(),
      trackingSessionId: ts.id,
      timestamp: e.timestamp,
      appName,
      windowTitle,
      url,
      category: match?.category,
      isActive: !!e.is_active,
      keyboardActivityScore: e.keyboard_activity_score,
      mouseActivityScore: e.mouse_activity_score,
      createdAt: Date.now()
    }
    activityEvents.push(ev)
  }
  return { inserted: input.events.length }
}

export async function ingestScreenshot(input: { trackingSessionId: string, timestamp: number, storagePath?: string, thumbnailPath?: string, imageUrl?: string }) {
  const sb = isSupabaseConfigured() ? supabaseServer() : null
  if (sb) {
    const { data: ts } = await sb!.from('tracking_sessions').select('*').eq('id', input.trackingSessionId).single()
    if (!ts || ts.consent_given !== true || ts.ended_at) return 'TRACKING_NOT_ALLOWED'
    const priv = await getPrivacySettings(ts.member_id, ts.org_id)
    if (!priv.allowScreenshots) return 'SCREENSHOTS_DISABLED'
    const blur = priv.maskPersonalWindows ? 60 : 0
    const wasMasked = !!priv.maskPersonalWindows
    let storage_path = input.storagePath || ''
    let thumbnail_path = input.thumbnailPath || ''
    if (!storage_path && input.imageUrl) {
      const img = input.imageUrl as string
      if (img.startsWith('data:image/png;base64,') || img.startsWith('data:image/jpeg;base64,')) {
        const base64 = img.split(',')[1]
        const buffer = Buffer.from(base64, 'base64')
        const ext = img.includes('jpeg') ? 'jpg' : 'png'
        const key = `${ts.org_id}/${ts.member_id}/${ts.id}/${input.timestamp}.${ext}`
        const up = await sb!.storage.from('screenshots').upload(key, buffer, { contentType: `image/${ext}`, upsert: true, cacheControl: '3600' })
        if (up.error) return 'DB_ERROR'
        const pub = sb!.storage.from('screenshots').getPublicUrl(key)
        storage_path = pub.data.publicUrl
        thumbnail_path = storage_path
      } else {
        storage_path = img
        thumbnail_path = img
      }
    }
    if (!thumbnail_path && storage_path) thumbnail_path = storage_path
    if (!storage_path) return 'MISSING_IMAGE'
    const { data, error } = await sb!.from('screenshots').insert({ tracking_session_id: ts.id, timestamp: new Date(input.timestamp), storage_path, thumbnail_path, blur_level: blur, was_masked: wasMasked, created_at: new Date() }).select('*').single()
    if (error) return 'DB_ERROR'
    return { screenshotId: data.id }
  }
  const ts = trackingSessions.find(t => t.id === input.trackingSessionId)
  if (!ts || ts.consentGiven !== true || ts.endedAt) return 'TRACKING_NOT_ALLOWED'
  const priv = await getPrivacySettings(ts.memberId, ts.orgId)
  if (!priv.allowScreenshots) return 'SCREENSHOTS_DISABLED'
  const blur = priv.maskPersonalWindows ? 60 : 0
  const wasMasked = !!priv.maskPersonalWindows
  const storagePath = input.storagePath || input.imageUrl || ''
  const thumbnailPath = input.thumbnailPath || input.imageUrl || ''
  if (!storagePath) return 'MISSING_IMAGE'
  const s: ScreenshotMeta = { id: newId(), trackingSessionId: ts.id, timestamp: input.timestamp, storagePath, thumbnailPath, blurLevel: blur, wasMasked, createdAt: Date.now() }
  screenshots.push(s)
  return { screenshotId: s.id }
}

export async function listActivityToday(memberId: string, orgId: string) {
  const today = dateISO(new Date())
  const sb = isSupabaseConfigured() ? supabaseServer() : null
  if (sb) {
    const { data: sessRows } = await sb!.from('time_sessions').select('*').eq('member_id', memberId).eq('org_id', orgId).eq('date', today)
    const ids = (sessRows || []).map((r: any) => r.id)
    const { data: tsRows } = await sb!.from('tracking_sessions').select('*').in('time_session_id', ids)
    const tsActive = (tsRows || []).find((r: any) => r.consent_given && !r.ended_at)
    const { data: evRows } = await sb!.from('activity_events').select('*').in('tracking_session_id', (tsRows || []).map((r: any) => r.id))
    const { data: scRows } = await sb!.from('screenshots').select('*').in('tracking_session_id', (tsRows || []).map((r: any) => r.id))
    const settings = await getPrivacySettings(memberId, orgId)
    const store = sb!.storage.from('screenshots')
    function toPublicUrl(p?: string) {
      const s = p || ''
      if (!s) return s
      if (s.startsWith('http://') || s.startsWith('https://') || s.startsWith('data:')) return s
      const pub = store.getPublicUrl(s)
      return pub.data.publicUrl || s
    }
    return {
      trackingOn: !!tsActive,
      settings,
      events: (evRows || []).map(r => ({ id: r.id, trackingSessionId: r.tracking_session_id, timestamp: new Date(r.timestamp).getTime(), appName: r.app_name, windowTitle: r.window_title, url: r.url ?? undefined, category: r.category ?? undefined, isActive: !!r.is_active, keyboardActivityScore: r.keyboard_activity_score ?? undefined, mouseActivityScore: r.mouse_activity_score ?? undefined, createdAt: new Date(r.created_at).getTime() })),
      screenshots: (scRows || []).map(r => ({ id: r.id, trackingSessionId: r.tracking_session_id, timestamp: new Date(r.timestamp).getTime(), storagePath: toPublicUrl(r.storage_path), thumbnailPath: toPublicUrl(r.thumbnail_path), blurLevel: Number(r.blur_level), wasMasked: !!r.was_masked, createdAt: new Date(r.created_at).getTime() }))
    }
  }
  const sessions = timeSessions.filter(s => s.memberId === memberId && s.orgId === orgId && s.date === today)
  const tsRows = trackingSessions.filter(t => sessions.some(s => s.id === t.timeSessionId))
  const tsActive = tsRows.find(t => t.consentGiven && !t.endedAt)
  const settings = await getPrivacySettings(memberId, orgId)
  const evs = activityEvents.filter(e => tsRows.some(t => t.id === e.trackingSessionId))
  const scs = screenshots.filter(s => tsRows.some(t => t.id === s.trackingSessionId))
  return { trackingOn: !!tsActive, settings, events: evs, screenshots: scs }
}

export async function getPrivacySettings(memberId: string, orgId: string): Promise<MemberPrivacySettings> {
  if (isSupabaseConfigured()) {
    const sb = supabaseServer()
    const { data } = await sb.from('member_privacy_settings').select('*').eq('member_id', memberId).eq('org_id', orgId).limit(1).maybeSingle()
    if (!data) return { id: 'default', memberId, orgId, allowActivityTracking: false, allowScreenshots: false, maskPersonalWindows: true, updatedAt: Date.now() }
    return mapPrivacyFromRow(data)
  }
  const existing = privacySettings.find(p => p.memberId === memberId && p.orgId === orgId)
  return existing || { id: 'default', memberId, orgId, allowActivityTracking: false, allowScreenshots: false, maskPersonalWindows: true, updatedAt: Date.now() }
}

export async function updatePrivacySettings(input: { memberId: string, orgId: string, allowActivityTracking: boolean, allowScreenshots: boolean, maskPersonalWindows: boolean, actorUserId?: string }): Promise<MemberPrivacySettings | 'DB_ERROR'> {
  const now = new Date()
  if (isSupabaseConfigured()) {
    const sb = supabaseServer()
    const { data: existing } = await sb.from('member_privacy_settings').select('*').eq('member_id', input.memberId).eq('org_id', input.orgId).limit(1).maybeSingle()
    if (existing) {
      const { data, error } = await sb.from('member_privacy_settings').update({ allow_activity_tracking: input.allowActivityTracking, allow_screenshots: input.allowScreenshots, mask_personal_windows: input.maskPersonalWindows, last_updated_by: input.actorUserId ?? null, updated_at: now }).eq('id', existing.id).select('*').single()
      if (error) return 'DB_ERROR'
      return mapPrivacyFromRow(data)
    } else {
      const { data, error } = await sb.from('member_privacy_settings').insert({ member_id: input.memberId, org_id: input.orgId, allow_activity_tracking: input.allowActivityTracking, allow_screenshots: input.allowScreenshots, mask_personal_windows: input.maskPersonalWindows, last_updated_by: input.actorUserId ?? null, updated_at: now }).select('*').single()
      if (error) return 'DB_ERROR'
      return mapPrivacyFromRow(data)
    }
  }
  const existing = privacySettings.find(p => p.memberId === input.memberId && p.orgId === input.orgId)
  const base: MemberPrivacySettings = existing || { id: newId(), memberId: input.memberId, orgId: input.orgId, allowActivityTracking: false, allowScreenshots: false, maskPersonalWindows: true, updatedAt: Date.now() }
  base.allowActivityTracking = input.allowActivityTracking
  base.allowScreenshots = input.allowScreenshots
  base.maskPersonalWindows = input.maskPersonalWindows
  base.lastUpdatedBy = input.actorUserId
  base.updatedAt = Date.now()
  if (!existing) privacySettings.push(base)
  return base
}

export async function startTracking(input: { timeSessionId?: string, memberId?: string, orgId?: string }) {
  const now = new Date()
  const sb = isSupabaseConfigured() ? supabaseServer() : null
  if (sb) {
    let sessionRow: any
    if (input.timeSessionId) {
      const { data } = await sb!.from('time_sessions').select('*').eq('id', input.timeSessionId).single()
      sessionRow = data
    } else {
      const { data } = await sb!.from('time_sessions').select('*').eq('member_id', input.memberId!).eq('org_id', input.orgId!).eq('status', 'open').order('start_time', { ascending: false }).limit(1).maybeSingle()
      sessionRow = data
    }
    if (!sessionRow || sessionRow.status !== 'open') return { trackingAllowed: false }
    const priv = await getPrivacySettings(sessionRow.member_id, sessionRow.org_id)
    if (!priv.allowActivityTracking) return { trackingAllowed: false }
    const consentText = 'While you are clocked in, MARQ will record active apps/websites and, if enabled, screenshots for work purposes.'
    const { data, error } = await sb!.from('tracking_sessions').insert({ time_session_id: sessionRow.id, member_id: sessionRow.member_id, org_id: sessionRow.org_id, started_at: now, ended_at: null, consent_given: false, consent_text: consentText, created_at: now }).select('*').single()
    if (error) return 'DB_ERROR'
    return { trackingAllowed: true, trackingSessionId: data.id, consentRequired: true, consentText }
  }
  let sess: TimeSession | undefined
  if (input.timeSessionId) sess = timeSessions.find(s => s.id === input.timeSessionId)
  else sess = timeSessions.filter(s => s.memberId === input.memberId && s.orgId === input.orgId && s.status === 'open').sort((a,b)=>b.startTime-a.startTime)[0]
  if (!sess || sess.status !== 'open') return { trackingAllowed: false }
  const priv = await getPrivacySettings(sess.memberId, sess.orgId)
  if (!priv.allowActivityTracking) return { trackingAllowed: false }
  const consentText = 'While you are clocked in, MARQ will record active apps/websites and, if enabled, screenshots for work purposes.'
  const ts: TrackingSession = { id: newId(), timeSessionId: sess.id, memberId: sess.memberId, orgId: sess.orgId, startedAt: now.getTime(), consentGiven: false, consentText, createdAt: now.getTime() }
  trackingSessions.push(ts)
  return { trackingAllowed: true, trackingSessionId: ts.id, consentRequired: true, consentText }
}

export async function trackingConsent(input: { trackingSessionId: string, accepted: boolean, consentText: string, actorUserId?: string }) {
  const now = new Date()
  const sb = isSupabaseConfigured() ? supabaseServer() : null
  if (sb) {
    const { data: ts } = await sb!.from('tracking_sessions').select('*').eq('id', input.trackingSessionId).single()
    if (!ts) return 'TRACKING_NOT_FOUND'
    if (input.accepted) {
      const { data } = await sb!.from('tracking_sessions').update({ consent_given: true, consent_text: input.consentText }).eq('id', input.trackingSessionId).select('*').single()
      return { allowed: true }
    } else {
      await sb!.from('tracking_sessions').update({ ended_at: now, consent_given: false, consent_text: input.consentText }).eq('id', input.trackingSessionId)
      await sb!.from('time_sessions').update({ end_time: now, status: 'cancelled', total_minutes: 0, cancel_reason: 'no_consent', updated_at: now }).eq('id', ts.time_session_id)
      await recomputeDaily(ts.member_id, ts.org_id, dateISO(now))
      return { allowed: false, message: "You declined tracking, so this session won’t be recorded as work time." }
    }
  }
  const ts = trackingSessions.find(t => t.id === input.trackingSessionId)
  if (!ts) return 'TRACKING_NOT_FOUND'
  if (input.accepted) {
    ts.consentGiven = true
    ts.consentText = input.consentText
    return { allowed: true }
  } else {
    ts.endedAt = now.getTime()
    ts.consentGiven = false
    ts.consentText = input.consentText
    const sess = timeSessions.find(s => s.id === ts.timeSessionId)
    if (sess) { sess.endTime = now.getTime(); sess.status = 'cancelled'; sess.totalMinutes = 0; sess.cancelReason = 'no_consent'; sess.updatedAt = now.getTime(); await recomputeDaily(sess.memberId, sess.orgId, dateISO(now)) }
    return { allowed: false, message: "You declined tracking, so this session won’t be recorded as work time." }
  }
}

export async function stopTracking(trackingSessionId: string) {
  const now = new Date()
  const sb = isSupabaseConfigured() ? supabaseServer() : null
  if (sb) {
    const { data: ts } = await sb!.from('tracking_sessions').select('*').eq('id', trackingSessionId).single()
    if (!ts) return 'TRACKING_NOT_FOUND'
    const { data } = await sb!.from('tracking_sessions').update({ ended_at: now }).eq('id', trackingSessionId).select('*').single()
    return mapTrackingFromRow(data)
  }
  const ts = trackingSessions.find(t => t.id === trackingSessionId)
  if (!ts) return 'TRACKING_NOT_FOUND'
  ts.endedAt = now.getTime()
  return ts
}

export async function generateLandingLink(orgId: string, priceOverride?: number, prefillEmail?: string, baseUrl?: string) {
  const org = await getOrganization(orgId)
  if (!org) return 'ORG_NOT_FOUND'
  const token = newToken()
  const urlBase = baseUrl || process.env.APP_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const url = `${urlBase.replace(/\/$/,'')}/invite/${orgId}/${token}`
  return { url, orgConfig: { pricePerLogin: priceOverride ?? org.pricePerLogin, totalLicensedSeats: org.totalLicensedSeats }, prefillEmail }
}

export async function createAsset(input: { orgId: string, assetTag: string, category: import('./types').AssetCategory, model?: string, serialNumber?: string, purchaseDate?: string, warrantyEnd?: string, status: import('./types').AssetStatus }): Promise<import('./types').Asset | 'DB_ERROR'> {
  const now = new Date()
  if (isSupabaseConfigured()) {
    const sb = supabaseServer()
    const payload = { org_id: input.orgId, asset_tag: input.assetTag, category: input.category, model: input.model ?? null, serial_number: input.serialNumber ?? null, purchase_date: input.purchaseDate ?? null, warranty_end: input.warrantyEnd ?? null, status: input.status, created_at: now }
    const { data, error } = await sb.from('assets').insert(payload).select('*').single()
    if (error) return 'DB_ERROR'
    return { id: data.id, orgId: data.org_id, assetTag: data.asset_tag, category: data.category, model: data.model ?? undefined, serialNumber: data.serial_number ?? undefined, purchaseDate: data.purchase_date ?? undefined, warrantyEnd: data.warranty_end ?? undefined, status: data.status, createdAt: new Date(data.created_at).getTime() }
  }
  const a: import('./types').Asset = { id: newId(), orgId: input.orgId, assetTag: input.assetTag, category: input.category, model: input.model, serialNumber: input.serialNumber, purchaseDate: input.purchaseDate, warrantyEnd: input.warrantyEnd, status: input.status, createdAt: now.getTime() }
  assetsMem.push(a)
  return a
}

export async function listAssets(params: { orgId: string, status?: import('./types').AssetStatus, category?: import('./types').AssetCategory }): Promise<import('./types').Asset[]> {
  if (isSupabaseConfigured()) {
    const sb = supabaseServer()
    let q = sb.from('assets').select('*').eq('org_id', params.orgId).order('created_at', { ascending: false })
    if (params.status) q = q.eq('status', params.status)
    if (params.category) q = q.eq('category', params.category)
    const { data } = await q
    return (data || []).map((r: any) => ({ id: r.id, orgId: r.org_id, assetTag: r.asset_tag, category: r.category, model: r.model ?? undefined, serialNumber: r.serial_number ?? undefined, purchaseDate: r.purchase_date ?? undefined, warrantyEnd: r.warranty_end ?? undefined, status: r.status, createdAt: new Date(r.created_at).getTime() }))
  }
  let arr = assetsMem.filter(a => a.orgId === params.orgId)
  if (params.status) arr = arr.filter(a => a.status === params.status)
  if (params.category) arr = arr.filter(a => a.category === params.category)
  return arr
}

export async function listAssetsWithActiveAssignment(params: { orgId: string, status?: import('./types').AssetStatus, category?: import('./types').AssetCategory }): Promise<Array<{ asset: import('./types').Asset, assignedTo?: string, assignedAt?: number }>> {
  if (isSupabaseConfigured()) {
    const sb = supabaseServer()
    let q = sb.from('assets').select('*, asset_assignments(*)').eq('org_id', params.orgId).order('created_at', { ascending: false })
    if (params.status) q = q.eq('status', params.status)
    if (params.category) q = q.eq('category', params.category)
    const { data } = await q
    return (data || []).map((r: any) => {
      const asset = { id: r.id, orgId: r.org_id, assetTag: r.asset_tag, category: r.category, model: r.model ?? undefined, serialNumber: r.serial_number ?? undefined, purchaseDate: r.purchase_date ?? undefined, warrantyEnd: r.warranty_end ?? undefined, status: r.status, createdAt: new Date(r.created_at).getTime() }
      const assignments = Array.isArray(r.asset_assignments) ? r.asset_assignments : []
      const active = assignments.find((a: any) => !a.returned_at)
      return { asset, assignedTo: active?.member_id || undefined, assignedAt: active?.assigned_at ? new Date(active.assigned_at).getTime() : undefined }
    })
  }
  let arr = assetsMem.filter(a => a.orgId === params.orgId)
  if (params.status) arr = arr.filter(a => a.status === params.status)
  if (params.category) arr = arr.filter(a => a.category === params.category)
  return arr.map(a => {
    const active = assetAssignmentsMem.find(x => x.assetId === a.id && !x.returnedAt)
    return { asset: a, assignedTo: active?.memberId, assignedAt: active?.assignedAt }
  })
}

export async function assignAssetToMember(input: { assetId: string, memberId: string }): Promise<import('./types').AssetAssignment | 'NOT_FOUND' | 'DB_ERROR'> {
  const now = new Date()
  if (isSupabaseConfigured()) {
    const sb = supabaseServer()
    const { data: asset } = await sb.from('assets').select('*').eq('id', input.assetId).limit(1).maybeSingle()
    if (!asset) return 'NOT_FOUND'
    const { data: active } = await sb.from('asset_assignments').select('*').eq('asset_id', input.assetId).is('returned_at', null).limit(1).maybeSingle()
    if (active) {
      const { error: retErr } = await sb.from('asset_assignments').update({ returned_at: now }).eq('id', active.id)
      if (retErr) return 'DB_ERROR'
    }
    const { error: updErr } = await sb.from('assets').update({ status: 'in_use' }).eq('id', input.assetId)
    if (updErr) return 'DB_ERROR'
    const { data, error } = await sb.from('asset_assignments').insert({ asset_id: input.assetId, member_id: input.memberId, assigned_at: now, returned_at: null }).select('*').single()
    if (error) return 'DB_ERROR'
    return { id: data.id, assetId: data.asset_id, memberId: data.member_id ?? undefined, assignedAt: new Date(data.assigned_at).getTime(), returnedAt: data.returned_at ? new Date(data.returned_at).getTime() : undefined }
  }
  const found = assetsMem.find(a => a.id === input.assetId)
  if (!found) return 'NOT_FOUND'
  found.status = 'in_use'
  const assignment: import('./types').AssetAssignment = { id: newId(), assetId: input.assetId, memberId: input.memberId, assignedAt: now.getTime() }
  assetAssignmentsMem.push(assignment)
  return assignment
}

export async function returnAsset(input: { assignmentId?: string, assetId?: string }): Promise<'OK' | 'NOT_FOUND' | 'DB_ERROR'> {
  const now = new Date()
  if (isSupabaseConfigured()) {
    const sb = supabaseServer()
    let active: any = null
    if (input.assignmentId) {
      const { data } = await sb.from('asset_assignments').select('*').eq('id', input.assignmentId).limit(1).maybeSingle()
      active = data || null
    } else if (input.assetId) {
      const { data } = await sb.from('asset_assignments').select('*').eq('asset_id', input.assetId).is('returned_at', null).limit(1).maybeSingle()
      active = data || null
    }
    if (!active) return 'NOT_FOUND'
    const { error: updAssignErr } = await sb.from('asset_assignments').update({ returned_at: now }).eq('id', active.id)
    if (updAssignErr) return 'DB_ERROR'
    const { error: updAssetErr } = await sb.from('assets').update({ status: 'in_stock' }).eq('id', active.asset_id)
    if (updAssetErr) return 'DB_ERROR'
    return 'OK'
  }
  let idx = -1
  if (input.assignmentId) idx = assetAssignmentsMem.findIndex(a => a.id === input.assignmentId)
  else if (input.assetId) idx = assetAssignmentsMem.findIndex(a => a.assetId === input.assetId && !a.returnedAt)
  if (idx < 0) return 'NOT_FOUND'
  assetAssignmentsMem[idx].returnedAt = now.getTime()
  const asset = assetsMem.find(a => a.id === assetAssignmentsMem[idx].assetId)
  if (asset) asset.status = 'in_stock'
  return 'OK'
}

export async function listMemberAssets(memberId: string): Promise<Array<{ assignment: import('./types').AssetAssignment, asset: import('./types').Asset }>> {
  if (isSupabaseConfigured()) {
    const sb = supabaseServer()
    const { data } = await sb.from('asset_assignments').select('*, assets(*)').eq('member_id', memberId).is('returned_at', null)
    const rows = (data || []).filter((r: any) => !!r.assets)
    return rows.map((r: any) => ({
      assignment: { id: r.id, assetId: r.asset_id, memberId: r.member_id ?? undefined, assignedAt: new Date(r.assigned_at).getTime(), returnedAt: r.returned_at ? new Date(r.returned_at).getTime() : undefined },
      asset: { id: r.assets.id, orgId: r.assets.org_id, assetTag: r.assets.asset_tag, category: r.assets.category, model: r.assets.model ?? undefined, serialNumber: r.assets.serial_number ?? undefined, purchaseDate: r.assets.purchase_date ?? undefined, warrantyEnd: r.assets.warranty_end ?? undefined, status: r.assets.status, createdAt: new Date(r.assets.created_at).getTime() }
    }))
  }
  const actives = assetAssignmentsMem.filter(a => a.memberId === memberId && !a.returnedAt)
  const rows = actives.map(a => ({ assignment: a, asset: assetsMem.find(x => x.id === a.assetId)! })).filter(x => !!x.asset)
  return rows
}

function mapOrgFromRow(row: any): Organization {
  return {
    id: row.id,
    orgName: row.org_name,
    orgLogo: row.org_logo ?? undefined,
    themeBgMain: row.theme_bg_main ?? undefined,
    themeAccent: row.theme_accent ?? undefined,
    layoutType: row.layout_type ?? undefined,
    ownerName: row.owner_name,
    ownerEmail: row.owner_email,
    billingEmail: row.billing_email,
    subscriptionType: row.subscription_type,
    pricePerLogin: Number(row.price_per_login),
    totalLicensedSeats: Number(row.total_licensed_seats),
    usedSeats: Number(row.used_seats),
    createdAt: new Date(row.created_at).getTime(),
    updatedAt: new Date(row.updated_at).getTime()
  }
}

function mapInviteFromRow(row: any): OrganizationInvite {
  return {
    id: row.id,
    invitedEmail: row.invited_email,
    orgId: row.org_id,
    invitedBy: row.invited_by,
    role: row.role,
    inviteStatus: row.invite_status,
    createdAt: new Date(row.created_at).getTime(),
    expiresAt: new Date(row.expires_at).getTime(),
    token: row.token,
    assignSeat: !!row.assign_seat
  }
}

export async function updateSettings(patch: Partial<SaaSSettings>) {
  if (isSupabaseConfigured()) {
    const sb = supabaseServer()
    const payload = {
      id: 'saas',
      default_seat_price: patch.defaultSeatPrice,
      default_seat_limit: patch.defaultSeatLimit,
      landing_page_invite_enabled: patch.landingPageInviteEnabled
    }
    const { data, error } = await sb.from('saas_settings').upsert(payload, { onConflict: 'id' }).select('*').single()
    if (error) return 'DB_ERROR'
    return { id: data.id, defaultSeatPrice: Number(data.default_seat_price), defaultSeatLimit: Number(data.default_seat_limit), landingPageInviteEnabled: !!data.landing_page_invite_enabled }
  }
  settings = { id: 'saas', defaultSeatPrice: patch.defaultSeatPrice ?? settings.defaultSeatPrice, defaultSeatLimit: patch.defaultSeatLimit ?? settings.defaultSeatLimit, landingPageInviteEnabled: patch.landingPageInviteEnabled ?? settings.landingPageInviteEnabled }
  return settings
}

export async function listDepartments(orgId: string) {
  if (isSupabaseConfigured()) {
    const sb = supabaseServer()
    const { data, error } = await sb.from('departments').select('*').eq('org_id', orgId).order('created_at', { ascending: false })
    if (error) return []
    return data.map(mapDepartmentFromRow)
  }
  return departments.filter(d => d.orgId === orgId)
}

export async function createDepartment(input: { orgId: string, name: string, description?: string, parentId?: string }) {
  if (isSupabaseConfigured()) {
    const org = await getOrganization(input.orgId)
    if (!org) return 'ORG_NOT_FOUND'
    const sb = supabaseServer()
    const now = new Date()
    const payload: any = { org_id: input.orgId, name: input.name, description: input.description ?? null, parent_id: input.parentId ?? null, created_at: now, updated_at: now }
    const { data: insData, error: insErr } = await sb.from('departments').insert(payload).select()
    if (!insErr) {
      if (Array.isArray(insData) && insData.length > 0) return mapDepartmentFromRow(insData[0])
      const { data: fetched } = await sb.from('departments').select('*').eq('org_id', input.orgId).eq('name', input.name).order('created_at', { ascending: false }).limit(1).maybeSingle()
      if (fetched) return mapDepartmentFromRow(fetched)
    }
    const code = (insErr as any)?.code
    const msg = ((insErr as any)?.message || '').toLowerCase()
    if (insErr) {
      if (code === '42501') return 'DB_FORBIDDEN'
      if (code === '42P01') return 'DB_TABLE_MISSING'
      if (code === '23505') return 'DEPARTMENT_DUPLICATE'
      if (code === '23502') return 'MISSING_FIELDS'
      if (code === '23503') return 'ORG_NOT_FOUND'
      if (code === '22P02') return 'INVALID_ORG_ID'
      if (code === '42883' || msg.includes('gen_random_uuid')) return 'DB_UNDEFINED_FUNCTION'
      if (msg.includes('row level security')) return 'DB_FORBIDDEN'
      if (msg.includes('invalid input syntax for type uuid')) return 'INVALID_ORG_ID'
      if (msg.includes('foreign key constraint')) return 'ORG_NOT_FOUND'
      if (msg.includes('not-null constraint')) return 'MISSING_FIELDS'
      if (msg.includes('duplicate key value')) return 'DEPARTMENT_DUPLICATE'
      if (msg.includes('permission denied')) return 'DB_FORBIDDEN'
      if (msg.includes('relation') && msg.includes('departments') && msg.includes('does not exist')) return 'DB_TABLE_MISSING'
      return `DB_ERROR_${code || 'UNKNOWN'}`
    }
    return 'DB_ERROR_UNKNOWN'
  }
  const org = organizations.find(o => o.id === input.orgId)
  if (!org) return 'ORG_NOT_FOUND'
  const id = newId()
  const now = Date.now()
  const dep: Department = { id, orgId: input.orgId, name: input.name, description: input.description, parentId: input.parentId, createdAt: now, updatedAt: now }
  departments.push(dep)
  return dep
}

export async function updateDepartment(id: string, patch: { name?: string, description?: string, parentId?: string }) {
  if (isSupabaseConfigured()) {
    const sb = supabaseServer()
    const now = new Date()
    const update: any = {}
    if (patch.name !== undefined) update.name = patch.name
    if (patch.description !== undefined) update.description = patch.description ?? null
    if (patch.parentId !== undefined) update.parent_id = patch.parentId ?? null
    update.updated_at = now
    const { data, error } = await sb.from('departments').update(update).eq('id', id).select('*').single()
    if (error) return 'DB_ERROR'
    return mapDepartmentFromRow(data)
  }
  const d = departments.find(x => x.id === id)
  if (!d) return undefined
  if (patch.name !== undefined) d.name = patch.name
  if (patch.description !== undefined) d.description = patch.description
  if (patch.parentId !== undefined) d.parentId = patch.parentId
  d.updatedAt = Date.now()
  return d
}

export async function deleteDepartment(id: string) {
  if (isSupabaseConfigured()) {
    const sb = supabaseServer()
    const { data: depRow, error: depErr } = await sb.from('departments').select('*').eq('id', id).single()
    if (depErr || !depRow) return 'DEPARTMENT_NOT_FOUND'
    const { count } = await sb.from('users').select('*', { count: 'exact', head: true }).eq('department_id', id)
    if ((count ?? 0) > 0) return 'DEPT_HAS_USERS'
    const { error } = await sb.from('departments').delete().eq('id', id)
    if (error) return 'DB_ERROR'
    return 'OK'
  }
  const dep = departments.find(d => d.id === id)
  if (!dep) return 'DEPARTMENT_NOT_FOUND'
  const attached = users.some(u => u.departmentId === id)
  if (attached) return 'DEPT_HAS_USERS'
  const idx = departments.findIndex(d => d.id === id)
  if (idx >= 0) departments.splice(idx, 1)
  return 'OK'
}

export async function listRoles(orgId: string) {
  if (isSupabaseConfigured()) {
    const sb = supabaseServer()
    const { data, error } = await sb.from('roles').select('*').eq('org_id', orgId).order('created_at', { ascending: false })
    if (error) return []
    return data.map(mapRoleFromRow)
  }
  return roles.filter(r => r.orgId === orgId)
}

export async function getRole(id: string) {
  if (isSupabaseConfigured()) {
    const sb = supabaseServer()
    const { data, error } = await sb.from('roles').select('*').eq('id', id).single()
    if (error || !data) return undefined
    return mapRoleFromRow(data)
  }
  return roles.find(r => r.id === id)
}

function isValidPermissions(perms: Permission[]) {
  const allowed: Permission[] = ['manage_org','manage_users','manage_time','manage_screenshots','manage_salary','manage_fines','manage_reports','manage_settings']
  return perms.every(p => allowed.includes(p))
}

export async function createRole(input: { orgId: string, name: string, permissions: Permission[] }) {
  if (!isValidPermissions(input.permissions)) return 'INVALID_PERMISSION'
  if (isSupabaseConfigured()) {
    const org = await getOrganization(input.orgId)
    if (!org) return 'ORG_NOT_FOUND'
    const sb = supabaseServer()
    const now = new Date()
    const { data, error } = await sb.from('roles').insert({ org_id: input.orgId, name: input.name, permissions: input.permissions, created_at: now }).select('*').single()
    if (error) return 'DB_ERROR'
    return mapRoleFromRow(data)
  }
  const org = organizations.find(o => o.id === input.orgId)
  if (!org) return 'ORG_NOT_FOUND'
  const id = newId()
  const now = Date.now()
  const role: Role = { id, orgId: input.orgId, name: input.name, permissions: input.permissions, createdAt: now }
  roles.push(role)
  return role
}

export async function updateRole(id: string, patch: { name?: string, permissions?: Permission[] }) {
  if (patch.permissions && !isValidPermissions(patch.permissions)) return 'INVALID_PERMISSION'
  if (patch.name && (patch.name === 'Owner' || patch.name === 'Admin' || patch.name === 'Employee')) return 'RESERVED_ROLE_NAME'
  if (isSupabaseConfigured()) {
    const sb = supabaseServer()
    const { data: before } = await sb.from('roles').select('*').eq('id', id).single()
    if (!before) return undefined
    const fullAllowed: Permission[] = ['manage_org','manage_users','manage_time','manage_screenshots','manage_salary','manage_fines','manage_reports','manage_settings']
    if (patch.permissions && before.permissions && before.permissions.length === fullAllowed.length && patch.permissions.length < fullAllowed.length) {
      const { data: countRows } = await sb.from('roles').select('id, permissions').eq('org_id', before.org_id)
      const fullCount = (countRows || []).filter((r: any) => (r.permissions || []).length === fullAllowed.length).length
      if (fullCount <= 1) return 'ROLE_PROTECTED'
    }
    const { data, error } = await sb.from('roles').update({ name: patch.name, permissions: patch.permissions }).eq('id', id).select('*').single()
    if (error) return 'DB_ERROR'
    await sb.from('permission_audit_logs').insert({
      org_id: before.org_id,
      actor_user_id: (process as any).currentActorUserId ?? null,
      target_user_id: null,
      action_type: 'permissions_updated',
      previous_role: { id: before.id, name: before.name },
      previous_permissions: before.permissions ?? [],
      new_role: { id: data.id, name: data.name },
      new_permissions: data.permissions ?? []
    })
    return mapRoleFromRow(data)
  }
  const r = roles.find(x => x.id === id)
  if (!r) return undefined
  const fullAllowed: Permission[] = ['manage_org','manage_users','manage_time','manage_screenshots','manage_salary','manage_fines','manage_reports','manage_settings']
  if (patch.permissions && r.permissions && r.permissions.length === fullAllowed.length && patch.permissions.length < fullAllowed.length) {
    const fullCount = roles.filter(rr => rr.orgId === r.orgId && rr.permissions.length === fullAllowed.length).length
    if (fullCount <= 1) return 'ROLE_PROTECTED'
  }
  if (patch.name) r.name = patch.name
  if (patch.permissions) r.permissions = patch.permissions
  permAudit.push({ orgId: r.orgId, actorUserId: (global as any).currentActorUserId ?? null, actionType: 'permissions_updated', previousRole: { id: id, name: r.name }, previousPermissions: r.permissions, newRole: { id: id, name: r.name }, newPermissions: r.permissions, createdAt: Date.now() })
  return r
}

async function ensureEmployeeRole(orgId: string) {
  const existing = (await listRoles(orgId)).find(r => r.name === 'Employee')
  if (existing) return existing
  const created = await createRole({ orgId, name: 'Employee', permissions: [] })
  return created as Role
}

export async function deleteRole(id: string) {
  if (isSupabaseConfigured()) {
    const sb = supabaseServer()
    const { data: roleRow, error: roleErr } = await sb.from('roles').select('*').eq('id', id).single()
    if (roleErr || !roleRow) return 'ROLE_NOT_FOUND'
    const role = mapRoleFromRow(roleRow)
    const allRoles = await listRoles(role.orgId)
    const fullAllowed: Permission[] = ['manage_org','manage_users','manage_time','manage_screenshots','manage_salary','manage_fines','manage_reports','manage_settings']
    const fullCount = allRoles.filter(r => r.permissions.length === fullAllowed.length).length
    if (role.permissions.length === fullAllowed.length && fullCount <= 1) return 'ROLE_PROTECTED'
    const employee = await ensureEmployeeRole(role.orgId)
    await sb.from('users').update({ role_id: employee.id }).eq('role_id', id)
    const { error } = await sb.from('roles').delete().eq('id', id)
    if (error) return 'DB_ERROR'
    await sb.from('permission_audit_logs').insert({ org_id: role.orgId, actor_user_id: (process as any).currentActorUserId ?? null, target_user_id: null, action_type: 'role_deleted', previous_role: { id: id, name: role.name }, previous_permissions: role.permissions, new_role: null, new_permissions: null })
    return 'OK'
  }
  const r = roles.find(x => x.id === id)
  if (!r) return 'ROLE_NOT_FOUND'
  const fullAllowed: Permission[] = ['manage_org','manage_users','manage_time','manage_screenshots','manage_salary','manage_fines','manage_reports','manage_settings']
  const fullCount = roles.filter(rr => rr.orgId === r.orgId && rr.permissions.length === fullAllowed.length).length
  if (r.permissions.length === fullAllowed.length && fullCount <= 1) return 'ROLE_PROTECTED'
  const employee = await ensureEmployeeRole(r.orgId)
  users.forEach(u => { if (u.roleId === id) u.roleId = employee.id })
  const idx = roles.findIndex(x => x.id === id)
  if (idx >= 0) roles.splice(idx, 1)
  permAudit.push({ orgId: r.orgId, actorUserId: (global as any).currentActorUserId ?? null, actionType: 'role_deleted', previousRole: { id: id, name: r.name }, previousPermissions: r.permissions, newRole: null, newPermissions: null, createdAt: Date.now() })
  return 'OK'
}

export async function listUsers(orgId: string) {
  if (isSupabaseConfigured()) {
    const sb = supabaseServer()
    const { data, error } = await sb.from('users').select('*').eq('org_id', orgId).order('created_at', { ascending: false })
    if (error) return []
    return data.map(mapUserFromRow)
  }
  await ensureDemoForOrg(orgId)
  return users.filter(u => u.orgId === orgId)
}

export async function listMemberRoles(orgId: string) {
  if (isSupabaseConfigured()) {
    const sb = supabaseServer()
    const { data, error } = await sb.from('member_roles').select('*').eq('org_id', orgId).order('level', { ascending: true })
    if (error) return []
    return (data || []).map((r: any) => ({ id: r.id, orgId: r.org_id, name: r.name, level: Number(r.level || 0), createdAt: new Date(r.created_at).getTime() }))
  }
  return memberRoles.filter(r => r.orgId === orgId).sort((a,b)=> a.level - b.level)
}

export async function createMemberRole(input: { orgId: string, name: string, level: number }) {
  if (isSupabaseConfigured()) {
    const sb = supabaseServer()
    const now = new Date()
    const { data, error } = await sb.from('member_roles').insert({ org_id: input.orgId, name: input.name, level: input.level, created_at: now }).select('*').single()
    if (error) return 'DB_ERROR'
    return { id: data.id, orgId: data.org_id, name: data.name, level: Number(data.level || 0), createdAt: new Date(data.created_at).getTime() } as MemberRole
  }
  const id = newId()
  const now = Date.now()
  const r: MemberRole = { id, orgId: input.orgId, name: input.name, level: input.level, createdAt: now }
  memberRoles.push(r)
  return r
}

export async function updateMemberRole(id: string, patch: { name?: string, level?: number }) {
  if (isSupabaseConfigured()) {
    const sb = supabaseServer()
    const upd: any = {}
    if (patch.name !== undefined) upd.name = patch.name
    if (patch.level !== undefined) upd.level = patch.level
    const { data, error } = await sb.from('member_roles').update(upd).eq('id', id).select('*').single()
    if (error) return 'DB_ERROR'
    return { id: data.id, orgId: data.org_id, name: data.name, level: Number(data.level || 0), createdAt: new Date(data.created_at).getTime() } as MemberRole
  }
  const r = memberRoles.find(x => x.id === id)
  if (!r) return undefined
  if (patch.name !== undefined) r.name = patch.name
  if (patch.level !== undefined) r.level = patch.level
  return r
}

export async function deleteMemberRole(id: string) {
  if (isSupabaseConfigured()) {
    const sb = supabaseServer()
    const { data: roleRow } = await sb.from('member_roles').select('*').eq('id', id).maybeSingle()
    if (!roleRow) return 'ROLE_NOT_FOUND'
    const { count } = await sb.from('users').select('*', { count: 'exact', head: true }).eq('role_id', id)
    if ((count ?? 0) > 0) return 'ROLE_IN_USE'
    const { error } = await sb.from('member_roles').delete().eq('id', id)
    if (error) return 'DB_ERROR'
    return 'OK'
  }
  const used = users.some(u => u.roleId === id)
  if (used) return 'ROLE_IN_USE'
  const idx = memberRoles.findIndex(x => x.id === id)
  if (idx < 0) return 'ROLE_NOT_FOUND'
  memberRoles.splice(idx, 1)
  return 'OK'
}

export async function listTeamMemberIds(orgId: string, managerId: string) {
  const members = await listUsers(orgId)
  const children = new Map<string, string[]>()
  for (const u of members) {
    const mgr = u.managerId || ''
    if (!mgr) continue
    const arr = children.get(mgr) || []
    arr.push(u.id)
    children.set(mgr, arr)
  }
  const out: Set<string> = new Set()
  const stack: string[] = [managerId]
  while (stack.length) {
    const cur = stack.pop() as string
    const subs = children.get(cur) || []
    for (const s of subs) if (!out.has(s)) { out.add(s); stack.push(s) }
  }
  return Array.from(out.values())
}

export async function getUser(id: string) {
  if (isSupabaseConfigured()) {
    const sb = supabaseServer()
    const { data, error } = await sb.from('users').select('*').eq('id', id).single()
    if (error || !data) return undefined
    return mapUserFromRow(data)
  }
  return users.find(u => u.id === id)
}

export async function createUser(input: Omit<User, 'id'|'createdAt'|'updatedAt'|'status'> & { status?: User['status'], autoAssignAdminManager?: boolean }) {
  const org = await getOrganization(input.orgId)
  if (!org) return 'ORG_NOT_FOUND'
  if (isSupabaseConfigured()) {
    const sb = supabaseServer()
    if (input.roleId) {
      const { data: rRow, error: rErr } = await sb.from('roles').select('id, org_id').eq('id', input.roleId).single()
      if (rErr || !rRow) return 'ROLE_NOT_FOUND'
      if (rRow.org_id !== input.orgId) return 'ORG_MISMATCH_ROLE'
    }
    if (input.departmentId) {
      const { data: dRow, error: dErr } = await sb.from('departments').select('id, org_id').eq('id', input.departmentId).single()
      if (dErr || !dRow) return 'DEPARTMENT_NOT_FOUND'
      if (dRow.org_id !== input.orgId) return 'ORG_MISMATCH_DEPARTMENT'
    }
    const { count } = await sb.from('users').select('*', { count: 'exact', head: true }).eq('org_id', input.orgId).eq('email', input.email)
    if ((count ?? 0) > 0) return 'EMAIL_ALREADY_EXISTS'
    // Defaults: member role, department, optional manager
    let member_role_id = (input as any).memberRoleId || null
    if (!member_role_id) {
      const { data: mr } = await sb.from('member_roles').select('*').eq('org_id', input.orgId).order('level', { ascending: true }).limit(1)
      member_role_id = (mr && mr[0]?.id) || null
    }
    let department_id = input.departmentId || null
    if (!department_id) {
      const { data: dep } = await sb.from('departments').select('*').eq('org_id', input.orgId).eq('name','Ungrouped').limit(1)
      if (dep && dep[0]) department_id = dep[0].id
      else {
        const nowU = new Date()
        const { data: created } = await sb.from('departments').insert({ org_id: input.orgId, name: 'Ungrouped', description: 'Auto-created default group', created_at: nowU, updated_at: nowU }).select('*').single()
        department_id = created?.id || null
      }
    }
    let manager_id = (input as any).managerId || null
    if (!manager_id && input.autoAssignAdminManager) {
      const { data: rAll } = await sb.from('roles').select('*').eq('org_id', input.orgId)
      const adminRoleIds = (rAll||[]).filter((r:any)=> Array.isArray(r.permissions) && r.permissions.includes('manage_users')).map((r:any)=> r.id)
      if (adminRoleIds.length) {
        const { data: admins } = await sb.from('users').select('*').eq('org_id', input.orgId).in('role_id', adminRoleIds).order('created_at', { ascending: true }).limit(1)
        manager_id = admins && admins[0]?.id || null
      }
    }
    const now = new Date()
    const payload = {
      org_id: input.orgId,
      first_name: input.firstName,
      last_name: input.lastName,
      email: input.email,
      password_hash: input.passwordHash,
      role_id: input.roleId || null,
      department_id,
      manager_id,
      member_role_id,
      position_title: input.positionTitle ?? null,
      profile_image: input.profileImage ?? null,
      salary: input.salary ?? null,
      working_days: input.workingDays,
      working_hours_per_day: input.workingHoursPerDay ?? null,
      status: input.status ?? 'active',
      created_at: now,
      updated_at: now
    }
    const { data, error } = await sb.from('users').insert(payload).select('*').single()
    if (error) return 'DB_ERROR'
    return mapUserFromRow(data)
  }
  if (users.some(u => u.orgId === input.orgId && u.email === input.email)) return 'EMAIL_ALREADY_EXISTS'
  const id = newId()
  const now = Date.now()
  // Defaults for memory mode
  let memberRoleId = (input as any).memberRoleId || undefined
  if (!memberRoleId) {
    const rolesForOrg = memberRoles.filter(r => r.orgId === input.orgId).sort((a,b)=> a.level - b.level)
    memberRoleId = rolesForOrg[0]?.id
  }
  let departmentId = input.departmentId || undefined
  if (!departmentId) {
    let dep = departments.find(d => d.orgId === input.orgId && d.name === 'Ungrouped')
    if (!dep) {
      const newDep = { id: newId(), orgId: input.orgId, name: 'Ungrouped', description: 'Auto-created default group', createdAt: now, updatedAt: now } as Department
      departments.push(newDep)
      dep = newDep
    }
    departmentId = dep!.id
  }
  let managerId = (input as any).managerId || undefined
  if (!managerId && input.autoAssignAdminManager) {
    const adminIds = roles.filter(r => r.permissions.includes('manage_users') && r.orgId === input.orgId).map(r => r.id)
    const adminUser = users.find(u => u.orgId === input.orgId && adminIds.includes(u.roleId))
    managerId = adminUser?.id
  }
  const user: User = {
    id,
    firstName: input.firstName,
    lastName: input.lastName,
    email: input.email,
    passwordHash: input.passwordHash,
    roleId: input.roleId,
    orgId: input.orgId,
    departmentId,
    managerId,
    memberRoleId,
    positionTitle: input.positionTitle,
    profileImage: input.profileImage,
    salary: input.salary,
    workingDays: input.workingDays,
    workingHoursPerDay: input.workingHoursPerDay,
    status: input.status ?? 'active',
    createdAt: now,
    updatedAt: now
  }
  users.push(user)
  return user
}

export async function updateUser(id: string, patch: Partial<Pick<User,'departmentId'|'roleId'|'managerId'|'memberRoleId'|'salary'|'workingDays'|'workingHoursPerDay'|'status'|'themeBgMain'|'themeAccent'|'layoutType'>>) {
  if (isSupabaseConfigured()) {
    const sb = supabaseServer()
    const { data: row, error: gErr } = await sb.from('users').select('*').eq('id', id).single()
    if (gErr || !row) return undefined
    if (patch.roleId) {
      const { data: rRow, error: rErr } = await sb.from('roles').select('id, org_id').eq('id', patch.roleId).single()
      if (rErr || !rRow) return 'ROLE_NOT_FOUND'
      if (rRow.org_id !== row.org_id) return 'ORG_MISMATCH_ROLE'
    }
    if (patch.departmentId) {
      const { data: dRow, error: dErr } = await sb.from('departments').select('id, org_id').eq('id', patch.departmentId).single()
      if (dErr || !dRow) return 'DEPARTMENT_NOT_FOUND'
      if (dRow.org_id !== row.org_id) return 'ORG_MISMATCH_DEPARTMENT'
    }
    if (patch.managerId !== undefined) {
      if (patch.managerId === id) return 'INVALID_MANAGER_SELF'
      if (patch.managerId) {
        const { data: mRow, error: mErr } = await sb.from('users').select('id, org_id').eq('id', patch.managerId).single()
        if (mErr || !mRow) return 'MANAGER_NOT_FOUND'
        if (mRow.org_id !== row.org_id) return 'ORG_MISMATCH_MANAGER'
      }
    }
    if (patch.memberRoleId !== undefined && patch.memberRoleId) {
      const { data: mrRow, error: mrErr } = await sb.from('member_roles').select('id, org_id').eq('id', patch.memberRoleId).single()
      if (mrErr || !mrRow) return 'MEMBER_ROLE_NOT_FOUND'
      if (mrRow.org_id !== row.org_id) return 'ORG_MISMATCH_MEMBER_ROLE'
    }
    const now = new Date()
    const { data, error } = await sb.from('users').update({
      department_id: patch.departmentId ?? row.department_id ?? null,
      role_id: patch.roleId ?? row.role_id ?? null,
      manager_id: patch.managerId !== undefined ? (patch.managerId || null) : (row.manager_id ?? null),
      member_role_id: patch.memberRoleId !== undefined ? (patch.memberRoleId || null) : (row.member_role_id ?? null),
      salary: patch.salary ?? row.salary ?? null,
      working_days: patch.workingDays ?? row.working_days,
      working_hours_per_day: patch.workingHoursPerDay ?? row.working_hours_per_day ?? null,
      status: patch.status ?? row.status,
      theme_bg_main: patch.themeBgMain ?? row.theme_bg_main ?? null,
      theme_accent: patch.themeAccent ?? row.theme_accent ?? null,
      layout_type: patch.layoutType ?? row.layout_type ?? null,
      updated_at: now
    }).eq('id', id).select('*').single()
    if (error) return 'DB_ERROR'
    if (patch.roleId && patch.roleId !== row.role_id) {
      const { data: newRole } = await sb.from('roles').select('*').eq('id', patch.roleId).single()
      const { data: prevRole } = await sb.from('roles').select('*').eq('id', row.role_id).single()
      await sb.from('permission_audit_logs').insert({
        org_id: row.org_id,
        actor_user_id: (process as any).currentActorUserId ?? null,
        target_user_id: row.id,
        action_type: 'role_changed',
        previous_role: prevRole ? { id: prevRole.id, name: prevRole.name } : null,
        previous_permissions: prevRole?.permissions ?? [],
        new_role: newRole ? { id: newRole.id, name: newRole.name } : null,
        new_permissions: newRole?.permissions ?? []
      })
    }
    return mapUserFromRow(data)
  }
  const u = users.find(x => x.id === id)
  if (!u) return undefined
  const prev = { ...u }
  if (patch.departmentId !== undefined) u.departmentId = patch.departmentId
  if (patch.roleId !== undefined) u.roleId = patch.roleId
  if (patch.managerId !== undefined) u.managerId = patch.managerId
  if (patch.memberRoleId !== undefined) u.memberRoleId = patch.memberRoleId
  if (patch.salary !== undefined) u.salary = patch.salary
  if (patch.workingDays !== undefined) u.workingDays = patch.workingDays
  if (patch.workingHoursPerDay !== undefined) u.workingHoursPerDay = patch.workingHoursPerDay
  if (patch.status !== undefined) u.status = patch.status
  if (patch.themeBgMain !== undefined) u.themeBgMain = patch.themeBgMain
  if (patch.themeAccent !== undefined) u.themeAccent = patch.themeAccent
  if (patch.layoutType !== undefined) u.layoutType = patch.layoutType
  u.updatedAt = Date.now()
  if (patch.roleId && patch.roleId !== prev.roleId) {
    const newRole = roles.find(r => r.id === patch.roleId)
    const prevRole = roles.find(r => r.id === prev.roleId)
    permAudit.push({ orgId: u.orgId, actorUserId: (global as any).currentActorUserId ?? null, targetUserId: u.id, actionType: 'role_changed', previousRole: prevRole ? { id: prevRole.id, name: prevRole.name } : null, previousPermissions: prevRole?.permissions ?? [], newRole: newRole ? { id: newRole.id, name: newRole.name } : null, newPermissions: newRole?.permissions ?? [], createdAt: Date.now() })
  }
  return u
}

export async function suspendUser(id: string) {
  const res = await updateUser(id, { status: 'suspended' })
  if (!res) return 'USER_NOT_FOUND'
  return res
}

export async function activateUser(id: string) {
  const res = await updateUser(id, { status: 'active' })
  if (!res) return 'USER_NOT_FOUND'
  return res
}

function mapDepartmentFromRow(row: any): Department {
  return { id: row.id, orgId: row.org_id, name: row.name, description: row.description ?? undefined, parentId: row.parent_id ?? undefined, createdAt: new Date(row.created_at).getTime(), updatedAt: row.updated_at ? new Date(row.updated_at).getTime() : undefined }
}

function mapRoleFromRow(row: any): Role {
  return { id: row.id, orgId: row.org_id, name: row.name, permissions: (row.permissions ?? []) as Permission[], createdAt: new Date(row.created_at).getTime() }
}

function mapUserFromRow(row: any): User {
  return {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email,
    passwordHash: row.password_hash,
    roleId: row.role_id ?? undefined,
    orgId: row.org_id,
    themeBgMain: row.theme_bg_main ?? undefined,
    themeAccent: row.theme_accent ?? undefined,
    layoutType: row.layout_type ?? undefined,
    departmentId: row.department_id ?? undefined,
    managerId: row.manager_id ?? undefined,
    memberRoleId: row.member_role_id ?? undefined,
    positionTitle: row.position_title ?? undefined,
    profileImage: row.profile_image ?? undefined,
    salary: row.salary === null ? undefined : Number(row.salary),
    workingDays: row.working_days ?? [],
    workingHoursPerDay: row.working_hours_per_day === null ? undefined : Number(row.working_hours_per_day),
    status: row.status,
    createdAt: new Date(row.created_at).getTime(),
    updatedAt: new Date(row.updated_at).getTime()
  }
}
function mapPayrollPeriodFromRow(row: any): PayrollPeriod {
  return {
    id: row.id,
    orgId: row.org_id,
    name: row.name,
    startDate: row.start_date,
    endDate: row.end_date,
    status: row.status,
    createdBy: row.created_by,
    createdAt: new Date(row.created_at).getTime(),
    lockedAt: row.locked_at ? new Date(row.locked_at).getTime() : undefined,
    exportedAt: row.exported_at ? new Date(row.exported_at).getTime() : undefined
  }
}

function mapPayrollLineFromRow(row: any): MemberPayrollLine {
  return {
    id: row.id,
    payrollPeriodId: row.payroll_period_id,
    memberId: row.member_id,
    orgId: row.org_id,
    totalScheduledMinutes: Number(row.total_scheduled_minutes || 0),
    totalWorkedMinutes: Number(row.total_worked_minutes || 0),
    totalExtraMinutes: Number(row.total_extra_minutes || 0),
    totalShortMinutes: Number(row.total_short_minutes || 0),
    daysPresent: Number(row.days_present || 0),
    daysAbsent: Number(row.days_absent || 0),
    salaryType: row.salary_type,
    baseRate: Number(row.base_rate || 0),
    currency: row.currency,
    baseEarnings: Number(row.base_earnings || 0),
    extraEarnings: Number(row.extra_earnings || 0),
    deductionForShort: Number(row.deduction_for_short || 0),
    finesTotal: Number(row.fines_total || 0),
    adjustmentsTotal: Number(row.adjustments_total || 0),
    netPayable: Number(row.net_payable || 0),
    notes: row.notes ?? undefined,
    createdAt: new Date(row.created_at).getTime(),
    updatedAt: new Date(row.updated_at).getTime()
  }
}

export async function createPayrollPeriod(input: { orgId: string, name: string, startDate: string, endDate: string, createdBy: string }) {
  const now = new Date()
  if (isSupabaseConfigured()) {
    const sb = supabaseServer()
    const { data, error } = await sb.from('payroll_periods').insert({ org_id: input.orgId, name: input.name, start_date: input.startDate, end_date: input.endDate, status: 'open', created_by: input.createdBy, created_at: now }).select('*').single()
    if (error) return 'DB_ERROR'
    return mapPayrollPeriodFromRow(data)
  }
  const p: PayrollPeriod = { id: newId(), orgId: input.orgId, name: input.name, startDate: input.startDate, endDate: input.endDate, status: 'open', createdBy: input.createdBy, createdAt: now.getTime() }
  payrollPeriods.push(p)
  return p
}

export async function listPayrollPeriods(orgId: string) {
  if (isSupabaseConfigured()) {
    const sb = supabaseServer()
    const { data } = await sb.from('payroll_periods').select('*').eq('org_id', orgId).order('start_date', { ascending: false })
    return (data || []).map(mapPayrollPeriodFromRow)
  }
  return payrollPeriods.filter(p => p.orgId === orgId)
}

export async function lockPayrollPeriod(id: string) {
  const now = new Date()
  if (isSupabaseConfigured()) {
    const sb = supabaseServer()
    const { data, error } = await sb.from('payroll_periods').update({ status: 'locked', locked_at: now }).eq('id', id).select('*').single()
    if (error) return 'DB_ERROR'
    return mapPayrollPeriodFromRow(data)
  }
  const p = payrollPeriods.find(x => x.id === id)
  if (!p) return undefined
  p.status = 'locked'
  p.lockedAt = now.getTime()
  return p
}

export async function exportPayrollPeriod(id: string) {
  const now = new Date()
  if (isSupabaseConfigured()) {
    const sb = supabaseServer()
    const { data: period } = await sb.from('payroll_periods').select('*').eq('id', id).single()
    if (!period) return 'PERIOD_NOT_FOUND'
    const { data: lines } = await sb.from('member_payroll_lines').select('*').eq('payroll_period_id', id)
    await sb.from('payroll_periods').update({ status: 'exported', exported_at: now }).eq('id', id)
    const mapped = (lines || []).map(mapPayrollLineFromRow)
    const csv = toCSV(mapped)
    return { period: mapPayrollPeriodFromRow(period), items: mapped, csv }
  }
  const p = payrollPeriods.find(x => x.id === id)
  if (!p) return 'PERIOD_NOT_FOUND'
  p.status = 'exported'
  p.exportedAt = now.getTime()
  const items = payrollLines.filter(l => l.payrollPeriodId === id)
  const csv = toCSV(items)
  return { period: p, items, csv }
}

export async function listPayrollLines(periodId: string) {
  if (isSupabaseConfigured()) {
    const sb = supabaseServer()
    const { data } = await sb.from('member_payroll_lines').select('*').eq('payroll_period_id', periodId)
    return (data || []).map(mapPayrollLineFromRow)
  }
  return payrollLines.filter(l => l.payrollPeriodId === periodId)
}

export async function addFine(input: { memberId: string, orgId: string, date: string, reason: string, amount: number, currency: string, createdBy: string }) {
  const now = new Date()
  if (isSupabaseConfigured()) {
    const sb = supabaseServer()
    const { error } = await sb.from('member_fines').insert({ member_id: input.memberId, org_id: input.orgId, date: input.date, reason: input.reason, amount: input.amount, currency: input.currency, created_by: input.createdBy, created_at: now })
    if (error) return 'DB_ERROR'
    return 'OK'
  }
  fines.push({ id: newId(), ...input, createdAt: now.getTime() })
  return 'OK'
}

export async function listFines(input: { memberId?: string, orgId: string, periodId?: string }) {
  if (isSupabaseConfigured()) {
    const sb = supabaseServer()
    let q = sb.from('member_fines').select('*').eq('org_id', input.orgId)
    if (input.memberId) q = q.eq('member_id', input.memberId)
    if (input.periodId) {
      const { data: period } = await sb.from('payroll_periods').select('*').eq('id', input.periodId).single()
      if (period) q = q.gte('date', period.start_date).lte('date', period.end_date)
    }
    const { data } = await q
    return (data || []).map((r: any) => ({ id: r.id, memberId: r.member_id, orgId: r.org_id, date: r.date, reason: r.reason, amount: Number(r.amount), currency: r.currency, createdBy: r.created_by, createdAt: new Date(r.created_at).getTime() }))
  }
  let rows = fines.filter(f => f.orgId === input.orgId)
  if (input.memberId) rows = rows.filter(f => f.memberId === input.memberId)
  if (input.periodId) {
    const p = payrollPeriods.find(x => x.id === input.periodId)
    if (p) rows = rows.filter(f => f.date >= p.startDate && f.date <= p.endDate)
  }
  return rows
}

export async function addAdjustment(input: { memberId: string, orgId: string, date: string, reason: string, amount: number, currency: string, createdBy: string }) {
  const now = new Date()
  if (isSupabaseConfigured()) {
    const sb = supabaseServer()
    const { error } = await sb.from('member_adjustments').insert({ member_id: input.memberId, org_id: input.orgId, date: input.date, reason: input.reason, amount: input.amount, currency: input.currency, created_by: input.createdBy, created_at: now })
    if (error) return 'DB_ERROR'
    return 'OK'
  }
  adjustments.push({ id: newId(), ...input, createdAt: now.getTime() })
  return 'OK'
}

export async function listAdjustments(input: { memberId?: string, orgId: string, periodId?: string }) {
  if (isSupabaseConfigured()) {
    const sb = supabaseServer()
    let q = sb.from('member_adjustments').select('*').eq('org_id', input.orgId)
    if (input.memberId) q = q.eq('member_id', input.memberId)
    if (input.periodId) {
      const { data: period } = await sb.from('payroll_periods').select('*').eq('id', input.periodId).single()
      if (period) q = q.gte('date', period.start_date).lte('date', period.end_date)
    }
    const { data } = await q
    return (data || []).map((r: any) => ({ id: r.id, memberId: r.member_id, orgId: r.org_id, date: r.date, reason: r.reason, amount: Number(r.amount), currency: r.currency, createdBy: r.created_by, createdAt: new Date(r.created_at).getTime() }))
  }
  let rows = adjustments.filter(f => f.orgId === input.orgId)
  if (input.memberId) rows = rows.filter(f => f.memberId === input.memberId)
  if (input.periodId) {
    const p = payrollPeriods.find(x => x.id === input.periodId)
    if (p) rows = rows.filter(f => f.date >= p.startDate && f.date <= p.endDate)
  }
  return rows
}

export async function payrollSummary(orgId: string, periodId: string) {
  const period = isSupabaseConfigured() ? await (async ()=>{ const sb = supabaseServer(); const { data } = await sb.from('payroll_periods').select('*').eq('id', periodId).single(); return data ? mapPayrollPeriodFromRow(data) : undefined })() : payrollPeriods.find(p => p.id === periodId)
  if (!period || period.orgId !== orgId) return 'PERIOD_NOT_FOUND'
  const lines = await listPayrollLines(periodId)
  const users = await listUsers(orgId)
  const departments = await listDepartments(orgId)
  const deptMap = new Map(departments.map(d => [d.id, d.name]))
  const userMap = new Map(users.map(u => [u.id, u]))
  const items = lines.map(l => ({
    ...l,
    memberName: `${userMap.get(l.memberId)?.firstName || ''} ${userMap.get(l.memberId)?.lastName || ''}`.trim(),
    departmentName: deptMap.get(userMap.get(l.memberId)?.departmentId || '') || ''
  }))
  return { period, items }
}

export async function payrollMember(orgId: string, periodId: string, memberId: string) {
  const period = isSupabaseConfigured() ? await (async ()=>{ const sb = supabaseServer(); const { data } = await sb.from('payroll_periods').select('*').eq('id', periodId).single(); return data ? mapPayrollPeriodFromRow(data) : undefined })() : payrollPeriods.find(p => p.id === periodId)
  if (!period || period.orgId !== orgId) return 'PERIOD_NOT_FOUND'
  const lines = await listPayrollLines(periodId)
  const line = lines.find(l => l.memberId === memberId)
  if (!line) return 'NOT_FOUND'
  const user = (await listUsers(orgId)).find(u => u.id === memberId)
  const dept = user?.departmentId ? (await listDepartments(orgId)).find(d => d.id === user!.departmentId) : undefined
  return { period, line, memberName: `${user?.firstName || ''} ${user?.lastName || ''}`.trim(), departmentName: dept?.name || '' }
}

function toCSV(items: MemberPayrollLine[]) {
  const headers = ['memberId','totalScheduledMinutes','totalWorkedMinutes','totalExtraMinutes','totalShortMinutes','baseRate','currency','baseEarnings','extraEarnings','deductionForShort','finesTotal','adjustmentsTotal','netPayable']
  const rows = items.map(i => [i.memberId, i.totalScheduledMinutes, i.totalWorkedMinutes, i.totalExtraMinutes, i.totalShortMinutes, i.baseRate, i.currency, i.baseEarnings, i.extraEarnings, i.deductionForShort, i.finesTotal, i.adjustmentsTotal, i.netPayable].join(','))
  return [headers.join(','), ...rows].join('\n')
}
export async function generatePayrollLines(orgId: string, periodId: string) {
  const period = isSupabaseConfigured() ? await (async ()=>{ const sb = supabaseServer(); const { data } = await sb.from('payroll_periods').select('*').eq('id', periodId).single(); return data ? mapPayrollPeriodFromRow(data) : undefined })() : payrollPeriods.find(p => p.id === periodId)
  if (!period || period.orgId !== orgId) return 'PERIOD_NOT_FOUND'
  const members = await listUsers(orgId)
  const start = period.startDate
  const end = period.endDate
  for (const u of members) {
    const salaryType: SalaryType = 'monthly'
    const baseRate = Number(u.salary || 0)
    const currency = 'USD'
    if (isSupabaseConfigured()) {
      const sb = supabaseServer()
      const { data: rows } = await sb.from('daily_time_summaries').select('*').eq('member_id', u.id).eq('org_id', orgId).gte('date', start).lte('date', end)
      const d = (rows || []).map(mapDailySummaryFromRow)
      const totals = aggregateDaily(d)
      const finesTotal = await sumFinesSupabase(sb, u.id, orgId, start, end)
      const adjustmentsTotal = await sumAdjustmentsSupabase(sb, u.id, orgId, start, end)
      const line = computePayrollLine(period.id, u.id, orgId, salaryType, baseRate, currency, totals, u.workingHoursPerDay)
      line.finesTotal = finesTotal
      line.adjustmentsTotal = adjustmentsTotal
      line.netPayable = line.baseEarnings + line.extraEarnings - line.deductionForShort - line.finesTotal + line.adjustmentsTotal
      const { data: existing } = await sb.from('member_payroll_lines').select('*').eq('payroll_period_id', period.id).eq('member_id', u.id).limit(1).maybeSingle()
      if (existing) await sb.from('member_payroll_lines').update(toRow(line)).eq('id', existing.id)
      else await sb.from('member_payroll_lines').insert(toRow(line))
    } else {
      const d = dailySummaries.filter(s => s.memberId === u.id && s.orgId === orgId && s.date >= start && s.date <= end)
      const totals = aggregateDaily(d)
      const finesTotal = fines.filter(f => f.memberId === u.id && f.orgId === orgId && f.date >= start && f.date <= end).reduce((s, r) => s + r.amount, 0)
      const adjustmentsTotal = adjustments.filter(a => a.memberId === u.id && a.orgId === orgId && a.date >= start && a.date <= end).reduce((s, r) => s + r.amount, 0)
      let line = computePayrollLine(period.id, u.id, orgId, salaryType, baseRate, currency, totals, u.workingHoursPerDay)
      line.finesTotal = finesTotal
      line.adjustmentsTotal = adjustmentsTotal
      line.netPayable = line.baseEarnings + line.extraEarnings - line.deductionForShort - line.finesTotal + line.adjustmentsTotal
      const existing = payrollLines.find(l => l.payrollPeriodId === period.id && l.memberId === u.id)
      if (existing) Object.assign(existing, { ...line, id: existing.id, createdAt: existing.createdAt, updatedAt: Date.now() })
      else payrollLines.push({ ...line, id: newId(), createdAt: Date.now(), updatedAt: Date.now() })
    }
  }
  return 'OK'
}

function aggregateDaily(items: DailyTimeSummary[]) {
  const totalScheduledMinutes = items.reduce((s, r) => s + r.scheduledMinutes, 0)
  const totalWorkedMinutes = items.reduce((s, r) => s + r.workedMinutes, 0)
  const totalExtraMinutes = items.reduce((s, r) => s + r.extraMinutes, 0)
  const totalShortMinutes = items.filter(r => !r.isHoliday).reduce((s, r) => s + r.shortMinutes, 0)
  const daysPresent = items.filter(r => r.workedMinutes > 0).length
  const daysAbsent = items.filter(r => (r.scheduledMinutes > 0 && r.workedMinutes === 0 && !r.isHoliday)).length
  return { totalScheduledMinutes, totalWorkedMinutes, totalExtraMinutes, totalShortMinutes, daysPresent, daysAbsent }
}

function computePayrollLine(periodId: string, memberId: string, orgId: string, salaryType: SalaryType, baseRate: number, currency: string, totals: { totalScheduledMinutes: number, totalWorkedMinutes: number, totalExtraMinutes: number, totalShortMinutes: number, daysPresent: number, daysAbsent: number }, workingHoursPerDay?: number): MemberPayrollLine {
  const standardHours = Number(workingHoursPerDay || 8)
  let baseEarnings = 0
  if (salaryType === 'monthly') baseEarnings = baseRate
  if (salaryType === 'hourly') baseEarnings = baseRate * (totals.totalWorkedMinutes / 60)
  if (salaryType === 'daily') baseEarnings = baseRate * totals.daysPresent
  const extraEarnings = (totals.totalExtraMinutes / 60) * (baseRate / standardHours)
  const deductionForShort = (totals.totalShortMinutes / 60) * (baseRate / standardHours)
  const line: MemberPayrollLine = {
    id: '',
    payrollPeriodId: periodId,
    memberId,
    orgId,
    totalScheduledMinutes: totals.totalScheduledMinutes,
    totalWorkedMinutes: totals.totalWorkedMinutes,
    totalExtraMinutes: totals.totalExtraMinutes,
    totalShortMinutes: totals.totalShortMinutes,
    daysPresent: totals.daysPresent,
    daysAbsent: totals.daysAbsent,
    salaryType,
    baseRate,
    currency,
    baseEarnings,
    extraEarnings,
    deductionForShort,
    finesTotal: 0,
    adjustmentsTotal: 0,
    netPayable: 0,
    createdAt: Date.now(),
    updatedAt: Date.now()
  }
  return line
}

async function sumFinesSupabase(sb: any, memberId: string, orgId: string, start: string, end: string) {
  const { data } = await sb.from('member_fines').select('amount').eq('member_id', memberId).eq('org_id', orgId).gte('date', start).lte('date', end)
  return (data || []).reduce((s: number, r: any) => s + Number(r.amount || 0), 0)
}

async function sumAdjustmentsSupabase(sb: any, memberId: string, orgId: string, start: string, end: string) {
  const { data } = await sb.from('member_adjustments').select('amount').eq('member_id', memberId).eq('org_id', orgId).gte('date', start).lte('date', end)
  return (data || []).reduce((s: number, r: any) => s + Number(r.amount || 0), 0)
}

function toRow(line: MemberPayrollLine) {
  return {
    payroll_period_id: line.payrollPeriodId,
    member_id: line.memberId,
    org_id: line.orgId,
    total_scheduled_minutes: line.totalScheduledMinutes,
    total_worked_minutes: line.totalWorkedMinutes,
    total_extra_minutes: line.totalExtraMinutes,
    total_short_minutes: line.totalShortMinutes,
    days_present: line.daysPresent,
    days_absent: line.daysAbsent,
    salary_type: line.salaryType,
    base_rate: line.baseRate,
    currency: line.currency,
    base_earnings: line.baseEarnings,
    extra_earnings: line.extraEarnings,
    deduction_for_short: line.deductionForShort,
    fines_total: line.finesTotal,
    adjustments_total: line.adjustmentsTotal,
    net_payable: line.netPayable,
    notes: line.notes ?? null,
    created_at: new Date(line.createdAt),
    updated_at: new Date(line.updatedAt)
  }
}

function mapSurveyFromRow(row: any): Survey {
  return { id: row.id, orgId: row.org_id, title: row.title, description: row.description || undefined, isAnonymous: !!row.is_anonymous, createdBy: row.created_by, createdAt: new Date(row.created_at).getTime(), closesAt: row.closes_at ? new Date(row.closes_at).getTime() : undefined }
}

function mapSurveyQuestionFromRow(row: any): SurveyQuestion {
  return { id: row.id, surveyId: row.survey_id, questionType: row.question_type, questionText: row.question_text, options: Array.isArray(row.options) ? row.options : undefined }
}

function mapSurveyResponseFromRow(row: any): SurveyResponse {
  return { id: row.id, surveyId: row.survey_id, questionId: row.question_id, memberId: row.member_id || undefined, orgId: row.org_id, answerText: row.answer_text || undefined, answerNumeric: row.answer_numeric !== null && row.answer_numeric !== undefined ? Number(row.answer_numeric) : undefined, createdAt: new Date(row.created_at).getTime() }
}

export async function createSurvey(input: { orgId: string, title: string, description?: string, isAnonymous?: boolean, createdBy: string, closesAt?: string, questions: { questionType: 'scale'|'text'|'mcq', questionText: string, options?: string[] }[] }): Promise<{ survey: Survey, questions: SurveyQuestion[] } | 'DB_ERROR'> {
  const now = new Date()
  if (isSupabaseConfigured()) {
    const sb = supabaseServer()
    const { data: sRow, error: sErr } = await sb.from('surveys').insert({ org_id: input.orgId, title: input.title, description: input.description ?? null, is_anonymous: input.isAnonymous ?? true, created_by: input.createdBy, created_at: now, closes_at: input.closesAt ?? null }).select('*').single()
    if (sErr) return 'DB_ERROR'
    const survey = mapSurveyFromRow(sRow)
    const qPayloads = input.questions.map(q => ({ survey_id: survey.id, question_type: q.questionType, question_text: q.questionText, options: q.options ?? null }))
    const { data: qRows, error: qErr } = await sb.from('survey_questions').insert(qPayloads).select('*')
    if (qErr) return 'DB_ERROR'
    const questions = (qRows || []).map(mapSurveyQuestionFromRow)
    return { survey, questions }
  }
  const survey: Survey = { id: newId(), orgId: input.orgId, title: input.title, description: input.description, isAnonymous: input.isAnonymous ?? true, createdBy: input.createdBy, createdAt: now.getTime(), closesAt: input.closesAt ? new Date(input.closesAt).getTime() : undefined }
  surveysMem.push(survey)
  const questions: SurveyQuestion[] = input.questions.map(q => ({ id: newId(), surveyId: survey.id, questionType: q.questionType, questionText: q.questionText, options: q.options }))
  surveyQuestionsMem.push(...questions)
  return { survey, questions }
}

export async function listSurveys(orgId: string): Promise<Survey[]> {
  if (isSupabaseConfigured()) {
    const sb = supabaseServer()
    const { data } = await sb.from('surveys').select('*').eq('org_id', orgId).order('created_at', { ascending: false })
    return (data || []).map(mapSurveyFromRow)
  }
  return surveysMem.filter(s => s.orgId === orgId).sort((a,b)=> b.createdAt - a.createdAt)
}

export async function getSurveyDetail(surveyId: string): Promise<{ survey: Survey, questions: SurveyQuestion[] } | undefined> {
  if (isSupabaseConfigured()) {
    const sb = supabaseServer()
    const { data: sRow } = await sb.from('surveys').select('*').eq('id', surveyId).limit(1).maybeSingle()
    if (!sRow) return undefined
    const survey = mapSurveyFromRow(sRow)
    const { data: qRows } = await sb.from('survey_questions').select('*').eq('survey_id', surveyId)
    const questions = (qRows || []).map(mapSurveyQuestionFromRow)
    return { survey, questions }
  }
  const survey = surveysMem.find(s => s.id === surveyId)
  if (!survey) return undefined
  const questions = surveyQuestionsMem.filter(q => q.surveyId === surveyId)
  return { survey, questions }
}

export async function submitSurveyResponses(input: { surveyId: string, orgId: string, memberId: string, answers: { questionId: string, answerText?: string, answerNumeric?: number }[] }): Promise<'OK'|'DB_ERROR'|'SURVEY_NOT_FOUND'|'ORG_MISMATCH'> {
  const s = await getSurveyDetail(input.surveyId)
  if (!s) return 'SURVEY_NOT_FOUND'
  if (s.survey.orgId !== input.orgId) return 'ORG_MISMATCH'
  const now = new Date()
  const memberIdToStore = s.survey.isAnonymous ? undefined : input.memberId
  if (isSupabaseConfigured()) {
    const sb = supabaseServer()
    const payloads = input.answers.map(a => ({ survey_id: input.surveyId, question_id: a.questionId, member_id: memberIdToStore ?? null, org_id: input.orgId, answer_text: a.answerText ?? null, answer_numeric: a.answerNumeric ?? null, created_at: now }))
    const { error } = await sb.from('survey_responses').insert(payloads)
    if (error) return 'DB_ERROR'
    return 'OK'
  }
  for (const a of input.answers) surveyResponsesMem.push({ id: newId(), surveyId: input.surveyId, questionId: a.questionId, memberId: memberIdToStore, orgId: input.orgId, answerText: a.answerText, answerNumeric: a.answerNumeric, createdAt: now.getTime() })
  return 'OK'
}

export async function getSurveyResults(input: { surveyId: string, groupBy?: 'department'|'role' }): Promise<any> {
  const detail = await getSurveyDetail(input.surveyId)
  if (!detail) return { error: 'SURVEY_NOT_FOUND' }
  const orgId = detail.survey.orgId
  const questions = detail.questions
  if (isSupabaseConfigured()) {
    const sb = supabaseServer()
    const { data: rows } = await sb.from('survey_responses').select('*').eq('survey_id', input.surveyId)
    const responses = (rows || []).map(mapSurveyResponseFromRow)
    const users = await listUsers(orgId)
    const depMap = new Map(users.map(u => [u.id, u.departmentId || '']))
    const roleMap = new Map(users.map(u => [u.id, u.roleId || '']))
    return aggregateSurvey(questions, responses, input.groupBy, depMap, roleMap)
  }
  const responses = surveyResponsesMem.filter(r => r.surveyId === input.surveyId)
  const users = await listUsers(orgId)
  const depMap = new Map(users.map(u => [u.id, u.departmentId || '']))
  const roleMap = new Map(users.map(u => [u.id, u.roleId || '']))
  return aggregateSurvey(questions, responses, input.groupBy, depMap, roleMap)
}

function aggregateSurvey(questions: SurveyQuestion[], responses: SurveyResponse[], groupBy: 'department'|'role'|undefined, depMap: Map<string,string>, roleMap: Map<string,string>) {
  const byQ = new Map<string, SurveyResponse[]>(questions.map(q => [q.id, []]))
  for (const r of responses) {
    const arr = byQ.get(r.questionId)
    if (arr) arr.push(r)
  }
  function statsFor(q: SurveyQuestion, arr: SurveyResponse[]) {
    if (q.questionType === 'scale') {
      const nums = arr.map(a => Number(a.answerNumeric || 0)).filter(n => !isNaN(n))
      const count = nums.length
      const avg = count ? nums.reduce((s, n) => s + n, 0) / count : 0
      return { count, avg }
    }
    if (q.questionType === 'mcq') {
      const dist: Record<string, number> = {}
      const opts = Array.isArray(q.options) ? q.options : []
      for (const o of opts) dist[o] = 0
      for (const a of arr) {
        const t = (a.answerText || '').trim()
        if (t) dist[t] = (dist[t] || 0) + 1
      }
      const count = arr.length
      return { count, distribution: dist }
    }
    const texts = arr.map(a => a.answerText || '').filter(Boolean)
    const count = texts.length
    return { count, texts }
  }
  const base = questions.map(q => ({ questionId: q.id, questionType: q.questionType, ...statsFor(q, byQ.get(q.id) || []) }))
  if (!groupBy) return { questions: base }
  const groups = new Map<string, SurveyResponse[]>()
  for (const r of responses) {
    const key = groupBy === 'department' ? depMap.get(String(r.memberId)) || '' : roleMap.get(String(r.memberId)) || ''
    const k = key || 'unknown'
    const arr = groups.get(k) || []
    arr.push(r)
    groups.set(k, arr)
  }
  const outGroups: { group_id: string, question_stats: any[] }[] = []
  for (const [gid, arr] of groups.entries()) {
    const byQ2 = new Map<string, SurveyResponse[]>(questions.map(q => [q.id, []]))
    for (const r of arr) {
      const a = byQ2.get(r.questionId)
      if (a) a.push(r)
    }
    const stats = questions.map(q => ({ questionId: q.id, questionType: q.questionType, ...statsFor(q, byQ2.get(q.id) || []) }))
    outGroups.push({ group_id: gid, question_stats: stats })
  }
  return { questions: base, groups: outGroups }
}

export async function listSurveyResponses(surveyId: string): Promise<SurveyResponse[]> {
  if (isSupabaseConfigured()) {
    const sb = supabaseServer()
    const { data } = await sb.from('survey_responses').select('*').eq('survey_id', surveyId)
    return (data || []).map(mapSurveyResponseFromRow)
  }
  return surveyResponsesMem.filter(r => r.surveyId === surveyId)
}

function mapRetentionFromRow(row: any): DataRetentionPolicy {
  return { id: String(row.id), orgId: String(row.org_id), category: String(row.category), retentionDays: Number(row.retention_days || 0), hardDelete: !!row.hard_delete, createdAt: new Date(row.created_at).getTime() }
}

function mapPrivacyRequestFromRow(row: any): PrivacyRequest {
  return {
    id: String(row.id),
    orgId: String(row.org_id),
    userId: row.user_id ? String(row.user_id) : undefined,
    subjectType: String(row.subject_type),
    subjectId: String(row.subject_id),
    requestType: String(row.request_type) as any,
    status: String(row.status) as any,
    createdAt: new Date(row.created_at).getTime(),
    processedAt: row.processed_at ? new Date(row.processed_at).getTime() : undefined,
    processedBy: row.processed_by ? String(row.processed_by) : undefined,
    notes: row.notes ?? undefined
  }
}

export async function listRetentionPolicies(orgId: string): Promise<DataRetentionPolicy[]> {
  if (isSupabaseConfigured()) {
    const sb = supabaseServer()
    const { data } = await sb.from('data_retention_policies').select('*').eq('org_id', orgId).order('created_at', { ascending: true })
    return (data || []).map(mapRetentionFromRow)
  }
  return retentionPoliciesMem.filter(p => p.orgId === orgId)
}

export async function upsertRetentionPolicies(orgId: string, items: { category: string, retentionDays: number, hardDelete: boolean }[]): Promise<DataRetentionPolicy[] | 'DB_ERROR'> {
  if (isSupabaseConfigured()) {
    const sb = supabaseServer()
    const { data: existing } = await sb.from('data_retention_policies').select('*').eq('org_id', orgId)
    const now = new Date()
    for (const it of items) {
      const prev = (existing || []).find((r: any) => String(r.category) === it.category)
      if (prev) {
        const { error } = await sb.from('data_retention_policies').update({ retention_days: it.retentionDays, hard_delete: it.hardDelete }).eq('id', prev.id)
        if (error) return 'DB_ERROR'
      } else {
        const { error } = await sb.from('data_retention_policies').insert({ org_id: orgId, category: it.category, retention_days: it.retentionDays, hard_delete: it.hardDelete, created_at: now })
        if (error) return 'DB_ERROR'
      }
    }
    const { data } = await sb.from('data_retention_policies').select('*').eq('org_id', orgId)
    return (data || []).map(mapRetentionFromRow)
  }
  for (const it of items) {
    const prev = retentionPoliciesMem.find(p => p.orgId === orgId && p.category === it.category)
    if (prev) {
      prev.retentionDays = it.retentionDays
      prev.hardDelete = it.hardDelete
    } else {
      retentionPoliciesMem.push({ id: newId(), orgId, category: it.category, retentionDays: it.retentionDays, hardDelete: it.hardDelete, createdAt: Date.now() })
    }
  }
  return retentionPoliciesMem.filter(p => p.orgId === orgId)
}

export async function createPrivacyRequest(input: { orgId: string, userId?: string, subjectType: 'user'|'member', subjectId: string, requestType: 'export'|'anonymize'|'delete' }): Promise<PrivacyRequest | 'DB_ERROR'> {
  if (isSupabaseConfigured()) {
    const sb = supabaseServer()
    const now = new Date()
    const { data, error } = await sb.from('privacy_requests').insert({ org_id: input.orgId, user_id: input.userId ?? null, subject_type: input.subjectType, subject_id: input.subjectId, request_type: input.requestType, status: 'pending', created_at: now }).select('*').single()
    if (error) return 'DB_ERROR'
    return mapPrivacyRequestFromRow(data)
  }
  const req: PrivacyRequest = { id: newId(), orgId: input.orgId, userId: input.userId, subjectType: input.subjectType, subjectId: input.subjectId, requestType: input.requestType, status: 'pending', createdAt: Date.now() }
  privacyRequestsMem.push(req)
  return req
}

export async function listPrivacyRequests(orgId: string, status?: PrivacyRequestStatus): Promise<PrivacyRequest[]> {
  if (isSupabaseConfigured()) {
    const sb = supabaseServer()
    let q = sb.from('privacy_requests').select('*').eq('org_id', orgId)
    if (status) q = q.eq('status', status)
    const { data } = await q.order('created_at', { ascending: false })
    return (data || []).map(mapPrivacyRequestFromRow)
  }
  const arr = privacyRequestsMem.filter(r => r.orgId === orgId)
  return status ? arr.filter(r => r.status === status) : arr
}

async function buildExportData(orgId: string, subjectId: string): Promise<any> {
  if (isSupabaseConfigured()) {
    const sb = supabaseServer()
    const { data: userRow } = await sb.from('users').select('*').eq('id', subjectId).eq('org_id', orgId).maybeSingle()
    const { data: tsRows } = await sb.from('time_sessions').select('*').eq('org_id', orgId).eq('member_id', subjectId)
    const { data: dailyRows } = await sb.from('daily_time_summaries').select('*').eq('org_id', orgId).eq('member_id', subjectId)
    const { data: leaveRows } = await sb.from('leave_requests').select('*').eq('org_id', orgId).eq('member_id', subjectId)
    const { data: trackingRows } = await sb.from('tracking_sessions').select('*').eq('org_id', orgId).eq('member_id', subjectId)
    const { data: evRows } = await sb.from('activity_events').select('*').in('tracking_session_id', (trackingRows || []).map((r: any) => r.id))
    const { data: shotRows } = await sb.from('screenshots').select('*').in('tracking_session_id', (trackingRows || []).map((r: any) => r.id))
    return { user: userRow || null, time_sessions: tsRows || [], daily_time_summaries: dailyRows || [], leave_requests: leaveRows || [], tracking_sessions: trackingRows || [], activity_events: evRows || [], screenshots: shotRows || [] }
  }
  const u = users.find(x => x.id === subjectId && x.orgId === orgId) || null
  const ts = timeSessions.filter(s => s.memberId === subjectId && s.orgId === orgId)
  const ds = dailySummaries.filter(s => s.memberId === subjectId && s.orgId === orgId)
  const lr: any[] = []
  const tr = trackingSessions.filter(t => t.memberId === subjectId && t.orgId === orgId)
  const ev = activityEvents.filter(e => tr.some(t => t.id === e.trackingSessionId))
  const sc = screenshots.filter(s => tr.some(t => t.id === s.trackingSessionId))
  return { user: u, time_sessions: ts, daily_time_summaries: ds, leave_requests: lr, tracking_sessions: tr, activity_events: ev, screenshots: sc }
}

export async function processPrivacyRequest(id: string, actorUserId: string): Promise<PrivacyRequest | 'NOT_FOUND' | 'DB_ERROR' | 'FORBIDDEN'> {
  if (isSupabaseConfigured()) {
    const sb = supabaseServer()
    const { data: req } = await sb.from('privacy_requests').select('*').eq('id', id).maybeSingle()
    if (!req) return 'NOT_FOUND'
    const now = new Date()
    await sb.from('privacy_requests').update({ status: 'in_progress' }).eq('id', id)
    if (String(req.request_type) === 'export') {
      const bundle = await buildExportData(String(req.org_id), String(req.subject_id))
      const note = JSON.stringify(bundle)
      const { data, error } = await sb.from('privacy_requests').update({ status: 'completed', processed_at: now, processed_by: actorUserId || null, notes: note }).eq('id', id).select('*').single()
      if (error) return 'DB_ERROR'
      return mapPrivacyRequestFromRow(data)
    }
    if (String(req.request_type) === 'anonymize' || String(req.request_type) === 'delete') {
      const email = `anon-${id}@example.local`
      const { error: upErr } = await sb.from('users').update({ first_name: 'Anonymous', last_name: '', email, position_title: null, profile_image: null }).eq('id', req.subject_id).eq('org_id', req.org_id)
      if (upErr) return 'DB_ERROR'
      if (String(req.request_type) === 'delete') {
        await sb.from('users').update({ status: 'inactive' }).eq('id', req.subject_id).eq('org_id', req.org_id)
      }
      const { data, error } = await sb.from('privacy_requests').update({ status: 'completed', processed_at: now, processed_by: actorUserId || null, notes: String(req.request_type) === 'delete' ? 'soft_deleted' : 'anonymized' }).eq('id', id).select('*').single()
      if (error) return 'DB_ERROR'
      return mapPrivacyRequestFromRow(data)
    }
    const { data, error } = await sb.from('privacy_requests').update({ status: 'rejected', processed_at: now, processed_by: actorUserId || null, notes: 'unsupported' }).eq('id', id).select('*').single()
    if (error) return 'DB_ERROR'
    return mapPrivacyRequestFromRow(data)
  }
  const req = privacyRequestsMem.find(r => r.id === id)
  if (!req) return 'NOT_FOUND'
  req.status = 'in_progress'
  if (req.requestType === 'export') {
    const bundle = await buildExportData(req.orgId, req.subjectId)
    req.notes = JSON.stringify(bundle)
  } else if (req.requestType === 'anonymize' || req.requestType === 'delete') {
    const u = users.find(x => x.id === req.subjectId && x.orgId === req.orgId)
    if (u) {
      u.firstName = 'Anonymous'
      u.lastName = ''
      u.email = `anon-${id}@example.local`
      u.positionTitle = undefined as any
      u.profileImage = undefined as any
      if (req.requestType === 'delete') u.status = 'inactive'
    }
    req.notes = req.requestType === 'delete' ? 'soft_deleted' : 'anonymized'
  } else {
    req.status = 'rejected'
    req.notes = 'unsupported'
  }
  req.status = req.status === 'rejected' ? 'rejected' : 'completed'
  req.processedAt = Date.now()
  req.processedBy = actorUserId
  return req
}

export async function runRetentionCleanup(): Promise<{ processed: number }> {
  if (isSupabaseConfigured()) {
    const sb = supabaseServer()
    const { data: policies } = await sb.from('data_retention_policies').select('*')
    const list = (policies || [])
    let processed = 0
    for (const p of list) {
      const days = Number(p.retention_days || 0)
      const cutoff = new Date()
      cutoff.setDate(cutoff.getDate() - days)
      if (String(p.category) === 'activity_logs') {
        if (p.hard_delete) {
          const { error } = await sb.from('activity_events').delete().lt('timestamp', cutoff)
          if (!error) processed++
        } else {
          const { error } = await sb.from('activity_events').update({ window_title: '', url: null, keyboard_activity_score: null, mouse_activity_score: null }).lt('timestamp', cutoff)
          if (!error) processed++
        }
      } else if (String(p.category) === 'screenshots') {
        if (p.hard_delete) {
          const { error } = await sb.from('screenshots').delete().lt('timestamp', cutoff)
          if (!error) processed++
        } else {
          const { error } = await sb.from('screenshots').update({ storage_path: '', thumbnail_path: '' }).lt('timestamp', cutoff)
          if (!error) processed++
        }
      } else if (String(p.category) === 'time_logs') {
        if (p.hard_delete) {
          await sb.from('daily_time_summaries').delete().lt('date', cutoff.toISOString().slice(0,10)).eq('org_id', p.org_id)
          await sb.from('time_sessions').delete().lt('date', cutoff.toISOString().slice(0,10)).eq('org_id', p.org_id)
          processed++
        }
      } else if (String(p.category) === 'audit_logs') {
        if (p.hard_delete) {
          const { error } = await sb.from('timesheet_audit_log').delete().lt('created_at', cutoff).eq('org_id', p.org_id)
          if (!error) processed++
        }
      }
    }
    return { processed }
  }
  let processed = 0
  processed++
  return { processed }
}
