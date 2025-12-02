import { NextRequest, NextResponse } from 'next/server'
import { isSupabaseConfigured, supabaseServer } from '@lib/supabase'
import { listDailyLogs } from '@lib/db'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const orgId = searchParams.get('org_id') || searchParams.get('orgId') || ''
  const start = searchParams.get('start') || ''
  const end = searchParams.get('end') || ''
  if (!orgId || !start || !end) return NextResponse.json({ error: 'MISSING_FIELDS' }, { status: 400 })

  const sb = isSupabaseConfigured() ? supabaseServer() : null
  const points: { date: string, totalWorkedMinutes: number, payrollCost: number }[] = []

  if (sb) {
    const { data: rows } = await sb.from('daily_time_summaries').select('date, worked_minutes').eq('org_id', orgId).gte('date', start).lte('date', end)
    const byDate = new Map<string, number>()
    for (const r of (rows || []) as any[]) {
      const d = r.date
      byDate.set(d, (byDate.get(d) || 0) + Number(r.worked_minutes || 0))
    }
    const sorted = Array.from(byDate.entries()).sort((a,b)=>a[0].localeCompare(b[0]))
    for (const [d, w] of sorted) points.push({ date: d, totalWorkedMinutes: w, payrollCost: 0 })
  } else {
    const days: string[] = []
    for (let d = new Date(start + 'T00:00:00'); d <= new Date(end + 'T00:00:00'); d = new Date(d.getTime() + 24*60*60*1000)) {
      days.push(d.toISOString().slice(0,10))
    }
    for (const day of days) {
      const { summaries } = await listDailyLogs({ orgId, date: day })
      const worked = (summaries || []).reduce((s: number, r: any) => s + Number(r.workedMinutes || 0), 0)
      points.push({ date: day, totalWorkedMinutes: worked, payrollCost: 0 })
    }
  }

  return NextResponse.json({ points })
}
