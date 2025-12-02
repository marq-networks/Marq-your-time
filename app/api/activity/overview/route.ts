import { NextRequest, NextResponse } from 'next/server'
import { listUsers, listDepartments, listDailyLogs } from '@lib/db'
import { supabaseServer, isSupabaseConfigured } from '@lib/supabase'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const orgId = searchParams.get('org_id') || ''
  const date = searchParams.get('date') || new Date().toISOString().slice(0,10)
  const departmentId = searchParams.get('department_id') || undefined
  const memberId = searchParams.get('member_id') || undefined
  if (!orgId) return NextResponse.json({ error: 'MISSING_FIELDS' }, { status: 400 })
  const { summaries } = await listDailyLogs({ orgId, date, memberId: memberId || undefined })
  const users = await listUsers(orgId)
  const departments = await listDepartments(orgId)
  const deptMap = new Map(departments.map(d => [d.id, d.name]))
  const userMap = new Map(users.map(u => [u.id, u]))
  const filteredUserIds = departmentId ? users.filter(u => u.departmentId === departmentId).map(u => u.id) : undefined
  const sb = isSupabaseConfigured() ? supabaseServer() : null
  let eventsAgg: Map<string, { active: number, productive: number, unproductive: number, idle: number, screenshots: number }> = new Map()
  if (sb) {
    const { data: sessRows } = await sb!.from('time_sessions').select('id, member_id').eq('org_id', orgId).eq('date', date)
    const byMember = new Map<string, string[]>(sessRows?.reduce((acc: any, r: any) => { (acc[r.member_id] = acc[r.member_id] || []).push(r.id); return acc }, {}) || {})
    const memberIds = filteredUserIds ? filteredUserIds : Array.from(byMember.keys())
    const { data: tsRows } = await sb!.from('tracking_sessions').select('id, member_id').in('time_session_id', (sessRows || []).map((r: any) => r.id))
    const tsByMember = new Map<string, string[]>(tsRows?.reduce((acc: any, r: any) => { (acc[r.member_id] = acc[r.member_id] || []).push(r.id); return acc }, {}) || {})
    const allTsIds = Array.from(tsByMember.values()).flat()
    const { data: evRows } = allTsIds.length ? await sb!.from('activity_events').select('*').in('tracking_session_id', allTsIds) : { data: [] }
    const { data: scRows } = allTsIds.length ? await sb!.from('screenshots').select('*').in('tracking_session_id', allTsIds) : { data: [] }
    for (const mId of memberIds) {
      const tsIds = tsByMember.get(mId) || []
      const events = (evRows || []).filter((e: any) => tsIds.includes(e.tracking_session_id))
      const shots = (scRows || []).filter((s: any) => tsIds.includes(s.tracking_session_id))
      let active = 0, productive = 0, unproductive = 0, idle = 0
      for (const e of events) {
        if (e.is_active) active += 1; else idle += 1
        if (e.category === 'productive') productive += 1
        if (e.category === 'unproductive') unproductive += 1
      }
      eventsAgg.set(mId, { active, productive, unproductive, idle, screenshots: (shots || []).length })
    }
  }
  const rows = (summaries || []).filter(s => (filteredUserIds ? filteredUserIds.includes(s.memberId) : true)).map(s => {
    const u = userMap.get(s.memberId)!
    const a = eventsAgg.get(s.memberId) || { active: 0, productive: 0, unproductive: 0, idle: 0, screenshots: 0 }
    return {
      memberId: s.memberId,
      memberName: `${u.firstName} ${u.lastName}`,
      departmentName: deptMap.get(u.departmentId || '') || '',
      date,
      workedHours: s.workedMinutes,
      trackedActiveMinutes: a.active,
      productiveMinutes: a.productive,
      unproductiveMinutes: a.unproductive,
      idleMinutes: a.idle,
      screenshots: a.screenshots,
      status: s.status
    }
  })
  const totals = rows.reduce((acc, r) => { acc.tracked += r.trackedActiveMinutes; acc.productive += r.productiveMinutes; acc.unproductive += r.unproductiveMinutes; acc.idle += r.idleMinutes; acc.screenshots += r.screenshots; return acc }, { tracked: 0, productive: 0, unproductive: 0, idle: 0, screenshots: 0 })
  return NextResponse.json({ items: rows, totals })
}

