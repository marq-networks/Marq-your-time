import { isSupabaseConfigured, supabaseServer } from './supabase'
import { listUsers, listDepartments, listTeamMemberIds } from './db'

type ReportFormat = 'csv'|'xlsx'|'pdf'
type ReportType = 'attendance'|'timesheet'|'activity'|'payroll'|'billing'|'leave'

type BaseParams = {
  date_start: string
  date_end: string
  member_ids?: string[]
  department_ids?: string[]
  manager_id?: string
  member_role_ids?: string[]
  include_inactive?: boolean
}

export type AttendanceRow = {
  org: string
  department: string
  member: string
  date: string
  first_check_in?: string
  last_check_out?: string
  worked_minutes: number
  extra_minutes: number
  short_minutes: number
  status: string
}

export type TimesheetRow = {
  org: string
  department: string
  member: string
  date: string
  session_start: string
  session_end?: string
  session_minutes: number
  breaks_minutes: number
  daily_total_minutes: number
}

export type ActivityRow = {
  org: string
  department: string
  member: string
  date: string
  active_minutes: number
  idle_minutes: number
  top_apps: string
  top_urls: string
  screenshots_count: number
  activity_score?: number
}

export type PayrollRow = {
  org: string
  department: string
  member: string
  period: string
  base_salary: number
  worked_minutes: number
  extra_minutes: number
  short_minutes: number
  fines_total: number
  adjustments_total: number
  net_salary: number
}

export type BillingRow = {
  org_name: string
  plan_code: string
  plan_name?: string
  seats: number
  status: string
  start_date?: string
  trial_end?: string
  cancelled_date?: string
  mrr: number
}

export type LeaveRow = {
  org: string
  department: string
  member: string
  leave_type: string
  start_date: string
  end_date: string
  days_count: number
  status: string
  paid: boolean
}

export async function generateAttendanceReport(org_id: string, params: BaseParams): Promise<AttendanceRow[]|string> {
  if (!isSupabaseConfigured()) return 'SUPABASE_REQUIRED'
  const sb = supabaseServer()
  const users = await listUsers(org_id)
  const deps = await listDepartments(org_id)
  const depMap = new Map(deps.map(d => [d.id, d.name]))
  const userMap = new Map(users.map(u => [u.id, u]))
  let memberIds = users.map(u => u.id)
  if (params.member_ids && params.member_ids.length) memberIds = memberIds.filter(id => params.member_ids!.includes(id))
  if (params.department_ids && params.department_ids.length) memberIds = memberIds.filter(id => {
    const u = userMap.get(id)
    return u?.departmentId && params.department_ids!.includes(u.departmentId)
  })
  if (params.manager_id) {
    const team = await listTeamMemberIds(org_id, params.manager_id)
    memberIds = memberIds.filter(id => team.includes(id))
  }
  if (params.member_role_ids && params.member_role_ids.length) {
    memberIds = memberIds.filter(id => {
      const u = userMap.get(id)
      return u?.memberRoleId && params.member_role_ids!.includes(u.memberRoleId)
    })
  }
  const { data: daily } = await sb.from('daily_time_summaries').select('*').eq('org_id', org_id).in('member_id', memberIds).gte('date', params.date_start).lte('date', params.date_end)
  const { data: sess } = await sb.from('time_sessions').select('*').eq('org_id', org_id).in('member_id', memberIds).gte('date', params.date_start).lte('date', params.date_end).eq('status','closed')
  const { data: leaves } = await sb.from('leave_requests').select('*').eq('org_id', org_id).eq('status','approved').in('member_id', memberIds).gte('start_date', params.date_start).lte('end_date', params.date_end)
  const leaveByMember: Record<string, { start: string, end: string }[]> = {}
  for (const lr of (leaves||[])) {
    const arr = leaveByMember[lr.member_id] || []
    arr.push({ start: lr.start_date, end: lr.end_date })
    leaveByMember[lr.member_id] = arr
  }
  const sessByKey = new Map<string, any[]>()
  for (const s of (sess||[])) {
    const key = `${s.member_id}|${s.date}`
    const arr = sessByKey.get(key) || []
    arr.push(s)
    sessByKey.set(key, arr)
  }
  const out: AttendanceRow[] = []
  for (const d of (daily||[])) {
    const u = userMap.get(d.member_id)
    if (!u) continue
    const sessions = sessByKey.get(`${d.member_id}|${d.date}`) || []
    const first = sessions.length ? new Date(sessions[0].start_time).toISOString() : undefined
    const last = sessions.length ? new Date(sessions[sessions.length-1].end_time || sessions[sessions.length-1].start_time).toISOString() : undefined
    let status = d.status
    const lr = leaveByMember[d.member_id] || []
    if (lr.some(r => d.date >= r.start && d.date <= r.end)) status = 'leave'
    out.push({
      org: org_id,
      department: u.departmentId ? (depMap.get(u.departmentId) || '') : '',
      member: `${u.firstName} ${u.lastName}`.trim(),
      date: d.date,
      first_check_in: first,
      last_check_out: last,
      worked_minutes: Number(d.worked_minutes||0),
      extra_minutes: Number(d.extra_minutes||0),
      short_minutes: Number(d.short_minutes||0),
      status
    })
  }
  return out
}

