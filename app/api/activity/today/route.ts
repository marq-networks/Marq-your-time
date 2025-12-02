import { NextRequest, NextResponse } from 'next/server'
import { listActivityToday, getTodaySummary } from '@lib/db'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const memberId = searchParams.get('member_id') || searchParams.get('memberId') || ''
  const orgId = searchParams.get('org_id') || searchParams.get('orgId') || ''
  if (!memberId || !orgId) return NextResponse.json({ error: 'MISSING_FIELDS' }, { status: 400 })
  const base = await listActivityToday(memberId, orgId)
  const time = await getTodaySummary({ memberId, orgId })
  const apps = aggregateTopApps(base.events || [])
  return NextResponse.json({ trackingOn: base.trackingOn, settings: base.settings, sessions: time.sessions, breaks: time.breaks, events: base.events, topApps: apps, screenshots: base.settings.allowScreenshots ? base.screenshots : [] })
}

function aggregateTopApps(events: any[]) {
  const map: Record<string, { minutes: number, category?: string }> = {}
  for (const e of events) {
    const key = e.appName
    if (!map[key]) map[key] = { minutes: 0, category: e.category }
    if (e.isActive) map[key].minutes += 1
  }
  return Object.entries(map).map(([name, v]) => ({ app: name, minutes: v.minutes, category: v.category }))
}

