import { NextRequest, NextResponse } from 'next/server'
import { isSupabaseConfigured, supabaseServer } from '@lib/supabase'
import { listDepartments, listUsers, listDailyLogs } from '@lib/db'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const orgId = searchParams.get('org_id') || searchParams.get('orgId') || ''
  const start = searchParams.get('start') || ''
  const end = searchParams.get('end') || ''
  if (!orgId || !start || !end) return NextResponse.json({ error: 'MISSING_FIELDS' }, { status: 400 })

  const sb = isSupabaseConfigured() ? supabaseServer() : null
  const departments = await listDepartments(orgId)
  const users = await listUsers(orgId)

  const items: any[] = []
  if (sb) {
    const { data: daily } = await sb.from('daily_time_summaries').select('*').eq('org_id', orgId).gte('date', start).lte('date', end)
    const { data: sessRows } = await sb.from('time_sessions').select('id, member_id').eq('org_id', orgId).gte('date', start).lte('date', end)
    const { data: tsRows } = await sb.from('tracking_sessions').select('id, member_id').in('time_session_id', (sessRows || []).map((r: any) => r.id))
    const { data: evRows } = await sb.from('activity_events').select('tracking_session_id, category').in('tracking_session_id', (tsRows || []).map((r: any) => r.id))
    const tsByMember = new Map<string, string[]>(((tsRows || []) as any[]).reduce((acc: any, r: any) => { (acc[r.member_id] = acc[r.member_id] || []).push(r.id); return acc }, {}))

    for (const d of departments) {
      const memberIds = users.filter(u => u.departmentId === d.id).map(u => u.id)
      const dSumm = (daily || []).filter((r: any) => memberIds.includes(r.member_id))
      const workedMinutes = dSumm.reduce((s: number, r: any) => s + Number(r.worked_minutes || 0), 0)
      const extraMinutes = dSumm.reduce((s: number, r: any) => s + Number(r.extra_minutes || 0), 0)
      const shortMinutes = dSumm.reduce((s: number, r: any) => s + Number(r.short_minutes || 0), 0)
      const tsIds = memberIds.flatMap(m => tsByMember.get(m) || [])
      const evs = (evRows || []).filter((e: any) => tsIds.includes(e.tracking_session_id))
      const productive = evs.filter(e => e.category === 'productive').length
      const unproductive = evs.filter(e => e.category === 'unproductive').length
      const score = (productive + unproductive) > 0 ? Math.round((productive / (productive + unproductive)) * 100) : 0
      items.push({
        department_id: d.id,
        department_name: d.name,
        members_count: memberIds.length,
        worked_minutes: workedMinutes,
        extra_minutes: extraMinutes,
        short_minutes: shortMinutes,
        productivity_score: score
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
    for (const d of departments) {
      const memberIds = users.filter(u => u.departmentId === d.id).map(u => u.id)
      const dSumm = perDaySummaries.filter((r: any) => memberIds.includes(r.memberId))
      const workedMinutes = dSumm.reduce((s: number, r: any) => s + Number(r.workedMinutes || 0), 0)
      const extraMinutes = dSumm.reduce((s: number, r: any) => s + Number(r.extraMinutes || 0), 0)
      const shortMinutes = dSumm.reduce((s: number, r: any) => s + Number(r.shortMinutes || 0), 0)
      const score = 0
      items.push({
        department_id: d.id,
        department_name: d.name,
        members_count: memberIds.length,
        worked_minutes: workedMinutes,
        extra_minutes: extraMinutes,
        short_minutes: shortMinutes,
        productivity_score: score
      })
    }
  }

  return NextResponse.json({ items })
}