export async function generateTimesheetReport(org_id: string, params: BaseParams): Promise<TimesheetRow[]|string> {
  if (!isSupabaseConfigured()) return 'SUPABASE_REQUIRED'
  const sb = supabaseServer()
  const users = await listUsers(org_id)
  const deps = await listDepartments(org_id)
  const depMap = new Map(deps.map(d => [d.id, d.name]))
  const userMap = new Map(users.map(u => [u.id, u]))
  let memberIds = users.map(u => u.id)
  if (params.member_ids && params.member_ids.length) memberIds = memberIds.filter(id => params.member_ids!.includes(id))
  if (params.department_ids && params.department_ids.length) memberIds = memberIds.filter(id => {
    const u = userMap.get(id)
    return u?.departmentId && params.department_ids!.includes(u.departmentId)
  })
  if (params.manager_id) {
    const team = await listTeamMemberIds(org_id, params.manager_id)
    memberIds = memberIds.filter(id => team.includes(id))
  }
  if (params.member_role_ids && params.member_role_ids.length) {
    memberIds = memberIds.filter(id => {
      const u = userMap.get(id)
      return u?.memberRoleId && params.member_role_ids!.includes(u.memberRoleId)
    })
  }
  const { data: sess } = await sb.from('time_sessions').select('*').eq('org_id', org_id).in('member_id', memberIds).gte('date', params.date_start).lte('date', params.date_end).eq('status','closed').order('start_time', { ascending: true })
  const sessIds = (sess||[]).map((r:any)=> r.id)
  const { data: br } = await sb.from('break_sessions').select('*').in('time_session_id', sessIds)
  const breaksBySess = new Map<string, any[]>();
  for (const b of (br||[])) { const arr = breaksBySess.get(b.time_session_id) || []; arr.push(b); breaksBySess.set(b.time_session_id, arr) }
  const dailyTotals: Record<string, number> = {}
  const out: TimesheetRow[] = []
  for (const s of (sess||[])) {
    const u = userMap.get(s.member_id)
    if (!u) continue
    const dep = u.departmentId ? (depMap.get(u.departmentId) || '') : ''
    const brs = breaksBySess.get(s.id) || []
    const brMin = brs.reduce((sum:number, r:any)=> sum + Number(r.total_minutes||0), 0)
    const sessMin = Number(s.total_minutes||0)
    const key = `${s.member_id}|${s.date}`
    dailyTotals[key] = (dailyTotals[key]||0) + sessMin
    out.push({ org: org_id, department: dep, member: `${u.firstName} ${u.lastName}`.trim(), date: s.date, session_start: new Date(s.start_time).toISOString(), session_end: s.end_time ? new Date(s.end_time).toISOString() : undefined, session_minutes: sessMin, breaks_minutes: brMin, daily_total_minutes: dailyTotals[key] })
  }
  return out
}

