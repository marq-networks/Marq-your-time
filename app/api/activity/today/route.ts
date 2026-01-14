import { NextRequest, NextResponse } from 'next/server'
import { listActivityToday, getTodaySummary, listOrgCategoryRules } from '@lib/db'
import { getProductivityStatus } from '@lib/categorization'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const memberId = searchParams.get('member_id') || searchParams.get('memberId') || ''
  const orgId = searchParams.get('org_id') || searchParams.get('orgId') || ''
  if (!memberId || !orgId) return NextResponse.json({ error: 'MISSING_FIELDS' }, { status: 400 })
  const base = await listActivityToday(memberId, orgId)
  const time = await getTodaySummary({ memberId, orgId })
  const rules = await listOrgCategoryRules(orgId)
  const apps = aggregateTopApps(base.events || [], rules)
  return NextResponse.json({ trackingOn: base.trackingOn, trackingSessionId: base.trackingSessionId, settings: base.settings, sessions: time.sessions, breaks: time.breaks, events: base.events, topApps: apps, screenshots: base.settings.allowScreenshots ? base.screenshots : [] })
}

function aggregateTopApps(events: any[], rules: any[]) {
  // Deduplicate events by minute to prevent overcounting
  const uniqueEventsMap = new Map<string, any>()
  for (const e of events) {
      const d = new Date(e.timestamp)
      const key = `${d.toISOString().slice(0, 16)}`
      
      if (!uniqueEventsMap.has(key)) {
          uniqueEventsMap.set(key, e)
      } else {
          const existing = uniqueEventsMap.get(key)
          // Prefer Active over Idle
          if (!existing.isActive && e.isActive) {
              uniqueEventsMap.set(key, e)
          } else if (existing.isActive && e.isActive) {
               const exProd = getProductivityStatus(existing.category || '', rules)
               const newProd = getProductivityStatus(e.category || '', rules)
               if (exProd !== 'productive' && newProd === 'productive') {
                   uniqueEventsMap.set(key, e)
               }
          }
      }
  }
  const uniqueEvents = Array.from(uniqueEventsMap.values())

  const map: Record<string, { minutes: number, category?: string }> = {}
  for (const e of uniqueEvents) {
    const key = e.appName
    if (!map[key]) map[key] = { minutes: 0, category: e.category }
    if (e.isActive) map[key].minutes += 1
  }
  return Object.entries(map).map(([name, v]) => ({ app: name, minutes: v.minutes, category: v.category }))
}

