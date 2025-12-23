import { NextRequest, NextResponse } from 'next/server'
import { isSupabaseConfigured, supabaseServer } from '@lib/supabase'
import { listDepartments, listUsers, listDailyLogs } from '@lib/db'

export async function GET(req: NextRequest) {
  try {
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
      
      // Add real-time open session data
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

      const { data: sessRows } = await sb.from('time_sessions').select('id, member_id').eq('org_id', orgId).gte('date', start).lte('date', end)
      
      let tsRows: any[] = []
      if (sessRows && sessRows.length > 0) {
          const sIds = sessRows.map((r: any) => r.id)
          const { data } = await sb.from('tracking_sessions').select('id, member_id').in('time_session_id', sIds)
          tsRows = data || []
      }

      let evRows: any[] = []
      if (tsRows && tsRows.length > 0) {
          const tIds = tsRows.map((r: any) => r.id)
          const { data } = await sb.from('activity_events').select('tracking_session_id, category, is_active, timestamp').in('tracking_session_id', tIds)
          evRows = data || []
      }

      const tsByMember = new Map<string, string[]>(((tsRows || []) as any[]).reduce((acc: any, r: any) => { (acc[r.member_id] = acc[r.member_id] || []).push(r.id); return acc }, {}))

      for (const d of departments) {
        const memberIds = users.filter(u => u.departmentId === d.id).map(u => u.id)
        const dSumm = (daily || []).filter((r: any) => memberIds.includes(r.member_id))
        const openMinutes = memberIds.reduce((sum, mId) => sum + (openMinutesByMember.get(mId) || 0), 0)
        const workedMinutes = dSumm.reduce((s: number, r: any) => s + Number(r.worked_minutes || 0), 0) + openMinutes
        const extraMinutes = dSumm.reduce((s: number, r: any) => s + Number(r.extra_minutes || 0), 0)
        const shortMinutes = dSumm.reduce((s: number, r: any) => s + Number(r.short_minutes || 0), 0)
        const tsIds = memberIds.flatMap(m => tsByMember.get(m) || [])
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
  } catch (error) {
    console.error('Error in departments analytics:', error)
    return NextResponse.json({ error: 'INTERNAL_SERVER_ERROR' }, { status: 500 })
  }
}