export async function generateActivityReport(org_id: string, params: BaseParams): Promise<ActivityRow[]|string> {
  if (!isSupabaseConfigured()) return 'SUPABASE_REQUIRED'
  const sb = supabaseServer()
  const users = await listUsers(org_id)
  const deps = await listDepartments(org_id)
  const depMap = new Map(deps.map(d => [d.id, d.name]))
  const userMap = new Map(users.map(u => [u.id, u]))
  let memberIds = users.map(u => u.id)
  if (params.member_ids && params.member_ids.length) memberIds = memberIds.filter(id => params.member_ids!.includes(id))
  if (params.department_ids && params.department_ids.length) memberIds = memberIds.filter(id => {
    const u = userMap.get(id)
    return u?.departmentId && params.department_ids!.includes(u.departmentId)
  })
  if (params.manager_id) {
    const team = await listTeamMemberIds(org_id, params.manager_id)
    memberIds = memberIds.filter(id => team.includes(id))
  }
  if (params.member_role_ids && params.member_role_ids.length) {
    memberIds = memberIds.filter(id => {
      const u = userMap.get(id)
      return u?.memberRoleId && params.member_role_ids!.includes(u.memberRoleId)
    })
  }
  const { data: ts } = await sb.from('tracking_sessions').select('id, member_id, org_id, started_at, ended_at').eq('org_id', org_id).in('member_id', memberIds).gte('started_at', params.date_start).lte('started_at', params.date_end)
  const tsIds = (ts||[]).map((r:any)=> r.id)
  const { data: ev } = await sb.from('activity_events').select('*').in('tracking_session_id', tsIds)
  const { data: shots } = await sb.from('screenshots').select('tracking_session_id').in('tracking_session_id', tsIds)
  type Key = string
  const agg: Map<Key, { active: Set<string>, idle: Set<string>, apps: Map<string, number>, urls: Map<string, number>, shots: number }> = new Map()
  for (const e of (ev||[])) {
    const tsRow = (ts||[]).find((t:any)=> t.id === e.tracking_session_id)
    if (!tsRow) continue
    const dt = new Date(e.timestamp)
    const date = dt.toISOString().slice(0,10)
    const minute = dt.toISOString().slice(0,16)
    const key = `${tsRow.member_id}|${date}`
    const cur = agg.get(key) || { active: new Set(), idle: new Set(), apps: new Map(), urls: new Map(), shots: 0 }
    if (e.is_active) cur.active.add(minute); else cur.idle.add(minute)
    const app = String(e.app_name||'').trim()
    const url = sanitizeUrl(String(e.url||'').trim())
    if (app) cur.apps.set(app, (cur.apps.get(app)||0)+1)
    if (url) cur.urls.set(url, (cur.urls.get(url)||0)+1)
    agg.set(key, cur)
  }
  for (const s of (shots||[])) {
    const tsRow = (ts||[]).find((t:any)=> t.id === s.tracking_session_id)
    if (!tsRow) continue
    const date = new Date(tsRow.started_at).toISOString().slice(0,10)
    const key = `${tsRow.member_id}|${date}`
    const cur = agg.get(key) || { active: new Set(), idle: new Set(), apps: new Map(), urls: new Map(), shots: 0 }
    cur.shots += 1
    agg.set(key, cur)
  }
  const out: ActivityRow[] = []
  for (const [key, val] of agg.entries()) {
    const [memberId, date] = key.split('|')
    const u = userMap.get(memberId)
    if (!u) continue
    const topApps = [...val.apps.entries()].sort((a,b)=>b[1]-a[1]).slice(0,3).map(([k,v])=>`${k}(${v})`).join('; ')
    const topUrls = [...val.urls.entries()].sort((a,b)=>b[1]-a[1]).slice(0,3).map(([k,v])=>`${k}(${v})`).join('; ')
    out.push({ org: org_id, department: u.departmentId ? (depMap.get(u.departmentId)||'') : '', member: `${u.firstName} ${u.lastName}`.trim(), date, active_minutes: val.active.size, idle_minutes: val.idle.size, top_apps: topApps, top_urls: topUrls, screenshots_count: val.shots, activity_score: undefined })
  }
  return out
}

