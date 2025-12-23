import { NextRequest, NextResponse } from 'next/server'
import { isSupabaseConfigured, supabaseServer } from '@lib/supabase'
import { listDailyLogs } from '@lib/db'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const orgId = searchParams.get('org_id') || searchParams.get('orgId') || ''
  const start = searchParams.get('start') || ''
  const end = searchParams.get('end') || ''
  const metric = (searchParams.get('metric') || '').toLowerCase()
  if (!orgId || !start || !end || !['worked','extra','short','attendance'].includes(metric)) return NextResponse.json({ error: 'MISSING_FIELDS' }, { status: 400 })

  try {
    const sb = isSupabaseConfigured() ? supabaseServer() : null
    let points: { date: string, value: number }[] = []

  if (sb) {
    const { data: rows } = await sb.from('daily_time_summaries').select('*').eq('org_id', orgId).gte('date', start).lte('date', end)
    
    let openMinutesByDate = new Map<string, number>()
    if (metric === 'worked') {
        const { data: openSessions } = await sb.from('time_sessions').select('id, date, start_time').eq('org_id', orgId).gte('date', start).lte('date', end).is('end_time', null)
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
                openMinutesByDate.set(s.date, (openMinutesByDate.get(s.date) || 0) + mins)
            }
        }
    }

    const byDate: Record<string, any[]> = {}
    for (const r of (rows || []) as any[]) {
      const d = r.date
      ;(byDate[d] = byDate[d] || []).push(r)
    }
    
    if (metric === 'worked') {
        for (const d of openMinutesByDate.keys()) {
            if (!byDate[d]) byDate[d] = []
        }
    }

    points = Object.entries(byDate).sort((a,b)=>a[0].localeCompare(b[0])).map(([d, arr]) => {
      if (metric === 'worked') return { date: d, value: arr.reduce((s, r) => s + Number(r.worked_minutes || 0), 0) + (openMinutesByDate.get(d) || 0) }
      if (metric === 'extra') return { date: d, value: arr.reduce((s, r) => s + Number(r.extra_minutes || 0), 0) }
      if (metric === 'short') return { date: d, value: arr.reduce((s, r) => s + Number(r.short_minutes || 0), 0) }
      const scheduled = arr.filter(r => Number(r.scheduled_minutes || 0) > 0).length
      const present = arr.filter(r => Number(r.worked_minutes || 0) > 0).length
      const rate = scheduled > 0 ? Math.round((present / scheduled) * 100) : 0
      return { date: d, value: rate }
    })
  } else {
    const days: string[] = []
    for (let d = new Date(start + 'T00:00:00'); d <= new Date(end + 'T00:00:00'); d = new Date(d.getTime() + 24*60*60*1000)) {
      days.push(d.toISOString().slice(0,10))
    }
    for (const day of days) {
      const { summaries } = await listDailyLogs({ orgId, date: day })
      const arr = summaries || []
      if (metric === 'worked') points.push({ date: day, value: arr.reduce((s: number, r: any) => s + Number(r.workedMinutes || 0), 0) })
      else if (metric === 'extra') points.push({ date: day, value: arr.reduce((s: number, r: any) => s + Number(r.extraMinutes || 0), 0) })
      else if (metric === 'short') points.push({ date: day, value: arr.reduce((s: number, r: any) => s + Number(r.shortMinutes || 0), 0) })
      else {
        const scheduled = arr.filter((r: any) => Number(r.scheduledMinutes || 0) > 0).length
        const present = arr.filter((r: any) => Number(r.workedMinutes || 0) > 0).length
        const rate = scheduled > 0 ? Math.round((present / scheduled) * 100) : 0
        points.push({ date: day, value: rate })
      }
    }
  }

  return NextResponse.json({ points })
  } catch (error) {
    console.error('Error in time-series:', error)
    return NextResponse.json({ error: 'INTERNAL_SERVER_ERROR' }, { status: 500 })
  }
}
