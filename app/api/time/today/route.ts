import { NextRequest, NextResponse } from 'next/server'
import { getTodaySummary, getUser, isOrgHoliday, getOpenSession } from '@lib/db'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const memberId = searchParams.get('member_id') || searchParams.get('memberId') || ''
  const orgId = searchParams.get('org_id') || searchParams.get('orgId') || ''
  if (!memberId || !orgId) return NextResponse.json({ error: 'MISSING_FIELDS' }, { status: 400 })
  const summary = await getTodaySummary({ memberId, orgId })
  const openSess = await getOpenSession(memberId, orgId)
  const user = await getUser(memberId)
  const today = new Date().toISOString().slice(0,10)
  const dayName = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][new Date(today + 'T00:00:00').getDay()]
  const scheduled = user && Array.isArray(user.workingDays) && user.workingDays.includes(dayName) ? (user.workingHoursPerDay || 0) * 60 : 0
  const worked = (summary.sessions || []).reduce((s: number, r: any) => s + Number(r.totalMinutes || 0), 0)
  const unpaidBreak = (summary.breaks || []).filter((b: any) => !b.isPaid).reduce((s: number, b: any) => s + Number(b.totalMinutes || 0), 0)
  const workedMinusUnpaid = Math.max(0, worked - unpaidBreak)
  let status: 'normal'|'extra'|'short'|'absent'|'unconfigured' = 'normal'
  if (scheduled === 0) status = workedMinusUnpaid > 0 ? 'normal' : 'unconfigured'
  else if (workedMinusUnpaid === 0) status = 'absent'
  else if (workedMinusUnpaid > scheduled) status = 'extra'
  else if (workedMinusUnpaid < scheduled) status = 'short'
  const is_holiday = await isOrgHoliday(orgId, new Date(today + 'T00:00:00'))
  if (is_holiday && status === 'absent') status = 'unconfigured'
  const out = {
    today_hours: summary.worked,
    extra_time: summary.extra,
    short_time: summary.short,
    status,
    is_holiday,
    session_open: !!openSess,
    break_open: !!openSess?.currentBreak,
    current_session_id: openSess?.id,
    current_break_id: openSess?.currentBreak?.id,
    sessions: summary.sessions,
    breaks: summary.breaks
  }
  return NextResponse.json(out)
}
