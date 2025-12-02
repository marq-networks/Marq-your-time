import { NextRequest, NextResponse } from 'next/server'
import { isSupabaseConfigured, supabaseServer } from '@lib/supabase'
import { listOrganizations } from '@lib/db'

function dateISO(d: Date) { return d.toISOString().slice(0,10) }

export async function GET(req: NextRequest) {
  const role = req.headers.get('x-role') || ''
  if (role !== 'super_admin') return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const start = searchParams.get('start') || ''
  const end = searchParams.get('end') || ''
  const sb = isSupabaseConfigured() ? supabaseServer() : null
  const orgs = await listOrganizations()
  const points: { date: string, tracked_hours: number, active_members: number, active_seats: number }[] = []

  const days: string[] = []
  const s = start || dateISO(new Date(new Date().getTime() - 29*24*60*60*1000))
  const e = end || dateISO(new Date())
  for (let d = new Date(s + 'T00:00:00'); d <= new Date(e + 'T00:00:00'); d = new Date(d.getTime() + 24*60*60*1000)) days.push(dateISO(d))

  for (const day of days) {
    let trackedMinutes = 0
    const activeMembersSet = new Set<string>()
    let seats = 0
    seats = orgs.reduce((s, o) => s + (o.usedSeats || 0), 0)
    if (sb) {
      for (const org of orgs) {
        const { data } = await sb.from('daily_time_summaries').select('member_id, worked_minutes').eq('org_id', org.id).eq('date', day)
        for (const r of (data || []) as any[]) {
          trackedMinutes += Number(r.worked_minutes || 0)
          if (Number(r.worked_minutes || 0) > 0) activeMembersSet.add(String(r.member_id))
        }
      }
    } else {
      // memory mode not globally accessible for daily summaries; return zeros
    }
    points.push({ date: day, tracked_hours: Math.round(trackedMinutes/60), active_members: activeMembersSet.size, active_seats: seats })
  }

  return NextResponse.json({ points })
}

