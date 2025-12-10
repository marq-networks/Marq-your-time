import { NextRequest, NextResponse } from 'next/server'
import { isSupabaseConfigured } from '@lib/supabase'
import { checkPermission } from '@lib/permissions'
import { generateOrgInsights, generateDepartmentInsights, generateMemberInsights } from '@lib/insights/generateAIInsights'

function dateISO(d: Date) { return d.toISOString().slice(0,10) }
function addDays(s: string, n: number) { const d = new Date(s + 'T00:00:00'); d.setDate(d.getDate() + n); return dateISO(d) }

export async function POST(req: NextRequest) {
  const actor = req.headers.get('x-user-id') || ''
  const allowed = actor ? await checkPermission(actor, 'manage_reports') : true
  if (!allowed) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
  if (!isSupabaseConfigured()) return NextResponse.json({ error: 'SUPABASE_REQUIRED' }, { status: 400 })

  const body = await req.json().catch(()=>({}))
  const orgId = body.org_id || body.orgId || ''
  const targetType = body.target_type || body.targetType || 'org'
  const targetId = body.target_id || body.targetId || ''
  let start = body.period_start || body.periodStart || ''
  let end = body.period_end || body.periodEnd || ''
  if (!start || !end) { const today = dateISO(new Date()); start = addDays(today, -6); end = today }
  if (!orgId) return NextResponse.json({ error: 'MISSING_ORG' }, { status: 400 })

  let res: any = { inserted: 0 }
  if (targetType === 'org') res = await generateOrgInsights(orgId, start, end)
  else if (targetType === 'department' && targetId) res = await generateDepartmentInsights(orgId, targetId, start, end)
  else if (targetType === 'member' && targetId) res = await generateMemberInsights(orgId, targetId, start, end)
  else return NextResponse.json({ error: 'INVALID_TARGET' }, { status: 400 })

  return NextResponse.json({ success: true, range: { start, end }, result: res })
}
