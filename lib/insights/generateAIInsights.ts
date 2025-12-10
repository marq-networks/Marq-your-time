import { isSupabaseConfigured, supabaseServer } from '@lib/supabase'
import { createAIInsightSnapshot } from '@lib/db'

type Range = { start: string, end: string }

function dateISO(d: Date) { return d.toISOString().slice(0,10) }
function addDays(s: string, n: number) { const d = new Date(s + 'T00:00:00'); d.setDate(d.getDate() + n); return dateISO(d) }

async function summarizeForOrg(orgId: string, range: Range) {
  const sb = isSupabaseConfigured() ? supabaseServer() : null
  if (!sb) return { summary: '', metadata: {} }
  const { data: daily } = await sb.from('daily_time_summaries').select('*').eq('org_id', orgId).gte('date', range.start).lte('date', range.end)
  const { data: leaves } = await sb.from('leave_requests').select('*').eq('org_id', orgId).gte('start_date', range.start).lte('end_date', range.end)
  const { data: tickets } = await sb.from('support_tickets').select('*').eq('org_id', orgId).gte('created_at', new Date(range.start + 'T00:00:00')).lte('created_at', new Date(range.end + 'T23:59:59'))
  const { data: checkins } = await sb.from('performance_checkins').select('*').eq('org_id', orgId).gte('period_start', range.start).lte('period_end', range.end)

  const totalDays = new Set((daily||[]).map((d:any)=> d.date)).size
  const members = new Set((daily||[]).map((d:any)=> String(d.member_id))).size
  const worked = (daily||[]).reduce((s:any,d:any)=> s + Number(d.worked_minutes||0), 0)
  const extra = (daily||[]).reduce((s:any,d:any)=> s + Number(d.extra_minutes||0), 0)
  const short = (daily||[]).reduce((s:any,d:any)=> s + Number(d.short_minutes||0), 0)
  const absent = (daily||[]).filter((d:any)=> d.status === 'absent').length
  const overtimeStreaks = new Map<string, number>()
  ;(daily||[]).forEach((d:any)=> { if (Number(d.extra_minutes||0) >= 60) overtimeStreaks.set(String(d.member_id), (overtimeStreaks.get(String(d.member_id))||0)+1) })
  const highOvertime = Array.from(overtimeStreaks.entries()).filter(([_,v])=> v >= 3).length

  const leaveCount = (leaves||[]).length
  const ticketsOpen = (tickets||[]).filter((t:any)=> String(t.status) === 'open' || String(t.status) === 'in_progress').length
  const ticketsResolved = (tickets||[]).filter((t:any)=> String(t.status) === 'resolved' || String(t.status) === 'closed').length
  const perfAvgSelf = Math.round(((checkins||[]).reduce((s:any,c:any)=> s + Number(c.self_score||0), 0)) / Math.max(1,(checkins||[]).length))
  const perfAvgMgr = Math.round(((checkins||[]).reduce((s:any,c:any)=> s + Number(c.manager_score||0), 0)) / Math.max(1,(checkins||[]).length))

  const issues: string[] = []
  const suggestions: string[] = []
  if (highOvertime > 0) issues.push(`Consistent overtime observed for ${highOvertime} members.`)
  if (absent > members) issues.push(`Absences higher than normal with ${absent} absence-days.`)
  if (ticketsOpen > ticketsResolved) issues.push(`Support backlog trending up (${ticketsOpen} open vs ${ticketsResolved} resolved).`)
  if ((checkins||[]).length > 0 && perfAvgMgr < perfAvgSelf) issues.push(`Manager scores lower than self-reported scores can indicate alignment gaps.`)

  if (highOvertime > 0) suggestions.push('Review shift assignments or workload distribution for teams with overtime streaks.')
  if (absent > members) suggestions.push('Check scheduling conflicts and upcoming leave to stabilize attendance.')
  if (ticketsOpen > ticketsResolved) suggestions.push('Reprioritize ticket triage and assign owners to aged tickets.')
  if ((checkins||[]).length > 0 && perfAvgMgr < perfAvgSelf) suggestions.push('Encourage brief manager-member check-ins to align expectations.')

  const summaryParts = []
  summaryParts.push(`Period ${range.start} → ${range.end}. Members ${members}, days ${totalDays}. Worked ${Math.round(worked/60)}h, extra ${Math.round(extra/60)}h, short ${Math.round(short/60)}h.`)
  if (issues.length) summaryParts.push(issues.join(' '))
  if (suggestions.length) summaryParts.push('Suggestions: ' + suggestions.join(' '))
  const summary = summaryParts.join(' ')
  const metadata = { totals: { members, days: totalDays, worked_minutes: worked, extra_minutes: extra, short_minutes: short, absences: absent }, overtime_streak_members: highOvertime, leaves: leaveCount, tickets: { open: ticketsOpen, resolved: ticketsResolved }, performance: { avg_self: perfAvgSelf, avg_manager: perfAvgMgr } }
  return { summary, metadata }
}