function sanitizeUrl(u: string) {
  if (!u) return ''
  try { const url = new URL(u); return `${url.protocol}//${url.host}${url.pathname}` } catch { return u.split('?')[0].split('#')[0] }
}

export async function generatePayrollReport(org_id: string, params: BaseParams & { payroll_period_id?: string }): Promise<PayrollRow[]|string> {
  if (!isSupabaseConfigured()) return 'SUPABASE_REQUIRED'
  const sb = supabaseServer()
  const users = await listUsers(org_id)
  const deps = await listDepartments(org_id)
  const depMap = new Map(deps.map(d => [d.id, d.name]))
  const userMap = new Map(users.map(u => [u.id, u]))
  let memberIds = users.map(u => u.id)
  if (params.member_ids && params.member_ids.length) memberIds = memberIds.filter(id => params.member_ids!.includes(id))
  if (params.department_ids && params.department_ids.length) memberIds = memberIds.filter(id => {
    const u = userMap.get(id)
    return u?.departmentId && params.department_ids!.includes(u.departmentId)
  })
  if (params.manager_id) {
    const team = await listTeamMemberIds(org_id, params.manager_id)
    memberIds = memberIds.filter(id => team.includes(id))
  }
  if (params.member_role_ids && params.member_role_ids.length) {
    memberIds = memberIds.filter(id => {
      const u = userMap.get(id)
      return u?.memberRoleId && params.member_role_ids!.includes(u.memberRoleId)
    })
  }
  let rows: any[] = []
  if (params.payroll_period_id) {
    const { data: period } = await sb.from('payroll_periods').select('*').eq('id', params.payroll_period_id).maybeSingle()
    if (params as any && (params as any).status && period && period.status !== (params as any).status) return []
    const { data } = await sb.from('member_payroll_lines').select('*').eq('org_id', org_id).eq('payroll_period_id', params.payroll_period_id).in('member_id', memberIds)
    rows = data || []
  } else {
    const { data } = await sb.from('daily_time_summaries').select('*').eq('org_id', org_id).in('member_id', memberIds).gte('date', params.date_start).lte('date', params.date_end)
    const byMember = new Map<string, any[]>()
    for (const d of (data||[])) { const arr = byMember.get(d.member_id)||[]; arr.push(d); byMember.set(d.member_id, arr) }
    for (const id of memberIds) {
      const u = userMap.get(id)
      if (!u) continue
      const arr = byMember.get(id) || []
      const worked = arr.reduce((s,r)=> s + Number(r.worked_minutes||0), 0)
      const extra = arr.reduce((s,r)=> s + Number(r.extra_minutes||0), 0)
      const short = arr.reduce((s,r)=> s + Number(r.short_minutes||0), 0)
      const { data: fines } = await sb.from('member_fines').select('amount').eq('org_id', org_id).eq('member_id', id).gte('date', params.date_start).lte('date', params.date_end)
      const { data: adjs } = await sb.from('member_adjustments').select('amount').eq('org_id', org_id).eq('member_id', id).gte('date', params.date_start).lte('date', params.date_end)
      const finesTotal = (fines||[]).reduce((s:number,r:any)=> s + Number(r.amount||0), 0)
      const adjustmentsTotal = (adjs||[]).reduce((s:number,r:any)=> s + Number(r.amount||0), 0)
      const baseSalary = Number(u.salary||0)
      const standardHours = Number(u.workingHoursPerDay||8)
      const extraEarnings = (extra/60) * (baseSalary / standardHours)
      const shortDeduction = (short/60) * (baseSalary / standardHours)
      const net = baseSalary + extraEarnings - shortDeduction - finesTotal + adjustmentsTotal
      rows.push({ member_id: id, org_id: org_id, department_id: u.departmentId ?? null, worked_minutes: worked, extra_minutes: extra, short_minutes: short, base_rate: baseSalary, net_salary: net, fines_total: finesTotal, adjustments_total: adjustmentsTotal })
    }
  }
  const out: PayrollRow[] = []
  for (const r of rows) {
    const u = userMap.get(r.member_id)
    if (!u) continue
    out.push({ org: org_id, department: u.departmentId ? (depMap.get(u.departmentId)||'') : '', member: `${u.firstName} ${u.lastName}`.trim(), period: params.payroll_period_id ? `${params.payroll_period_id}` : `${params.date_start} → ${params.date_end}`, base_salary: Number(r.base_rate||0), worked_minutes: Number(r.total_worked_minutes||r.worked_minutes||0), extra_minutes: Number(r.total_extra_minutes||r.extra_minutes||0), short_minutes: Number(r.total_short_minutes||r.short_minutes||0), fines_total: Number(r.fines_total||0), adjustments_total: Number(r.adjustments_total||0), net_salary: Number(r.net_payable||r.net_salary||0) })
  }
  return out
}

