import { NextRequest, NextResponse } from 'next/server'
import { isSupabaseConfigured, supabaseServer } from '@lib/supabase'
import { listOrganizations } from '@lib/db'
import { checkPermission } from '@lib/permissions'
import { generateProductivityInsights } from '@lib/insights/generateProductivityInsights'

function dateISO(d: Date) { return d.toISOString().slice(0,10) }
function addDays(s: string, n: number) { const d = new Date(s + 'T00:00:00'); d.setDate(d.getDate() + n); return dateISO(d) }

function rangeFromQuick(key: string) {
  const today = dateISO(new Date())
  if (key === 'last_7_days') return { start: addDays(today, -6), end: today }
  if (key === 'last_14_days') return { start: addDays(today, -13), end: today }
  if (key === 'last_30_days') return { start: addDays(today, -29), end: today }
  return { start: today, end: today }
}

export async function POST(req: NextRequest) {
  const actor = req.headers.get('x-user-id') || ''
  const allowed = actor ? await checkPermission(actor, 'manage_reports') : true
  if (!allowed) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
  const sb = isSupabaseConfigured() ? supabaseServer() : null
  if (!sb) return NextResponse.json({ error: 'SUPABASE_REQUIRED' }, { status: 400 })

  const body = await req.json().catch(()=>({}))
  const org_id = body.org_id || body.orgId || ''
  const rangeKey = body.range || ''
  const date_start = body.date_start || body.dateStart || ''
  const date_end = body.date_end || body.dateEnd || ''

  let start = date_start
  let end = date_end
  if (!start || !end) {
    const r = rangeFromQuick(rangeKey || 'last_7_days')
    start = r.start
    end = r.end
  }
  const days: string[] = []
  for (let d = start; d <= end; d = addDays(d, 1)) days.push(d)

  const orgs = org_id ? [{ id: org_id }] : await listOrganizations()
  const results: any[] = []
  for (const org of orgs as any[]) {
    let totalInserted = 0
    for (const day of days) {
      const res = await generateProductivityInsights(org.id, day)
      totalInserted += Number((res as any)?.inserted || 0)
    }
    results.push({ org_id: org.id, inserted: totalInserted })
  }

  return NextResponse.json({ success: true, range: { start, end }, results })
}