async function summarizeForDepartment(orgId: string, departmentId: string, range: Range) {
  const sb = isSupabaseConfigured() ? supabaseServer() : null
  if (!sb) return { summary: '', metadata: {} }
  const { data: users } = await sb.from('users').select('id').eq('org_id', orgId).eq('department_id', departmentId)
  const ids = (users||[]).map((u:any)=> String(u.id))
  if (ids.length === 0) return { summary: 'No members in department.', metadata: {} }
  const { data: daily } = await sb.from('daily_time_summaries').select('*').eq('org_id', orgId).in('member_id', ids).gte('date', range.start).lte('date', range.end)
  const { data: tickets } = await sb.from('support_tickets').select('*').eq('org_id', orgId).gte('created_at', new Date(range.start + 'T00:00:00')).lte('created_at', new Date(range.end + 'T23:59:59')).in('created_by_user_id', ids)
  const worked = (daily||[]).reduce((s:any,d:any)=> s + Number(d.worked_minutes||0), 0)
  const extra = (daily||[]).reduce((s:any,d:any)=> s + Number(d.extra_minutes||0), 0)
  const absent = (daily||[]).filter((d:any)=> d.status === 'absent').length
  const ticketsOpen = (tickets||[]).filter((t:any)=> String(t.status) !== 'resolved' && String(t.status) !== 'closed').length
  const issues: string[] = []
  const suggestions: string[] = []
  if (extra > Math.round(worked*0.2)) issues.push('Overtime proportion notable.')
  if (absent > ids.length) issues.push('Absences elevated.')
  if (ticketsOpen > 0) suggestions.push('Assign ticket owners and plan daily standups to clear blockers.')
  const summary = [`Dept ${departmentId} period ${range.start} → ${range.end}. Members ${ids.length}. Worked ${Math.round(worked/60)}h, extra ${Math.round(extra/60)}h.`, issues.join(' '), suggestions.length ? 'Suggestions: '+suggestions.join(' ') : ''].join(' ').trim()
  const metadata = { totals: { members: ids.length, worked_minutes: worked, extra_minutes: extra, absences: absent }, tickets_open: ticketsOpen }
  return { summary, metadata }
}

async function summarizeForMember(orgId: string, memberId: string, range: Range) {
  const sb = isSupabaseConfigured() ? supabaseServer() : null
  if (!sb) return { summary: '', metadata: {} }
  const { data: daily } = await sb.from('daily_time_summaries').select('*').eq('org_id', orgId).eq('member_id', memberId).gte('date', range.start).lte('date', range.end)
  const { data: leaves } = await sb.from('leave_requests').select('*').eq('org_id', orgId).eq('member_id', memberId).gte('start_date', range.start).lte('end_date', range.end)
  const worked = (daily||[]).reduce((s:any,d:any)=> s + Number(d.worked_minutes||0), 0)
  const extra = (daily||[]).reduce((s:any,d:any)=> s + Number(d.extra_minutes||0), 0)
  const short = (daily||[]).reduce((s:any,d:any)=> s + Number(d.short_minutes||0), 0)
  const absent = (daily||[]).filter((d:any)=> d.status === 'absent').length
  const issues: string[] = []
  const suggestions: string[] = []
  if (extra >= 3*60) issues.push('Repeated extra time detected.')
  if (absent > 1) issues.push('Attendance variability observed.')
  if (extra >= 3*60) suggestions.push('Consider scheduling lighter days after high-hour days.')
  if (short >= 120) suggestions.push('Try a focused block next day to regain momentum.')
  const summary = [`Member ${memberId} period ${range.start} → ${range.end}. Worked ${Math.round(worked/60)}h, extra ${Math.round(extra/60)}h, short ${Math.round(short/60)}h.`, issues.join(' '), suggestions.length ? 'Suggestions: '+suggestions.join(' ') : ''].join(' ').trim()
  const metadata = { totals: { worked_minutes: worked, extra_minutes: extra, short_minutes: short, absences: absent }, leaves: (leaves||[]).length }
  return { summary, metadata }
}

export async function generateOrgInsights(orgId: string, start: string, end: string) {
  const sb = isSupabaseConfigured() ? supabaseServer() : null
  if (!sb) return { inserted: 0 }
  const range = { start, end }
  const { summary, metadata } = await summarizeForOrg(orgId, range)
  await createAIInsightSnapshot({ orgId, targetType: 'org', snapshotDate: end, summary, metadata })
  return { inserted: 1 }
}

export async function generateDepartmentInsights(orgId: string, departmentId: string, start: string, end: string) {
  const sb = isSupabaseConfigured() ? supabaseServer() : null
  if (!sb) return { inserted: 0 }
  const range = { start, end }
  const { summary, metadata } = await summarizeForDepartment(orgId, departmentId, range)
  await createAIInsightSnapshot({ orgId, targetType: 'department', targetId: departmentId, snapshotDate: end, summary, metadata })
  return { inserted: 1 }
}

export async function generateMemberInsights(orgId: string, memberId: string, start: string, end: string) {
  const sb = isSupabaseConfigured() ? supabaseServer() : null
  if (!sb) return { inserted: 0 }
  const range = { start, end }
  const { summary, metadata } = await summarizeForMember(orgId, memberId, range)
  await createAIInsightSnapshot({ orgId, targetType: 'member', targetId: memberId, snapshotDate: end, summary, metadata })
  return { inserted: 1 }
}