export async function generateBillingReport(org_id: string, _params: BaseParams): Promise<BillingRow[]|string> {
  if (!isSupabaseConfigured()) return 'SUPABASE_REQUIRED'
  const sb = supabaseServer()
  const { data: subs } = await sb.from('org_subscriptions').select('*').eq('org_id', org_id)
  const status = (_params as any)?.status
  const filteredSubs = (subs||[]).filter((s:any)=> !status || s.status === status)
  const planIds = Array.from(new Set((subs||[]).map((s:any)=> s.plan_id)))
  const { data: plans } = await sb.from('billing_plans').select('*').in('id', planIds)
  const planMap = new Map((plans||[]).map((p:any)=> [p.id, p]))
  const { data: org } = await sb.from('organizations').select('*').eq('id', org_id).single()
  const out: BillingRow[] = []
  for (const s of filteredSubs) {
    const plan = planMap.get(s.plan_id)
    const mrr = Number(plan?.price_per_seat||0) * Number(s.seats||0)
    out.push({ org_name: org?.org_name || '', plan_code: plan?.code || 'legacy', plan_name: plan?.name || undefined, seats: Number(s.seats||0), status: s.status, start_date: s.started_at ? new Date(s.started_at).toISOString().slice(0,10) : undefined, trial_end: s.trial_ends_at ? new Date(s.trial_ends_at).toISOString().slice(0,10) : undefined, cancelled_date: s.cancelled_at ? new Date(s.cancelled_at).toISOString().slice(0,10) : undefined, mrr })
  }
  return out
}

export async function generateLeaveReport(org_id: string, params: BaseParams): Promise<LeaveRow[]|string> {
  if (!isSupabaseConfigured()) return 'SUPABASE_REQUIRED'
  const sb = supabaseServer()
  const users = await listUsers(org_id)
  const deps = await listDepartments(org_id)
  const depMap = new Map(deps.map(d => [d.id, d.name]))
  const userMap = new Map(users.map(u => [u.id, u]))
  let memberIds = users.map(u => u.id)
  if (params.member_ids && params.member_ids.length) memberIds = memberIds.filter(id => params.member_ids!.includes(id))
  if (params.department_ids && params.department_ids.length) memberIds = memberIds.filter(id => {
    const u = userMap.get(id)
    return u?.departmentId && params.department_ids!.includes(u.departmentId)
  })
  if (params.manager_id) {
    const team = await listTeamMemberIds(org_id, params.manager_id)
    memberIds = memberIds.filter(id => team.includes(id))
  }
  if (params.member_role_ids && params.member_role_ids.length) {
    memberIds = memberIds.filter(id => {
      const u = userMap.get(id)
      return u?.memberRoleId && params.member_role_ids!.includes(u.memberRoleId)
    })
  }
  let q = sb.from('leave_requests').select('*').eq('org_id', org_id).in('member_id', memberIds).gte('start_date', params.date_start).lte('end_date', params.date_end)
  const st = (params as any)?.status
  if (st) q = q.eq('status', st)
  const { data: reqs } = await q
  const typeIds = Array.from(new Set((reqs||[]).map((r:any)=> r.leave_type_id).filter(Boolean)))
  const { data: types } = await sb.from('leave_types').select('*').in('id', typeIds)
  const typeMap = new Map((types||[]).map((t:any)=> [t.id, t.name]))
  const out: LeaveRow[] = []
  for (const r of (reqs||[])) {
    const u = userMap.get(r.member_id)
    if (!u) continue
    const start = r.start_date
    const end = r.end_date
    const days = Math.max(0, Math.round((new Date(end).getTime() - new Date(start).getTime()) / (24*60*60*1000))) + 1
    out.push({ org: org_id, department: u.departmentId ? (depMap.get(u.departmentId)||'') : '', member: `${u.firstName} ${u.lastName}`.trim(), leave_type: typeMap.get(r.leave_type_id) || r.leave_type_id || '', start_date: start, end_date: end, days_count: days, status: r.status, paid: !!r.is_paid })
  }
  return out
}

