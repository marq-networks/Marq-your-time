import { NextRequest, NextResponse } from 'next/server'
import { isSupabaseConfigured, supabaseServer } from '@lib/supabase'
import { listAllOrgMembers, listDepartments, listDailyLogs } from '@lib/db'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const orgId = searchParams.get('org_id') || searchParams.get('orgId') || ''
  const start = searchParams.get('start') || ''
  const end = searchParams.get('end') || ''
  const sort = (searchParams.get('sort') || 'worked').toLowerCase()
  const departmentId = searchParams.get('department') || searchParams.get('department_id') || ''
  if (!orgId || !start || !end) return NextResponse.json({ error: 'MISSING_FIELDS' }, { status: 400 })

  const sb = isSupabaseConfigured() ? supabaseServer() : null
  const users = await listAllOrgMembers(orgId)
  const departments = await listDepartments(orgId)
  const deptMap = new Map(departments.map(d => [d.id, d.name]))
  const filteredUsers = departmentId ? users.filter(u => u.departmentId === departmentId) : users

  let items: any[] = []
  if (sb) {
    const memberIds = filteredUsers.map(u => u.id)
    const { data: daily } = await sb.from('daily_time_summaries').select('*').eq('org_id', orgId).gte('date', start).lte('date', end)
    const { data: sessRows } = await sb.from('time_sessions').select('id, member_id').eq('org_id', orgId).gte('date', start).lte('date', end)
    const { data: tsRows } = await sb.from('tracking_sessions').select('id, member_id').in('time_session_id', (sessRows || []).map((r: any) => r.id))
    const { data: evRows } = await sb.from('activity_events').select('tracking_session_id, category, is_active, timestamp').in('tracking_session_id', (tsRows || []).map((r: any) => r.id))
    const tsByMember = new Map<string, string[]>(((tsRows || []) as any[]).reduce((acc: any, r: any) => { (acc[r.member_id] = acc[r.member_id] || []).push(r.id); return acc }, {}))

    // Calculate open session minutes per member
    const { data: openSessions } = await sb.from('time_sessions').select('id, member_id, start_time').eq('org_id', orgId).gte('date', start).lte('date', end).is('end_time', null)
    const openMinutesByMember = new Map<string, number>()
    if (openSessions && openSessions.length > 0) {
        const ids = openSessions.map((s:any) => s.id)
        const { data: breaks } = await sb.from('break_sessions').select('time_session_id, start_time, end_time, total_minutes, is_paid').in('time_session_id', ids)
        const now = Date.now()
        for (const s of openSessions) {
            const sBreaks = (breaks || []).filter((b:any) => b.time_session_id === s.id)
            const startMs = new Date(s.start_time).getTime()
            const totalMs = Math.max(0, now - startMs)
            let unpaidBreakMs = 0
            for (const b of sBreaks) {
                if (!b.is_paid) {
                    if (b.end_time) unpaidBreakMs += (Number(b.total_minutes || 0) * 60000)
                    else unpaidBreakMs += Math.max(0, now - new Date(b.start_time).getTime())
                }
            }
            const mins = Math.max(0, totalMs - unpaidBreakMs) / 60000
            openMinutesByMember.set(s.member_id, (openMinutesByMember.get(s.member_id) || 0) + mins)
        }
    }

    for (const u of filteredUsers) {
      const dSumm = (daily || []).filter((r: any) => r.member_id === u.id)
      const worked = dSumm.reduce((s: number, r: any) => s + Number(r.worked_minutes || 0), 0) + (openMinutesByMember.get(u.id) || 0)
      const extra = dSumm.reduce((s: number, r: any) => s + Number(r.extra_minutes || 0), 0)
      const short = dSumm.reduce((s: number, r: any) => s + Number(r.short_minutes || 0), 0)
      const tsIds = tsByMember.get(u.id) || []
      const rawEvs = (evRows || []).filter((e: any) => tsIds.includes(e.tracking_session_id))
      
      const uniqueEventsMap = new Map<string, any>()
      for (const e of rawEvs) {
        const d = new Date(e.timestamp)
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
      const evs = Array.from(uniqueEventsMap.values())
      
      const productive = evs.filter(e => e.category === 'productive').length
      const unproductive = evs.filter(e => e.category === 'unproductive').length
      const productivity = (productive + unproductive) > 0 ? Math.round((productive / (productive + unproductive)) * 100) : 0
      items.push({
        id: u.id,
        name: `${u.firstName} ${u.lastName}`.trim(),
        dept: deptMap.get(u.departmentId || '') || '',
        worked_minutes: worked,
        extra_minutes: extra,
        short_minutes: short,
        productivity,
        net_pay: 0
      })
    }
  } else {
    const days: string[] = []
    for (let d = new Date(start + 'T00:00:00'); d <= new Date(end + 'T00:00:00'); d = new Date(d.getTime() + 24*60*60*1000)) {
      days.push(d.toISOString().slice(0,10))
    }
    const perDaySummaries: any[] = []
    for (const day of days) {
      const { summaries } = await listDailyLogs({ orgId, date: day })
      perDaySummaries.push(...(summaries || []))
    }
    for (const u of filteredUsers) {
      const dSumm = perDaySummaries.filter((r: any) => r.memberId === u.id)
      const worked = dSumm.reduce((s: number, r: any) => s + Number(r.workedMinutes || 0), 0)
      const extra = dSumm.reduce((s: number, r: any) => s + Number(r.extraMinutes || 0), 0)
      const short = dSumm.reduce((s: number, r: any) => s + Number(r.shortMinutes || 0), 0)
      const productivity = 0
      items.push({
        id: u.id,
        name: `${u.firstName} ${u.lastName}`.trim(),
        dept: deptMap.get(u.departmentId || '') || '',
        worked_minutes: worked,
        extra_minutes: extra,
        short_minutes: short,
        productivity,
        net_pay: 0
      })
    }
  }

  const key = sort
  items.sort((a, b) => {
    if (key === 'productivity') return (b.productivity || 0) - (a.productivity || 0)
    if (key === 'net_pay') return (b.net_pay || 0) - (a.net_pay || 0)
    return (b[`${key}_minutes`] || 0) - (a[`${key}_minutes`] || 0)
  })

  return NextResponse.json({ items })
}