export function toCSV<T extends Record<string, any>>(rows: T[], headers?: string[]): string {
  const cols = headers && headers.length ? headers : (rows[0] ? Object.keys(rows[0]) : [])
  const esc = (v: any) => {
    const s = v === null || v === undefined ? '' : String(v)
    if (s.includes(',') || s.includes('\n') || s.includes('"')) return '"' + s.replace(/"/g,'""') + '"'
    return s
  }
  const lines = [ cols.join(',') ]
  for (const r of rows) lines.push(cols.map(c => esc(r[c])).join(','))
  return lines.join('\n')
}

export async function generateReport(org_id: string, report_type: ReportType, params: any): Promise<{ rows: any[], headers: string[] }|string> {
  if (report_type === 'attendance') {
    const rows = await generateAttendanceReport(org_id, params)
    if (typeof rows === 'string') return rows
    const headers = ['org','department','member','date','first_check_in','last_check_out','worked_minutes','extra_minutes','short_minutes','status']
    return { rows, headers }
  }
  if (report_type === 'timesheet') {
    const rows = await generateTimesheetReport(org_id, params)
    if (typeof rows === 'string') return rows
    const headers = ['org','department','member','date','session_start','session_end','session_minutes','breaks_minutes','daily_total_minutes']
    return { rows, headers }
  }
  if (report_type === 'activity') {
    const rows = await generateActivityReport(org_id, params)
    if (typeof rows === 'string') return rows
    const headers = ['org','department','member','date','active_minutes','idle_minutes','top_apps','top_urls','screenshots_count','activity_score']
    return { rows, headers }
  }
  if (report_type === 'payroll') {
    const rows = await generatePayrollReport(org_id, params)
    if (typeof rows === 'string') return rows
    const headers = ['org','department','member','period','base_salary','worked_minutes','extra_minutes','short_minutes','fines_total','adjustments_total','net_salary']
    return { rows, headers }
  }
  if (report_type === 'billing') {
    const rows = await generateBillingReport(org_id, params)
    if (typeof rows === 'string') return rows
    const headers = ['org_name','plan_code','plan_name','seats','status','start_date','trial_end','cancelled_date','mrr']
    return { rows, headers }
  }
  if (report_type === 'leave') {
    const rows = await generateLeaveReport(org_id, params)
    if (typeof rows === 'string') return rows
    const headers = ['org','department','member','leave_type','start_date','end_date','days_count','status','paid']
    return { rows, headers }
  }
  return 'REPORT_TYPE_NOT_SUPPORTED'
}

export function reportTemplates() {
  return {
    reports: [
      { type:'attendance', label:'Attendance Summary', fields:['org','department','member','date','first_check_in','last_check_out','worked_minutes','extra_minutes','short_minutes','status'] },
      { type:'timesheet', label:'Detailed Timesheet', fields:['org','department','member','date','session_start','session_end','session_minutes','breaks_minutes','daily_total_minutes'] },
      { type:'activity', label:'Activity Productivity', fields:['org','department','member','date','active_minutes','idle_minutes','top_apps','top_urls','screenshots_count','activity_score'] },
      { type:'payroll', label:'Payroll Summary', fields:['org','department','member','period','base_salary','worked_minutes','extra_minutes','short_minutes','fines_total','adjustments_total','net_salary'] },
      { type:'billing', label:'Billing / Subscription', fields:['org_name','plan_code','plan_name','seats','status','start_date','trial_end','cancelled_date','mrr'] },
      { type:'leave', label:'Leave Requests', fields:['org','department','member','leave_type','start_date','end_date','days_count','status','paid'] },
    ]
  }
}
